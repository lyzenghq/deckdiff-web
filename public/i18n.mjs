// SPDX-License-Identifier: GPL-2.0-only
import {zilliaxAppearanceModule} from './decks.mjs';

const BASE_HERO_CLASSES = new Map([
  [7, 10], [31, 3], [274, 2], [637, 4], [671, 5], [813, 6],
  [893, 9], [930, 7], [1066, 8], [56550, 14], [78065, 1],
]);

export const messages = {
  zh_CN: {
    brand: 'DeckDIFF Web', pageTitle: 'DeckDIFF Web · 炉石卡组比较', description: '比较两个炉石传说卡组的卡牌、数量与备牌差异。',
    language: '界面语言', title: '卡组比较', instructions: '输入两个卡组代码，比较卡牌与数量变化。支持游戏内导出的完整文本。',
    deckA: '原始卡组', deckB: '目标卡组', paste: '粘贴', clear: '清空',
    placeholderA: '粘贴卡组 A 的代码或导出文本', placeholderB: '粘贴卡组 B 的代码或导出文本',
    hintA: 'A：比较基准', hintB: 'B：比较目标', swap: '交换 A / B', example: '载入示例', compare: '比较卡组',
    emptyTitle: '尚未比较', emptyHelp: '输入两个卡组代码后点击“比较卡组”。', results: '比较结果', copy: '复制差异',
    filters: '显示范围', differences: '差异', allCards: '全部卡牌', commonCards: '共同卡牌', sort: '法力值 / 卡名排序 · 点击查看详情',
    sideboard: '备牌 / 模块', sideboardHelp: '单独比较，不计入主卡组张数', copyright: '卡牌版权归 Blizzard Entertainment 所有。',
    projectRepository: 'GitHub 项目仓库', officialLibrary: '官方卡牌库', softwareLicense: '代码许可：GPLv2', close: '关闭卡牌详情', retry: '重试加载',
    similarity: '相似度', similarityHelp: '共同张数 / 较大卡组张数', shared: '共同卡牌', removed: '从 A 移出', added: '加入 B',
    mainCount: '{count} 张主卡牌', hero: '英雄 #{ids}', notIncluded: '未携带', unknownCard: '卡牌 #{id}',
    appearance: '外观：{name}', appearanceDetails: '这项选择只改变奇利亚斯的外观。费用、属性与效果由所选的两个功能模块决定。',
    cardLabel: '{name}，{count} 张，查看详情', manaLabel: '法力值 {cost}', unknown: '未知', owner: '归属：{name}',
    identical: '两份卡组的卡牌组成相同。', sameCardsDifferentMetadata: '卡牌组成相同；英雄或模式不同。', noCommon: '两份卡组没有共同卡牌。',
    differentFormat: '两份卡组的模式不同。', differentHero: '两份卡组的英雄不同。', footnote: '以 A 为基准，显示变更到 B 的数量。备牌按所属卡牌分别比较。',
    cardImage: '{name} 官方卡图', noDetails: '暂无卡牌详情。', viewOfficial: '在官方卡牌库查看', copied: '差异已复制。',
    clipboardEmpty: '剪贴板为空，请先复制卡组代码。', clipboardRead: '无法读取剪贴板，请使用 Ctrl / ⌘ + V 粘贴。', clipboardWrite: '浏览器不允许写入剪贴板，请手动选择并复制结果。',
    imageFailed: '卡图加载失败，可通过官方卡牌库链接查看。', loading: '正在加载官方卡牌数据…', missingCards: '官方卡牌库暂未返回 {count} 张卡牌，已保留其 ID 和数量。',
    timeout: '官方卡牌库响应超时。差异已按 ID 计算，请重试加载。', apiUnavailable: '无法加载官方卡牌数据。差异已按 ID 计算，请重试加载。', apiConfiguration: '官方卡牌服务尚未配置，请联系服务维护者。',
    reloading: '正在重新加载官方卡牌数据（第 {attempt}/{total} 次）…', retryBusy: '重新加载中…', reloaded: '官方卡牌数据已重新加载。',
    reloadFailed: '重新加载失败（已尝试 {attempt} 次）。{reason}',
    localServerUnavailable: '无法连接本地服务，请确认启动窗口仍在运行，再重新加载。',
    'format.1': '狂野', 'format.2': '标准', 'format.3': '经典', 'format.4': '幻变',
    'class.1': '死亡骑士', 'class.2': '德鲁伊', 'class.3': '猎人', 'class.4': '法师', 'class.5': '圣骑士', 'class.6': '牧师',
    'class.7': '潜行者', 'class.8': '萨满祭司', 'class.9': '术士', 'class.10': '战士', 'class.14': '恶魔猎手',
    'module.104944': '递归模块', 'module.104945': '失控模块', 'module.104946': '能量模块', 'module.104947': '输能模块',
    'module.104948': '病毒模块', 'module.104949': '复制模块', 'module.104950': '计数模块', 'module.104951': '完美模块',
    'error.invalidBase64': '卡组代码不是有效的 Base64。', 'error.incomplete': '卡组代码不完整。', 'error.outOfRange': '卡组代码中的数值超出范围。', 'error.invalidValue': '卡组代码中的数值无效。',
    'error.invalidId': '无效的卡牌 ID 或数量。', 'error.unsupportedVersion': '不支持的卡组代码版本。', 'error.unsupportedFormat': '不支持的卡组模式。', 'error.missingHero': '卡组缺少英雄。',
    'error.tooManyCards': '卡组包含过多卡牌。', 'error.duplicateCard': '卡组有重复的卡牌记录。', 'error.unknownExtension': '卡组包含无法识别的扩展数据，请检查代码。', 'error.emptyDeck': '卡组中没有卡牌。',
    'error.missingOwner': '备牌对应的主卡牌不存在。', 'error.emptyInput': '请先粘贴卡组代码。', 'error.inputTooLong': '输入内容过长。', 'error.invalidDeck': '未找到有效的卡组代码。',
  },
  en_US: {
    brand: 'DeckDIFF Web', pageTitle: 'DeckDIFF Web · Hearthstone Deck Comparison', description: 'Compare cards, quantities, and sideboards in two Hearthstone decks.',
    language: 'Interface language', title: 'Deck comparison', instructions: 'Enter two deck codes to compare cards and quantities. Full in-game deck exports are supported.',
    deckA: 'Original deck', deckB: 'Target deck', paste: 'Paste', clear: 'Clear',
    placeholderA: 'Paste deck A code or exported deck text', placeholderB: 'Paste deck B code or exported deck text',
    hintA: 'A: comparison baseline', hintB: 'B: comparison target', swap: 'Swap A / B', example: 'Load example', compare: 'Compare decks',
    emptyTitle: 'No comparison yet', emptyHelp: 'Enter two deck codes, then select “Compare decks”.', results: 'Comparison results', copy: 'Copy changes',
    filters: 'Display scope', differences: 'Changes', allCards: 'All cards', commonCards: 'Shared cards', sort: 'Sorted by mana / name · Select a card for details',
    sideboard: 'Sideboard / modules', sideboardHelp: 'Compared separately; excluded from main deck totals', copyright: 'Card content © Blizzard Entertainment.',
    projectRepository: 'GitHub repository', officialLibrary: 'Official card library', softwareLicense: 'Code license: GPLv2', close: 'Close card details', retry: 'Retry loading',
    similarity: 'Similarity', similarityHelp: 'Shared copies / larger deck size', shared: 'Shared copies', removed: 'Removed from A', added: 'Added to B',
    mainCount: 'Main deck: {count}', hero: 'Hero #{ids}', notIncluded: 'Not included', unknownCard: 'Card #{id}',
    appearance: 'Appearance: {name}', appearanceDetails: 'This choice changes how Zilliax looks. The two functional modules determine its cost, stats, and effects.',
    cardLabel: '{name}, quantity: {count}, view details', manaLabel: 'Mana cost {cost}', unknown: 'unknown', owner: 'Owner: {name}',
    identical: 'Both decks contain the same cards and quantities.', sameCardsDifferentMetadata: 'Cards and quantities match; heroes or formats differ.', noCommon: 'These decks have no shared cards.',
    differentFormat: 'The decks use different formats.', differentHero: 'The decks use different heroes.', footnote: 'Quantities show changes from A to B. Sideboard cards are compared by owner.',
    cardImage: '{name} official card image', noDetails: 'Card details are unavailable.', viewOfficial: 'View in the official card library', copied: 'Changes copied.',
    clipboardEmpty: 'The clipboard is empty. Copy a deck code first.', clipboardRead: 'Clipboard access is unavailable. Use Ctrl / ⌘ + V to paste.', clipboardWrite: 'Clipboard access is unavailable. Select and copy the results manually.',
    imageFailed: 'The image could not load. Use the official card library link to view it.', loading: 'Loading official card data…', missingCards: 'Missing card entries: {count}. IDs and quantities are retained.',
    timeout: 'The official library timed out. Changes are shown by card ID. Retry to load card details.', apiUnavailable: 'Official card data could not load. Changes are shown by card ID. Retry to load card details.', apiConfiguration: 'The official card service is not configured. Contact the service administrator.',
    reloading: 'Reloading official card data (attempt {attempt}/{total})…', retryBusy: 'Reloading…', reloaded: 'Official card data reloaded.',
    reloadFailed: 'Reload failed. Attempts: {attempt}. {reason}',
    localServerUnavailable: 'Cannot connect to the local service. Check that the server window is still running, then reload the card data.',
    'format.1': 'Wild', 'format.2': 'Standard', 'format.3': 'Classic', 'format.4': 'Twist',
    'class.1': 'Death Knight', 'class.2': 'Druid', 'class.3': 'Hunter', 'class.4': 'Mage', 'class.5': 'Paladin', 'class.6': 'Priest',
    'class.7': 'Rogue', 'class.8': 'Shaman', 'class.9': 'Warlock', 'class.10': 'Warrior', 'class.14': 'Demon Hunter',
    'module.104944': 'Recursive Module', 'module.104945': 'Haywire Module', 'module.104946': 'Power Module', 'module.104947': 'Pylon Module',
    'module.104948': 'Virus Module', 'module.104949': 'Twin Module', 'module.104950': 'Ticking Module', 'module.104951': 'Perfect Module',
    'error.invalidBase64': 'The deck code is not valid Base64.', 'error.incomplete': 'The deck code is incomplete.', 'error.outOfRange': 'A value in the deck code is out of range.', 'error.invalidValue': 'The deck code contains an invalid value.',
    'error.invalidId': 'Invalid card ID or quantity.', 'error.unsupportedVersion': 'Unsupported deck code version.', 'error.unsupportedFormat': 'Unsupported deck format.', 'error.missingHero': 'The deck has no hero.',
    'error.tooManyCards': 'The deck contains too many cards.', 'error.duplicateCard': 'The deck contains duplicate card records.', 'error.unknownExtension': 'The deck code contains an unsupported extension. Check the code.', 'error.emptyDeck': 'The deck contains no cards.',
    'error.missingOwner': 'A sideboard owner is missing from the main deck.', 'error.emptyInput': 'Paste a deck code first.', 'error.inputTooLong': 'The input is too long.', 'error.invalidDeck': 'No valid deck code was found.',
  },
};

export function translate(locale, key, params = {}) {
  const template = messages[locale]?.[key] ?? messages.zh_CN[key];
  if (template === undefined) throw new Error(`Unknown translation key: ${key}`);
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

export function heroClassName(locale, id, card) {
  const key = `class.${BASE_HERO_CLASSES.get(id) ?? card?.classId}`;
  return Object.hasOwn(messages.zh_CN, key) ? translate(locale, key) : null;
}

export function cardDisplayName(locale, id, owner, card) {
  const module = zilliaxAppearanceModule(id, owner);
  if (module) return translate(locale, 'appearance', {name: translate(locale, `module.${module}`)});
  return card?.name || translate(locale, 'unknownCard', {id});
}
