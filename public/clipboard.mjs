// SPDX-License-Identifier: GPL-2.0-only
import {translate, cardDisplayName} from './i18n.mjs';

export function formatDifferences({diff, decks, metadata = new Map(), locale = 'zh_CN'}) {
  const t = (key, params) => translate(locale, key, params);
  const name = (id, owner) => cardDisplayName(locale, id, owner, metadata.get(id));
  const lines = [];
  if (decks[0].format !== decks[1].format) lines.push(t('differentFormat'));
  if (decks[0].heroes.join(',') !== decks[1].heroes.join(',')) lines.push(t('differentHero'));
  const hasMetadataChanges = lines.length > 0;
  let hasCardChanges = false;
  for (const [title, rows] of [[null, diff.rows], [t('sideboard'), diff.sideboard]]) {
    const changed = rows.filter(row => row.delta !== 0).sort((a, b) =>
      Number(a.delta > 0) - Number(b.delta > 0)
      || (metadata.get(a.id)?.manaCost ?? 999) - (metadata.get(b.id)?.manaCost ?? 999)
      || name(a.id, a.owner).localeCompare(name(b.id, b.owner), locale === 'zh_CN' ? 'zh-CN' : 'en')
      || (a.owner || 0) - (b.owner || 0));
    if (!changed.length) continue;
    hasCardChanges = true;
    if (title) { if (lines.length) lines.push(''); lines.push(title); }
    for (const row of changed) {
      const side = row.delta < 0 ? 'a' : 'b';
      const id = row[`${side}Id`] ?? row.id, owner = row[`${side}Owner`] ?? row.owner;
      lines.push(`${row.delta > 0 ? '+' : ''}${row.delta} ${name(id, owner)}${owner ? ` [${name(owner)}]` : ''}`);
    }
  }
  if (!hasCardChanges) lines.push(t(hasMetadataChanges ? 'sameCardsDifferentMetadata' : 'identical'));
  return lines.join('\n');
}
