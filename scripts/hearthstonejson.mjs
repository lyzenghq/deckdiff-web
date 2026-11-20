// SPDX-License-Identifier: GPL-2.0-only
import {zilliaxCardIds} from '../public/decks.mjs';

const classIds = new Map([
  ['DEATHKNIGHT', 1], ['DRUID', 2], ['HUNTER', 3], ['MAGE', 4], ['PALADIN', 5], ['PRIEST', 6],
  ['ROGUE', 7], ['SHAMAN', 8], ['WARLOCK', 9], ['WARRIOR', 10], ['NEUTRAL', 12], ['DEMONHUNTER', 14],
]);
const rarityIds = new Map([['COMMON', 1], ['FREE', 2], ['RARE', 3], ['EPIC', 4], ['LEGENDARY', 5]]);
const renderable = new Set(['HERO', 'MINION', 'SPELL', 'WEAPON', 'LOCATION']);
const art = 'https://art.hearthstonejson.com/v1';

export async function downloadHearthstoneJson(locale, fetcher) {
  const language = locale.replace('_', '');
  const url = new URL(`https://api.hearthstonejson.com/v1/latest/${language}/cards.json`);
  const response = await fetcher(url, {signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw Object.assign(new Error(`HearthstoneJSON returned HTTP ${response.status} for ${locale}.`), {status: response.status});
  const cards = await response.json();
  if (!Array.isArray(cards) || !cards.length) throw new Error(`Invalid HearthstoneJSON catalog for ${locale}.`);

  const records = new Map();
  for (const card of cards) {
    const {dbfId, id, name} = card;
    if (!Number.isInteger(dbfId) || dbfId < 1 || dbfId > 0x7fffffff || typeof id !== 'string' || !id ||
        typeof name !== 'string' || !name.trim()) continue;
    if (records.has(dbfId)) throw new Error(`Repeated HearthstoneJSON card ${dbfId} in ${locale}.`);
    const cardId = encodeURIComponent(id);
    const hasArt = renderable.has(card.type);
    records.set(dbfId, {
      id: dbfId,
      name,
      manaCost: card.cost,
      rarityId: rarityIds.get(card.rarity),
      image: hasArt ? `${art}/render/latest/${language}/256x/${cardId}.png` : null,
      cropImage: hasArt ? `${art}/tiles/${cardId}.webp` : null,
      copyOfCardId: [card.countAsCopyOfDbfId],
      text: card.collectionText || card.text,
      classId: classIds.get(card.cardClass),
    });
  }
  const missingModule = zilliaxCardIds.find(id => !records.has(id));
  if (missingModule) throw new Error(`Missing HearthstoneJSON Zilliax record ${missingModule} in ${locale}.`);
  return records;
}
