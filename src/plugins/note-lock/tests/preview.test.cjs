const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const nunjucks=require('nunjucks'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync);

test('actual core hover previews cannot fetch or show locked notes, including cached fragments and backlinks', {timeout:60000},async()=>{
  const env=new nunjucks.Environment(new nunjucks.FileSystemLoader([path.join(root,'templates'),path.join(root,'tests/fixtures')]),{autoescape:true});
  let collect;
  const settings={defaultPassword:'preview fixture only',notePasswords:'{"/override/":"preview fixture only"}'};
  require('../index.js').setupEleventy({on(){},addCollection(name,cb){collect=cb;},addFilter(name,cb){env.addFilter(name,cb);}}, {settings});
  collect({getAll:()=>[{url:'/locked/',data:{'dg-note-properties':{lock:true}}},{url:'/ordinary/',data:{lock:false}}]});
  const counts=new Map();
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(/^\/(assets|styles)\//.test(url.pathname)){const file=path.join(root,url.pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');return res.end(fs.readFileSync(file));}
    counts.set(url.pathname,(counts.get(url.pathname)||0)+1);
    const locked=url.pathname==='/locked/',ctx={page:{url:url.pathname},'dg-note-properties':{lock:locked},pluginSettings:settings,settings:{dgLinkPreview:true}};
    const content=url.pathname==='/'?'<a id="locked" class="internal-link" href="/locked/#hidden"><span>Protected</span></a><div class="backlink-card"><a id="override" href="/override/">Override</a></div><a id="ordinary" class="internal-link" href="/ordinary/">Ordinary</a>':locked||url.pathname==='/override/'?'<h1 id="hidden">PRIVATE_FIXTURE_ONLY</h1><p>PRIVATE_BODY_FIXTURE_ONLY</p>':'<h1>Ordinary note</h1><p>PUBLIC_FIXTURE_ONLY</p>';
    const manifest=require('../garden-plugin.json');
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width">'+env.render('lock.njk',ctx)+manifest.styles.map(f=>`<link rel="stylesheet" href="/${f}">`).join('')+manifest.scripts.map(f=>`<script defer src="/${f}"></script>`).join('')+'</head><body><main class="content">'+content+'</main>'+env.render('core-link-preview.njk',ctx)+env.render('preview.njk',ctx)+'</body></html>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:chrome,headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base+'/',{waitUntil:'load'});
    await page.evaluate(()=>{linkHistories['/locked/']='<h1>PRIVATE_CACHED_FIXTURE_ONLY</h1>';});
    for(const selector of ['#locked','#override','#locked span']){
      await page.mouse.move(600,400);await page.waitForTimeout(250);
      await page.locator(selector).hover();await page.waitForTimeout(300);
      assert.match(await page.locator('#tooltip-content').textContent(),/Locked note/);
      assert(!await page.locator('#tooltip-content').textContent().then(s=>s.includes('PRIVATE')));
      assert.equal(counts.get('/locked/')||0,0);
      assert.equal(counts.get('/override/')||0,0);
    }
    await page.mouse.move(600,400);await page.waitForTimeout(250);await page.locator('#ordinary').hover();
    await page.waitForFunction(()=>document.querySelector('#tooltip-content').textContent.includes('PUBLIC_FIXTURE_ONLY'));
    assert((counts.get('/ordinary/')||0)>0,'Public previews still load');
    await page.locator('#locked').click();await page.waitForSelector('#dg-note-lock-password');
    await page.locator('#dg-note-lock-password').fill('preview fixture only');await page.locator('.dg-note-lock-submit').click();
    await page.waitForFunction(()=>document.documentElement.classList.contains('dg-note-unlocked'));
    assert.equal(await page.locator('main.content').isVisible(),true);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
