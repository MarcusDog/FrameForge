import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const base=process.env.FRAMEFORGE_URL||"http://localhost:3000";
const fixture=await readFile(fileURLToPath(new URL("../frontend/public/demo/samples/lake.jpg",import.meta.url)));
let cookie="";
async function request(path,init={},expected=200){
  const response=await fetch(base+"/api"+path,{...init,headers:{...init.headers,...(cookie?{Cookie:cookie}:{})}});
  assert.equal(response.status,expected,path+" returned "+response.status+": "+(response.status!==expected?await response.text():""));
  return response;
}
const jsonPost=body=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
async function identity(id){
  const response=await request("/demo/session",jsonPost({userId:id}));
  const setCookie=response.headers.get("set-cookie");
  assert.ok(setCookie?.includes("HttpOnly"));assert.ok(setCookie?.includes("SameSite=Lax"));
  cookie=setCookie.split(";")[0];assert.equal((await response.json()).id,id);
}
async function upload(){
  const form=new FormData();form.append("file",new Blob([fixture],{type:"image/jpeg"}),"lake.jpg");
  return (await (await request("/assets",{method:"POST",body:form})).json()).id;
}
async function submit(asset,failAt=null){
  const key=crypto.randomUUID();
  const response=await request("/tasks",jsonPost({
    templateId:"pet-portrait",assetIds:[asset],requestKey:key,
    simulation:{failAt,checkMs:100,generationMs:250,organizeMs:100}
  }),202);
  const accepted=await response.json();assert.equal(accepted.task.id,accepted.taskId);
  return accepted.taskId;
}
async function terminal(id){
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    const task=await (await request("/tasks/"+id)).json();
    if(["SUCCEEDED","FAILED"].includes(task.status))return task;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error("Task did not finish: "+id);
}
const templates=await (await request("/templates")).json();
assert.equal(templates.length,6);
assert.equal(templates.find(t=>t.id==="travel-postcard").title,"旅行明信片");
assert.deepEqual(new Set(templates.map(t=>t.category)),new Set(["创意拼贴","生活影集","节日海报"]));
assert.equal(new Set(templates.map(template=>template.category)).size,3);
for(const template of templates){
  assert.equal((await fetch(base+template.coverUrl)).status,200);
}
await identity("alice");
const asset=await upload();
const successId=await submit(asset),failureId=await submit(asset,"GENERATING");
const [success,failure]=await Promise.all([terminal(successId),terminal(failureId)]);
assert.equal(success.status,"SUCCEEDED");
assert.deepEqual(success.stages.map(stage=>stage.status),["SUCCEEDED","SUCCEEDED","SUCCEEDED"]);
assert.equal(failure.status,"FAILED");assert.equal(failure.currentStage,"GENERATING");
assert.deepEqual(failure.stages.map(stage=>stage.status),["SUCCEEDED","FAILED","SKIPPED"]);
const image=new Uint8Array(await (await request(success.resultUrl.replace("/api",""))).arrayBuffer());
assert.deepEqual(Array.from(image.slice(0,8)),[137,80,78,71,13,10,26,10]);
assert.ok((await (await request("/tasks")).json()).items.some(task=>task.id===successId));
await identity("bob");
await request("/tasks/"+successId,{},404);await request("/assets/"+asset+"/content",{},404);
await request(success.resultUrl.replace("/api",""),{},404);
await identity("alice");
assert.equal((await (await request("/tasks/"+successId)).json()).status,"SUCCEEDED");
for(const [path,init,status] of [
  ["/templates",{method:"DELETE"},405],
  ["/tasks",{method:"POST",headers:{"Content-Type":"text/plain"},body:"invalid"},415],
  ["/not-an-api",{},404]
]){
  const error=await (await request(path,init,status)).json();
  assert.equal(error.code,"HTTP_"+status);
}
console.log(JSON.stringify({result:"PASS",base,templates:templates.length,successId,failureId,
  checks:["UTF-8 seed","local covers","cookie forwarding","upload","multi-task","three stages","failure stop","PNG result","history recovery","user isolation","HTTP client errors"]},null,2));
