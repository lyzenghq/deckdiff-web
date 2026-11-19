// SPDX-License-Identifier: GPL-2.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCardData} from '../public/card-loader.mjs';

const ok = () => Response.json({cards:[{id:315,name:'火球术'}],missing:[]});
const failed = (code='API_UNAVAILABLE',status=502) => Response.json({code},{status});
const noWait = async () => {};

test('initial loading tries once and reports the upstream failure', async () => {
  let calls=0;
  await assert.rejects(loadCardData({ids:[315],locale:'zh_CN',fetcher:async()=>{calls++;return failed();}}),error=>error.code==='API_UNAVAILABLE');
  assert.equal(calls,1);
});

test('manual reload sends fresh requests, reports progress and recovers on attempt three', async () => {
  const attempts=[], requests=[];
  const data=await loadCardData({ids:[315],locale:'zh_CN',refresh:true,wait:noWait,onAttempt:value=>attempts.push(value),fetcher:async(url,init)=>{
    requests.push({url,init}); return requests.length<3?failed():ok();
  }});
  assert.deepEqual(attempts,[{attempt:1,total:3},{attempt:2,total:3},{attempt:3,total:3}]);
  assert.equal(data.cards[0].name,'火球术');
  assert.ok(requests.every(request=>new URL(request.url,'http://localhost').searchParams.get('refresh')==='1'&&request.init.cache==='no-store'));
  assert.notEqual(requests[0].init.signal,requests[1].init.signal);
  assert.equal(requests[0].init.signal.aborted,true);
});

test('manual reload stops after three failures and preserves the timeout diagnosis', async () => {
  let calls=0;
  await assert.rejects(loadCardData({ids:[315],locale:'en_US',refresh:true,wait:noWait,fetcher:async()=>{calls++;return failed('API_TIMEOUT',504);}}),error=>error.code==='API_TIMEOUT');
  assert.equal(calls,3);
});

test('configuration failures stop immediately instead of retrying unchanged credentials', async () => {
  let calls=0;
  await assert.rejects(loadCardData({ids:[315],locale:'en_US',refresh:true,wait:noWait,fetcher:async()=>{calls++;return failed('API_CONFIGURATION');}}),error=>error.code==='API_CONFIGURATION');
  assert.equal(calls,1);
});

test('a stopped local service has a distinct diagnosis', async () => {
  await assert.rejects(loadCardData({ids:[315],locale:'zh_CN',fetcher:async()=>{throw new TypeError('Failed to fetch');}}),error=>error.code==='LOCAL_SERVER_UNAVAILABLE');
});

test('canceling an active load aborts its fetch and prevents further retries', async () => {
  const controller=new AbortController(); let calls=0;
  const pending=loadCardData({ids:[315],locale:'zh_CN',refresh:true,signal:controller.signal,wait:noWait,fetcher:async(_,init)=>{
    calls++;
    return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
  }});
  controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError');
  assert.equal(calls,1);
});

test('large loads keep the API batch size at 200 and combine all card records', async () => {
  const sizes=[];
  const data=await loadCardData({ids:Array.from({length:201},(_,i)=>i+1),locale:'zh_CN',fetcher:async url=>{
    const ids=new URL(url,'http://localhost').searchParams.get('ids').split(',').map(Number);
    sizes.push(ids.length); return Response.json({cards:ids.map(id=>({id})),missing:[]});
  }});
  assert.deepEqual(sizes,[200,1]); assert.equal(data.cards.length,201);
});
