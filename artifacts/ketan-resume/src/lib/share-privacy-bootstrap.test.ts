import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="application-share-privacy">([\s\S]*?)<\/script>/)![1];

function boot(url: string, base = '/') {
  const location = new URL(url);
  const listeners: Record<string, () => void> = {};
  const history = {
    state: { unrelatedState: 'preserved' } as Record<string, unknown>,
    replaceState(state: Record<string, unknown>, _unused: string, next: string) {
      this.state = state;
      location.href = new URL(next, location.href).href;
    },
  };
  const window = { addEventListener(name: string, listener: () => void, capture: boolean) {
    expect(capture).toBe(true);
    listeners[name] = listener;
  } };
  runInNewContext(script.replace('%BASE_URL%', base), { location, history, window });
  return { location, history, listeners };
}

describe('share privacy before page-view analytics', () => {
  it('scrubs the fragment before third-party scripts while preserving tab reload access', () => {
    const token = 'a'.repeat(43);
    const { location, history } = boot(`https://example.com/shared#${token}`);
    expect(location.href).toBe('https://example.com/shared');
    expect(history.state.careerApplicationShareToken).toBe(token);
    expect(history.state.unrelatedState).toBe('preserved');
  });
  it('handles prefixed artifacts without stripping ordinary portfolio anchors', () => {
    expect(boot('https://example.com/career/shared#test-token', '/career/').location.hash).toBe('');
    expect(boot('https://example.com/portfolio#experience').location.hash).toBe('#experience');
  });
  it('captures later hash navigation before analytics listeners see it', () => {
    const page = boot('https://example.com/shared#first-test-token');
    page.location.hash = 'second-test-token';
    page.listeners.hashchange();
    expect(page.location.hash).toBe('');
    expect(page.history.state.careerApplicationShareToken).toBe('second-test-token');
  });
});