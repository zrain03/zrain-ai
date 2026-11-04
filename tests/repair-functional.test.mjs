/**
 * Fail / File: tests/repair-functional.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateChat, promptMessages, runModel } from '../worker/src/chat.js';
import { searchWikipedia, gatherResearch } from '../worker/src/web-research.js';

const image = 'data:image/jpeg;base64,' + 'A'.repeat(220);
const document = name => ({ name, text: `This is readable content inside ${name}.` });

test('two documents are both included as data in a single prompt', () => {
  const request = validateChat({ message: 'Compare', history: [], documents: [document('first.md'), document('second.txt')] });
  assert.ok(request);
  const prompt = promptMessages(request).at(-1).content;
  assert.match(prompt, /first\.md/);
  assert.match(prompt, /second\.txt/);
  assert.match(prompt, /untrusted document text/i);
});

test('multiple images go to a vision model with one part for each', async () => {
  const request = validateChat({ message: 'Compare the photos', history: [], images: [image, image] });
  assert.ok(request);
  assert.equal(promptMessages(request).at(-1).content.length, 3);
  let model;
  const response = await runModel({ AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', AI: {
    run: async (chosen, options) => {
      model = chosen;
      assert.equal(options.messages.at(-1).content.length, 3);
      return { response: 'They appear similar.' };
    }
  } }, request);
  assert.equal(model, '@cf/meta/llama-4-scout-17b-16e-instruct');
  assert.equal(response.answer, 'They appear similar.');
});

test('rejects duplicate single and list fields, unsupported URLs and too many attachments', () => {
  assert.equal(validateChat({ message: 'hello', history: [], image, images: [image] }), null);
  assert.equal(validateChat({ message: 'hello', history: [], images: ['https://example.org/unsafe.jpg'] }), null);
  assert.equal(validateChat({ message: 'hello', history: [], images: [image, image], documents: [document('a'), document('b'), document('c')] }), null);
  assert.equal(validateChat({ message: 'hello', history: [], documents: [document('<script>')] }), null);
  assert.equal(validateChat({ message: 'hello', history: [], documents: [{ name: 'big.txt', text: 'x'.repeat(12_001) }] }), null);
});

test('continues an explicitly length-limited answer at most once', async () => {
  let calls = 0;
  const response = await runModel({ AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8', MAX_OUTPUT_TOKENS: '1200', AI: {
    run: async () => {
      calls++;
      return calls === 1
        ? { response: 'First part of the explanation', choices: [{ finish_reason: 'length' }] }
        : { response: 'Final part of the explanation.' };
    }
  } }, validateChat({ message: 'Explain in detail', history: [] }));
  assert.equal(calls, 2);
  assert.match(response.answer, /First part.*\nFinal part/s);
  assert.equal(response.incomplete, undefined);
});

test('Wikipedia title fallback returns a source only if summary really exists', async () => {
  let calls = 0;
  const sources = await searchWikipedia('Search the web for Spring Boot', async (url) => {
    calls++;
    if (url.includes('gsrsearch=')) return new Response(JSON.stringify({query:{pages:[]}}), {headers:{'content-type':'application/json'}});
    if (url.includes('opensearch')) return new Response(JSON.stringify(['Spring Boot',['Spring Boot'],[],[]]), {headers:{'content-type':'application/json'}});
    if (url.includes('/summary/')) return new Response(JSON.stringify({title:'Spring Boot',extract:'Spring Boot is a Java application framework for building applications with convention-based configuration.'}), {headers:{'content-type':'application/json'}});
    throw new Error('unexpected URL');
  });
  assert.equal(calls, 3);
  assert.equal(sources[0].provider,'Wikipedia');
  assert.equal(sources[0].title,'Spring Boot');
});

test('failed research does not claim a source exists', async () => {
  const res = await gatherResearch({message:'Search latest information',research:true}, async () => { throw new Error('offline'); });
  assert.equal(res.status, 'unavailable');
  assert.equal(res.sources.length, 0);
});

test('composer uses the multi-file payload rather than removed attachment variable', () => {
  const source = readFileSync(new URL('../frontend/app.js',import.meta.url), 'utf8');
  assert.match(source, /payload\.images =/);
  assert.match(source, /payload\.documents =/);
  assert.doesNotMatch(source, /attachment\?\.kind/);
  assert.match(source, /openAttachmentPreview/);
});
