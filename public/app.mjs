// SPDX-License-Identifier: GPL-2.0-only
import {parseInput, compare, examples, isZilliaxModule, zilliaxAppearanceModule} from './decks.mjs';
import {translate, heroClassName, cardDisplayName} from './i18n.mjs';
import {formatDifferences} from './clipboard.mjs';
import {loadCardData} from './card-loader.mjs';

const $ = selector => document.querySelector(selector);
const inputs = [$('#deck-a'), $('#deck-b')];
const state = {
  locale: 'en_US', filter: 'diff', decks: null, diff: null,
  metadata: new Map(), loadStates: new Map(), requests: new Map(),
  generation: 0, activeCard: null, errors: [null, null], notice: null, toast: null,
};
const t = (key, params) => translate(state.locale, key, params);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const cardImage = (id, kind, value) => {
  try { return new URL(value).protocol === 'https:' ? `/api/card-image/${state.locale}/${id}/${kind}` : ''; }
  catch { return ''; }
};
const plainText = value => String(value || '').replace(/<[^>]*>/g, '').replace(/\[x\]/g, '');
const metadata = id => state.metadata.get(state.locale)?.get(id);
const officialLibraryUrl = () => `https://hearthstone.blizzard.com/${state.locale === 'zh_CN' ? 'zh-tw' : 'en-us'}/cards`;
const STORAGE_KEY = 'deckdiff-web.v1';
const comparisonMetadata = () => new Map([...state.metadata.values()].flatMap(cards => [...cards]));
let toastTimer;

function toast(key) {
  state.toast = key;
  $('#toast').textContent = t(key);
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; state.toast = null; }, 3000);
}
function renderNotice() {
  const el = $('#notice'), item = state.notice;
  el.textContent = item ? t(item.key, item.params) : '';
  el.hidden = !item;
  if (item?.retry) {
    const button = document.createElement('button');
    const loading = Boolean(state.loadStates.get(state.locale)?.loading);
    button.type = 'button'; button.className = 'text-button'; button.textContent = t(loading ? 'retryBusy' : 'retry');
    button.disabled = loading;
    button.addEventListener('click', () => loadMetadata({refresh: true})); el.append(button);
  }
}
function notice(key, params = {}, retry = false) {
  state.notice = key ? {key, params, retry} : null;
  renderNotice();
}
function dataNotice() {
  const status = state.loadStates.get(state.locale);
  $('#copy-result').disabled = Boolean(status?.loading);
  if (status?.loading) notice(status.reloading ? 'reloading' : 'loading', {attempt: status.attempt, total: status.total}, Boolean(status.reloading));
  else if (status?.error) notice(status.reloading ? 'reloadFailed' : status.error, {attempt: status.attempt, reason: t(status.error)}, true);
  else if (status?.missing?.length) notice('missingCards', {count: status.missing.length}, true);
  else if (status?.reloaded) notice('reloaded');
  else notice(null);
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({a: inputs[0].value, b: inputs[1].value, locale: state.locale})); }
  catch { /* Keep the app usable when storage is disabled. */ }
}
try {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('deck-compare.v1') || localStorage.getItem('deckdiff.v1') || 'null');
  if (data) {
    inputs[0].value = typeof data.a === 'string' ? data.a.slice(0,100000) : '';
    inputs[1].value = typeof data.b === 'string' ? data.b.slice(0,100000) : '';
    if (data.locale === 'en_US' || data.locale === 'zh_CN') state.locale = data.locale;
  }
} catch { /* Ignore stale settings. */ }

