/**
 * Fail / File: tests/completion-preview.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateChat, runModel, endedAbruptly } from '../worker/src/chat.js';
import { saveConversations, readConversations, makeConversation } from '../frontend/history.js';
import { getLocalPreview, saveLocalPreview, deleteLocalPreviews } from '../frontend/local-previews.js';

const fakeStore = () => {
  const contents = new Map();
  return { getItem: key => contents.get(key) ?? null, setItem: (key, value) => contents.set(key, value) };
};

test('an unfinished bullet without punctuation is detected', () => {
  const answer = 'A'.repeat(300) + '\n- **Memory**: This method improves';
  assert.equal(endedAbruptly(answer, {}), true);
});

test('an explicit model length stop is detected even when a sentence ends in a period', () => {
  assert.equal(endedAbruptly('I finished the first paragraph.', { finish_reason:'length' }), true);
});

test('three model inference chunks combine into one answer without repeating exact overlap', async () => {
  let count = 0;
  const responses = [
    { response:'Part one of this longer explanation '.repeat(20), choices:[{finish_reason:'length'}] },
    { response:'Part two is here '.repeat(40), choices:[{finish_reason:'length'}] },
    { response:'In conclusion, the explanation is now complete.' }
  ];
  const req = validateChat({message:'Explain in depth',history:[]});
  const result = await runModel({AI_MODEL:'@cf/qwen/qwen3-30b-a3b-fp8', MAX_OUTPUT_TOKENS:'1200',AI:{run:async() => responses[count++]}},req);
  assert.equal(count, 3);
  assert.match(result.answer,/Part one/);
  assert.match(result.answer,/Part two/);
  assert.match(result.answer,/explanation is now complete\./);
  assert.equal(result.incomplete,undefined);
});

test('free tier stops automatic generations after a fixed number and advertises continuation', async () => {
  let calls=0;
  const req=validateChat({message:'Very long explanation',history:[]});
  const result=await runModel({ AI_MODEL:'@cf/qwen/qwen3-30b-a3b-fp8',AI:{run:async()=>{calls++;return {response:`Part ${calls}: `+'word '.repeat(200), finish_reason:'length'};}}},req);
  assert.equal(calls,3);
  assert.equal(result.incomplete,true);
  assert.match(result.answer,/Part 3/);
});

test('saved history preserves lengthy assistant answer and clickable attachment id after reload', () => {
  const memory=fakeStore();
  const chat=makeConversation('long-chats-abcdef');
  const huge='test '.repeat(5000);
  chat.messages=[{role:'user',content:'Explain file',attachments:[{id:'local-preview-abcd-1234',kind:'document',name:'README.md'}]}, {role:'assistant',content:huge,incomplete:true}];
  assert.equal(saveConversations([chat],memory),true);
  const saved=readConversations(memory)[0];
  assert.equal(saved.messages[1].content.length,huge.length);
  assert.equal(saved.messages[1].incomplete,true);
  assert.equal(saved.messages[0].attachments[0].id,'local-preview-abcd-1234');
});

test('document preview stays local, can be read and erased', async () => {
  const id='local-preview-abcdef-0123';
  const ok=await saveLocalPreview({id,name:'README.md',kind:'document',fullPreview:'# Hello\nMore details',text:'# Hello'});
  // Node has no IndexedDB, but the in-memory fallback remains usable this session.
  assert.equal(ok,false);
  assert.equal((await getLocalPreview(id))?.text,'# Hello\nMore details');
  await deleteLocalPreviews([id]);
  assert.equal(await getLocalPreview(id),null);
});

test('client allows clicking a sent file chip and distinguishes full preview from model excerpt', () => {
  const app=readFileSync(new URL('../frontend/app.js',import.meta.url),'utf8');
  const attachment=readFileSync(new URL('../frontend/attachments.js',import.meta.url),'utf8');
  assert.match(app,/indicator\.addEventListener\("click", \(\) => openAttachmentPreview\(item\)\)/);
  assert.match(app,/saveLocalPreview\(item\)/);
  assert.match(app,/getLocalPreview\(attachment\.id\)/);
  assert.match(attachment,/MAX_LOCAL_PREVIEW = 150_000/);
  assert.match(attachment,/MAX_DOCUMENT_TEXT = 12000/);
});

test('chat prompt validation accepts a larger document while rejecting more than the safe input cap', () => {
  const text='A'.repeat(11_000);
  assert.ok(validateChat({message:'Explain README',history:[],document:{name:'README.md',text}}));
  assert.equal(validateChat({message:'Explain README',history:[],document:{name:'README.md',text:'B'.repeat(12_001)}}),null);
});
