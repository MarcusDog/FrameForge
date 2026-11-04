// Real Chromium + real Java/MySQL. Only the named task GET is intercepted for HTTP 500.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require(process.env.FF_PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'..'),base=process.env.FRAMEFORGE_URL||'http://localhost:3000';
const output=path.join(root,'output/playwright',process.env.FF_QA_RUN||'current');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,ms=35000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await pause(80);}throw new Error(label);}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.FF_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']});
  const checks=[],pageErrors=[],network=[];
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'}),page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('response',response=>{if(/\/api\/tasks\/[^/?]+$/.test(response.url())&&response.request().method()==='GET')network.push({time:Date.now(),path:new URL(response.url()).pathname,status:response.status()});});
  async function check(name,fn){try{await fn();checks.push({name,result:'PASS'});}catch(error){checks.push({name,result:'FAIL',error:error.message});await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png')}).catch(()=>{});}}
  async function select(id){const response=await context.request.post(base+'/api/demo/session',{data:{userId:id}});assert.equal(response.status(),200);}
  async function create(ms){
    const upload=await context.request.post(base+'/api/assets',{multipart:{file:{name:'qa.jpg',mimeType:'image/jpeg',buffer:await fs.readFile(path.join(root,'frontend/public/demo/samples/lake.jpg'))}}});assert.equal(upload.status(),200);
    const response=await context.request.post(base+'/api/tasks',{data:{templateId:'pet-portrait',assetIds:[(await upload.json()).id],requestKey:crypto.randomUUID(),simulation:{checkMs:0,generationMs:ms,organizeMs:0,failAt:null}}});assert.equal(response.status(),202);return (await response.json()).taskId;
  }
  const card=id=>page.locator('.task-card').filter({has:page.locator('a[href="/tasks/'+id+'"]')});
  async function keyboardTo(locator){for(let i=0;i<100;i++){await page.keyboard.press('Tab');if(await locator.evaluate(el=>el===document.activeElement))return;}throw new Error('Keyboard could not reach '+await locator.getAttribute('aria-label'));}
  try{
    await select('alice');
    await check('Real browser A HTTP500 / B success / independent recovery and terminal polling',async()=>{
      const a=await create(16000),b=await create(5000);checks.push({name:'realTaskIds',a,b,result:'INFO'});
      await until(async()=>{const responses=await Promise.all([a,b].map(id=>context.request.get(base+'/api/tasks/'+id)));return (await Promise.all(responses.map(r=>r.json()))).every(task=>task.status==='RUNNING');},'Both tasks did not enter RUNNING');
      await page.route('**/api/tasks/'+a,route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'QA_HTTP_500',message:'浏览器验收：临时查询故障'})}));
      await page.goto(base+'/history');await card(a).locator('.status.running').waitFor();
      await card(a).getByText('状态同步失败，可重试。',{exact:false}).waitFor();
      assert.equal(await card(a).locator('.status.running').count(),1);assert.equal(await card(a).locator('.status.failed').count(),0);
      await card(b).locator('.status.succeeded').waitFor({timeout:20000});
      await page.screenshot({path:path.join(output,'a-sync-error-b-success.png')});
      const bCount=network.filter(r=>r.path.endsWith(b)).length;await pause(1900);assert.equal(network.filter(r=>r.path.endsWith(b)).length,bCount);
      await page.unroute('**/api/tasks/'+a);await card(a).getByRole('button',{name:'恢复查询'}).click();
      await until(()=>card(a).locator('.query-error').count().then(n=>n===0),'A error did not clear');
      await card(a).locator('.status.succeeded').waitFor({timeout:25000});
      const count=network.length;await pause(3300);assert.equal(network.length,count,'Terminal tasks still polling');
      checks.push({name:'A/B real network behavior',result:'PASS',aInitial:'RUNNING with HTTP500',bFinal:'SUCCEEDED',aRecovered:'SUCCEEDED',terminalPollingStopped:true});
      const preview=card(a).getByRole('button',{name:/预览作品/});
      await keyboardTo(preview);await page.keyboard.press('Enter');await page.locator('dialog[open]').waitFor();
      assert.equal(await page.getByRole('button',{name:'关闭结果预览'}).evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog[open]')),true,'Dialog leaked focus');
      await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog[open]')),true,'Dialog leaked reverse focus');
      await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await preview.evaluate(el=>el===document.activeElement),true,'Focus did not return to preview trigger');
    });
    await check('Refresh restores a real RUNNING task; leaving page and switching user cancel tracking',async()=>{
      const id=await create(18000);await page.goto(base+'/history');await card(id).locator('.status.running').waitFor();
      await page.reload();await card(id).locator('.status.running').waitFor();
      await page.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'模板广场'}).click();await page.locator('.template-card').first().waitFor();
      const count=network.length;await pause(1800);assert.equal(network.length,count,'Gallery continues polling');
      await page.goto(base+'/history');await card(id).locator('.status.running').waitFor();
      let release;const gate=new Promise(resolve=>{release=resolve;});let intercepted=false;
      await page.route('**/api/tasks/'+id,async route=>{const response=await route.fetch();intercepted=true;await gate;await route.fulfill({response}).catch(()=>{});});
      await until(()=>intercepted,'No task request to hold');
      await page.getByRole('combobox',{name:'切换演示用户'}).selectOption('bob');
      await until(()=>page.getByRole('combobox',{name:'切换演示用户'}).inputValue().then(v=>v==='bob'),'Bob not selected');
      release();await pause(500);assert.equal(await card(id).count(),0,'Old-user response polluted Bob');
      await page.unroute('**/api/tasks/'+id);await page.getByRole('combobox',{name:'切换演示用户'}).selectOption('alice');
      await until(async()=>(await (await context.request.get(base+'/api/tasks/'+id)).json()).status==='SUCCEEDED','Background task did not complete after returning');
    });
    await check('Keyboard skip link, profile form focus ring and upload control',async()=>{
      await page.goto(base+'/account');await page.getByLabel(/^昵称/).waitFor();
      await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Enter');
      await keyboardTo(page.getByLabel('上传头像'));
      assert.equal(await page.locator('.avatar-upload').evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
      await keyboardTo(page.getByLabel(/^昵称/));
      assert.equal(await page.getByLabel(/^昵称/).evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
      await page.keyboard.press('Tab');assert.equal(await page.getByLabel(/^个人简介/).evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.getByLabel(/^个人简介/).evaluate(el=>getComputedStyle(el).outlineWidth),'3px','Bio has no consistent visible focus ring');
      await page.screenshot({path:path.join(output,'account-keyboard.png')});
    });
    await check('Mobile 320/375/390px: gallery, studio, history, account without horizontal overflow',async()=>{
      for(const width of [320,375,390]){
        await page.setViewportSize({width,height:844});
        for(const route of ['/','/templates/pet-portrait','/history','/account','/login','/register']){
          await page.goto(base+route);await page.locator('h1').first().waitFor();await pause(300);
          const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.scroll<=size.viewport+1,route+' overflows '+width+': '+JSON.stringify(size));
          if(width===375)await page.screenshot({path:path.join(output,(route==='/'?'gallery':route.split('/')[1])+'-375.png'),fullPage:route==='/account'});
        }
      }
    });
    await check('Desktop studio creation/activity heights',async()=>{
      await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/templates/pet-portrait');await page.locator('.creation-panel').waitFor();await page.locator('.task-card').first().waitFor();
      const metrics=await page.evaluate(()=>({creation:document.querySelector('.creation-panel').getBoundingClientRect().height,activity:document.querySelector('.live-tasks').getBoundingClientRect().height}));
      checks.push({name:'studioGeometry',...metrics,result:'INFO'});
      if(process.env.FF_ASSERT_COMPACT==='true')assert.ok(metrics.activity<=Math.max(metrics.creation+80,760),'Activity creates a large blank below creation');
      if(process.env.FF_ASSERT_COMPACT==='true')assert.ok(Math.abs(metrics.activity-metrics.creation)<=300,'Desktop panels leave excessive empty space');
      await page.screenshot({path:path.join(output,'studio-desktop.png'),fullPage:true});
    });
    assert.deepEqual(pageErrors,[]);
  }finally{
    const result={result:checks.some(c=>c.result==='FAIL')||pageErrors.length?'FAIL':'PASS',time:new Date().toISOString(),browser:browser.version(),checks,pageErrors,network};
    await fs.writeFile(path.join(output,'browser-regression.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
    if(result.result==='FAIL')process.exitCode=1;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
