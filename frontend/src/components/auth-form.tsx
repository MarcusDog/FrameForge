"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {message} from "@/lib/api";
import {IdentityPrompt,useSession} from "./providers";

export function AuthForm({mode}:{mode:"login"|"register"}){
  const session=useSession(),router=useRouter(),register=mode==="register";
  const [username,setUsername]=useState(""),[password,setPassword]=useState(""),[nickname,setNickname]=useState(""),[confirmation,setConfirmation]=useState("");
  const [visible,setVisible]=useState(false),[error,setError]=useState<string|null>(null);
  const request=useRef<AbortController|null>(null),locked=useRef(false);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(locked.current||session.switching||session.sessionLoading)return;
    setError(null);
    if(register&&password!==confirmation){setError("两次输入的密码不一致");return;}
    locked.current=true;const controller=new AbortController();request.current=controller;
    try{await session.authenticate(mode,{username,password,...(register?{nickname}: {})},controller.signal);if(!controller.signal.aborted)router.replace("/account");}
    catch(error){if(!controller.signal.aborted)setError(message(error));}
    finally{locked.current=false;}
  }
  if(session.user)return <section className="auth-card panel"><h1>你已登录</h1><Link className="button primary" href="/account">进入个人中心</Link></section>;
  return <section className="auth-layout"><div className="auth-card panel">
    <span className="eyebrow">FRAMEFORGE ACCOUNT</span><h1>{register?"创建你的账户":"欢迎回来"}</h1>
    <form onSubmit={event=>void submit(event)}>
      <fieldset disabled={session.switching||session.sessionLoading}>
        <label className="profile-field">用户名<input required pattern="[a-zA-Z0-9_]{4,32}" minLength={4} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event=>setUsername(event.target.value)}/><small>4～32 位字母、数字或下划线</small></label>
        {register&&<label className="profile-field">昵称<input required maxLength={24} autoComplete="nickname" value={nickname} onChange={event=>setNickname(event.target.value)}/></label>}
        <label className="profile-field">密码<input type={visible?"text":"password"} required minLength={8} maxLength={128} autoComplete={register?"new-password":"current-password"} value={password} onChange={event=>setPassword(event.target.value)}/><small>8～128 个字符</small></label>
        <button className="text-button password-toggle" type="button" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?"隐藏密码":"显示密码"}</button>
        {register&&<label className="profile-field">确认密码<input type={visible?"text":"password"} required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>}
      </fieldset>
      {error&&<p role="alert" className="notice error">{error}</p>}
      <button className="button primary auth-submit" disabled={session.switching||session.sessionLoading||!username||!password||(register&&(!nickname.trim()||!confirmation))}>{session.switching?"请稍候…":register?"创建账户并登录":"登录"}</button>
    </form>
    <p className="auth-alternative">{register?"已有账户？":"还没有账户？"}<Link className="text-link" href={register?"/login":"/register"}>{register?"去登录":"创建账户"}</Link></p>
  </div>{session.users.length>0&&<IdentityPrompt showAuthLinks={false}/>}</section>;
}
