/**
 * Fail / File: tests/research-preview.test.mjs
 * Pembangun / Developer: Zrain
 * Dicipta / Created: Unknown / Belum disahkan (tiada Git history dalam ZIP asal)
 * Dikemas kini / Last updated: 2026-11-04
 * BM: Menguji regresi fungsi dan kontrak produk bagi modul berkaitan.
 * EN: Test feature regressions and product contracts for the relevant module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeReadUrl, firstUrl, wantsResearch, readApprovedPage, searchWikipedia, gatherResearch } from '../worker/src/web-research.js';
import { makePreviewSource, isPreviewLanguage } from '../frontend/code-preview.js';
import { validateChat, promptMessages } from '../worker/src/chat.js';
import { renderUserLinks } from '../frontend/markdown.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Only known HTTPS documentation and Zrain websites can be read by backend', () => {
  assert.ok(safeReadUrl('https://zrain.web.app/about'));
  assert.ok(safeReadUrl('https://developer.mozilla.org/en-US/docs/Web/API'));
  for (const value of ['http://zrain.web.app', 'https://localhost/a', 'https://127.0.0.1/a',
    'https://zrain.web.app.evil.test/a', 'https://user:pass@zrain.web.app',
    'https://zrain.web.app:8443/x', 'file:///etc/hosts', 'https://169.254.169.254/latest',
    'https://example.org', 'https://zrain.web.app@evil.test']) assert.equal(safeReadUrl(value), null, value);
});

test('User supplied direct links are recognized and punctuation trimmed', () => {
  assert.equal(firstUrl('Check this https://zrain.web.app/about.'), 'https://zrain.web.app/about');
  assert.equal(firstUrl('No link here'), null);
  assert.equal(wantsResearch('cari di internet apa itu Spring Boot'), true);
  assert.equal(wantsResearch('Search the web for JavaScript'), true);
  assert.equal(wantsResearch('write a search function'), false);
});

test('Wikipedia query uses one public Action API request with contact identity', async () => {
  let count = 0;
  const result = await searchWikipedia('search the web for Spring Boot', async (url, options) => {
    count++;
    assert.match(url, /^https:\/\/en\.wikipedia\.org\/w\/api\.php\?/);
    assert.equal(new URL(url).searchParams.get('gsrlimit'), '3');
    assert.match(options.headers['User-Agent'], /zrain\.dev@gmail\.com/);
    assert.equal(options.redirect, 'manual');
    return new Response(JSON.stringify({ query:{ pages:[
      { title:'Spring Framework', extract:'Spring Framework is an application framework used in Java development. It supports various features.' }
    ]}}), { status:200, headers:{ 'content-type':'application/json' }});
  });
  assert.equal(count, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://en.wikipedia.org/wiki/Spring_Framework');
});

test('Known URL reader strips scripts and refuses redirects and oversized pages', async () => {
  const page = await readApprovedPage('https://zrain.web.app', async (url, options) => {
    assert.equal(url, 'https://zrain.web.app/');
    assert.equal(options.redirect, 'manual');
    return new Response('<html><head><title>Zrain Ecosystem</title><script>bad()</script></head><body><h1>Zrain products</h1><p>Tools for people and useful applications.</p></body></html>', {headers:{'content-type':'text/html'}});
  });
  assert.match(page.excerpt, /Zrain products/);
  assert.doesNotMatch(page.excerpt, /bad\(\)/);
  await assert.rejects(readApprovedPage('https://zrain.web.app',async () => new Response(null, {status:302,headers:{Location:'http://127.0.0.1'}})));
  await assert.rejects(readApprovedPage('https://zrain.web.app',async () => new Response('a'.repeat(110000), {headers:{'content-type':'text/html','content-length':'110000'}})));
});

test('Research fails without inventing links or pretending complete web access', async () => {
  assert.deepEqual(await gatherResearch({message:'Hello'}), {status:'off',sources:[],context:''});
  const disallowed = await gatherResearch({message:'read https://localhost/admin'});
  assert.equal(disallowed.status,'link-not-readable');
  const failing = await gatherResearch({message:'Wikipedia latest Spring', research:true}, async () => {throw Error('network offline')});
  assert.equal(failing.status,'unavailable');
  assert.equal(failing.sources.length,0);
});

test('Research context is marked as untrusted in model prompt, with honest status', () => {
  assert.equal(validateChat({message:'x',history:[],research:'true'}),null);
  const valid = validateChat({message:'cari Wikipedia',history:[],research:true});
  const prompt = promptMessages({...valid,researchStatus:'wikipedia',researchContext:'[Source 1] Hello\nURL: https://en.wikipedia.org/wiki/Hello\nExcerpt: Human greeting'});
  assert.match(prompt.at(-1).content,/untrusted website text/);
  assert.match(prompt.at(-1).content,/https:\/\/en\.wikipedia\.org/);
  const missing = promptMessages({...valid,researchStatus:'unavailable',researchContext:''});
  assert.match(missing.at(-1).content,/Do not pretend you searched/);
});

test('Preview supports only HTML CSS and browser JavaScript', () => {
  assert.equal(isPreviewLanguage('html'),true);
  assert.equal(isPreviewLanguage('css'),true);
  assert.equal(isPreviewLanguage('javascript'),true);
  for (const lang of ['python','shell','react','tsx','json','java']) assert.equal(isPreviewLanguage(lang),false);
});

test('Iframe preview includes restrictive Content Security Policy and bootstrap log capture', async () => {
  const markup = makePreviewSource({html:'<html><head></head><body><h1>Hi</h1></body></html>', css:'h1{color:red}', js:'console.log("ok")',id:'test'});
  assert.match(markup,/connect-src 'none'/);
  assert.match(markup,/default-src 'none'/);
  assert.match(markup,/form-action 'none'/);
  assert.match(markup,/zrainPreview/);
  assert.match(markup,/<h1>Hi<\/h1>/);
  assert.match(markup,/<style>h1\{color:red\}<\/style>/);
  assert.match(markup,/<script>console.log\("ok"\)<\/script>/);
  const html = await read('frontend/code-preview.js');
  assert.match(html,/setAttribute\("sandbox", "allow-scripts"\)/);
  assert.doesNotMatch(html,/allow-same-origin/);
});

test('User text links are clickable DOM elements with no unsafe HTML insertion', () => {
  const previous = globalThis.document;
  const create = (tag, value='') => ({tag,textContent:value,children:[],append(...c){this.children.push(...c)},replaceChildren(...c){this.children=c}});
  globalThis.document = { createElement: tag=>create(tag), createTextNode: text=>create('#text',text) };
  try {
    const root = create('div');
    renderUserLinks(root,'Check https://zrain.web.app. and https://example.com/foo');
    const links = root.children.filter(x=>x.tag==='a');
    assert.equal(links.length,2);
    assert.equal(links[0].href,'https://zrain.web.app/');
    assert.equal(links[1].rel,'noopener noreferrer nofollow');
    assert.ok(root.children.some(c=>c.textContent === ' and '));
  } finally {globalThis.document=previous}
});

test('Frontend adds research toggle and secure source panels without altering chat layout', async () => {
  const html = await read('frontend/index.html');
  const app = await read('frontend/app.js');
  const css = await read('frontend/research-preview.css');
  assert.match(html,/id="research-toggle"/);
  assert.match(app,/researchStatus: result\.researchStatus/);
  assert.match(app,/target = "_blank"/);
  assert.match(css,/zrain-preview-dialog/);
  assert.match(html,/footer-layout\.css/);
  assert.match(html,/id="quota-inline-label"/);
});

test('Saved chat history retains citation links but rejects unsafe links', async () => {
  const { saveConversations, readConversations } = await import('../frontend/history.js');
  const store = new Map();
  const adapter = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  const chat = [{ id:'12345678', title:'Web search', updatedAt:Date.now(), messages:[
    {role:'assistant',content:'Hello', sources:[
      {title:'Zrain',url:'https://zrain.web.app/',provider:'Public page'},
      {title:'Bad',url:'javascript:alert(1)',provider:'Fake'}
    ], researchStatus:'read'}
  ]}];
  assert.equal(saveConversations(chat,adapter), true);
  const stored = readConversations(adapter);
  assert.equal(stored[0].messages[0].sources.length,1);
  assert.equal(stored[0].messages[0].sources[0].url,'https://zrain.web.app/');
});
