// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {messages, translate, heroClassName} from '../public/i18n.mjs';
import {parseInput} from '../public/decks.mjs';

test('both locales cover the same messages and interpolation parameters', () => {
  assert.deepEqual(Object.keys(messages.en_US).sort(), Object.keys(messages.zh_CN).sort());
  for (const key of Object.keys(messages.zh_CN)) {
    const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(params(messages.en_US[key]), params(messages.zh_CN[key]), key);
    assert.ok(messages.en_US[key].length > 0);
  }
  assert.equal(translate('en_US', 'cardLabel', {name: 'Fireball', count: 2}), 'Fireball, quantity: 2, view details');
  assert.equal(translate('zh_CN', 'mainCount', {count: 30}), '30 张主卡牌');
});

test('alternate hero portraits use the official class ID when available', () => {
  assert.equal(heroClassName('zh_CN', 99999, {classId: 14}), '恶魔猎手');
  assert.equal(heroClassName('en_US', 99999, {classId: 10}), 'Warrior');
  assert.equal(heroClassName('en_US', 99999), null);
});
test('static HTML provides an English fallback before the app initializes', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const choices = [...html.matchAll(/data-locale="([^"]+)" aria-pressed="([^"]+)"/g)];
  assert.match(html, /<html lang="en">/);
  assert.ok(html.includes(`<title>${messages.en_US.pageTitle}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${messages.en_US.description}">`));
  assert.deepEqual(choices.map(([, locale, pressed]) => [locale, pressed]), [['en_US', 'true'], ['zh_CN', 'false']]);
});

test('static labels and parser errors resolve in either interface language', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const parser = await readFile(new URL('../public/decks.mjs', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g)].map(match => match[1]);
  keys.push(...[...parser.matchAll(/new DeckError\('([^']+)'/g)].map(match => `error.${match[1]}`));
  for (const locale of ['zh_CN', 'en_US']) for (const key of keys) assert.ok(translate(locale, key), `${locale}:${key}`);
  for (const [input, code] of [['', 'emptyInput'], ['invalid code', 'invalidBase64'], ['# comments', 'invalidDeck']]) {
    assert.throws(() => parseInput(input), error => {
      assert.equal(error.code, code);
      assert.notEqual(translate('en_US', `error.${code}`), translate('zh_CN', `error.${code}`));
      return true;
    });
  }
});
