// Optional headless QA. Reuse an installed playwright-core and Edge; no browser downloads.
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const {chromium}=require(process.env.FF_PLAYWRIGHT_MODULE||"playwright-core");
const base=process.env.FRAMEFORGE_URL||"http://localhost:3000";
const root=path.resolve(__dirname,".."),output=path.join(root,"output/playwright");
async function until(predicate,message,timeout=15000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){if(await predicate())return;await new Promise(done=>setTimeout(done,50));}
  throw new Error(message);
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const server=await chromium.launchServer({channel:"msedge",headless:true,timeout:20000});
  const browser=await chromium.connect(server.wsEndpoint());
  const errors=[],checks=[];
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"zh-CN"});
    const page=await context.newPage();
    page.on("pageerror",error=>errors.push(error.message));
    let polls=0;
    page.on("request",request=>{if(request.method()==="GET"&&/\/api\/tasks\/[a-f0-9-]+$/.test(request.url()))polls++;});
    await page.goto(base);
    await page.locator(".template-card").first().waitFor();
    assert.equal(await page.locator(".template-card").count(),12);
    assert.ok((await page.locator("body").innerText()).includes("旅行明信片"));
    await page.getByRole("button",{name:"创意拼贴",exact:true}).click();
    assert.equal(await page.locator(".template-card").count(),4);
    await page.getByRole("button",{name:"全部",exact:true}).click();
    await page.screenshot({path:path.join(output,"gallery-desktop.png"),fullPage:true});
    checks.push("UTF-8 gallery and category filter");
    await page.getByRole("button",{name:/以 Alice 体验/}).click();
    await until(()=>page.getByRole("combobox",{name:"切换演示用户"}).inputValue().then(value=>value==="alice"),"Alice not selected");
    await page.locator(".template-card").filter({hasText:"旅行明信片"}).click();
    await page.getByLabel("选择素材 1").waitFor();
    assert.equal(await page.locator('input[type="file"]').count(),2);
    const submit=page.getByRole("button",{name:/开始制作/});
    assert.equal(await submit.isDisabled(),true);
    await page.getByLabel("选择素材 1").setInputFiles(path.join(root,"frontend/public/demo/samples/lake.jpg"));
    await page.getByLabel("选择素材 2").setInputFiles(path.join(root,"frontend/public/demo/samples/mountains.jpg"));
    await until(()=>submit.isEnabled(),"Uploads not ready");
    await page.locator(".simulation summary").click();
    await page.getByRole("spinbutton",{name:"素材检查耗时",exact:true}).fill("0");
    await page.getByRole("spinbutton",{name:"模拟生成耗时",exact:true}).fill("5000");
    await page.getByRole("spinbutton",{name:"结果整理耗时",exact:true}).fill("0");
    const send=async()=>{
      const pending=page.waitForResponse(response=>response.url().endsWith("/api/tasks")&&response.request().method()==="POST");
      await submit.click();const response=await pending;assert.equal(response.status(),202);
      return (await response.json()).taskId;
    };
    const success=await send();
    await until(()=>submit.isEnabled(),"Submit remained disabled after acceptance");
    await page.getByRole("combobox",{name:"模拟失败阶段"}).selectOption("GENERATING");
    const failure=await send();
    assert.notEqual(success,failure);
    checks.push("Dynamic uploads, successful acceptance, repeat submission");
    await page.getByRole("navigation",{name:"主要导航"}).getByRole("link",{name:"模板广场"}).click();
    await page.locator(".template-card").first().waitFor();
    const galleryPolls=polls;await page.waitForTimeout(1800);assert.equal(polls,galleryPolls);
    await page.getByRole("navigation",{name:"主要导航"}).getByRole("link",{name:"历史记录"}).click();
    checks.push("Leaving task pages stops queries; returning restores tracking");
    const successCard=page.locator('.task-card:has(a[href="/tasks/'+success+'"])');
    const failedCard=page.locator('.task-card:has(a[href="/tasks/'+failure+'"])');
    await until(()=>successCard.locator(".status.succeeded").count().then(Boolean),"Success was not restored");
    await until(()=>failedCard.locator(".status.failed").count().then(Boolean),"Failure was not restored");
    await page.screenshot({path:path.join(output,"history-desktop.png"),fullPage:true});
    await successCard.getByRole("button",{name:/预览作品/}).click();
    await page.locator("dialog[open] img").waitFor();
    await until(()=>page.locator("dialog[open] img").evaluate(image=>image.complete&&image.naturalWidth===1200),"Result image did not decode");
    await page.screenshot({path:path.join(output,"result-preview.png"),fullPage:true});
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(),0);
    checks.push("Refresh recovery, independent success/failure, real result preview, Escape close");
    const before=polls;await page.waitForTimeout(3300);assert.equal(polls,before);
    checks.push("No task polling after terminal state");
    await page.getByRole("combobox",{name:"切换演示用户"}).selectOption("bob");
    await until(()=>page.getByRole("combobox",{name:"切换演示用户"}).inputValue().then(value=>value==="bob"),"Bob not selected");
    await until(()=>page.locator(".task-card").count().then(count=>count===0),"Old user's cards remained");
    await page.goto(base+"/templates/travel-postcard");
    await page.getByLabel("选择素材 1").waitFor();
    assert.equal(await page.getByRole("button",{name:/开始制作/}).isDisabled(),true);
    await page.getByRole("combobox",{name:"切换演示用户"}).selectOption("alice");
    await until(()=>page.getByRole("combobox",{name:"切换演示用户"}).inputValue().then(value=>value==="alice"),"Alice not restored");
    checks.push("User switch clears previous tasks and upload state");
    const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:"zh-CN",storageState:await context.storageState()});
    const mobile=await mobileContext.newPage();
    mobile.on("pageerror",error=>errors.push(error.message));
    for(const width of [390,320]){
      await mobile.setViewportSize({width,height:844});
      await mobile.goto(base);await mobile.locator(".template-card").first().waitFor();
      assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,"Gallery overflows at "+width);
      if(width===390)await mobile.screenshot({path:path.join(output,"gallery-mobile.png"),fullPage:true});
      await mobile.goto(base+"/templates/travel-postcard");await mobile.getByLabel("选择素材 1").waitFor();
      assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,"Studio overflows at "+width);
      if(width===390)await mobile.screenshot({path:path.join(output,"studio-mobile.png"),fullPage:true});
    }
    checks.push("390px and 320px gallery/studio layouts without horizontal overflow");
    await page.goto(base+"/templates/not-a-template");await page.locator('.empty-state[role="alert"]').waitFor();
    assert.ok((await page.locator('.empty-state[role="alert"]').innerText()).includes("不存在"));
    checks.push("Unknown template error");
    assert.deepEqual(errors,[]);
    const result={result:"PASS",time:new Date().toISOString(),browser:browser.version(),success,failure,checks,pageErrors:errors};
    await fs.writeFile(path.join(output,"browser-check.json"),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  }finally{
    // Some Windows Edge builds leave background utility processes after graceful close.
    await server.kill();
  }
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
