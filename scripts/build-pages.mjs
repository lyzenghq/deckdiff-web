// SPDX-License-Identifier: GPL-2.0-only
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {CardService, indexCardCrops, normalizeCard} from '../lib/cards.mjs';
import {WEB_FILES} from '../lib/web-files.mjs';
import {zilliaxCardIds} from '../public/decks.mjs';
import {cardShard} from '../public/static-cards.mjs';
import {downloadHearthstoneJson} from './hearthstonejson.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const locales = ['en_US', 'zh_CN'];
const snapshotLifetime = 30 * 24 * 60 * 60 * 1000;
const validCard = card => Number.isInteger(card?.id) && card.id > 0 && card.id <= 0x7fffffff && typeof card.name === 'string';

async function retryDownload(download) {
  for (let attempt = 1; ; attempt++) {
    try { return await download(); }
    catch (error) {
      const transient = error.status === 429 || error.status >= 500 || error.name === 'TimeoutError' || error instanceof TypeError;
      if (!transient || attempt === 3) throw error;
      await delay(attempt * 1000);
    }
  }
}

async function downloadBattleNet(service, locale) {
  const url = service.cardEndpoint(locale);
  url.search = new URLSearchParams({locale, pageSize: '200', collectible: '0,1', sort: 'name:asc'});
  const records = new Map();
  let pages = 1, count;
  for (let page = 1; page <= pages; page++) {
    url.searchParams.set('page', String(page));
    const result = await retryDownload(() => service.requestCards(url));
    if (!Array.isArray(result?.cards) || !result.cards.length || result.page !== page ||
        !Number.isSafeInteger(result.pageCount) || result.pageCount < page ||
        !Number.isSafeInteger(result.cardCount) || result.cardCount < result.pageCount) {
      throw new Error(`Invalid card catalog for ${locale}, page ${page}.`);
    }
    if (page === 1) {
      pages = result.pageCount;
      count = result.cardCount;
    }
    if (result.pageCount !== pages || result.cardCount !== count) {
      throw new Error(`The ${locale} card catalog changed during pagination.`);
    }
    for (const card of result.cards) {
      if (!validCard(card) || records.has(card.id)) throw new Error(`Invalid or repeated card in ${locale}, page ${page}.`);
      records.set(card.id, card);
    }
  }
  if (records.size !== count) throw new Error(`Incomplete ${locale} card catalog: expected ${count}, received ${records.size}.`);

  // Cosmetic and functional modules must be available even if the search index omits them.
  for (const id of zilliaxCardIds) {
    if (records.has(id)) continue;
    const detail = service.cardEndpoint(locale);
    detail.pathname += `/${id}`;
    detail.searchParams.set('locale', locale);
    const card = await retryDownload(() => service.requestCards(detail));
    if (!validCard(card) || card.id !== id) throw new Error(`Missing Zilliax record ${id} in ${locale}.`);
    records.set(id, card);
  }
  return records;
}

async function writeSite(site, catalogs, manifest) {
  await mkdir(site, {recursive: true});
  const html = await readFile(join(project, 'public', 'index.html'), 'utf8');
  const metadata = [
    '  <meta name="deckdiff-card-source" content="snapshot">',
    `  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https:; base-uri 'none'; object-src 'none'">`,
  ].join('\n');
  await Promise.all([
    writeFile(join(site, 'index.html'), html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${metadata}`)),
    ...WEB_FILES.filter(file => file !== 'index.html').map(file => copyFile(join(project, 'public', file), join(site, file))),
    copyFile(join(project, 'LICENSE'), join(site, 'LICENSE')),
  ]);

  const data = join(site, 'data');
  for (const [locale, records] of catalogs) {
    const crops = indexCardCrops(records.values());
    const shards = new Map();
    for (const card of records.values()) {
      const shard = cardShard(card.id);
      if (!shards.has(shard)) shards.set(shard, []);
      shards.get(shard).push(normalizeCard(card, crops));
    }
    const directory = join(data, manifest.snapshot, locale);
    await mkdir(directory, {recursive: true});
    await Promise.all([...shards].map(([shard, cards]) => writeFile(join(directory, `${shard}.json`), JSON.stringify(cards))));
    manifest.locales[locale] = [...shards.keys()].sort((a, b) => a - b);
  }
  await writeFile(join(data, 'manifest.json'), JSON.stringify(manifest));
}

export async function buildPages({output = join(project, 'dist'), env = process.env, fetcher = fetch, now = Date.now} = {}) {
  const source = env.PAGES_CARD_SOURCE || 'hearthstonejson';
  if (!['hearthstonejson', 'battlenet'].includes(source)) throw new Error('PAGES_CARD_SOURCE must be hearthstonejson or battlenet.');
  const service = source === 'battlenet' ? new CardService({env: {...env, CARD_PROVIDER: 'battlenet'}, fetcher, now}) : null;
  const started = now();
  const manifest = {
    version: 1,
    snapshot: started.toString(36),
    source,
    generatedAt: new Date(started).toISOString(),
    locales: {},
  };
  if (service) manifest.expiresAt = new Date(started + snapshotLifetime).toISOString();
  const catalogs = await Promise.all(locales.map(async locale => [
    locale, service ? await downloadBattleNet(service, locale) : await retryDownload(() => downloadHearthstoneJson(locale, fetcher)),
  ]));
  await mkdir(dirname(output), {recursive: true});
  const staging = await mkdtemp(join(dirname(output), '.deckdiff-pages-'));
  try {
    const site = join(staging, 'site');
    const previous = join(staging, 'previous');
    await writeSite(site, catalogs, manifest);
    let hadPrevious = true;
    try { await rename(output, previous); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hadPrevious = false;
    }
    try { await rename(site, output); }
    catch (error) {
      if (hadPrevious) await rename(previous, output);
      throw error;
    }
  } finally {
    await rm(staging, {recursive: true, force: true});
  }
  return Object.fromEntries(catalogs.map(([locale, records]) => [locale, records.size]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const counts = await buildPages();
    console.log(`Built dist/ with ${counts.en_US} English and ${counts.zh_CN} Simplified Chinese cards.`);
  } catch (error) {
    console.error(`GitHub Pages build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
