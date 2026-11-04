"use client";
import Image from "next/image";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {api,message,post} from "@/lib/api";
import {active,STAGES,stageName,type Asset,type Simulation,type Task,type Template} from "@/lib/types";
import {useFeed,useSession} from "./providers";
import {TaskCard} from "./task-card";

type Slot={file?:File;preview?:string;status:"empty"|"waiting"|"uploading"|"ready"|"error";asset?:Asset;error?:string};
export function Studio({templateId,initialBatch=false}:{templateId:string;initialBatch?:boolean}){
  const [batch,setBatch]=useState(initialBatch);
  const [template,setTemplate]=useState<Template|null>(null),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0);
  const {user,sessionLoading}=useSession(),state=useFeed();
  useEffect(()=>{
    const controller=new AbortController();
    void api<Template>("/templates/"+templateId,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setTemplate(data);setError(null);}})
      .catch(error=>{if(!controller.signal.aborted)setError(message(error));});
    return()=>controller.abort();
  },[templateId,revision]);
  if(error)return <div className="empty-state" role="alert"><h2>{error}</h2><p>请返回模板广场，或重新连接。</p><div className="button-row"><Link className="button secondary" href="/">返回模板</Link><button className="button secondary" onClick={()=>setRevision(value=>value+1)}>重新加载</button></div></div>;
  if(!template)return <div className="empty-state">正在打开创作工作台…</div>;
  const recent=Object.values(state.items).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,6);
  return <section>
    <Link className="back-link" href="/">← 返回模板广场</Link>
    <div className="studio-title"><h1>制作作品</h1></div>
    <div className="studio-grid"><div className="panel creation-panel">
      <div className="studio-template"><Image src={template.coverUrl} alt={template.title+"模板示例"} width={1200} height={900} unoptimized/>
        <div><span className="eyebrow">{template.category}</span><h2>{template.title}</h2><p>{template.description}</p></div></div>
      <div className="requirements"><span>需要 {template.requiredImageCount} 张图片</span><span>JPG / PNG</span><span>每张 ≤ 5 MiB</span></div>
      <div className="category-tabs creation-modes"><button aria-pressed={!batch} className={!batch?"active":""} onClick={()=>setBatch(false)}>单次制作</button><button aria-pressed={batch} className={batch?"active":""} onClick={()=>setBatch(true)}>批量制作</button></div>
      {user?<UploadForm key={user.id+template.id+batch} template={template} batch={batch}/>:<div className="empty-state"><h3>{sessionLoading?"正在恢复身份…":"先选择上方的演示身份"}</h3><p>你的素材和作品将独立保存。</p></div>}
    </div><aside className="panel live-tasks">
      <div className="section-heading"><div><h2>创作动态 <span className="muted-count">{Object.values(state.items).filter(active).length}</span></h2></div><Link className="text-link" href="/history">全部记录 →</Link></div>

      {state.pageError&&<div className="notice error" role="alert">{state.pageError}<button className="text-button" onClick={()=>void state.feed.start()}>重新连接</button></div>}
      {state.loading&&user?<div className="skeleton task-skeleton"/>:!recent.length?<div className="empty-state small-empty"><span className="empty-icon" aria-hidden>◷</span><h3>暂无任务</h3></div>:
        <div className="live-list">{recent.map(task=><TaskCard key={task.id} task={task} error={state.errors[task.id]} onRetry={()=>state.feed.retry(task.id)} compact/>)}</div>}
    </aside></div>
  </section>;
}
type Submission={taskId?:string;error?:string};
export function UploadForm({template,batch=false}:{template:Template;batch?:boolean}){
  const {simulationEnabled}=useSession(),{feed}=useFeed();
  const [slots,setSlots]=useState<Slot[]>(()=>batch?[]:Array.from({length:template.requiredImageCount},()=>({status:"empty"})));
  const [submitting,setSubmitting]=useState(false),[error,setError]=useState<string|null>(null),[accepted,setAccepted]=useState<string|null>(null);
  const [results,setResults]=useState<Record<number,Submission>>({});
  const [simulation,setSimulation]=useState<Simulation>({failAt:null,checkMs:1000,generationMs:4000,organizeMs:1000});
  const mounted=useRef(true),versions=useRef<number[]>([]),controllers=useRef<(AbortController|undefined)[]>([]);
  const previews=useRef<(string|undefined)[]>([]),submissions=useRef<Set<AbortController>>(new Set());
  const locked=useRef(false),requestKeys=useRef<Record<number,string>>({}),batchEpoch=useRef(0);
  const count=template.requiredImageCount;
  useEffect(()=>{mounted.current=true;batchEpoch.current++;const activeControllers=controllers.current,activePreviews=previews.current,activeSubmissions=submissions.current;return()=>{
    mounted.current=false;activeControllers.forEach(controller=>controller?.abort());activeSubmissions.forEach(controller=>controller.abort());
    activePreviews.forEach(preview=>{if(preview)URL.revokeObjectURL(preview);});
  };},[]);
  function update(index:number,slot:Slot){setSlots(current=>current.map((old,i)=>i===index?slot:old));}
  function remove(index:number){
    versions.current[index]=(versions.current[index]||0)+1;controllers.current[index]?.abort();
    if(previews.current[index])URL.revokeObjectURL(previews.current[index]!);
    previews.current[index]=undefined;delete requestKeys.current[Math.floor(index/count)];setAccepted(null);update(index,{status:"empty"});
  }
  async function choose(index:number,file:File){
    remove(index);const version=versions.current[index];
    if(!template.acceptedMimeTypes.includes(file.type)){update(index,{file,status:"error",error:"仅支持 JPG / PNG 图片"});return;}
    if(file.size===0||file.size>template.maxFileSizeBytes){update(index,{file,status:"error",error:"图片不能为空且不能超过 5 MiB"});return;}
    const preview=URL.createObjectURL(file);previews.current[index]=preview;
    const controller=new AbortController();controllers.current[index]=controller;
    update(index,{file,preview,status:"uploading"});
    const form=new FormData();form.append("file",file);
    try{
      const asset=await api<Asset>("/assets",{method:"POST",body:form,signal:controller.signal});
      if(mounted.current&&versions.current[index]===version&&!controller.signal.aborted)update(index,{file,preview,status:"ready",asset});
    }catch(error){
      if(mounted.current&&versions.current[index]===version&&!controller.signal.aborted)update(index,{file,preview,status:"error",error:message(error)});
    }
  }
  async function chooseBatch(files:File[]){
    if(locked.current||!files.length)return;
    if(files.length>count*5){setError("一次最多选择 "+(count*5)+" 张图片（5 个任务）");return;}
    const generation=++batchEpoch.current;
    for(let i=0;i<Math.max(slots.length,files.length);i++){
      controllers.current[i]?.abort();if(previews.current[i])URL.revokeObjectURL(previews.current[i]!);
      previews.current[i]=undefined;versions.current[i]=(versions.current[i]||0)+1;
    }
    requestKeys.current={};setResults({});setAccepted(null);setError(null);
    setSlots(files.map(file=>({file,status:"waiting"})));
    for(let i=0;i<files.length;i+=3){
      if(!mounted.current||generation!==batchEpoch.current)return;
      await Promise.all(files.slice(i,i+3).map((file,offset)=>choose(i+offset,file)));
    }
  }
  const groups=slots.length/count;
  const durationValid=[simulation.checkMs,simulation.generationMs,simulation.organizeMs].every(value=>Number.isInteger(value)&&value>=0&&value<=30000);
  const groupIds=Array.from({length:Math.floor(groups)},(_,index)=>index);
  const pending=groupIds.filter(index=>!batch||!results[index]?.taskId);
  const ready=slots.length>0&&Number.isInteger(groups)&&slots.every(slot=>slot.status==="ready")&&durationValid&&!submitting&&pending.length>0;
  async function submit(){
    if(locked.current||!ready)return;
    locked.current=true;setSubmitting(true);setError(null);setAccepted(null);
    try{
      await Promise.all(pending.map(async index=>{
        const controller=new AbortController();submissions.current.add(controller);
        requestKeys.current[index]??=crypto.randomUUID();
        try{
          const result=await api<{taskId:string;task:Task}>("/tasks",{...post({templateId:template.id,
            assetIds:slots.slice(index*count,(index+1)*count).map(slot=>slot.asset!.id),requestKey:requestKeys.current[index],
            ...(simulationEnabled?{simulation}:{})}),signal:controller.signal});
          if(mounted.current&&!controller.signal.aborted){
            feed.add(result.task);
            if(batch)setResults(current=>({...current,[index]:{taskId:result.taskId}}));
            else {setAccepted(result.taskId);delete requestKeys.current[index];}
          }
        }catch(error){
          if(mounted.current&&!controller.signal.aborted){
            if(batch)setResults(current=>({...current,[index]:{error:message(error)}}));else setError(message(error));
          }
        }finally{submissions.current.delete(controller);}
      }));
    }finally{locked.current=false;if(mounted.current)setSubmitting(false);}
  }
  return <div className="upload-form">
    {batch&&<label className="batch-picker"><strong>{slots.length?"更换这一批图片":"一次选择多张图片"}</strong><span>{count===1?"每张图片生成独立结果":"每 "+count+" 张一组，分别生成结果"} · 最多 5 个任务</span><input aria-label="批量选择图片" type="file" multiple accept={template.acceptedMimeTypes.join(",")} disabled={submitting} onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value="";void chooseBatch(files);}}/></label>}
    <div className="upload-heading"><h3>{batch?"已选图片":"上传照片"}</h3><span>{slots.filter(slot=>slot.status==="ready").length} / {slots.length} 已上传</span></div>
    {batch&&slots.length>0&&!Number.isInteger(groups)&&<p className="error-text" role="alert">每个任务需要 {count} 张图片，请选择 {count} 的整数倍张数。</p>}
    <div className={(batch?"batch-upload-grid":"upload-grid count-"+count)}>{slots.map((slot,index)=>{
      const acceptedGroup=batch&&Boolean(results[Math.floor(index/count)]?.taskId);
      return <div className={"upload-slot "+slot.status} key={index}
        onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!submitting&&!acceptedGroup&&event.dataTransfer.files[0])void choose(index,event.dataTransfer.files[0]);}}>
        {slot.preview&&<Image src={slot.preview} alt={"素材 "+(index+1)+" 预览"} width={300} height={260} unoptimized/>}
        <label className="upload-select"><input aria-label={"选择素材 "+(index+1)} type="file" accept={template.acceptedMimeTypes.join(",")} disabled={submitting||acceptedGroup} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void choose(index,file);}}/>
          {!slot.preview&&<><span className="upload-plus" aria-hidden>＋</span><strong>照片 {index+1}</strong><small>{slot.status==="waiting"?"等待上传":"点击或拖入图片"}</small></>}
          {slot.preview&&<span className="replace-label">{acceptedGroup?"已创建任务":"替换照片"}</span>}
        </label>
        {slot.status!=="empty"&&<button type="button" className="remove-image" disabled={submitting||acceptedGroup} aria-label={"移除素材 "+(index+1)} onClick={()=>remove(index)}>×</button>}
        {slot.status==="uploading"&&<span className="upload-badge">正在上传…</span>}{slot.status==="ready"&&<span className="upload-badge done">✓ 已上传</span>}
        {batch&&<span className="batch-group-label">任务 {Math.floor(index/count)+1}</span>}
        {slot.status==="error"&&<div className="slot-error" role="alert"><span>{slot.error}</span>{slot.file&&<button type="button" onClick={()=>void choose(index,slot.file!)} disabled={submitting}>重试上传</button>}</div>}
      </div>;
    })}</div>
    {simulationEnabled&&<details className="simulation"><summary>演示控制</summary>
      <label>失败阶段<select aria-label="模拟失败阶段" disabled={submitting||Object.keys(results).length>0} value={simulation.failAt||""} onChange={event=>{requestKeys.current={};setSimulation(value=>({...value,failAt:event.target.value as Simulation["failAt"]||null}));}}><option value="">正常完成</option>{STAGES.map(stage=><option key={stage} value={stage}>{stageName[stage]}</option>)}</select></label>
      <div className="duration-grid">{([["checkMs","素材检查"],["generationMs","模拟生成"],["organizeMs","结果整理"]] as const).map(([key,label])=><label key={key}>{label}（毫秒）<input aria-label={label+"耗时"} type="number" min="0" max="30000" step="500" disabled={submitting||Object.keys(results).length>0} value={Number.isNaN(simulation[key])?"":simulation[key]} onChange={event=>{requestKeys.current={};setSimulation(value=>({...value,[key]:event.target.valueAsNumber}));}}/></label>)}</div>
      {!durationValid&&<p className="error-text">请输入 0～30000 的整数毫秒。</p>}
    </details>}
    {error&&<div role="alert" className="notice error">{error}</div>}
    {accepted&&<div role="status" className="notice success"><strong>✓ 任务已受理</strong><Link href={"/tasks/"+accepted}>查看任务 →</Link></div>}
    {batch&&Object.entries(results).map(([index,result])=><div key={index} role={result.error?"alert":"status"} className={"notice "+(result.error?"error":"success")}><strong>任务 {Number(index)+1} · </strong>{result.taskId?<Link href={"/tasks/"+result.taskId}>已创建，查看进度 →</Link>:result.error}</div>)}
    <button type="button" className="button primary submit-button" disabled={!ready} onClick={()=>void submit()}>{submitting?"正在提交…":slots.some(slot=>slot.status==="uploading"||slot.status==="waiting")?"等待素材上传…":batch?(Object.values(results).some(result=>result.error)?"重试未受理任务":"开始制作 "+groupIds.length+" 个任务"):"开始制作"}<span aria-hidden>↗</span></button>
  </div>;
}
