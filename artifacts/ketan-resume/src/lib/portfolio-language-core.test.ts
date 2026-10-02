import assert from 'node:assert/strict';
import { test } from 'vitest';
import { normalizeLanguage, preservesNumbers, resolveLanguage, withLanguageParam } from './portfolio-language-core';
import { translationEntries } from './portfolio-translations';

test('normalizes locales', () => {
  assert.equal(normalizeLanguage('HI-IN'), 'hi');
  assert.equal(normalizeLanguage('gu'), 'gu');
  assert.equal(normalizeLanguage('fr'), null);
});

test('URL wins over storage, English default', () => {
  assert.equal(resolveLanguage('?lang=gu', 'hi'), 'gu');
  assert.equal(resolveLanguage('', 'hi'), 'hi');
  assert.equal(resolveLanguage('?lang=zz', null), 'en');
});

test('language change preserves view and hash', () => {
  assert.equal(withLanguageParam('/portfolio?view=technical#skills', 'hi'), '/portfolio?view=technical&lang=hi#skills');
});

test('translations keep numeric facts identical', () => {
  for (const [en, hi, gu] of translationEntries) {
    assert.ok(preservesNumbers(en, hi), en);
    assert.ok(preservesNumbers(en, gu), en);
  }
});
