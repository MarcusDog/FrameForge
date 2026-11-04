"use client";
import Link from "next/link";
import Image from "next/image";
import {useId,useRef,useState} from "react";
import {dateTime,stageName,statusName,type Task} from "@/lib/types";

export function Timeline({task,expanded=false}:{task:Task;expanded?:boolean}){
  return <ol className={"timeline"+(expanded?" expanded":"")}>{task.stages.map(stage=><li key={stage.stage} className={stage.status.toLowerCase()}>
    <span className="stage-dot" aria-hidden>{stage.status==="SUCCEEDED"?"✓":stage.status==="FAILED"?"×":""}</span>
    <div><strong>{stageName[stage.stage]}</strong><small>{stage.status==="PENDING"?"等待开始":stage.status==="SKIPPED"?"已跳过":stage.status==="RUNNING"?"正在处理":stage.status==="FAILED"?"执行失败":"已完成"}{stage.durationMs!==null?" · "+(stage.durationMs/1000).toFixed(2)+" 秒":""}</small>
    {expanded&&stage.startedAt&&<small>开始 {new Date(stage.startedAt).toLocaleTimeString("zh-CN")}{stage.endedAt?" · 结束 "+new Date(stage.endedAt).toLocaleTimeString("zh-CN"):""}</small>}
    {expanded&&stage.errorMessage&&<p className="error-text">{stage.errorMessage}</p>}</div>
  </li>)}</ol>;
}
export function ResultPreview({task}:{task:Task}){
  const titleId=useId();
  const dialog=useRef<HTMLDialogElement>(null),[failed,setFailed]=useState(false);
  return <>
    <button className="button secondary small" onClick={()=>{setFailed(false);dialog.current?.showModal();}}>预览作品 <span aria-hidden>↗</span></button>
    <dialog ref={dialog} aria-labelledby={titleId} className="preview-dialog" onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]'));
      const first=controls[0],last=controls.at(-1);
      if(first&&((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last))){event.preventDefault();(event.shiftKey?last:first)?.focus();}
    }} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className="dialog-heading"><div><span className="eyebrow">YOUR FINISHED CREATION</span><h2 id={titleId}>{task.templateTitle}</h2></div><button className="icon-button" autoFocus aria-label="关闭结果预览" onClick={()=>dialog.current?.close()}>×</button></div>
      {failed?<div role="alert" className="empty-state">图片暂时无法加载，请关闭后重新预览。</div>:task.resultUrl&&<Image src={task.resultUrl} alt={task.templateTitle+"制作结果"} width={1200} height={900} unoptimized onError={()=>setFailed(true)}/>}
      <p className="muted">制作于 {dateTime(task.createdAt)} · 由你的照片生成</p>
    </dialog>
  </>;
}
export function TaskCard({task,error,onRetry,compact=false}:{task:Task;error?:string;onRetry:()=>void;compact?:boolean}){
  return <article className={"task-card"+(compact?" compact":"")}>
    <div className="task-heading"><Image className="task-thumb" src={task.assets[0]?.previewUrl||task.coverUrl} alt={task.assets.length?"上传素材预览":""} width={80} height={70} unoptimized/>
      <div><h3><Link href={"/tasks/"+task.id}>{task.templateTitle}</Link></h3><small>#{task.id.slice(0,6)} · {dateTime(task.createdAt)}</small></div>
      <span className={"status "+task.status.toLowerCase()}><i/>{statusName[task.status]}</span></div>
    {compact?<p className="compact-stage">{task.status==="SUCCEEDED"?"全部阶段已完成":task.currentStage?stageName[task.currentStage]:"等待开始"}</p>:<Timeline task={task}/>}
    {task.status==="FAILED"&&<div className="task-failure"><strong>{task.currentStage?stageName[task.currentStage]+"失败":"任务未能执行"}</strong><p>{task.errorMessage}</p></div>}
    {error&&<div className="query-error" role="alert">状态同步失败，可重试。已保留上次记录。<small>{error}</small><button className="text-button" onClick={onRetry}>恢复查询</button></div>}
    <div className="task-footer"><Link className="text-link" href={"/tasks/"+task.id}>执行详情 <span aria-hidden>→</span></Link>{task.status==="SUCCEEDED"&&<ResultPreview task={task}/>}</div>
  </article>;
}