function renderFieldErrors() {
  state.errors.forEach((code, index) => {
    $(`#error-${index ? 'b' : 'a'}`).textContent = code ? t(`error.${code}`) : '';
    if (code) inputs[index].setAttribute('aria-invalid', 'true');
    else inputs[index].removeAttribute('aria-invalid');
  });
}
function renderInterface() {
  document.documentElement.lang = state.locale === 'zh_CN' ? 'zh-CN' : 'en';
  document.title = t('pageTitle');
  $('meta[name="description"]').content = t('description');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)); });
  document.querySelectorAll('[data-locale]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.locale === state.locale)); });
  $('#official-library').href = officialLibraryUrl();
  renderFieldErrors(); renderNotice();
  if (state.toast) $('#toast').textContent = t(state.toast);
}
function invalidate() {
  cancelRequests();
  state.generation++; state.decks = null; state.diff = null;
  $('#results').hidden = true; $('#empty').hidden = false;
  notice(null); save();
}
inputs.forEach((input, index) => input.addEventListener('input', () => {
  invalidate(); state.errors[index] = null; renderFieldErrors();
}));
function parse() {
  state.errors = [null, null];
  const decks = inputs.map((input, index) => {
    try { return parseInput(input.value); }
    catch (error) { state.errors[index] = error.code || 'invalidDeck'; return null; }
  });
  renderFieldErrors();
  const invalid = state.errors.findIndex(Boolean);
  if (invalid !== -1) { inputs[invalid].focus(); return null; }
  return decks;
}
function runComparison() {
  const decks = parse(); if (!decks) return;
  cancelRequests();
  state.generation++; state.decks = decks; state.diff = compare(...decks);
  state.metadata.clear(); state.loadStates.clear(); save();
  $('#empty').hidden = true; $('#results').hidden = false;
  render(); loadMetadata();
}
$('#compare-form').addEventListener('submit', event => { event.preventDefault(); runComparison(); });
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); runComparison(); }
});
$('#example').addEventListener('click', () => {
  // Default deck labels are translated; custom names supplied by users are preserved.
  [inputs[0].value, inputs[1].value] = examples;
  runComparison();
});
$('#swap').addEventListener('click', () => {
  [inputs[0].value, inputs[1].value] = [inputs[1].value, inputs[0].value];
  state.errors = [null, null]; renderFieldErrors();
  if (state.decks) runComparison(); else invalidate();
});
document.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => {
  const input = inputs[button.dataset.clear === 'a' ? 0 : 1];
  input.value = ''; input.dispatchEvent(new Event('input')); input.focus();
}));
document.querySelectorAll('[data-paste]').forEach(button => button.addEventListener('click', async () => {
  const input = inputs[button.dataset.paste === 'a' ? 0 : 1];
  try {
    if (!navigator.clipboard?.readText) throw new Error();
    const value = await navigator.clipboard.readText();
    if (!value.trim()) return toast('clipboardEmpty');
    input.value = value; input.dispatchEvent(new Event('input')); input.focus();
  } catch { toast('clipboardRead'); input.focus(); }
}));
document.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => {
  if (state.locale === button.dataset.locale) return;
  state.locale = button.dataset.locale; save(); renderInterface();
  if (state.decks) {
    render();
    if (state.metadata.has(state.locale)) dataNotice();
    else loadMetadata();
  }
  if (state.activeCard && $('#card-dialog').open) openCard(state.activeCard);
}));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { b.setAttribute('aria-pressed', String(b === button)); });
  if (state.diff) render();
}));

