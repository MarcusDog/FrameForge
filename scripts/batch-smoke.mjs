import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
const base=process.env.FRAMEFORGE_URL||"http://localhost:3000";
let cookie="";
async function request(path,init={},status=200){
  const response=await fetch(base+"/api"+path,{...init,headers:{...init.headers,...(cookie?{Cookie:cookie}:{})},signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,status,path+" status "+response.status);return response;
}
const post=body=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const session=await request("/demo/session",post({userId:"alice"}));cookie=session.headers.get("set-cookie").split(";")[0];
const before=await (await request("/me/summary")).json();
const form=new FormData();form.append("file",new Blob([await readFile(new URL("../frontend/public/demo/samples/lake.jpg",import.meta.url))],{type:"image/jpeg"}),"batch.jpg");
const asset=await (await request("/assets",{method:"POST",body:form})).json();
const templates=["pet-portrait","birthday-card","sunset-letter"];
const accepted=await Promise.all(templates.map(async(templateId,index)=>(await request("/tasks",post({templateId,assetIds:[asset.id],requestKey:crypto.randomUUID(),simulation:{checkMs:500,generationMs:2000,organizeMs:500,failAt:index===1?"GENERATING":null}}),202)).json()));
const ids=accepted.map(value=>value.taskId);assert.equal(new Set(ids).size,3);
const snapshots=()=>Promise.all(ids.map(async id=>(await request("/tasks/"+id)).json()));
let concurrent;
const startedDeadline=Date.now()+2000;
do{concurrent=await snapshots();if(concurrent.filter(task=>task.status==="RUNNING").length===2)break;await pause(25);}while(Date.now()<startedDeadline);
assert.equal(concurrent.filter(task=>task.status==="RUNNING").length,2,"Two tasks must run concurrently");
assert.equal(concurrent.filter(task=>task.status==="QUEUED").length,1,"The third task should queue independently");
let finished;const deadline=Date.now()+20000;
do{finished=await snapshots();if(finished.every(task=>["SUCCEEDED","FAILED"].includes(task.status)))break;await pause(100);}while(Date.now()<deadline);
assert.deepEqual(finished.map(task=>task.status),["SUCCEEDED","FAILED","SUCCEEDED"]);
assert.equal(finished[1].currentStage,"GENERATING");assert.equal(finished[1].stages[2].status,"SKIPPED");
const hashes=[];
for(const task of [finished[0],finished[2]]){
  const bytes=new Uint8Array(await (await request(task.resultUrl.replace("/api",""))).arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0,8)),[137,80,78,71,13,10,26,10]);hashes.push(createHash("sha256").update(bytes).digest("hex"));
}
assert.notEqual(hashes[0],hashes[1],"Different layouts with the same input should produce distinct results");
const after=await (await request("/me/summary")).json();
assert.equal(after.totalTasks,before.totalTasks+3);assert.equal(after.succeededTasks,before.succeededTasks+2);assert.equal(after.failedTasks,before.failedTasks+1);assert.equal(after.assetCount,before.assetCount+1);
const catalogue=await (await request("/templates")).json();assert.equal(catalogue.length,12);assert.equal(new Set(catalogue.map(t=>t.layout)).size,12);
const covers=await Promise.all(catalogue.map(async t=>{const response=await fetch(base+t.coverUrl);assert.ok(response.ok);return createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex");}));
assert.equal(new Set(covers).size,12);
console.log(JSON.stringify({result:"PASS",taskIds:ids,concurrent:concurrent.map(t=>({id:t.id,status:t.status})),final:finished.map(t=>({id:t.id,status:t.status})),distinctResultHashes:hashes,templateCount:catalogue.length,personalSummary:after},null,2));
