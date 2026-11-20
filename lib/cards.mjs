// SPDX-License-Identifier: GPL-2.0-only
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {writeCacheFile} from './cache.mjs';

const LOCALES = new Map([['zh_CN', 'zh-cn'], ['en_US', 'en-us']]);
const MAX_CACHE_ENTRIES = 12000;
function httpsImage(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function directCrop(card) {
  const crop = httpsImage(card?.cropImage);
  return crop && crop !== httpsImage(card?.image) ? crop : null;
}
function relatedIds(card) {
  return Array.isArray(card.copyOfCardId) ? [...new Set(card.copyOfCardId.filter(id => Number.isInteger(id) && id > 0 && id <= 0x7fffffff && id !== card.id))].slice(0, 20) : [];
}
export function normalizeCard(card, crops) {
  const manaCost = Number.isSafeInteger(card.manaCost) && card.manaCost >= 0 ? card.manaCost : null;
  const copyOfCardId = relatedIds(card);
  const crop = crops.get(card.id) || copyOfCardId.map(id => crops.get(id)).find(Boolean);
  return {id: card.id, name: card.name, manaCost, image: card.image, cropImage: crop?.url || null,
    cropImageSourceId: crop?.sourceId || null, copyOfCardId, text: card.text, rarityId: card.rarityId, classId: card.classId};
}

export function indexCardCrops(records) {
  const crops = new Map();
  for (const card of records) {
    const crop = directCrop(card);
    if (crop) crops.set(card.id, {url: crop, sourceId: card.id});
  }
  return crops;
}

export class CardService {
  constructor({fetcher = fetch, env = process.env, now = () => Date.now(), cacheDirectory} = {}) {
    this.fetcher = fetcher; this.env = env; this.now = now;
    this.cache = new Map(); this.pending = new Map(); this.token = null; this.tokenTask = null;
    this.provider = env.CARD_PROVIDER || 'website';
    if (!['website', 'battlenet'].includes(this.provider)) throw new Error('CARD_PROVIDER must be website or battlenet');
    this.region = env.BLIZZARD_REGION || 'us';
    if (!['us', 'eu', 'kr', 'tw'].includes(this.region)) throw new Error('Invalid BLIZZARD_REGION');
    const source = this.provider === 'website' ? 'website' : `battlenet-${this.region}`;
    this.cacheDirectory = cacheDirectory && join(cacheDirectory, 'cards', source);
  }
  rememberCard(key, card) {
    this.cache.set(key, card);
    while (this.cache.size > MAX_CACHE_ENTRIES) this.cache.delete(this.cache.keys().next().value);
  }
  async cachedCard(id, locale) {
    const key = `${locale}:${id}`;
    const cached = this.cache.get(key);
    if (cached || !this.cacheDirectory) return cached;
    try {
      const file = join(this.cacheDirectory, locale, `${id}.json`);
      const card = JSON.parse(await readFile(file, 'utf8'));
      if (card?.id !== id || typeof card.name !== 'string') return;
      const current = this.cache.get(key);
      if (current) return current;
      this.rememberCard(key, card);
      return card;
    } catch { /* A missing or unreadable record can be fetched again. */ }
  }
  async imageUrl(id, locale, kind) {
    const card = await this.cachedCard(id, locale);
    return httpsImage(kind === 'crop' ? card?.cropImage : card?.image);
  }
  async request(url, init = {}, timeout = 15000) {
    const response = await this.fetcher(url, {...init, signal: AbortSignal.timeout(timeout)});
    if (!response.ok) throw Object.assign(new Error(`官方数据接口返回 HTTP ${response.status}`), {status: response.status});
    return response.json();
  }
  async accessToken() {
    if (this.token?.expires > this.now()) return this.token.value;
    if (this.tokenTask) return this.tokenTask;
    const {BLIZZARD_CLIENT_ID: id, BLIZZARD_CLIENT_SECRET: secret} = this.env;
    if (!id || !secret) throw Object.assign(new Error('Battle.net API credentials are not configured.'), {code: 'API_CONFIGURATION'});
    this.tokenTask = (async () => {
      const data = await this.request('https://oauth.battle.net/token', {method: 'POST', headers: {'Authorization': `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded'}, body: 'grant_type=client_credentials'});
      if (!data.access_token || !Number.isFinite(data.expires_in)) throw new Error('战网鉴权响应无效。');
      this.token = {value: data.access_token, expires: this.now() + Math.max(0, data.expires_in - 60) * 1000};
      return this.token.value;
    })().finally(() => { this.tokenTask = null; });
    return this.tokenTask;
  }
  cardEndpoint(locale) {
    return new URL(this.provider === 'website' ? `https://hearthstone.blizzard.com/${LOCALES.get(locale)}/api/cards` : `https://${this.region}.api.blizzard.com/hearthstone/cards`);
  }
  async requestCards(url, timeout) {
    if (this.provider === 'website') return this.request(url, {headers: {Accept: 'application/json'}}, timeout);
    const headers = {Authorization: `Bearer ${await this.accessToken()}`};
    try { return await this.request(url, {headers}, timeout); }
    catch (error) {
      if (error.status !== 401) throw error;
      this.token = null;
      headers.Authorization = `Bearer ${await this.accessToken()}`;
      return this.request(url, {headers}, timeout);
    }
  }
  async load(ids, locale) {
    if (!LOCALES.has(locale)) throw new Error('不支持的语言。');
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length > 200 || unique.some(id => !Number.isInteger(id) || id < 1 || id > 0x7fffffff)) throw new Error('卡牌 ID 参数无效。');
    const keys = unique.map(id => `${locale}:${id}`);
    const cached = await Promise.all(unique.map(id => this.cachedCard(id, locale)));
    const missing = unique.filter((id, index) => !cached[index] && !this.cache.has(keys[index]) && !this.pending.has(keys[index]));
    if (missing.length) {
      const pendingKeys = missing.map(id => `${locale}:${id}`);
      const request = this.fetchCards(missing, locale).finally(() => {
        for (const key of pendingKeys) this.pending.delete(key);
      });
      for (const key of pendingKeys) this.pending.set(key, request);
    }
    const results = await Promise.all(unique.map((id, index) => {
      const key = keys[index];
      const pending = this.pending.get(key);
      return cached[index] || this.cache.get(key) || pending?.then(cards => cards.get(id));
    }));
    const cards = results.filter(Boolean);
    return {cards, missing: unique.filter(id => !cards.some(c => c.id === id)), source: this.provider === 'website' ? '炉石传说官方网站' : 'Battle.net 官方 API', provider: this.provider};
  }
  async fetchCards(ids, locale) {
    const url = this.cardEndpoint(locale);
    url.search = new URLSearchParams({ids: ids.join(','), locale, pageSize: '200', collectible: '0,1'});
    const data = await this.requestCards(url);
    if (!Array.isArray(data.cards)) throw new Error('官方接口返回了无法识别的数据。');
    if (Number(data.pageCount) > 1) throw new Error('官方接口未完整返回卡牌，请减少同时比较的卡牌数量。');
    const wanted = new Set(ids);
    const records = data.cards.filter(card => card && wanted.has(card.id) && typeof card.name === 'string');
    const crops = indexCardCrops(records);
    // Reprints sometimes omit cropImage. Only use the official same-card links,
    // never tokens/child cards or guessed image URLs. Keep the requested card ID.
    const missingArt = records.filter(card => !crops.has(card.id));
    const related = [...new Set(missingArt.flatMap(relatedIds))].filter(id => !crops.has(id));
    await Promise.all(related.map(async id => {
      const cached = await this.cachedCard(id, locale);
      const crop = directCrop(cached);
      if (crop) crops.set(id, {url: crop, sourceId: cached.cropImageSourceId || id});
    }));
    const needsLookup = missingArt.filter(card => !relatedIds(card).some(id => crops.has(id)));
    const lookupIds = [...new Set(needsLookup.flatMap(relatedIds))].filter(id => !crops.has(id)).slice(0, 200);
    if (lookupIds.length) {
      const cropUrl = new URL(url);
      cropUrl.searchParams.set('ids', lookupIds.join(','));
      try {
        // This optional request must not make otherwise valid card data fail.
        const extra = await this.requestCards(cropUrl, 5000);
        const requested = new Set(lookupIds);
        for (const card of Array.isArray(extra.cards) ? extra.cards : []) {
          const crop = directCrop(card);
          if (card && requested.has(card.id) && crop) crops.set(card.id, {url: crop, sourceId: card.id});
        }
      } catch { /* Leave a plain row background if official art is unavailable. */ }
    }
    const loaded = new Map(records.map(card => [card.id, normalizeCard(card, crops)]));
    if (this.cacheDirectory) {
      await Promise.all([...loaded].map(([id, card]) => {
        const file = join(this.cacheDirectory, locale, `${id}.json`);
        return writeCacheFile(file, JSON.stringify(card)).catch(() => { /* Keep serving cards in memory if disk caching fails. */ });
      }));
    }
    for (const [id, card] of loaded) this.rememberCard(`${locale}:${id}`, card);
    return loaded;
  }
}
