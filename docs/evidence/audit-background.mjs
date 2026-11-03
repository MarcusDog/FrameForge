// Run only in a Node container attached to the Compose network; see ../REVIEW.md.
// The gate lets the reviewer inspect MySQL before this client makes any task GET.
import assert from "node:assert/strict";
import {access,mkdir,readFile,writeFile} from "node:fs/promises";
import {setTimeout as pause} from "node:timers/promises";

const base=process.env.FRAMEFORGE_URL||"http://frontend:3000";
const gate=process.env.AUDIT_GATE_DIR;
assert.ok(gate,"Set AUDIT_GATE_DIR to a new empty directory inside the mounted workspace");
await mkdir(gate,{recursive:true});
const exists=path=>access(path).then(()=>true,()=>false);
assert.equal(await exists(gate+"/release"),false,"Use a new gate directory for each run");
let cookie="",taskReads=0;
async function request(path,init={},expected=200){
  if(!init.method&&/^\/tasks\/[^/]+$/.test(path))taskReads++;
  const response=await fetch(base+"/api"+path,{...init,headers:{...init.headers,...(cookie?{Cookie:cookie}:{})},signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,expected,path+" status "+response.status);
  return response;
}
const post=body=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const identity=await request("/demo/session",post({userId:"alice"}));
cookie=identity.headers.get("set-cookie").split(";")[0];
const fixture=await readFile(new URL("../../frontend/public/demo/samples/lake.jpg",import.meta.url));
const form=new FormData();form.append("file",new Blob([fixture],{type:"image/jpeg"}),"audit.jpg");
const asset=await (await request("/assets",{method:"POST",body:form})).json();
const started=performance.now();
const accepted=await (await request("/tasks",post({templateId:"pet-portrait",assetIds:[asset.id],requestKey:crypto.randomUUID(),
  simulation:{failAt:null,checkMs:500,generationMs:4500,organizeMs:500}}),202)).json();
const acceptanceMs=Math.round(performance.now()-started);
assert.ok(["QUEUED","RUNNING"].includes(accepted.task.status));
assert.equal(taskReads,0);
const record={taskId:accepted.taskId,acceptedStatus:accepted.task.status,acceptanceMs,taskReadsBeforeGate:taskReads};
await writeFile(gate+"/accepted.json",JSON.stringify(record,null,2));
console.log(JSON.stringify({event:"ACCEPTED_WAITING_FOR_DB_INSPECTION",...record}));
const deadline=Date.now()+90000;
while(!await exists(gate+"/release")){
  assert.ok(Date.now()<deadline,"Reviewer did not release the MySQL inspection gate within 90 seconds");
  await pause(200);
}
const task=await (await request("/tasks/"+accepted.taskId)).json();
assert.equal(task.status,"SUCCEEDED");
assert.deepEqual(task.stages.map(stage=>stage.status),["SUCCEEDED","SUCCEEDED","SUCCEEDED"]);
assert.equal(taskReads,1);
console.log(JSON.stringify({result:"PASS",...record,statusAfterGate:task.status,version:task.version,taskReadsAfterGate:taskReads}));
