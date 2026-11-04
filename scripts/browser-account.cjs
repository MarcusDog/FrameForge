const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require(process.env.FF_PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'..'),base=process.env.FRAMEFORGE_URL||'http://localhost:3000';
const output=path.join(root,'output/playwright',process.env.FF_QA_RUN||'current');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,ms=25000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await pause(100);}throw new Error(label);}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.FF_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:375,height:844},locale:'zh-CN'}),page=await context.newPage();
  const checks=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
  // Credentials exist only for this run and are never included in screenshots/logs/storageState.
  const username='browser_'+Date.now().toString(36),password=crypto.randomUUID()+'!';
  let userId,ids=[];
  try{
    await page.goto(base+'/register');await page.getByLabel(/^用户名/).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(output,'register-375.png'),fullPage:true});
    for(let i=0;i<30;i++){await page.keyboard.press('Tab');if(await page.getByLabel(/^用户名/).evaluate(el=>el===document.activeElement))break;}
    assert.equal(await page.getByLabel(/^用户名/).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.type(username);await page.keyboard.press('Tab');await page.keyboard.type('浏览器创作者');
    await page.keyboard.press('Tab');await page.keyboard.type(password);await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.type(password);
    const registered=page.waitForResponse(r=>r.url().endsWith('/api/auth/register')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'创建账户并登录'}).click();const response=await registered;assert.equal(response.status(),201);userId=(await response.json()).id;
    await page.waitForURL('**/account');await page.getByRole('heading',{name:'浏览器创作者',exact:true}).waitFor();
    await page.reload();await page.getByLabel(/^昵称/).waitFor();assert.equal(await page.getByLabel(/^昵称/).inputValue(),'浏览器创作者');
    checks.push('375px keyboard registration, auto-login and persisted session/profile after reload');
    await page.goto(base+'/templates/pet-portrait?batch=1');const file=page.getByLabel('批量选择图片');await file.waitFor();
    await file.setInputFiles(['lake.jpg','mountains.jpg','city.jpg'].map(name=>path.join(root,'frontend/public/demo/samples',name)));
    const submit=page.getByRole('button',{name:'开始制作 3 个任务'});await until(()=>submit.isEnabled(),'Batch uploads not ready');
    page.on('response',async r=>{if(r.url().endsWith('/api/tasks')&&r.request().method()==='POST'&&r.status()===202)ids.push((await r.json()).taskId);});
    await submit.click();await until(()=>ids.length===3,'Not all three independent tasks accepted');assert.equal(new Set(ids).size,3);
    const all=await context.request.get(base+'/api/tasks?active=true');const tasks=(await all.json()).items;
    assert.equal(tasks.filter(t=>t.status==='RUNNING').length,2);assert.equal(tasks.filter(t=>t.status==='QUEUED').length,1);
    await page.screenshot({path:path.join(output,'batch-375.png'),fullPage:true});
    await page.reload();await page.locator('.task-card').first().waitFor();
    await until(async()=>{const response=await context.request.get(base+'/api/tasks');return (await response.json()).items.filter(t=>ids.includes(t.id)&&t.status==='SUCCEEDED').length===3;},'Batch tasks did not complete',40000);
    await page.goto(base+'/history');await until(()=>page.locator('.status.succeeded').count().then(n=>n===3),'History did not recover all results');
    await page.screenshot({path:path.join(output,'registered-history-375.png')});
    checks.push('Real UI three-image batch: two running, one queued, reload restores three separate successful results');
    const other=await browser.newContext();
    assert.equal((await other.request.post(base+'/api/demo/session',{data:{userId}})).status(),400);
    assert.equal((await other.request.post(base+'/api/demo/session',{data:{userId:'alice'}})).status(),200);
    assert.equal((await other.request.get(base+'/api/tasks/'+ids[0])).status(),404);
    await other.close();checks.push('Demo endpoint cannot impersonate the registered account; Alice cannot read its task');
    await page.goto(base+'/account');await page.getByRole('button',{name:'退出当前账户'}).click();await page.getByRole('heading',{name:'个人中心',exact:true}).waitFor();
    const signedOut=await context.request.get(base+'/api/auth/session');assert.equal(signedOut.status(),401);
    await page.goto(base+'/login');await page.getByLabel(/^用户名/).waitFor();await page.screenshot({path:path.join(output,'login-375.png'),fullPage:true});
    await page.getByLabel(/^用户名/).fill(username);await page.getByLabel(/^密码/).fill('incorrect password');await page.getByRole('button',{name:'登录',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'用户名或密码不正确'}).waitFor();
    await page.getByLabel(/^密码/).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/account');
    assert.equal((await (await context.request.get(base+'/api/auth/session')).json()).id,userId);
    await page.goto(base+'/history');await until(()=>page.locator('.task-card').count().then(n=>n===3),'Login lost personal history');
    checks.push('Real logout returns 401; wrong password remains on login; correct login restores owned history');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({result:'PASS',browser:browser.version(),userId,taskIds:ids,checks,pageErrors:errors},null,2));
    await fs.writeFile(path.join(output,'browser-account.json'),JSON.stringify({result:'PASS',time:new Date().toISOString(),browser:browser.version(),userId,taskIds:ids,checks,pageErrors:errors},null,2));
  }catch(error){
    const result={result:'FAIL',time:new Date().toISOString(),browser:browser.version(),error:error.message,checks,pageErrors:errors};
    await fs.writeFile(path.join(output,'browser-account.json'),JSON.stringify(result,null,2));
    await page.screenshot({path:path.join(output,'account-failure.png')});console.error(JSON.stringify(result,null,2));process.exitCode=1;
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
