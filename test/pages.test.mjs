// SPDX-License-Identifier: GPL-2.0-only
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {loadCardData} from '../public/card-loader.mjs';
import {zilliaxCardIds} from '../public/decks.mjs';
import {cardShard, loadStaticCards} from '../public/static-cards.mjs';
import {buildPages} from '../scripts/build-pages.mjs';

const env = {PAGES_CARD_SOURCE: 'battlenet', BLIZZARD_CLIENT_ID: 'test-client', BLIZZARD_CLIENT_SECRET: 'test-secret'};
const base = new URL('https://example.github.io/deckdiff-web/data/');
const officialArt = 'https://example.com/curator.jpg';

function mockBattleNet({repeatPage = false} = {}) {
  const calls = [];
  const fetcher = async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === 'oauth.battle.net') {
      assert.equal(options.method, 'POST');
      return Response.json({access_token: 'test-token', expires_in: 3600});
    }
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const locale = url.searchParams.get('locale');
    assert.ok(['en_US', 'zh_CN'].includes(locale));
    const name = locale === 'zh_CN' ? '馆长' : 'The Curator';
    if (url.pathname === '/hearthstone/cards') {
      assert.equal(url.searchParams.get('collectible'), '0,1');
      const old = {id: 39225, name, image: 'https://example.com/old.png', cropImage: officialArt, extra: 'do not publish'};
      const revised = {id: 120180, name, image: 'https://example.com/new.png', copyOfCardId: [39225], manaCost: 7};
      const page = Number(url.searchParams.get('page'));
      const card = page === 1 || repeatPage ? old : revised;
      return Response.json({cards: [card], page, pageCount: 2, cardCount: 2});
    }
    const id = Number(url.pathname.split('/').at(-1));
    return Response.json({id, name: locale === 'zh_CN' ? '奇利亚斯模块' : 'Zilliax module', image: 'https://example.com/module.png'});
  };
  return {fetcher, calls};
}

test('Pages build publishes bilingual shards with module records and linked art', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'deckdiff-pages-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const output = join(directory, 'dist');
  const {fetcher, calls} = mockBattleNet();
  const counts = await buildPages({output, env, fetcher});
  assert.equal(counts.en_US, counts.zh_CN);
  assert.ok(counts.en_US > 2);
  assert.equal(calls.filter(url => url.hostname === 'oauth.battle.net').length, 1);
  assert.ok(calls.some(url => url.pathname === '/hearthstone/cards/110446'));

  const html = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(html, /name="deckdiff-card-source" content="snapshot"/);
  assert.match(html, /src="\.\/app\.mjs"/);
  assert.match(html, /href="\.\/LICENSE"/);
  assert.doesNotMatch(html, /test-secret|test-token/);
  assert.ok(!(await readdir(output)).some(name => name === '.env' || name === 'server.mjs'));

  const requested = [];
  const fetchStatic = async url => {
    assert.equal(url.origin, base.origin);
    assert.ok(url.pathname.startsWith(base.pathname));
    const file = url.pathname.slice(base.pathname.length);
    requested.push(file);
    return new Response(await readFile(join(output, 'data', file), 'utf8'));
  };
  const source = options => loadStaticCards(options, base);
  const ids = [120180, 110446, 120181, 999999];
  const result = await loadCardData({ids, locale: 'zh_CN', fetcher: fetchStatic, source});
  assert.deepEqual(result.missing, [120181, 999999]);
  assert.deepEqual(result.cards.map(({id, name}) => [id, name]), [[120180, '馆长'], [110446, '奇利亚斯模块']]);
  assert.equal(result.cards[0].cropImage, officialArt);
  assert.equal(result.cards[0].cropImageSourceId, 39225);
  assert.equal(result.cards[0].manaCost, 7);
  assert.equal(requested.length, 3);
  assert.equal(requested[0], 'manifest.json');
  assert.ok(requested.some(path => path.endsWith(`/zh_CN/${cardShard(110446)}.json`)));
  assert.ok(!requested.some(path => path.endsWith(`/${cardShard(39225)}.json`)));

  const en = await loadCardData({ids: [39225], locale: 'en_US', fetcher: fetchStatic, source});
  assert.equal(en.cards[0].name, 'The Curator');
  assert.equal(en.cards[0].extra, undefined);

  const existing = await readFile(join(output, 'data', 'manifest.json'), 'utf8');
  assert.equal(JSON.parse(existing).source, 'battlenet');
  assert.ok(JSON.parse(existing).expiresAt);
  await assert.rejects(buildPages({output, env, fetcher: mockBattleNet({repeatPage: true}).fetcher}), /repeated card/);
  assert.equal(await readFile(join(output, 'data', 'manifest.json'), 'utf8'), existing);
});

