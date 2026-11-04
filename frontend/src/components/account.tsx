"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {api,message} from "@/lib/api";
import type {UserSummary} from "@/lib/types";
import {useFeed,useSession} from "./providers";
import {TaskCard} from "./task-card";
import {Avatar} from "./avatar";
import {ProfileEditor} from "./profile-editor";

type SummarySnapshot={owner:string;value:UserSummary|null;error:string|null};
export function Account(){
  const {user,users,switching,sessionLoading,switchUser,profile,profileLoading,profileError,reloadProfile,signOut}=useSession(),state=useFeed();
  const [savedFor,setSavedFor]=useState<string|null>(null);
  const [snapshot,setSnapshot]=useState<SummarySnapshot|null>(null),[revision,setRevision]=useState(0);
  const owner=user?.id;
  const taskRevision=Object.values(state.items).map(task=>task.id+":"+task.version).join("|");
  useEffect(()=>{
    if(!owner)return;
    const controller=new AbortController();
    void api<UserSummary>("/me/summary",{signal:controller.signal}).then(value=>{
      if(!controller.signal.aborted)setSnapshot({owner,value,error:null});
    }).catch(error=>{
      if(!controller.signal.aborted)setSnapshot(previous=>({owner,value:previous?.owner===owner?previous.value:null,error:message(error)}));
    });
    return()=>controller.abort();
  },[owner,taskRevision,revision]);
  if(!user)return <div className="empty-state"><h1>{switching?"正在切换账户…":sessionLoading?"正在恢复账户…":"个人中心"}</h1></div>;
  const current=snapshot&&snapshot.owner===user.id?snapshot:null;
  const summary=current?.value??null,error=current?.error??null;
  const recent=Object.values(state.items).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,4);
  return <section>
    <div className="page-heading"><h1>个人中心</h1><button className="button secondary" disabled={state.loading} onClick={()=>{setRevision(value=>value+1);void state.feed.start();}}>刷新记录</button></div>
    <div className="account-profile panel"><Avatar name={profile?.nickname||user.name} url={profile?.avatarUrl} color={profile?.avatarColor}/><div><h2>{profile?.nickname||user.name}</h2><p className="muted">{user.name} · 账户 ID {user.id}</p>{profile?.bio&&<p className="profile-bio">{profile.bio}</p>}<span className="subtle-badge">演示账户</span></div><Link className="button primary" href="/">创建作品 ↗</Link></div>
    {error&&<div className="notice error" role="alert">统计同步失败：{error}<button className="text-button" onClick={()=>setRevision(value=>value+1)}>重试</button></div>}
    <dl className="account-stats">{([["totalTasks","全部任务"],["activeTasks","进行中"],["succeededTasks","已完成"],["failedTasks","失败"],["assetCount","已上传素材"]] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{summary?.[key]??"—"}</dd></div>)}</dl>
    <div className="account-grid"><div><div className="section-heading"><h2>最近记录</h2><Link className="text-link" href="/history">全部记录 →</Link></div>
      {state.pageError&&<div className="notice error" role="alert">{state.pageError}<button className="text-button" onClick={()=>void state.feed.start()}>重新加载</button></div>}
      {state.loading&&!recent.length?<div className="empty-state">正在读取记录…</div>:!recent.length?<div className="empty-state"><h3>还没有作品</h3><Link className="button secondary" href="/">选择模板</Link></div>:<div className="account-recent">{recent.map(task=><TaskCard key={task.id} task={task} error={state.errors[task.id]} onRetry={()=>state.feed.retry(task.id)}/>)}</div>}
    </div><aside className="account-settings">
      {profileLoading?<div className="panel" role="status">正在读取资料…</div>:profileError?<div className="notice error" role="alert">资料加载失败：{profileError}<button className="text-button" onClick={reloadProfile}>重试</button></div>:profile&&<ProfileEditor key={user.id+":"+profile.version} profile={profile} onSaved={()=>setSavedFor(user.id)} onEdit={()=>setSavedFor(null)}/>}
      {savedFor===user.id&&<p role="status" className="profile-saved">资料已保存</p>}
      <div className="panel account-switch"><h2>账户</h2>{users.map(account=><button key={account.id} className={"account-choice "+(user.id===account.id?"selected":"")} disabled={switching||sessionLoading||user.id===account.id} onClick={()=>{setSavedFor(null);void switchUser(account.id);}}><Avatar className="small-avatar" name={user.id===account.id?profile?.nickname||account.name:account.name} url={user.id===account.id?profile?.avatarUrl:null} color={user.id===account.id?profile?.avatarColor:account.id==="bob"?"#38745d":"#6551d9"}/><span>{account.name}<small>{account.id}</small></span><span>{user.id===account.id?"当前":"切换 →"}</span></button>)}
      <button className="button secondary sign-out" disabled={switching||sessionLoading} onClick={()=>{setSavedFor(null);void signOut();}}>退出当前账户</button></div>
    </aside></div>
  </section>;
}
