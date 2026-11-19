// SPDX-License-Identifier: GPL-2.0-only
export class DeckError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeckError';
    this.code = code;
  }
}
// Hearthstone deckstring v1: header, hero IDs, 1/2/N-copy groups,
// optional sideboard flag and 1/2/N-copy groups with owner IDs.
export function decode(code) {
  if (typeof code !== 'string' || code.length > 16384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(code) || code.length % 4 === 1) throw new DeckError('invalidBase64', '卡组代码不是有效的 Base64。');
  let bytes;
  try { bytes = Uint8Array.from(atob(code), c => c.charCodeAt(0)); } catch { throw new DeckError('invalidBase64', '卡组代码不是有效的 Base64。'); }
  let offset = 0;
  function read(max = 0x7fffffff) {
    let value = 0;
    for (let shift = 0; shift <= 28; shift += 7) {
      if (offset >= bytes.length) throw new DeckError('incomplete', '卡组代码不完整。');
      const byte = bytes[offset++];
      value += (byte & 127) * 2 ** shift;
      if (value > max) throw new DeckError('outOfRange', '卡组代码中的数值超出范围。');
      if (!(byte & 128)) return value;
    }
    throw new DeckError('invalidValue', '卡组代码中的数值无效。');
  }
  function positive() { const id = read(); if (!id) throw new DeckError('invalidId', '无效的卡牌 ID 或数量。'); return id; }
  if (read() !== 0 || read() !== 1) throw new DeckError('unsupportedVersion', '不支持的卡组代码版本。');
  const format = read();
  if (![1, 2, 3, 4].includes(format)) throw new DeckError('unsupportedFormat', '不支持的卡组模式。');
  const heroCount = read(10);
  if (!heroCount) throw new DeckError('missingHero', '卡组缺少英雄。');
  const heroes = Array.from({length: heroCount}, positive);
  function groups(sideboard = false) {
    const cards = [], seen = new Set();
    for (let group = 1; group <= 3; group++) {
      const length = read(500);
      for (let i = 0; i < length; i++) {
        const id = positive(), count = group < 3 ? group : positive(), owner = sideboard ? positive() : undefined;
        if (count > 100 || cards.length >= 500) throw new DeckError('tooManyCards', '卡组包含过多卡牌。');
        const key = `${owner || 0}:${id}`;
        if (seen.has(key)) throw new DeckError('duplicateCard', '卡组中有重复的卡牌记录。');
        seen.add(key);
        cards.push({id, count, ...(sideboard ? {owner} : {})});
      }
    }
    return cards;
  }
  const cards = groups();
  let sideboard = [];
  if (offset < bytes.length) { const flag = read(1); if (flag) sideboard = groups(true); }
  if (offset !== bytes.length) throw new DeckError('unknownExtension', '卡组包含无法识别的扩展数据，请检查代码。');
  if (!cards.length) throw new DeckError('emptyDeck', '卡组中没有卡牌。');
  if (sideboard.some(card => !cards.some(main => main.id === card.owner))) throw new DeckError('missingOwner', '备牌对应的主卡牌不存在。');
  return {format, heroes, cards, sideboard, code};
}

export function parseInput(input) {
  if (!input?.trim()) throw new DeckError('emptyInput', '请先粘贴卡组代码。');
  if (input.length > 100000) throw new DeckError('inputTooLong', '输入内容过长。');
  const name = input.match(/^###\s+(.+)$/m)?.[1]?.trim();
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  let lastError;
  for (const line of lines) {
    try { return {...decode(line), name}; } catch (error) { lastError = error; }
  }
  throw lastError || new DeckError('invalidDeck', '未找到有效的卡组代码。');
}

export function compare(a, b, metadata = new Map()) {
  // Official same-card links form families. Matching never depends on names or art.
  const parents = new Map();
  const validId = id => Number.isInteger(id) && id > 0 && id <= 0x7fffffff;
  function family(id) {
    if (!parents.has(id)) parents.set(id, id);
    let root = id;
    while (parents.get(root) !== root) root = parents.get(root);
    while (parents.get(id) !== id) { const next = parents.get(id); parents.set(id, root); id = next; }
    return root;
  }
  for (const card of metadata.values()) {
    if (!card || !validId(card.id) || !Array.isArray(card.copyOfCardId)) continue;
    for (const related of card.copyOfCardId) {
      if (!validId(related)) continue;
      const left = family(card.id), right = family(related);
      if (left !== right) parents.set(Math.max(left, right), Math.min(left, right));
    }
  }
  function merge(left, right) {
    const rows = new Map();
    for (const [index, cards] of [left, right].entries()) for (const card of cards) {
      const key = `${card.owner ? family(card.owner) : 0}:${family(card.id)}`;
      if (!rows.has(key)) rows.set(key, {id: card.id, owner: card.owner, a: 0, b: 0});
      const row = rows.get(key), side = index === 0 ? 'a' : 'b';
      row[side] += card.count;
      row[`${side}Id`] ??= card.id;
      if (card.owner) row[`${side}Owner`] ??= card.owner;
    }
    return [...rows.values()].map(row => ({...row, delta: row.b - row.a, common: Math.min(row.a, row.b)}));
  }
  const rows = merge(a.cards, b.cards), sideboard = merge(a.sideboard, b.sideboard);
  const total = cards => cards.reduce((n, c) => n + c.count, 0);
  return {rows, sideboard, totalA: total(a.cards), totalB: total(b.cards), common: rows.reduce((n, r) => n + r.common, 0), removed: rows.reduce((n, r) => n + Math.max(0, -r.delta), 0), added: rows.reduce((n, r) => n + Math.max(0, r.delta), 0)};
}

// Classic mage lists used only as an editable example; all metadata is fetched from Blizzard.
export function encodeExample(cards, sideboard = []) {
  const bytes = [];
  function write(value) { while (value > 127) { bytes.push((value & 127) | 128); value = Math.floor(value / 128); } bytes.push(value); }
  [0, 1, 1, 1, 637].forEach(write);
  function groups(entries, extra) { for (let g = 1; g <= 3; g++) { const list = entries.filter(c => g < 3 ? c[1] === g : c[1] > 2); write(list.length); for (const c of list) { write(c[0]); if (g === 3) write(c[1]); if (extra) write(c[2]); } } }
  groups(cards); write(sideboard.length ? 1 : 0); if (sideboard.length) groups(sideboard, true);
  return btoa(String.fromCharCode(...bytes));
}
const base = [315, 555, 662, 77, 172, 405, 587, 1084, 395, 906, 1004, 614, 621, 457, 1087].map(id => [id, 2]);
export const examples = [encodeExample(base), encodeExample(base.map(([id, n]) => [id === 1087 ? 531 : id === 457 ? 430 : id, n]))];
