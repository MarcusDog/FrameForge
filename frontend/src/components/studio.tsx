"use client";
import Image from "next/image";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {api,message,post} from "@/lib/api";
import {active,STAGES,stageName,type Asset,type Simulation,type Task,type Template} from "@/lib/types";
import {useFeed,useSession} from "./providers";
import {TaskCard} from "./task-card";

type Slot={file?:File;preview?:string;status:"empty"|"uploading"|"ready"|"error";asset?:Asset;error?:string};
export function Studio({templateId}:{templateId:string}){
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
    <div className="studio-title"><div><span className="eyebrow">MAKE IT YOURS</span><h1>留住这一刻，换一种表达。</h1></div><span className="subtle-badge">本地模拟制作 · 不调用 AI 服务</span></div>
    <div className="studio-grid"><div className="panel creation-panel">
      <div className="studio-template"><Image src={template.coverUrl} alt={template.title+"模板示例"} width={1200} height={900} unoptimized/>
        <div><span className="eyebrow">{template.category}</span><h2>{template.title}</h2><p>{template.description}</p></div></div>
      <div className="requirements"><span>需要 {template.requiredImageCount} 张图片</span><span>JPG / PNG</span><span>每张 ≤ 5 MiB</span></div>
      {user?<UploadForm key={user.id+template.id} template={template}/>:<div className="empty-state"><h3>{sessionLoading?"正在恢复身份…":"先选择上方的演示身份"}</h3><p>你的素材和作品将独立保存。</p></div>}
    </div><aside className="panel live-tasks">
      <div className="section-heading"><div><span className="eyebrow">WHILE YOU CREATE</span><h2>创作动态 <span className="muted-count">{Object.values(state.items).filter(active).length}</span></h2></div><Link className="text-link" href="/history">全部记录 →</Link></div>
      <p className="muted">任务受理后在后台继续，放心去寻找下一份灵感。</p>
      {state.pageError&&<div className="notice error" role="alert">{state.pageError}<button className="text-button" onClick={()=>void state.feed.start()}>重新连接</button></div>}
      {state.loading&&user?<div className="skeleton task-skeleton"/>:!recent.length?<div className="empty-state small-empty"><span className="empty-icon" aria-hidden>◷</span><h3>第一份作品，正在等你</h3><p>提交后，可在这里查看真实处理阶段。</p></div>:
        <div className="live-list">{recent.map(task=><TaskCard key={task.id} task={task} error={state.errors[task.id]} onRetry={()=>state.feed.retry(task.id)} compact/>)}</div>}
    </aside></div>
  </section>;
}
export function UploadForm({template}:{template:Template}){
  const {simulationEnabled}=useSession(),{feed}=useFeed();
  const [slots,setSlots]=useState<Slot[]>(()=>Array.from({length:template.requiredImageCount},()=>({status:"empty"})));
  const [submitting,setSubmitting]=useState(false),[error,setError]=useState<string|null>(null),[accepted,setAccepted]=useState<string|null>(null);
  const [simulation,setSimulation]=useState<Simulation>({failAt:null,checkMs:1000,generationMs:4000,organizeMs:1000});
  const mounted=useRef(true),versions=useRef<number[]>([]),controllers=useRef<(AbortController|undefined)[]>([]);
  const previews=useRef<(string|undefined)[]>([]),submission=useRef<AbortController|null>(null);
  const locked=useRef(false),requestKey=useRef<string|null>(null);
  useEffect(()=>{mounted.current=true;const activeControllers=controllers.current,activePreviews=previews.current;return()=>{
    mounted.current=false;activeControllers.forEach(controller=>controller?.abort());submission.current?.abort();
    activePreviews.forEach(preview=>{if(preview)URL.revokeObjectURL(preview);});
  };},[]);
  function update(index:number,slot:Slot){setSlots(current=>current.map((old,i)=>i===index?slot:old));}
  function remove(index:number){
    versions.current[index]=(versions.current[index]||0)+1;controllers.current[index]?.abort();
    if(previews.current[index])URL.revokeObjectURL(previews.current[index]!);
    previews.current[index]=undefined;requestKey.current=null;update(index,{status:"empty"});
  }
  async function choose(index:number,file:File){
    remove(index);
    const version=versions.current[index];
    if(!template.acceptedMimeTypes.includes(file.type)){update(index,{file,status:"error",error:"仅支持真实 JPG / PNG 图片"});return;}
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
  const durationValid=[simulation.checkMs,simulation.generationMs,simulation.organizeMs].every(value=>Number.isInteger(value)&&value>=0&&value<=30000);
  const ready=slots.every(slot=>slot.status==="ready")&&durationValid&&!submitting;
  async function submit(){
    if(locked.current||!ready)return;
    locked.current=true;setSubmitting(true);setError(null);setAccepted(null);
    const controller=new AbortController();submission.current=controller;
    requestKey.current??=crypto.randomUUID();
    try{
      const result=await api<{taskId:string;task:Task}>("/tasks",{...post({
        templateId:template.id,assetIds:slots.map(slot=>slot.asset!.id),requestKey:requestKey.current,
        ...(simulationEnabled?{simulation}:{})
      }),signal:controller.signal});
      if(mounted.current&&!controller.signal.aborted){feed.add(result.task);setAccepted(result.taskId);requestKey.current=null;}
    }catch(error){if(mounted.current&&!controller.signal.aborted)setError(message(error));}
    finally{locked.current=false;if(mounted.current)setSubmitting(false);}
  }
  return <div className="upload-form">
    <div className="upload-heading"><h3>放入你的照片</h3><span>{slots.filter(slot=>slot.status==="ready").length} / {template.requiredImageCount} 已准备好</span></div>
    <div className={"upload-grid count-"+slots.length}>{slots.map((slot,index)=><div className={"upload-slot "+slot.status} key={index}
      onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!submitting&&event.dataTransfer.files[0])void choose(index,event.dataTransfer.files[0]);}}>
      {slot.preview&&<Image src={slot.preview} alt={"素材 "+(index+1)+" 预览"} width={300} height={260} unoptimized/>}
      <label className="upload-select">
        <input aria-label={"选择素材 "+(index+1)} type="file" accept={template.acceptedMimeTypes.join(",")} disabled={submitting} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void choose(index,file);}}/>
        {!slot.preview&&<><span className="upload-plus" aria-hidden>＋</span><strong>照片 {index+1}</strong><small>点击或拖入图片</small></>}
        {slot.preview&&<span className="replace-label">替换照片</span>}
      </label>
      {slot.status!=="empty"&&<button type="button" className="remove-image" disabled={submitting} aria-label={"移除素材 "+(index+1)} onClick={()=>remove(index)}>×</button>}
      {slot.status==="uploading"&&<span className="upload-badge">正在上传…</span>}
      {slot.status==="ready"&&<span className="upload-badge done">✓ 已上传</span>}
      {slot.status==="error"&&<div className="slot-error" role="alert"><span>{slot.error}</span>{slot.file&&<button type="button" onClick={()=>void choose(index,slot.file!)} disabled={submitting}>重试上传</button>}</div>}
    </div>)}</div>
    <p className="fine-print">图片上传至 Java 服务端保存。请选择你有权使用的照片。</p>
    {simulationEnabled&&<details className="simulation"><summary>演示控制 <span>成功 / 指定阶段失败 / 处理耗时</span></summary>
      <label>模拟失败阶段<select aria-label="模拟失败阶段" disabled={submitting} value={simulation.failAt||""} onChange={event=>{requestKey.current=null;setSimulation(value=>({...value,failAt:event.target.value as Simulation["failAt"]||null}));}}><option value="">正常完成</option>{STAGES.map(stage=><option key={stage} value={stage}>{stageName[stage]}</option>)}</select></label>
      <div className="duration-grid">{([["checkMs","素材检查"],["generationMs","模拟生成"],["organizeMs","结果整理"]] as const).map(([key,label])=><label key={key}>{label}（毫秒）<input aria-label={label+"耗时"} type="number" min="0" max="30000" step="500" disabled={submitting} value={Number.isNaN(simulation[key])?"":simulation[key]} onChange={event=>{requestKey.current=null;setSimulation(value=>({...value,[key]:event.target.valueAsNumber}));}}/></label>)}</div>
      {!durationValid&&<p className="error-text">各阶段请输入 0～30000 的整数毫秒。</p>}
    </details>}
    {error&&<div role="alert" className="notice error">{error}。重试相同提交会复用提交键。</div>}
    {accepted&&<div role="status" className="notice success"><strong>✓ 任务已受理</strong><p>后台正在接力，你可以继续创作。<Link href={"/tasks/"+accepted}>查看任务 →</Link></p></div>}
    <button type="button" className="button primary submit-button" disabled={!ready} onClick={()=>void submit()}>{submitting?"正在提交…":slots.some(slot=>slot.status==="uploading")?"等待素材上传…":"开始制作"}<span aria-hidden>↗</span></button>
    <div className="background-note"><span aria-hidden>◷</span><p>制作在后台完成<br/><small>关闭或刷新页面，不会中断已受理的任务。</small></p></div>
  </div>;
}
