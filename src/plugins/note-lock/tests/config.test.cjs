const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createResolver } = require("../index.js");
const { filterDiscovery } = require("../index.js");

test('remembered verifier survives rebuilds and changes only for the affected note/password', () => {
  const settings = {defaultPassword:'shared fixture', notePasswords:'{"/specific/":"specific fixture"}'};
  const first = createResolver(settings), rebuilt = createResolver(settings);
  const shared = JSON.parse(first('/shared/',true));
  assert.equal(JSON.parse(rebuilt('/shared/',true)).verifier,shared.verifier);
  assert.notEqual(JSON.parse(first('/another/',true)).salt,shared.salt);
  const changed = createResolver({...settings,defaultPassword:'new shared fixture'});
  assert.notEqual(JSON.parse(changed('/shared/',true)).verifier,shared.verifier);
  assert.equal(JSON.parse(changed('/specific/',false)).verifier,JSON.parse(first('/specific/',false)).verifier);
});

test('search and Atom exclude protected paths and retain unrelated entries; both options can be disabled', () => {
  const protectedPaths = new Set(['/locked-demonstration']);
  const search = JSON.stringify([{url:'/public/'},{url:'/locked-demonstration/',content:'private fixture'}]);
  assert.deepEqual(JSON.parse(filterDiscovery(search,'dist/searchIndex.json',protectedPaths,{})),[{url:'/public/'}]);
  assert.equal(filterDiscovery(search,'dist/searchIndex.json',protectedPaths,{excludeLockedFromSearch:false}),search);
  const feed = '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Garden</title><entry><title>Public</title><link href="https://example.com/public/"/><id>https://example.com/public/</id><content type="html">&lt;p&gt;Public&lt;/p&gt;</content></entry><entry><title>Private</title><link href="https://example.com/locked-demonstration/"/><id>https://example.com/locked-demonstration/</id></entry></feed>';
  const result = filterDiscovery(feed,'dist/feed.xml',protectedPaths,{});
  assert(!result.includes('<title>Private</title>'));
  assert(result.includes('<title>Public</title>'));
  assert(result.includes('&lt;p&gt;Public&lt;/p&gt;'));
  assert.equal(filterDiscovery(feed,'dist/feed.xml',protectedPaths,{excludeLockedFromFeed:false}),feed);
});

test('watch rebuild clears removed per-note locks without losing configured overrides', () => {
  let before, collect, transform;
  require('../index.js').setupEleventy({
    on(name, callback) { before=callback; },
    addCollection(name, callback) { collect=callback; },
    addTransform(name, callback) { transform=callback; },
    addFilter() {}
  }, {settings:{notePasswords:'{"/configured/":"fixture only"}'}});
  before();collect({getAll:()=>[{url:'/marked/',data:{lock:true}}]});
  const content=JSON.stringify([{url:'/marked/'},{url:'/configured/'}]);
  assert.deepEqual(JSON.parse(transform(content,'dist/searchIndex.json')),[]);
  before();collect({getAll:()=>[{url:'/marked/',data:{lock:false}}]});
  assert.deepEqual(JSON.parse(transform(content,'dist/searchIndex.json')),[{url:'/marked/'}]);
});

test("lock bootstrap and critical sidebar hiding are emitted in the document head", () => {
  const manifest = require("../garden-plugin.json");
  assert.equal(manifest.slots["common.head"], "templates/lock.njk");
  assert.equal(manifest.slots["common.header"], undefined);
  const template = fs.readFileSync(path.join(__dirname, "../templates/lock.njk"), "utf8");
  assert(template.includes("<style>"));
  assert(template.includes("body > :not(.dg-note-lock) *"));
  assert(template.includes("visibility: hidden !important"));
});

test("ordinary notes have no lock and text flags do not accidentally mark notes", async () => {
  const resolve = createResolver({ defaultPassword: "example only", notePasswords: "{}" });
  assert.equal(await resolve("/public/", false), null);
  assert.equal(await resolve("/public/", "false"), null);
  assert.equal(await resolve(false, false), null);
});

