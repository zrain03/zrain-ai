/**
 * Fail / File: tests/research-closure.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchWikipedia, gatherResearch, safeReadUrl } from '../worker/src/web-research.js';
import { saveConversations, readConversations, makeConversation } from '../frontend/history.js';

const wikiResult = { query: { pages: [{ title: 'Spring Framework', extract: 'The Spring Framework is an application framework and inversion of control container for the Java platform.' }] } };
const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });

test('research finds article excerpts with real verified URLs', async () => {
  let calls=0;
  const fetcher=async (url,options) => {
    calls++;
    assert.equal(options.redirect,'manual');
    assert.match(options.headers['User-Agent'],/ZrainAIResearch/);
    if (!url.includes('/w/api.php')) throw new Error('unexpected endpoint');
    return json(wikiResult);
  };
  const info=await gatherResearch({message:'Search Wikipedia Spring Framework',research:true},fetcher);
  assert.equal(calls,1);
  assert.equal(info.status,'wikipedia');
  assert.equal(info.attempted,true);
  assert.equal(info.sources.length,1);
  assert.equal(info.sources[0].evidenceType,'article-extract');
  assert.match(info.context,/Spring Framework/);
  assert.match(info.checkedAt,/^\d{4}-\d{2}-\d{2}T/);
});

test('REST page search works when Action and old summary APIs cannot be reached',async()=>{
  const hits=[];
  const fetcher=async url=>{
    hits.push(url);
    if (url.includes('/w/rest.php/v1/search/page')) return json({pages:[{
      title:'Memory',key:'Memory',description:'Memory is an ability of the brain to encode and recall information',excerpt:'Memory involves encoding, storage and retrieval of information.'
    }]});
    throw Error('action blocked');
  };
  const sources=await searchWikipedia('Search web for memory',fetcher);
  assert.equal(sources.length,1);
  assert.equal(sources[0].evidenceType,'search-preview');
  assert.equal(sources[0].url,'https://en.wikipedia.org/wiki/Memory');
  assert.equal(hits.filter(url=>url.includes('/w/rest.php/v1/search/page')).length,1);
  assert.ok(hits.length<=4);
});

test('Research OFF avoids web requests; ON with failing source reports honest failure',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++; throw Error('offline')};
  assert.deepEqual(await gatherResearch({message:'Hello, can you help?'},fetcher),{status:'off',sources:[],context:''});
  assert.equal(calls,0);
  const result=await gatherResearch({message:'Hello, can you help?',research:true},fetcher);
  assert.equal(result.status,'unavailable');
  assert.equal(result.sources.length,0);
  assert.equal(result.attempted,true);
  assert.match(result.notice,/not web-verified/i);
  assert.ok(calls>=1 && calls<=4);
});

test('Research URL restriction remains exact and blocks redirects',async()=>{
  for (const url of ['https://127.0.0.1/admin','https://localhost/x','http://zrain.web.app','https://zrain.web.app.evil.com'])
    assert.equal(safeReadUrl(url),null);
  const response=await gatherResearch({message:'Please read https://zrain.web.app',research:true},async()=>new Response('<html><title>Zrain</title><body><p>Useful web tools, games, and AI products developed by Zrain for the public.</p></body></html>', {headers:{'content-type':'text/html'}}));
  assert.equal(response.status,'read');
  assert.equal(response.sources.length,1);
  assert.equal(response.sources[0].url,'https://zrain.web.app/');
});

test('Research audit remains visible after chat reload, including no results',()=>{
  const map=new Map();
  const storage={getItem:key=>map.get(key) || null,setItem:(key,val)=>map.set(key,val)};
  const chat=makeConversation('research-test-chat');
  chat.messages=[{role:'user',content:'Test me'},{role:'assistant',content:'I cannot verify this online.',
    researchAttempted:true,researchStatus:'unavailable',researchMode:'manual',
    researchNotice:'Public sources unavailable',researchCheckedAt:'2026-11-03T08:00:00Z'}];
  assert.equal(saveConversations([chat],storage),true);
  const read=readConversations(storage)[0];
  assert.equal(read.messages[1].researchAttempted,true);
  assert.equal(read.messages[1].researchStatus,'unavailable');
  assert.equal(read.messages[1].researchMode,'manual');
  assert.match(read.messages[1].researchNotice,/Public sources/);
});

test('small document previews survive simulated reload without IndexedDB',async()=>{
  const earlierStorage=globalThis.localStorage;
  const previousIdb=globalThis.indexedDB;
  const data=new Map();
  const storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)||null,removeItem:k=>data.delete(k),key:i=>Array.from(data.keys())[i],get length(){return data.size}};
  globalThis.localStorage=storage;
  globalThis.indexedDB=undefined;
  try {
    const id='preview-test-abc-0001';
    const first=await import('../frontend/local-previews.js?testSessionOne');
    assert.equal(await first.saveLocalPreview({id,kind:'document',name:'README.md',fullPreview:'Hello\nMy README details'}),true);
    const fresh=await import('../frontend/local-previews.js?testSessionTwo');
    assert.match((await fresh.getLocalPreview(id)).text,/README details/);
    await fresh.deleteLocalPreviews([id]);
    assert.equal(await fresh.getLocalPreview(id),null);
  } finally {
    if (earlierStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage=earlierStorage;
    if (previousIdb === undefined) delete globalThis.indexedDB; else globalThis.indexedDB=previousIdb;
  }
});

test('research UI shows verified-source status OR no-source warning, not silent fallback',()=>{
  const app=readFileSync(new URL('../frontend/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../frontend/research-preview.css',import.meta.url),'utf8');
  const backend=readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
  assert.match(app,/Research: no verified sources/);
  assert.match(app,/verified \$\{fetched\.length === 1/);
  assert.match(app,/const researchInfo = result\.researchAttempted/);
  assert.match(backend,/researchMode: research\.status === "off"/);
  assert.doesNotMatch(css,/aria-pressed="true"\]::after/);
});
