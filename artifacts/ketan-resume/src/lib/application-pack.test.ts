import { describe, expect, it } from 'vitest';
import { buildApplicationPackFiles, parseApplicationPack, safeSupportingUrl } from './application-pack';

const snapshot = {
  title: 'Selected application',
  resume: { title: 'Reviewed resume', content: 'ગુજરાતી અને हिंदी — exact original wording\nCGPA 7.58' },
  coverLetter: null,
  brief: 'Reviewed, concise brief.',
  links: [{ label: '<script>not executable</script>', url: 'https://example.com/?a=1&b=2' }],
  createdAt: '2026-10-02T00:00:00.000Z',
};

describe('application pack documents', () => {
  it('preserves exact Unicode text without adding claims', () => {
    const parsed = parseApplicationPack(JSON.stringify(snapshot))!;
    expect(new TextDecoder().decode(buildApplicationPackFiles(parsed)['resume.txt'])).toBe(snapshot.resume.content);
  });
  it('selects no private fields from an incoming snapshot', () => {
    const parsed = parseApplicationPack(JSON.stringify({ ...snapshot, metadata: { privateNote: 'NOT FOR SHARING' } }))!;
    expect(JSON.stringify(parsed)).not.toContain('NOT FOR SHARING');
    expect(Object.keys(buildApplicationPackFiles(parsed))).not.toContain('cover-letter.txt');
  });
  it('escapes supporting-link labels and attributes', () => {
    const html = new TextDecoder().decode(buildApplicationPackFiles(snapshot)['supporting-links.html']);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a=1&amp;b=2');
  });
  it('fails closed for corrupt snapshots and unsafe links', () => {
    expect(parseApplicationPack('broken JSON')).toBeNull();
    expect(parseApplicationPack(JSON.stringify({ ...snapshot, resume: { title: 'x', content: '' } }))).toBeNull();
    expect(safeSupportingUrl('javascript:alert(1)')).toBe(false);
    expect(safeSupportingUrl('https://name:password@example.com')).toBe(false);
    expect(parseApplicationPack(JSON.stringify({ ...snapshot, createdAt: 'not a date' }))).toBeNull();
  });
});