function cancelRequests() {
  for (const request of state.requests.values()) request.controller.abort();
  state.requests.clear();
}
async function loadMetadata({refresh = false} = {}) {
  if (!state.decks) return;
  const generation = state.generation, locale = state.locale, requestKey = `${generation}:${locale}`;
  if (state.requests.has(requestKey)) {
    if (!refresh) { dataNotice(); return; }
    state.requests.get(requestKey).controller.abort();
  }
  const request = {controller: new AbortController()};
  const isCurrent = () => generation === state.generation && state.requests.get(requestKey) === request;
  const ids = [...new Set(state.decks.flatMap(deck => [...deck.cards, ...deck.sideboard].flatMap(card => [card.id, card.owner].filter(Boolean))))];
  state.requests.set(requestKey, request);
  try {
    const data = await loadCardData({ids, locale, refresh, signal: request.controller.signal, onAttempt: ({attempt, total}) => {
      if (!isCurrent()) return;
      state.loadStates.set(locale, {loading: true, reloading: refresh, attempt, total});
      if (locale === state.locale) dataNotice();
    }});
    if (!isCurrent()) return;
    const cards = new Map(data.cards.map(card => [card.id, card]));
    state.metadata.set(locale, cards);
    state.loadStates.set(locale, {missing: data.missing, reloaded: refresh});
    state.diff = compare(...state.decks, comparisonMetadata());
    render();
    if (locale === state.locale) {
      dataNotice();
      if (state.activeCard && $('#card-dialog').open) openCard(state.activeCard);
    }
    const portraits = [...new Set(state.decks.flatMap(deck => deck.heroes))]
      .filter(id => !heroClassName(locale, id, cards.get(id)));
    if (portraits.length) {
      // Hero portraits supplement the heading after the comparison has rendered.
      const data = await loadCardData({ids: portraits, locale, signal: request.controller.signal}).catch(() => null);
      if (!data || !isCurrent()) return;
      for (const portrait of data.cards) cards.set(portrait.id, portrait);
      if (locale === state.locale) renderDeckHeadings();
    }
  } catch (error) {
    if (!isCurrent() || request.controller.signal.aborted) return;
    const errors = {API_TIMEOUT: 'timeout', API_CONFIGURATION: 'apiConfiguration', LOCAL_SERVER_UNAVAILABLE: 'localServerUnavailable'};
    state.loadStates.set(locale, {error: errors[error.code] || 'apiUnavailable', reloading: refresh, attempt: state.loadStates.get(locale)?.attempt || 1});
    if (locale === state.locale) dataNotice();
  } finally { if (state.requests.get(requestKey) === request) state.requests.delete(requestKey); }
}
function visible(row) {
  return state.filter === 'all' || (state.filter === 'diff' ? row.delta !== 0 : row.common > 0);
}
function sorted(rows) {
  const name = ({id, owner}) => zilliaxAppearanceModule(id, owner) ? cardName(id, owner) : metadata(id)?.name || String(id);
  return [...rows].sort((a,b) => (rowMana(a.id, a.owner) ?? 999) - (rowMana(b.id, b.owner) ?? 999)
    || name(a).localeCompare(name(b), state.locale === 'zh_CN' ? 'zh-CN' : 'en')
    || (a.owner || 0) - (b.owner || 0));
}
function cardName(id, owner) { return cardDisplayName(state.locale, id, owner, metadata(id)); }
function rowMana(id, owner) { return zilliaxAppearanceModule(id, owner) ? null : metadata(id)?.manaCost; }
function cardRow(row, side) {
  const id = row[`${side}Id`] ?? row.id, ownerId = row[`${side}Owner`] ?? row.owner;
  const count = row[side], card = metadata(id);
  if (!count) return `<div class="card-placeholder">${esc(t('notIncluded'))}</div>`;
  const image = cardImage(id, 'crop', card?.cropImage);
  const moduleImage = !image && isZilliaxModule(id, ownerId) && cardImage(id, 'full', card?.image);
  const name = cardName(id, ownerId), isAppearance = Boolean(zilliaxAppearanceModule(id, ownerId));
  const changed = row.delta !== 0, owner = ownerId ? cardName(ownerId) : null;
  const statusClass = changed ? (side === 'a' && row.delta < 0 ? 'removed-card' : side === 'b' && row.delta > 0 ? 'added-card' : '') : 'common-card';
  return `<button type="button" class="card-row ${statusClass}" data-card="${id}" data-owner="${ownerId || 0}" aria-label="${esc(t('cardLabel', {name, count}))}">
    ${image ? `<img class="card-art" src="${esc(image)}" alt="" loading="lazy">` : ''}
    ${moduleImage ? `<span class="card-art card-art-window"><img class="card-art-render" src="${esc(moduleImage)}" alt="" loading="lazy"></span>` : ''}
    ${isAppearance ? '<span class="mana" aria-hidden="true"></span>' : `<span class="mana" aria-label="${esc(t('manaLabel', {cost: card?.manaCost ?? t('unknown')}))}">${esc(card?.manaCost ?? '?')}</span>`}
    <span class="card-name">${esc(name)}${owner ? `<small>${esc(t('owner', {name: owner}))}</small>` : ''}</span><span class="card-copy">×${count}</span></button>`;
}
function rowHtml(row) {
  return `<div class="compare-row">${cardRow(row, 'a')}<div class="row-delta">${row.delta === 0 ? '=' : `<span class="${row.delta > 0 ? 'plus' : 'minus'}">${row.delta > 0 ? '+' : '−'}${Math.abs(row.delta)}</span>`}</div>${cardRow(row, 'b')}</div>`;
}
function renderDeckHeadings() {
  $('#deck-headings').innerHTML = state.decks.map((deck,index) => {
    const name = deck.name || t(index ? 'deckB' : 'deckA');
    const classes = deck.heroes.map(id => heroClassName(state.locale, id, metadata(id)) || t('hero', {ids: id}));
    return `<div class="deck-heading"><strong><span class="deck-letter">${index ? 'B' : 'A'}</span><span class="deck-name" title="${esc(name)}">${esc(name)}<small>${esc(t(`format.${deck.format}`))} · ${esc(classes.join(', '))}</small></span></strong><span>${esc(t('mainCount', {count: index ? state.diff.totalB : state.diff.totalA}))}</span></div>`;
  }).join('');
}
function render() {
  const d = state.diff; if (!d) return;
  const max = Math.max(d.totalA, d.totalB), percent = max ? Math.round(d.common / max * 100) : 100;
  $('#summary').innerHTML = `<div class="stat"><strong>${percent}%</strong><span>${esc(t('similarity'))}</span><small>${esc(t('similarityHelp'))}</small></div><div class="stat"><strong>${d.common}</strong><span>${esc(t('shared'))}</span></div><div class="stat removed"><strong>−${d.removed}</strong><span>${esc(t('removed'))}</span></div><div class="stat added"><strong>+${d.added}</strong><span>${esc(t('added'))}</span></div>`;
  $('#diff-count').textContent = d.rows.filter(row => row.delta !== 0).length + d.sideboard.filter(row => row.delta !== 0).length;
  renderDeckHeadings();
  const rows = sorted(d.rows.filter(visible)), sideboard = sorted(d.sideboard.filter(visible));
  $('#cards').innerHTML = rows.map(rowHtml).join('');
  $('#sideboard-section').hidden = !sideboard.length;
  $('#sideboard').innerHTML = sideboard.map(rowHtml).join('');
  $('#no-rows').hidden = !!(rows.length || sideboard.length);
  const differentFormat = state.decks[0].format !== state.decks[1].format;
  const differentHero = state.decks[0].heroes.join(',') !== state.decks[1].heroes.join(',');
  $('#no-rows').textContent = t(state.filter === 'diff' ? (differentFormat || differentHero ? 'sameCardsDifferentMetadata' : 'identical') : 'noCommon');
  const warnings = [differentFormat ? t('differentFormat') : '', differentHero ? t('differentHero') : ''].filter(Boolean).join(' ');
  $('#result-footnote').innerHTML = `${warnings ? `<span>${esc(warnings)}</span> ` : ''}${esc(t('footnote'))}`;
}
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement) {
    event.target.classList.add('image-error');
    if (event.target.closest('#card-detail')) toast('imageFailed');
  }
}, true);
function openCard(selection) {
  const {id, owner} = selection;
  state.activeCard = selection;
  const card = metadata(id), image = cardImage(id, 'full', card?.image), name = cardName(id, owner);
  const description = zilliaxAppearanceModule(id, owner) ? t('appearanceDetails') : plainText(card?.text) || t('noDetails');
  $('#card-detail').innerHTML = `${image ? `<img src="${esc(image)}" alt="${esc(t('cardImage', {name}))}">` : ''}<h2 id="card-title">${esc(name)}</h2><p>${esc(description)}</p><a href="${officialLibraryUrl()}/${id}" target="_blank" rel="noreferrer">${esc(t('viewOfficial'))}</a>`;
  if (!$('#card-dialog').open) $('#card-dialog').showModal();
}
$('#results').addEventListener('click', event => {
  const button = event.target.closest('[data-card]');
  if (button) openCard({id: Number(button.dataset.card), owner: Number(button.dataset.owner)});
});
$('#close-dialog').addEventListener('click', () => $('#card-dialog').close());
$('#card-dialog').addEventListener('click', event => {
  if (event.target !== $('#card-dialog')) return;
  const bounds = event.target.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close();
});
$('#card-dialog').addEventListener('close', () => { state.activeCard = null; });
$('#copy-result').addEventListener('click', async () => {
  if (!state.diff || state.loadStates.get(state.locale)?.loading) return;
  const text = formatDifferences({diff: state.diff, decks: state.decks, metadata: state.metadata.get(state.locale), locale: state.locale});
  try { await navigator.clipboard.writeText(text); toast('copied'); }
  catch { notice('clipboardWrite'); }
});

renderInterface();
