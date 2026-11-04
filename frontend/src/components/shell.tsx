"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import {IdentityPrompt,useSession} from "./providers";
import {Avatar} from "./avatar";

export function Shell({children}:{children:ReactNode}){
  const pathname=usePathname(),session=useSession();
  const links=[{path:"/",label:"模板广场",icon:"▦"},{path:"/tasks",label:"我的任务",icon:"◷"},{path:"/history",label:"历史记录",icon:"▤"},{path:"/account",label:"个人中心",icon:"◎"}];
  const current=links.find(link=>link.path!=="/"&&pathname.startsWith(link.path))?.label||"模板广场";
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark" aria-hidden>F<span>✦</span></span><span>FrameForge<small>素材创作工作台</small></span></Link>
      <div className="nav-label">工作空间</div>
      <nav aria-label="主要导航">{links.map(link=><Link key={link.path} href={link.path} className={(link.path==="/"?(pathname==="/"||pathname.startsWith("/templates")):pathname.startsWith(link.path))?"nav-item selected":"nav-item"}><span aria-hidden>{link.icon}</span>{link.label}</Link>)}</nav>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">工作空间 <span>/</span> {current}</div>
        <div className="user-switch"><Link href="/account" className="header-profile" aria-label="个人中心"><Avatar className="header-avatar" name={session.profile?.nickname||session.user?.name||"?"} url={session.profile?.avatarUrl} color={session.profile?.avatarColor}/><span>{session.profile?.nickname||session.user?.name}</span></Link>
          <select aria-label="切换演示用户" disabled={session.switching||session.sessionLoading} value={session.user?.id||""} onChange={event=>void session.switchUser(event.target.value)}>
            <option value="" disabled>{session.sessionLoading?"恢复身份…":session.switching?"切换中…":"选择账户"}</option>
            {session.users.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </div>
      </header>
      <main id="main-content">
        {session.sessionError&&<div role="alert" className="notice error">{session.sessionError}<button className="text-button" onClick={session.reloadSession}>重新连接</button></div>}
        {!session.user&&!session.sessionLoading&&!session.switching&&<IdentityPrompt/>}
        {children}
      </main>
      <footer className="site-footer"><span>FrameForge Studio</span></footer>
    </div>
  </div>;
}
