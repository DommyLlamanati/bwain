const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const nunjucks = require('nunjucks');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync);

test('real head template: typing, navigation, malformed settings, delayed assets and repeated reloads', {timeout:60000}, async () => {
  assert(chrome, 'Set CHROME_PATH');
  function head(url) {
    const settings = { defaultPassword: url.searchParams.has('missing') ? '' : url.searchParams.has('changed') ? 'changed passphrase' : 'fixture passphrase', notePasswords: url.searchParams.has('bad') ? '{bad json' : '{"/other/":"other passphrase"}', showFileBrowser: url.searchParams.has('navigation') };
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(root, 'templates')), {autoescape:true});
    require('../index.js').setupEleventy({on(){},addFilter(name, callback){env.addFilter(name,callback);}}, {settings});
    return env.render('lock.njk', {page:{url:url.pathname}, 'dg-note-properties':{lock:url.pathname === '/locked/'}, pluginSettings:settings});
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/assets/note-lock.js' || url.pathname === '/styles/note-lock.css') {
      res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
      return setTimeout(() => res.end(fs.readFileSync(path.join(root,url.pathname))), 250);
    }
    res.setHeader('Content-Type','text/html');
    res.write('<!doctype html><html><head><meta name="viewport" content="width=device-width">' + head(url) + '</head><body><div class="filetree-wrapper"><a href="/">Public home</a></div><main class="content"><h1>Private body</h1><p>Not visible before unlock</p></main><aside><div class="sidebar" id="page-panel"><div class="toc-container"><a href="#private">Private TOC title</a></div></div></aside>');
    setTimeout(() => res.end('<style>html body #page-panel .toc-container,html body #page-panel .toc-container a{visibility:visible!important}.filetree-wrapper{position:fixed;left:0;top:0;width:240px;height:100vh}.content{margin-left:260px}body{margin:0;--background-primary:#fff;--text-normal:#111;--text-muted:#555;--interactive-accent:#e78c28;--text-on-accent:#111}</style><link rel="stylesheet" href="/styles/note-lock.css"><script defer src="/assets/note-lock.js"></script></body></html>'), 150);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({executablePath:chrome,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1600,height:900}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(() => {
      window.lockFrames = {checked:0,leaked:0};
      function sample() {
        if (!document.documentElement.classList.contains('dg-note-unlocked')) {
          for (const el of document.querySelectorAll('main.content, .toc-container a')) {
            window.lockFrames.checked++;
            if (el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden') window.lockFrames.leaked++;
          }
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    for (const navigation of [false,true]) {
      for (let reload=0;reload<5;reload++) {
        await page.goto(`http://127.0.0.1:${server.address().port}/locked/?${navigation?'navigation':''}`, {waitUntil:'commit'});
        await page.waitForSelector('#dg-note-lock-password');
        assert.equal(await page.locator('.toc-container a').isVisible(),false);
        assert.equal(await page.locator('main.content').isVisible(),false);
        if (navigation) assert.equal(await page.locator('.filetree-wrapper a').isVisible(),true);
        const frames = await page.evaluate(()=>window.lockFrames);
        assert(frames.checked>0,'Sampled pre-bootstrap frames');
        assert.equal(frames.leaked,0,'No TOC/body paint during slow loading');
        await page.locator('#dg-note-lock-password').click();
        await page.keyboard.type('typed normally');
        assert.equal(await page.locator('#dg-note-lock-password').inputValue(),'typed normally');
      }
      for (const width of [1600,390]) {
        await page.evaluate(() => localStorage.clear());
        await page.setViewportSize({width,height:844});
        await page.goto(`http://127.0.0.1:${server.address().port}/locked/?${navigation?'navigation':''}`);
        const input = page.locator('#dg-note-lock-password');
        await input.click(); await page.keyboard.type('wrong');
        await page.locator('.dg-note-lock-submit').click();
        await page.waitForFunction(()=>document.querySelector('#dg-note-lock-status').textContent.includes('did not match'));
        await page.keyboard.press('Backspace'); await page.keyboard.type('fixture passphrase');
        await page.locator('.dg-note-lock-reveal').click();
        assert.equal(await input.getAttribute('type'),'text');
        await page.locator('.dg-note-lock-submit').click();
        await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
        assert.equal(await page.locator('main.content').isVisible(),true);
        assert.equal(await page.locator('.toc-container a').isVisible(),true);
        assert.equal(await page.locator('main.content').evaluate(el=>el.inert),false);
        await page.reload();
        await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
        assert.equal(await page.locator('.dg-note-lock').count(),0,'Remembered unlock survives rebuild/reload');
      }
      await page.evaluate(() => localStorage.clear());
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/?bad`);
    assert.equal(await page.locator('.dg-note-lock').count(),0,'Bad JSON must not lock homepage');
    await page.goto(`http://127.0.0.1:${server.address().port}/locked/?bad`);
    await page.locator('#dg-note-lock-password').fill('fixture passphrase');
    await page.locator('.dg-note-lock-submit').click();
    await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
    await page.goto(`http://127.0.0.1:${server.address().port}/other/`);
    assert.equal(await page.locator('main.content').isVisible(),false,'Other note needs its own unlock');
    await page.locator('#dg-note-lock-password').fill('fixture passphrase');
    await page.locator('.dg-note-lock-submit').click();
    await page.waitForFunction(()=>document.querySelector('#dg-note-lock-status').textContent.includes('did not match'));
    await page.locator('#dg-note-lock-password').fill('other passphrase');
    await page.locator('.dg-note-lock-submit').click();
    await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
    await page.goto(`http://127.0.0.1:${server.address().port}/locked/?changed`);
    assert.equal(await page.locator('main.content').isVisible(),false,'Changed password invalidates saved unlock');
    await page.locator('#dg-note-lock-password').fill('fixture passphrase');
    await page.locator('.dg-note-lock-submit').click();
    await page.waitForFunction(()=>document.querySelector('#dg-note-lock-status').textContent.includes('did not match'));
    await page.locator('#dg-note-lock-password').fill('changed passphrase');
    await page.locator('.dg-note-lock-submit').click();
    await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
    await page.goto(`http://127.0.0.1:${server.address().port}/other/`);
    await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
    await page.goto(`http://127.0.0.1:${server.address().port}/locked/?missing`);
    assert.equal(await page.locator('.dg-note-lock h1').textContent(),'Lock needs setup');
    assert.equal(await page.locator('#dg-note-lock-password').count(),0,'No misleading disabled entry field');
    assert.equal(await page.locator('.toc-container a').isVisible(),false);
    const noJS = await browser.newContext({javaScriptEnabled:false});
    const plain = await noJS.newPage();
    await plain.goto(`http://127.0.0.1:${server.address().port}/locked/`);
    assert.equal(await plain.locator('.toc-container a').isVisible(),false);
    assert.equal(await plain.locator('main.content').isVisible(),false);
    await noJS.close();
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
