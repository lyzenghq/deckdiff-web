// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {CardService} from '../lib/cards.mjs';
import {createApp} from '../server.mjs';
const card = {id:315,name:'火球术',manaCost:4,image:'https://example.com/card.png'};
const response = body => new Response(JSON.stringify(body), {headers:{'Content-Type':'application/json'}});
const curator = {id:120180,name:'馆长',manaCost:7,image:'https://example.com/curator-new.png',cropImage:null,copyOfCardId:[39225]};
const oldCurator = {id:39225,name:'馆长',manaCost:7,image:'https://example.com/curator-old.png',cropImage:'https://example.com/curator-art.png',copyOfCardId:[120180]};

test('missing reprint art uses an officially linked copy without replacing the card', async () => {
  const urls = [];
  const service = new CardService({env:{},fetcher:async url => {
    const parsed = new URL(url); urls.push(parsed);
    return response({cards:parsed.searchParams.get('ids') === '120180' ? [curator] : [oldCurator],pageCount:1});
  }});
  const result = await service.load([120180], 'zh_CN');
  assert.equal(urls.length,2);
  assert.equal(urls[1].searchParams.get('ids'),'39225');
  assert.equal(urls[1].searchParams.get('locale'),'zh_CN');
  assert.equal(result.cards.length,1);
  assert.equal(result.cards[0].id,120180);
  assert.equal(result.cards[0].name,curator.name);
  assert.equal(result.cards[0].image,curator.image);
  assert.equal(result.cards[0].cropImage,oldCurator.cropImage);
  assert.equal(result.cards[0].cropImageSourceId,39225);
  assert.deepEqual(result.cards[0].copyOfCardId,[39225]);
  await service.load([120180], 'zh_CN');
  assert.equal(urls.length,2);
});

test('native art takes priority and art in the same batch needs no extra request', async () => {
  let calls = 0;
  const service = new CardService({env:{},fetcher:async () => {
    calls++; return response({cards:[curator,oldCurator],pageCount:1});
  }});
  const result = await service.load([120180,39225], 'en_US');
  assert.equal(calls,1);
  assert.equal(result.cards.find(card=>card.id===120180).cropImageSourceId,39225);
  assert.equal(result.cards.find(card=>card.id===39225).cropImageSourceId,39225);
  assert.equal(result.cards.find(card=>card.id===39225).image,oldCurator.image);
});

test('an unavailable optional art lookup does not discard card metadata', async () => {
  let calls = 0;
  const service = new CardService({env:{},fetcher:async () => {
    if (++calls === 1) return response({cards:[curator],pageCount:1});
    throw new Error('Optional art endpoint unavailable');
  }});
  const result = await service.load([120180], 'zh_CN');
  assert.deepEqual(result.missing,[]);
  assert.equal(result.cards[0].image,curator.image);
  assert.equal(result.cards[0].cropImage,null);
});

test('child cards are not art sources and full card renders are not landscape art', async () => {
  let calls = 0;
  const service = new CardService({env:{},fetcher:async () => {
    calls++; return response({cards:[{...curator,copyOfCardId:undefined,childIds:[39225],cropImage:curator.image}],pageCount:1});
  }});
  const result = await service.load([120180], 'zh_CN');
  assert.equal(calls,1);
  assert.equal(result.cards[0].cropImage,null);
  assert.equal(result.cards[0].image,curator.image);
});

test('cached official copy art is reused for a missing reprint crop', async () => {
  let calls = 0;
  const service = new CardService({env:{},fetcher:async url => {
    calls++; return response({cards:new URL(url).searchParams.get('ids') === '39225' ? [oldCurator] : [curator],pageCount:1});
  }});
  await service.load([39225], 'zh_CN');
  const result = await service.load([120180], 'zh_CN');
  assert.equal(calls,2);
  assert.equal(result.cards[0].cropImage,oldCurator.cropImage);
});

test('official website provider filters IDs, separates locales, and caches requests', async () => {
  const urls = [];
  const service = new CardService({env:{},fetcher:async url => { urls.push(new URL(url)); return response({cards:[card,{id:999,name:'Unrequested'}],pageCount:1}); }});
  const result = await service.load([315,531],'zh_CN');
  assert.deepEqual(result.missing,[531]); assert.equal(result.cards.length,1);
  assert.equal(urls[0].hostname,'hearthstone.blizzard.com');
  assert.equal(urls[0].searchParams.get('ids'),'315,531');
  await service.load([315],'zh_CN'); assert.equal(urls.length,1);
  await service.load([315],'en_US'); assert.equal(urls.length,2);
  assert.equal(urls[1].pathname,'/en-us/api/cards');
  await assert.rejects(service.load([0],'zh_CN'));
});
test('deduplicates concurrent overlapping batches and rejects incomplete official responses',async()=>{
  const requests=[];
  const service=new CardService({env:{},fetcher:async url=>{
    const ids=new URL(url).searchParams.get('ids'); requests.push(ids);
    await new Promise(resolve=>setTimeout(resolve,10));
    return response({cards:ids==='315'?[card]:[{id:531,name:'炎爆术'}],pageCount:1});
  }});
  const [single,batch]=await Promise.all([service.load([315],'zh_CN'),service.load([315,531],'zh_CN')]);
  assert.deepEqual(requests,['315','531']);
  assert.deepEqual(single.cards.map(card=>card.id),[315]);
  assert.deepEqual(batch.cards.map(card=>card.id),[315,531]);
  const broken=new CardService({env:{},fetcher:async()=>response({cards:[card],pageCount:2})});
  await assert.rejects(broken.load([315],'zh_CN'),/完整/);
});

