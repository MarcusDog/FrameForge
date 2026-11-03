"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import {IdentityPrompt,useSession} from "./providers";

export function Shell({children}:{children:ReactNode}){
  const pathname=usePathname(),session=useSession();
  const links=[{path:"/",label:"模板广场",icon:"▦"},{path:"/tasks",label:"我的任务",icon:"◷"},{path:"/history",label:"历史记录",icon:"▤"}];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark" aria-hidden>F<span>✦</span></span><span>FrameForge<small>素材创作工作台</small></span></Link>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="主要导航">{links.map(link=><Link key={link.path} href={link.path} className={(link.path==="/"?(pathname==="/"||pathname.startsWith("/templates")):pathname.startsWith(link.path))?"nav-item selected":"nav-item"}><span aria-hidden>{link.icon}</span>{link.label}</Link>)}</nav>
      <div className="sidebar-bottom"><span className="tiny-dot"/><strong>灵感不必等待</strong><p>后台持续制作，<br/>你可以继续探索。</p><span className="demo-label">DEMO · 无真实 AI 服务</span></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">工作空间 <span>/</span> {pathname.startsWith("/history")?"历史记录":pathname.startsWith("/tasks")?"我的任务":"模板广场"}</div>
        <label className="user-switch"><span className="avatar">{session.user?.name[0]||"?"}</span><span className="sr-only">切换演示用户</span>
          <select aria-label="切换演示用户" disabled={session.switching||session.sessionLoading} value={session.user?.id||""} onChange={event=>void session.switchUser(event.target.value)}>
            <option value="" disabled>{session.sessionLoading?"恢复身份…":session.switching?"切换中…":"选择演示用户"}</option>
            {session.users.map(user=><option key={user.id} value={user.id}>{user.name} · 演示用户</option>)}
          </select>
        </label>
      </header>
      <main id="main-content">
        {session.sessionError&&<div role="alert" className="notice error">{session.sessionError}<button className="text-button" onClick={session.reloadSession}>重新连接</button></div>}
        {!session.user&&!session.sessionLoading&&!session.switching&&<IdentityPrompt/>}
        {children}
      </main>
      <footer className="site-footer"><span>FrameForge Studio</span><span>让每一帧，都有自己的故事。</span></footer>
    </div>
  </div>;
}
