// SPDX-License-Identifier: GPL-2.0-only
const LOCALES = new Map([['zh_CN', 'zh-cn'], ['en_US', 'en-us']]);
function httpsImage(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
function directCrop(card) {
  const crop = httpsImage(card?.cropImage);
  return crop && crop !== httpsImage(card?.image) ? crop : null;
}
function relatedIds(card) {
  return Array.isArray(card.copyOfCardId) ? [...new Set(card.copyOfCardId.filter(id => Number.isInteger(id) && id > 0 && id <= 0x7fffffff && id !== card.id))].slice(0, 20) : [];
}
export class CardService {
  constructor({fetcher = fetch, env = process.env, now = () => Date.now()} = {}) {
    this.fetcher = fetcher; this.env = env; this.now = now;
    this.cache = new Map(); this.pending = new Map(); this.token = null; this.tokenTask = null;
    this.provider = env.CARD_PROVIDER || 'website';
    if (!['website', 'battlenet'].includes(this.provider)) throw new Error('CARD_PROVIDER must be website or battlenet');
    this.region = env.BLIZZARD_REGION || 'us';
    if (!['us', 'eu', 'kr', 'tw'].includes(this.region)) throw new Error('Invalid BLIZZARD_REGION');
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
  async load(ids, locale, {refresh = false} = {}) {
    if (!LOCALES.has(locale)) throw new Error('不支持的语言。');
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length > 200 || unique.some(id => !Number.isInteger(id) || id < 1 || id > 0x7fffffff)) throw new Error('卡牌 ID 参数无效。');
    const missing = unique.filter(id => refresh || (this.cache.get(`${locale}:${id}`)?.expires || 0) <= this.now());
    if (missing.length) {
      const key = `${locale}:${missing.sort((a,b) => a-b).join(',')}:${refresh ? 'refresh' : 'normal'}`;
      if (!this.pending.has(key)) this.pending.set(key, this.fetchCards(missing, locale).finally(() => this.pending.delete(key)));
      const returnedIds = await this.pending.get(key);
      if (refresh) for (const id of missing) if (!returnedIds.has(id)) this.cache.delete(`${locale}:${id}`);
    }
    // An expired entry is not a successful refresh if the upstream omitted it.
    const cards = unique.map(id => this.cache.get(`${locale}:${id}`))
      .filter(entry => entry && entry.expires > this.now()).map(entry => entry.card);
    return {cards, missing: unique.filter(id => !cards.some(c => c.id === id)), source: this.provider === 'website' ? '炉石传说官方网站' : 'Battle.net 官方 API', provider: this.provider};
  }
  async fetchCards(ids, locale) {
    const website = this.provider === 'website';
    const url = new URL(website ? `https://hearthstone.blizzard.com/${LOCALES.get(locale)}/api/cards` : `https://${this.region}.api.blizzard.com/hearthstone/cards`);
    url.search = new URLSearchParams({ids: ids.join(','), locale, pageSize: '200', collectible: '0,1'});
    const headers = website ? {'Accept': 'application/json'} : {'Authorization': `Bearer ${await this.accessToken()}`};
    let data;
    try { data = await this.request(url, {headers}); }
    catch (error) { if (!website && /HTTP 401\b/.test(error.message)) { this.token = null; headers.Authorization = `Bearer ${await this.accessToken()}`; data = await this.request(url, {headers}); } else throw error; }
    if (!Array.isArray(data.cards)) throw new Error('官方接口返回了无法识别的数据。');
    if (Number(data.pageCount) > 1) throw new Error('官方接口未完整返回卡牌，请减少同时比较的卡牌数量。');
    const wanted = new Set(ids);
    const records = data.cards.filter(card => card && wanted.has(card.id) && typeof card.name === 'string');
    const crops = new Map();
    for (const card of records) {
      const crop = directCrop(card);
      if (crop) crops.set(card.id, {url: crop, sourceId: card.id});
    }
    // Reprints sometimes omit cropImage. Only use the official same-card links,
    // never tokens/child cards or guessed image URLs. Keep the requested card ID.
    const missingArt = records.filter(card => !crops.has(card.id));
    for (const card of missingArt) for (const id of relatedIds(card)) {
      const cached = this.cache.get(`${locale}:${id}`);
      const crop = cached?.expires > this.now() ? directCrop(cached.card) : null;
      if (crop && !crops.has(id)) crops.set(id, {url: crop, sourceId: cached.card.cropImageSourceId || id});
    }
    const needsLookup = missingArt.filter(card => !relatedIds(card).some(id => crops.has(id)));
    const lookupIds = [...new Set(needsLookup.flatMap(relatedIds))].filter(id => !crops.has(id)).slice(0, 200);
    if (lookupIds.length) {
      const cropUrl = new URL(url);
      cropUrl.searchParams.set('ids', lookupIds.join(','));
      try {
        // This optional request must not make otherwise valid card data fail.
        const extra = await this.request(cropUrl, {headers}, 5000);
        const requested = new Set(lookupIds);
        for (const card of Array.isArray(extra.cards) ? extra.cards : []) {
          const crop = directCrop(card);
          if (card && requested.has(card.id) && crop) crops.set(card.id, {url: crop, sourceId: card.id});
        }
      } catch { /* Leave a plain row background if official art is unavailable. */ }
    }
    for (const card of records) {
      const manaCost = Number.isSafeInteger(card.manaCost) && card.manaCost >= 0 ? card.manaCost : null;
      const crop = crops.get(card.id) || relatedIds(card).map(id => crops.get(id)).find(Boolean);
      this.cache.set(`${locale}:${card.id}`, {expires: this.now() + 6 * 60 * 60 * 1000, card: {id: card.id, name: card.name, manaCost, image: card.image, cropImage: crop?.url || null, cropImageSourceId: crop?.sourceId || null, copyOfCardId: relatedIds(card), text: card.text, rarityId: card.rarityId, classId: card.classId}});
    }
    // Bound memory on a public deployment. There is no persistent copy of the database.
    while (this.cache.size > 12000) this.cache.delete(this.cache.keys().next().value);
    return new Set(records.map(card => card.id));
  }
}