test("note rules and checkbox flag produce verifiers without plaintext passwords", async () => {
  const resolve = createResolver({ defaultPassword: "default example", notePasswords: JSON.stringify({ "/specific/": "override example" }) });
  for (const [url, locked, password] of [["/specific", false, "override example"], ["/marked/", true, "default example"]]) {
    const payload = await resolve(url, locked);
    assert(!payload.includes(password));
    const config = JSON.parse(payload);
    const derived = crypto.pbkdf2Sync(password, Buffer.from(config.salt, "base64"), config.iterations, 32, "sha256");
    assert.equal(derived.toString("base64"), config.verifier);
    assert.notEqual(crypto.pbkdf2Sync("wrong example", Buffer.from(config.salt, "base64"), config.iterations, 32, "sha256").toString("base64"), config.verifier);
  }
});

test("invalid overrides never lock unrelated notes or the homepage; explicit locks still work", () => {
  const badPaths = ['/private/../', '/%2e%2e/', '/.\t/', '/?', '/#', '/%2f/', '/back\\slash/'];
  for (const raw of ['not json', '[]', '{"https://example.com/":"example"}', ...badPaths.map(key=>JSON.stringify({[key]:'example'}))]) {
    const resolve = createResolver({ notePasswords: raw, defaultPassword: 'fixture only' });
    assert.equal(resolve('/', false), null);
    assert.equal(resolve('/public/', false), null);
    assert.equal(JSON.parse(resolve('/marked/', true)).iterations, 600000);
  }
  assert.throws(() => createResolver({ notePasswords: '{}', defaultPassword: "" })("/note/", true), /no password/);
});

test('valid overrides survive invalid entries and wrong valid paths cannot match the homepage', () => {
  const resolve = createResolver({ notePasswords: JSON.stringify({'/missing-note/':'test', '/specific/':'test', '/x/../':'bad', '/':'intentional home'}) });
  assert.equal(resolve('/other/', false), null);
  assert.equal(JSON.parse(resolve('/specific/', false)).iterations, 600000);
  assert.equal(JSON.parse(resolve('/', false)).iterations, 600000, 'Only exact / opts into a homepage lock');
  assert.equal(createResolver({notePasswords:'{"/missing-note/":"test"}'})('/', false), null);
});

test('actual Nunjucks template reads exported Obsidian checkbox properties, not truthy strings', () => {
  const nunjucks = require('nunjucks');
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../templates')), {autoescape:true});
  require('../index.js').setupEleventy({on(){},addFilter(name, callback){env.addFilter(name, callback);}}, {settings:{notePasswords:'{}',defaultPassword:'fixture only'}});
  for (const flag of [true, false, 'true', 'false', undefined]) {
    const html = env.render('lock.njk', {page:{url:'/specific/'},'dg-note-properties':{lock:flag},pluginSettings:{}});
    assert.equal(html.includes('id="dg-note-lock-config"'), flag === true);
  }
  assert(!env.render('lock.njk',{page:{url:'/'},pluginSettings:{}}).includes('dg-note-lock-config'));
  assert(!env.render('lock.njk',{page:{url:'/'},lock:true,'dg-note-properties':{lock:false},pluginSettings:{}}).includes('dg-note-lock-config'));
});

test("file-browser access is opt-in and is carried in the page configuration", () => {
  for (const allowed of [false, true]) {
    const resolve = createResolver({ defaultPassword: "navigation test only", notePasswords: "{}", showFileBrowser: allowed });
    assert.equal(JSON.parse(resolve("/", true)).showFileBrowser, allowed);
  }
  const definition = require("../garden-plugin.json").settings.find(setting => setting.key === "showFileBrowser");
  assert.equal(definition.type, "boolean");
  assert.equal(definition.default, false);
});

test("hook registers a synchronous filter that emits the lock payload", () => {
  let filter;
  require("../index.js").setupEleventy({
    on() {},
    addFilter(name, callback) { if (name === "gpNoteLock") filter = callback; }
  }, { settings: { defaultPassword: "", notePasswords: '{"/":"integration example"}' } });
  const value = filter("/", undefined);
  assert.equal(typeof value, "string");
  assert.equal(JSON.parse(value).iterations, 600000);
  assert(!value.includes("integration example"));
});
