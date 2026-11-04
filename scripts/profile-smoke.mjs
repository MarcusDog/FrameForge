import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const base=process.env.FRAMEFORGE_URL||"http://localhost:3000";
let cookie="";
async function request(path,init={},status=200){
  const response=await fetch(base+"/api"+path,{...init,headers:{...init.headers,...(cookie?{Cookie:cookie}:{})},signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,status,path+" status "+response.status);return response;
}
const json=(method,body)=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const select=async userId=>{const response=await request("/demo/session",json("POST",{userId}));cookie=response.headers.get("set-cookie").split(";")[0];};
const input=profile=>({nickname:profile.nickname,bio:profile.bio,avatarColor:profile.avatarColor,avatarAssetId:profile.avatarAssetId,version:profile.version});
await select("alice");const alice=await (await request("/me/profile")).json();
await select("bob");const original=await (await request("/me/profile")).json();
const summary=await (await request("/me/summary")).json();
let saved;
try{
  const form=new FormData();form.append("file",new Blob([await readFile(new URL("../frontend/public/demo/samples/lake.jpg",import.meta.url))],{type:"image/jpeg"}),"avatar.jpg");
  const asset=await (await request("/assets",{method:"POST",body:form})).json();
  const change={nickname:"光影旅人",bio:"FrameForge 资料保存验证",avatarColor:"#386fa4",avatarAssetId:asset.id,version:original.version};
  saved=await (await request("/me/profile",json("PUT",change))).json();
  assert.equal(saved.nickname,change.nickname);assert.equal(saved.version,original.version+1);
  assert.equal(saved.avatarAssetId,asset.id);
  assert.deepEqual(await (await request("/me/profile")).json(),saved,"Fresh GET must restore saved data");
  const image=await request(saved.avatarUrl.replace("/api",""));assert.equal(image.headers.get("content-type"),"image/jpeg");assert.ok((await image.arrayBuffer()).byteLength>100);
  await request("/me/profile",json("PUT",change),409);
  await select("alice");assert.deepEqual(await (await request("/me/profile?userId=bob")).json(),alice);
  await request(saved.avatarUrl.replace("/api",""),{},404);
  await request("/me/profile",json("PUT",{...input(alice),avatarAssetId:asset.id}),404);
  await select("bob");
  const logout=await request("/demo/session",{method:"DELETE"});assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
  cookie="";await request("/me/profile",{},401);await request("/tasks",{},401);
  await select("bob");assert.deepEqual(await (await request("/me/profile")).json(),saved);
  const after=await (await request("/me/summary")).json();assert.equal(after.totalTasks,summary.totalTasks);assert.equal(after.assetCount,summary.assetCount+1);
  console.log(JSON.stringify({result:"PASS",profileUser:saved.userId,version:saved.version,persistedNickname:true,ownedAvatar:true,conflict409:true,foreignAvatar404:true,logout401:true,historyPreserved:true},null,2));
}finally{
  if(saved){
    await select("bob");
    // Expected version protects any concurrent manual edit; never silently overwrite it.
    await request("/me/profile",json("PUT",{...input(original),version:saved.version}));
    console.log(JSON.stringify({profileRestored:true,uploadedTestAssetRetained:true}));
  }
}