test('the default Pages build downloads HearthstoneJSON at build time without credentials', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'deckdiff-pages-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const output = join(directory, 'dist');
  const calls = [];
  const counts = await buildPages({
    output, env: {}, now: () => Date.UTC(2020, 0, 1),
    fetcher: async url => {
      calls.push(url.href);
      const chinese = url.pathname.includes('/zhCN/');
      const name = chinese ? '馆长' : 'The Curator';
      return Response.json([
        {dbfId: 39225, id: 'KAR_061', type: 'MINION', name},
        {dbfId: 120180, id: 'CORE_KAR_061', type: 'MINION', name, cost: 7, countAsCopyOfDbfId: 39225,
          cardClass: 'NEUTRAL', rarity: 'LEGENDARY', text: chinese ? '战吼' : 'Battlecry'},
        ...zilliaxCardIds.map(dbfId => ({dbfId, id: `module_${dbfId}`, type: 'MINION', name: 'Zilliax'})),
      ]);
    },
  });
  assert.deepEqual(calls.sort(), ['enUS', 'zhCN'].map(language => `https://api.hearthstonejson.com/v1/latest/${language}/cards.json`));
  assert.deepEqual(counts, {en_US: 2 + zilliaxCardIds.length, zh_CN: 2 + zilliaxCardIds.length});
  const manifest = JSON.parse(await readFile(join(output, 'data', 'manifest.json'), 'utf8'));
  assert.equal(manifest.source, 'hearthstonejson');
  assert.equal(manifest.expiresAt, undefined);

  const result = await loadCardData({
    ids: [120180, 110446, 999999], locale: 'zh_CN', source: options => loadStaticCards(options, base),
    fetcher: async url => {
      assert.ok(url.href.startsWith(base.href));
      return new Response(await readFile(join(output, 'data', url.pathname.slice(base.pathname.length)), 'utf8'));
    },
  });
  assert.deepEqual(result.missing, [999999]);
  const [curator, module] = result.cards;
  assert.equal(curator.name, '馆长');
  assert.equal(curator.text, '战吼');
  assert.equal(curator.manaCost, 7);
  assert.equal(curator.classId, 12);
  assert.equal(curator.rarityId, 5);
  assert.deepEqual(curator.copyOfCardId, [39225]);
  assert.equal(curator.image, 'https://art.hearthstonejson.com/v1/render/latest/zhCN/256x/CORE_KAR_061.png');
  assert.equal(module.cropImage, 'https://art.hearthstonejson.com/v1/tiles/module_110446.webp');
});

test('the static loader stops before downloading shards once the snapshot expires', async () => {
  const urls = [];
  const fetcher = async url => {
    urls.push(url.pathname);
    return Response.json({
      version: 1, snapshot: 'expired', expiresAt: '2020-01-01T00:00:00Z', locales: {en_US: [cardShard(315)]},
    });
  };
  const source = options => loadStaticCards(options, base);
  await assert.rejects(loadCardData({ids: [315], locale: 'en_US', fetcher, source, refresh: true}),
    {code: 'SNAPSHOT_EXPIRED'});
  assert.deepEqual(urls, ['/deckdiff-web/data/manifest.json']);
});
