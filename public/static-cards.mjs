// SPDX-License-Identifier: GPL-2.0-only
import {CardLoadError} from './card-loader.mjs';

export const cardShard = id => Math.floor(id / 100);

async function readJson(url, {fetcher, signal, cache}) {
  try {
    const response = await fetcher(url, {signal, cache});
    if (!response.ok) throw new Error('Snapshot file unavailable');
    return await response.json();
  } catch {
    if (signal.reason?.name === 'TimeoutError') throw new CardLoadError('API_TIMEOUT');
    signal.throwIfAborted();
    throw new CardLoadError('SNAPSHOT_UNAVAILABLE');
  }
}

export async function loadStaticCards({ids, locale, refresh, signal, fetcher}, base = new URL('./data/', import.meta.url)) {
  const manifest = await readJson(new URL('manifest.json', base), {fetcher, signal, cache: 'no-cache'});
  const available = manifest?.locales?.[locale];
  if (manifest?.version !== 1 || typeof manifest.snapshot !== 'string' || !/^[a-z0-9]+$/.test(manifest.snapshot) ||
      !Array.isArray(available)) throw new CardLoadError('SNAPSHOT_UNAVAILABLE');
  if (manifest.source !== 'hearthstonejson') {
    const expires = Date.parse(manifest.expiresAt);
    if (!Number.isFinite(expires)) throw new CardLoadError('SNAPSHOT_UNAVAILABLE');
    if (expires <= Date.now()) throw new CardLoadError('SNAPSHOT_EXPIRED', false);
  }

  const included = new Set(available);
  const shards = [...new Set(ids.map(cardShard))].filter(shard => included.has(shard));
  const batches = await Promise.all(shards.map(async shard => {
    const path = `${manifest.snapshot}/${locale}/${shard}.json`;
    const cards = await readJson(new URL(path, base), {fetcher, signal, cache: refresh ? 'reload' : 'force-cache'});
    if (!Array.isArray(cards)) throw new CardLoadError('SNAPSHOT_UNAVAILABLE');
    return cards;
  }));
  const byId = new Map(batches.flatMap(cards => cards.map(card => [card.id, card])));
  return {cards: ids.map(id => byId.get(id)).filter(Boolean), missing: ids.filter(id => !byId.has(id))};
}
