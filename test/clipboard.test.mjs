// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {compare} from '../public/decks.mjs';
import {formatDifferences} from '../public/clipboard.mjs';

const deck = cards => ({cards,sideboard:[],format:1,heroes:[637]});
test('clipboard contains only actual signed changes, with removals before additions', () => {
  const a = deck([{id:120180,count:1},{id:10,count:1}]);
  const b = deck([{id:39225,count:1},{id:20,count:1}]);
  const metadata = new Map([
    [120180,{id:120180,name:'馆长',copyOfCardId:[39225]}],
    [39225,{id:39225,name:'馆长',copyOfCardId:[120180]}],
    [10,{id:10,name:'禁忌之果',manaCost:10}],
    [20,{id:20,name:'分岔路口',manaCost:1}],
  ]);
  const text = formatDifferences({diff:compare(a,b,metadata),decks:[a,b],metadata});
  assert.equal(text,'-1 禁忌之果\n+1 分岔路口');
});

test('clipboard uses net quantities and the original version on the changed side', () => {
  const a = deck([{id:120180,count:1}]), b = deck([{id:39225,count:2}]);
  const metadata = new Map([[120180,{id:120180,name:'New Curator',copyOfCardId:[39225]}],[39225,{id:39225,name:'Original Curator'}]]);
  const diff = compare(a,b,metadata);
  assert.equal(formatDifferences({diff,decks:[a,b],metadata,locale:'en_US'}),'+1 Original Curator');
});

test('unchanged families have no signed changes; format warnings are preserved', () => {
  const a = deck([{id:10,count:1}]), b = {...a,format:2};
  const text = formatDifferences({diff:compare(a,b),decks:[a,b],locale:'en_US'});
  assert.equal(text,'The decks use different formats.\nCards and quantities match; heroes or formats differ.');
  assert.equal(formatDifferences({diff:compare(a,a),decks:[a,a]}),'两份卡组的卡牌组成相同。');
});

test('sideboard changes retain their section and the correct owner name', () => {
  const a = {...deck([{id:10,count:1}]),sideboard:[{id:11,owner:10,count:1}]};
  const b = {...deck([{id:20,count:1}]),sideboard:[{id:21,owner:20,count:2}]};
  const metadata = new Map([[10,{id:10,name:'旧主卡',copyOfCardId:[20]}],[20,{id:20,name:'新主卡'}],[11,{id:11,name:'旧备牌',copyOfCardId:[21]}],[21,{id:21,name:'新备牌'}]]);
  assert.equal(formatDifferences({diff:compare(a,b,metadata),decks:[a,b],metadata}),'备牌 / 模块\n+1 新备牌 [新主卡]');
});
