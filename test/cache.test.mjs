// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm, utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CardService} from '../lib/cards.mjs';
import {CardImageCache} from '../lib/card-images.mjs';
import {createApp} from '../server.mjs';

const card = {id: 315, name: '火球术', manaCost: 4,
  image: 'https://d15f34w2p8l1cc.cloudfront.net/hearthstone/fireball.png',
  cropImage: 'https://d15f34w2p8l1cc.cloudfront.net/hearthstone/fireball-crop.png'};

async function cacheDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'deckdiff-cache-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
}

test('old disk card records survive a restart and only missing IDs are fetched', async t => {
  const directory = await cacheDirectory(t);
  const requests = [];
  const service = () => new CardService({cacheDirectory: directory, env: {}, fetcher: async url => {
    const ids = url.searchParams.get('ids');
    requests.push(ids);
    return Response.json({cards: ids === '315' ? [card] : [{id: 531, name: '炎爆术'}]});
  }});
  await service().load([315], 'zh_CN');
  const file = join(directory, 'cards', 'website', 'zh_CN', '315.json');
  const old = new Date('2000-01-01T00:00:00Z');
  await utimes(file, old, old);
  const result = await service().load([315, 531], 'zh_CN');
  assert.deepEqual(result.cards.map(({name}) => name), ['火球术', '炎爆术']);
  assert.deepEqual(requests, ['315', '531']);
});

test('HTTP image requests persist full and cropped art and reuse it after restart', async t => {
  const directory = await cacheDirectory(t);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const jpeg = Buffer.from([255, 216, 255, 217]);
  const fallback = 'https://example.com/other-card.png';
  let cardRequests = 0, imageRequests = 0;
  const start = async () => {
    const cards = new CardService({cacheDirectory: directory, env: {}, fetcher: async () => {
      cardRequests++;
      return Response.json({cards: [card, {id: 531, name: '备用', image: fallback}]});
    }});
    const images = new CardImageCache({directory: join(directory, 'images'), fetcher: async (url, options) => {
      assert.equal(options.redirect, 'error');
      imageRequests++;
      if (url.href === card.image) return new Response(png, {headers: {'Content-Type': 'application/octet-stream'}});
      assert.equal(url.href, card.cropImage);
      return new Response(jpeg, {headers: {'Content-Type': 'image/jpeg'}});
    }});
    const app = createApp({cacheDirectory: directory, cards, images});
    await new Promise((resolve, reject) => {
      app.once('error', reject);
      app.listen(0, '127.0.0.1', resolve);
    });
    const stop = () => new Promise(resolve => app.close(resolve));
    t.after(() => { if (app.listening) return stop(); });
    return {origin: `http://127.0.0.1:${app.address().port}`, stop};
  };
  const cardsPath = '/api/cards?ids=315,531';
  const fullPath = '/api/card-image/zh_CN/315/full';
  const cropPath = '/api/card-image/zh_CN/315/crop';
  const first = await start();
  assert.equal((await (await fetch(first.origin + cardsPath)).json()).cards.length, 2);
  const full = await fetch(first.origin + fullPath);
  assert.equal(full.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), png);
  const crop = await fetch(first.origin + cropPath);
  assert.equal(crop.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await crop.arrayBuffer()), jpeg);
  assert.equal(imageRequests, 2);
  await first.stop();

  const imageDirectory = join(directory, 'images');
  assert.equal((await readdir(imageDirectory)).length, 2);
  const pngFile = join(imageDirectory, `${createHash('sha256').update(card.image).digest('hex')}.img`);
  assert.deepEqual(await readFile(pngFile), png);

  const restarted = await start();
  assert.equal((await (await fetch(restarted.origin + cardsPath + '&refresh=1')).json()).cards.length, 2);
  assert.equal(cardRequests, 1);
  assert.deepEqual(Buffer.from(await (await fetch(restarted.origin + fullPath)).arrayBuffer()), png);
  assert.deepEqual(Buffer.from(await (await fetch(restarted.origin + cropPath)).arrayBuffer()), jpeg);
  assert.equal(imageRequests, 2);

  const old = new Date('2000-01-01T00:00:00Z');
  await utimes(pngFile, old, old);
  assert.equal((await fetch(restarted.origin + fullPath, {method: 'HEAD'})).status, 200);
  assert.equal(imageRequests, 2);
  await rm(pngFile);
  assert.equal((await fetch(restarted.origin + fullPath, {method: 'HEAD'})).status, 200);
  assert.equal(imageRequests, 3);

  const otherHost = await fetch(restarted.origin + '/api/card-image/zh_CN/531/full', {redirect: 'manual'});
  assert.equal(otherHost.status, 302);
  assert.equal(otherHost.headers.get('location'), fallback);
  assert.equal(imageRequests, 3);
  assert.equal((await fetch(restarted.origin + '/api/card-image/zh_CN/999/full')).status, 404);
  assert.equal((await fetch(restarted.origin + '/cache/cards/website/zh_CN/315.json')).status, 404);
});
