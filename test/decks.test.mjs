// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {decode, parseInput, compare, encodeExample, examples} from '../public/decks.mjs';

test('parses bare deckstrings and game exports with CRLF comments', () => {
  const deck = parseInput(`### 我的法师\r\n# comment\r\n${examples[0]}\r\n# footer`);
  assert.equal(deck.name, '我的法师');
  assert.equal(deck.cards.reduce((n,c) => n+c.count,0), 30);
  assert.equal(decode(examples[1]).heroes[0], 637);
});
test('supports older deckstrings without sideboard flag', () => {
  const bytes = atob(examples[0]);
  assert.deepEqual(decode(btoa(bytes.slice(0,-1))).cards, decode(examples[0]).cards);
});
test('computes multiset differences including partially shared copies', () => {
  const a = decode(encodeExample([[315,2],[531,1]]));
  const b = decode(encodeExample([[315,1],[555,2]]));
  const result = compare(a,b);
  assert.equal(result.common,1); assert.equal(result.removed,2); assert.equal(result.added,2);
  assert.equal(result.totalA,3); assert.equal(result.totalB,3);
  assert.equal(result.rows.find(row => row.id === 315).delta,-1);
  assert.equal(compare(a,a).removed,0);
});
test('sideboards distinguish owners and do not inflate main deck totals', () => {
  const a = decode(encodeExample([[315,2],[531,1]], [[555,1,315],[662,3,315]]));
  const b = decode(encodeExample([[315,2],[531,1]], [[555,1,531],[662,2,315]]));
  const result = compare(a,b);
  assert.equal(result.sideboard.length,3); assert.equal(result.totalA,3); assert.equal(result.common,3);
  assert.equal(result.sideboard.find(row => row.owner === 315 && row.id === 555).delta,-1);
  assert.equal(result.sideboard.find(row => row.owner === 531 && row.id === 555).delta,1);
  assert.equal(result.sideboard.find(row => row.id === 662).delta,-1);
});
test('rejects corrupt, truncated, duplicated and unknown extension data', () => {
  for (const value of ['', 'hello', 'AA==', '%%%%', examples[0]+'====', btoa(atob(examples[0])+'\x01')]) assert.throws(() => decode(value));
  assert.throws(() => parseInput('# only comments'));
  assert.throws(() => decode(encodeExample([[315,1],[315,1]])));
  assert.throws(() => decode(encodeExample([[315,2]],[[555,1,999]])));
  const bytes = atob(examples[0]);
  for (let i=0;i<bytes.length-1;i++) assert.throws(() => decode(btoa(bytes.slice(0,i))));
});
test('supports classic and twist modes', () => {
  for (const format of [3,4]) {
    const bytes = Uint8Array.from(atob(examples[0]),c=>c.charCodeAt(0)); bytes[2]=format;
    assert.equal(decode(btoa(String.fromCharCode(...bytes))).format,format);
  }
});

test('official reprints compare as one card while keeping each original version', () => {
  const a = decode(encodeExample([[120180,1],[315,1]]));
  const b = decode(encodeExample([[39225,1],[531,1]]));
  const before = JSON.stringify([a,b]);
  const metadata = new Map([[120180,{id:120180,copyOfCardId:[39225]}]]);
  const result = compare(a,b,metadata);
  assert.equal(result.common,1); assert.equal(result.removed,1); assert.equal(result.added,1);
  const curator = result.rows.find(row=>row.aId===120180);
  assert.equal(curator.bId,39225); assert.equal(curator.delta,0);
  assert.equal(JSON.stringify([a,b]),before);
});

test('multiple reprint records in a deck have their quantities summed', () => {
  const a = decode(encodeExample([[120180,1],[39225,1]]));
  const b = decode(encodeExample([[39225,1]]));
  const result = compare(a,b,new Map([[39225,{id:39225,copyOfCardId:[120180]}]]));
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].a,2); assert.equal(result.rows[0].b,1);
  assert.equal(result.removed,1); assert.equal(result.added,0); assert.equal(result.common,1);
  assert.equal(result.totalA,2); assert.equal(result.totalB,1);
});

test('one-way and transitive official links form the same card family', () => {
  const a = {cards:[{id:10,count:2}],sideboard:[]};
  const b = {cards:[{id:30,count:1}],sideboard:[]};
  const metadata = new Map([[10,{id:10,copyOfCardId:[20]}],[30,{id:30,copyOfCardId:[20]}]]);
  const result = compare(a,b,metadata);
  assert.equal(result.rows.length,1);
  assert.equal(result.common,1); assert.equal(result.removed,1);
});

test('names and artwork alone cannot merge distinct card IDs', () => {
  const a = {cards:[{id:10,count:1}],sideboard:[]};
  const b = {cards:[{id:20,count:1}],sideboard:[]};
  const metadata = new Map([10,20].map(id=>[id,{id,name:'Same name',cropImage:'https://example.com/same.png',cropImageSourceId:10}]));
  const result = compare(a,b,metadata);
  assert.equal(result.rows.length,2); assert.equal(result.common,0);
  assert.equal(result.removed,1); assert.equal(result.added,1);
});

test('sideboard cards and their owners both match across official reprints', () => {
  const a = decode(encodeExample([[110,1]],[[11,1,110]]));
  const b = decode(encodeExample([[210,1]],[[21,1,210]]));
  const metadata = new Map([[110,{id:110,copyOfCardId:[210]}],[11,{id:11,copyOfCardId:[21]}]]);
  const result = compare(a,b,metadata);
  assert.equal(result.common,1); assert.equal(result.sideboard.length,1);
  assert.equal(result.sideboard[0].delta,0);
  assert.equal(result.sideboard[0].aOwner,110); assert.equal(result.sideboard[0].bOwner,210);
  assert.equal(result.sideboard[0].aId,11); assert.equal(result.sideboard[0].bId,21);
});
