"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {api,message} from "@/lib/api";
import {active,dateTime,statusName,type Task} from "@/lib/types";
import {useFeed,useSession} from "./providers";
import {ResultPreview,TaskCard,Timeline} from "./task-card";

export function TaskPages({history=false}:{history?:boolean}){
  const {user,sessionLoading}=useSession(),state=useFeed();
  const [filter,setFilter]=useState(history?"ALL":"ACTIVE");
  const tasks=Object.values(state.items).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const visible=tasks.filter(task=>filter==="ALL"||(filter==="ACTIVE"?active(task):task.status===filter));
  if(!user)return <div className="empty-state"><h2>{sessionLoading?"正在恢复工作空间…":"作品会保存在你的工作空间"}</h2><p>选择上方演示身份即可查看。</p></div>;
  return <section>
    <div className="page-heading"><div><span className="eyebrow">{history?"YOUR CREATIVE ARCHIVE":"MADE IN THE BACKGROUND"}</span><h1>{history?"每一份灵感，都有记录。":"创作继续，灵感不停。"}</h1><p>{history?"查看制作结果、失败原因与真实阶段时间线。":"后台正在替你完成制作，你可以继续浏览和提交新作品。"}</p></div><Link className="button primary" href="/">探索模板 <span aria-hidden>＋</span></Link></div>
    <div className="toolbar"><div className="category-tabs">{[["ALL","全部"],["ACTIVE","进行中"],["SUCCEEDED","已完成"],["FAILED","失败"]].map(([key,label])=><button key={key} className={filter===key?"active":""} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}{key==="ACTIVE"?" · "+tasks.filter(active).length:""}</button>)}</div><button className="button secondary small" disabled={state.loading} onClick={()=>void state.feed.start()}>↻ 刷新记录</button></div>
    {state.pageError&&<div className="notice error" role="alert">{state.pageError}<button className="text-button" onClick={()=>void state.feed.start()}>重新连接</button></div>}
    {state.loading&&!tasks.length?<div className="empty-state">正在读取创作记录…</div>:!visible.length?<div className="empty-state"><span className="empty-icon" aria-hidden>▧</span><h2>{filter==="ACTIVE"?"当前没有进行中的任务":"这里还没有作品"}</h2><p>从一个模板开始，让照片拥有新的表达。</p><Link className="button secondary" href="/">去挑选模板</Link></div>:
    <div className="task-grid">{visible.map(task=><TaskCard key={task.id} task={task} error={state.errors[task.id]} onRetry={()=>state.feed.retry(task.id)}/>)}</div>}
    {state.nextCursor!==null&&<div className="load-more"><button className="button secondary" disabled={state.moreLoading} onClick={()=>void state.feed.more()}>{state.moreLoading?"加载中…":"加载更早的记录"}</button></div>}
    <p className="fine-print">记录属于 {user.name} · 刷新页面不会中断服务端任务</p>
  </section>;
}
export function TaskDetail({id}:{id:string}){
  const {user}=useSession(),state=useFeed();
  const [loadError,setLoadError]=useState<{userId:string;taskId:string;message:string}|null>(null),[revision,setRevision]=useState(0);
  const task=state.items[id];
  const error=loadError?.userId===user?.id&&loadError?.taskId===id?loadError.message:null;
  useEffect(()=>{
    if(!user||task||state.loading)return;
    const controller=new AbortController();
    void api<Task>("/tasks/"+id,{signal:controller.signal}).then(task=>{if(!controller.signal.aborted){state.feed.add(task);setLoadError(null);}})
      .catch(error=>{if(!controller.signal.aborted)setLoadError({userId:user.id,taskId:id,message:message(error)});});
    return()=>controller.abort();
  },[id,user,state.feed,state.loading,task,revision]);
  if(!user)return <div className="empty-state">请选择演示身份查看任务。</div>;
  if(!task)return <div className="empty-state" role={error?"alert":undefined}><h2>{error||"正在读取任务…"}</h2>{error&&<button className="button secondary" onClick={()=>setRevision(value=>value+1)}>重新查询</button>}</div>;
  return <section><Link className="back-link" href="/history">← 返回历史记录</Link>
    <div className="page-heading"><div><span className="eyebrow">THE STORY BEHIND YOUR CREATION</span><h1>{task.templateTitle}</h1><p>{dateTime(task.createdAt)} · <span className={"status "+task.status.toLowerCase()}>{statusName[task.status]}</span></p></div>{task.status==="SUCCEEDED"&&<ResultPreview task={task}/>}</div>
    <div className="detail-grid"><div className="panel"><h2>真实执行时间线</h2><p className="muted">每一次阶段开始与结束，都来自 Java 后台记录。</p><Timeline task={task} expanded/>
      {task.errorMessage&&<div className="notice error"><strong>{task.errorCode}</strong><p>{task.errorMessage}</p></div>}
      {state.errors[id]&&<div className="query-error" role="alert">状态同步失败，可重试。已保留上次状态。<button className="text-button" onClick={()=>state.feed.retry(id)}>恢复查询</button></div>}
    </div><div className="panel"><h2>任务信息</h2><dl className="metadata"><dt>任务 ID</dt><dd>{task.id}</dd><dt>状态版本</dt><dd>{task.version}</dd><dt>所属用户</dt><dd>{user.name}</dd><dt>输入素材</dt><dd>{task.assets.length} 张</dd></dl><Link className="button secondary" href={"/templates/"+task.templateId}>回到模板</Link></div></div>
  </section>;
}