test('a retry fetches missing cards and keeps previously loaded cards', async () => {
  const requests=[];
  const service=new CardService({env:{},fetcher:async url=>{
    requests.push(new URL(url).searchParams.get('ids'));
    return response({cards:requests.length===1?[card]:[{id:531,name:'炎爆术'}],pageCount:1});
  }});
  assert.deepEqual((await service.load([315,531],'zh_CN')).missing,[531]);
  const result=await service.load([315,531],'zh_CN');
  assert.deepEqual(requests,['315,531','531']);
  assert.deepEqual(result.cards.map(card=>card.id),[315,531]);
});

test('a failed request does not leave a rejected promise blocking the next reload', async () => {
  let calls=0;
  const service=new CardService({env:{},fetcher:async()=>{
    if(++calls===1) throw new Error('Temporary failure');
    return response({cards:[card],pageCount:1});
  }});
  await assert.rejects(service.load([315],'zh_CN'));
  assert.equal(service.pending.size,0);
  assert.equal((await service.load([315],'zh_CN')).cards[0].id,315);
  assert.equal(calls,2);
});

test('invalid upstream mana values and null records do not reach card rendering', async () => {
  const service = new CardService({env: {}, fetcher: async () => response({cards: [null, {...card, manaCost: '<b>invalid</b>'}], pageCount: 1})});
  const result = await service.load([315], 'zh_CN');
  assert.equal(result.cards[0].name, card.name);
  assert.equal(result.cards[0].manaCost, null);
});
test('Battle.net mode keeps OAuth secret on server and reuses access token', async()=>{
  const requests=[];
  const service=new CardService({env:{CARD_PROVIDER:'battlenet',BLIZZARD_CLIENT_ID:'test-id',BLIZZARD_CLIENT_SECRET:'test-secret'},fetcher:async(url,init)=>{requests.push({url:String(url),init});return response(String(url).includes('/token')?{access_token:'test-token',expires_in:3600}:{cards:[card],pageCount:1});}});
  const result=await service.load([315],'zh_CN');
  await service.load([315],'en_US');
  assert.equal(requests.filter(r=>r.url.includes('/token')).length,1);
  assert.equal(requests[1].init.headers.Authorization,'Bearer test-token');
  assert.equal(JSON.stringify(result).includes('test-secret'),false);
  assert.equal(requests[1].url.includes('test-token'),false);
});

test('Battle.net refreshes a rejected token once and retries the card request', async () => {
  let tokens = 0, cardRequests = 0;
  const service = new CardService({env: {CARD_PROVIDER: 'battlenet', BLIZZARD_CLIENT_ID: 'test-id', BLIZZARD_CLIENT_SECRET: 'test-secret'}, fetcher: async (url, init) => {
    if (String(url).includes('/token')) return response({access_token: `token-${++tokens}`, expires_in: 3600});
    cardRequests++;
    if (cardRequests === 1) return new Response('', {status: 401});
    assert.equal(init.headers.Authorization, 'Bearer token-2');
    return response({cards: [card], pageCount: 1});
  }});
  assert.equal((await service.load([315], 'en_US')).cards.length, 1);
  assert.equal(tokens, 2);
  assert.equal(cardRequests, 2);
});
test('HTTP routes serve website, validate input, and block file traversal',async t=>{
  const app=createApp({cards:new CardService({env:{},fetcher:async()=>response({cards:[card],pageCount:1})})});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  const origin=`http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(origin)).status,200);
  const license=await fetch(origin+'/LICENSE');
  assert.equal(license.status,200);
  assert.match(license.headers.get('content-type'),/text\/plain/);
  assert.match(await license.text(),/GNU GENERAL PUBLIC LICENSE[\s\S]*Version 2, June 1991/);
  const translations=await fetch(origin+'/i18n.mjs');
  assert.equal(translations.status,200);
  assert.match(translations.headers.get('content-type'),/javascript/);
  assert.equal((await fetch(origin+'/clipboard.mjs')).status,200);
  assert.equal((await fetch(origin+'/card-loader.mjs')).status,200);
  for(const path of ['/api/cards?ids=315&locale=xx','/api/cards?ids=0','/api/cards?ids=-3','/.env','/package.json']) assert.equal((await fetch(origin+path)).status,path.startsWith('/api')?400:404);
  const res=await fetch(origin+'/api/cards?ids=315&locale=zh_CN');
  assert.equal(res.status,200);assert.equal((await res.json()).cards[0].name,'火球术');
});

test('API failures use stable codes that the interface can localize',async t=>{
  const app=createApp({cards:{provider:'battlenet',load:async()=>{throw Object.assign(new Error('Missing credentials'),{code:'API_CONFIGURATION'});}}});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  const res=await fetch(`http://127.0.0.1:${app.address().port}/api/cards?ids=315&locale=en_US`);
  assert.equal(res.status,502);
  assert.deepEqual(await res.json(),{code:'API_CONFIGURATION'});
});

test('HTTP accepts the legacy retry flag and reports upstream timeouts separately',async t=>{
  const options=[];
  const app=createApp({cards:{provider:'website',load:async(ids,locale,option)=>{
    options.push(option);
    if(ids[0]===531) throw new DOMException('Timed out','TimeoutError');
    return {cards:[card],missing:[]};
  }}});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  const origin=`http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(origin+'/api/cards?ids=315&refresh=1')).status,200);
  assert.equal(options[0],undefined);
  assert.equal((await fetch(origin+'/api/cards?ids=315&refresh=bad')).status,400);
  const timeout=await fetch(origin+'/api/cards?ids=531');
  assert.equal(timeout.status,504); assert.deepEqual(await timeout.json(),{code:'API_TIMEOUT'});
});
