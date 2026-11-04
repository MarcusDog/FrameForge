"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {api,ApiError,message} from "@/lib/api";
import type {Asset,UserProfile} from "@/lib/types";
import {Avatar} from "./avatar";
import {useSession} from "./providers";

const colors=[{color:"#6551d9",label:"紫罗兰"},{color:"#38745d",label:"松绿色"},{color:"#386fa4",label:"晴空蓝"},{color:"#ac5470",label:"玫瑰色"},{color:"#9c6626",label:"琥珀色"}];
export function ProfileEditor({profile,onSaved,onEdit}:{profile:UserProfile;onSaved:()=>void;onEdit:()=>void}){
  const {saveProfile,reloadProfile}=useSession();
  const [nickname,setNickname]=useState(profile.nickname),[bio,setBio]=useState(profile.bio);
  const [color,setColor]=useState(profile.avatarColor),[avatar,setAvatar]=useState(profile.avatarAssetId),[url,setUrl]=useState(profile.avatarUrl);
  const [uploading,setUploading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null),[conflict,setConflict]=useState(false);
  const request=useRef<AbortController|null>(null),busy=useRef(false);
  useEffect(()=>()=>{request.current?.abort();},[]);
  const dirty=nickname!==profile.nickname||bio!==profile.bio||color!==profile.avatarColor||avatar!==profile.avatarAssetId;
  async function upload(file:File){
    if(busy.current)return;
    setError(null);setConflict(false);
    if(!["image/png","image/jpeg"].includes(file.type)||file.size>5*1024*1024){setError("请选择不超过 5 MiB 的 JPEG 或 PNG 图片");return;}
    busy.current=true;setUploading(true);
    const controller=new AbortController();request.current=controller;
    const body=new FormData();body.append("file",file);
    try{
      const asset=await api<Asset>("/assets",{method:"POST",body,signal:controller.signal});
      if(!controller.signal.aborted){setAvatar(asset.id);setUrl(asset.previewUrl);}
    }catch(error){if(!controller.signal.aborted)setError(message(error));}
    finally{busy.current=false;if(!controller.signal.aborted)setUploading(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();if(busy.current||!dirty||!nickname.trim())return;
    busy.current=true;setSaving(true);setError(null);setConflict(false);
    const controller=new AbortController();request.current=controller;
    try{
      await saveProfile({nickname,bio,avatarColor:color,avatarAssetId:avatar,version:profile.version},controller.signal);
      if(!controller.signal.aborted)onSaved();
    }catch(error){if(!controller.signal.aborted){setError(message(error));setConflict(error instanceof ApiError&&error.status===409);}}
    finally{busy.current=false;if(!controller.signal.aborted)setSaving(false);}
  }
  return <form className="panel profile-editor" onChange={onEdit} onSubmit={event=>void save(event)}>
    <h2>编辑资料</h2>
    <fieldset disabled={uploading||saving}>
      <div className="avatar-editor"><Avatar name={nickname||profile.nickname} url={url} color={color}/><div className="avatar-actions">
        <label className="button secondary avatar-upload">{uploading?"上传中…":"上传头像"}<input aria-label="上传头像" type="file" accept="image/jpeg,image/png" onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void upload(file);}}/></label>
        {avatar&&<button type="button" className="text-button" onClick={()=>{onEdit();setAvatar(null);setUrl(null);}}>移除头像</button>}
        <small>JPEG / PNG · 最大 5 MiB</small>
      </div></div>
      <div className="avatar-colors" role="group" aria-label="默认头像颜色">{colors.map(item=><button type="button" key={item.color} style={{backgroundColor:item.color}} aria-label={item.label} aria-pressed={!avatar&&color===item.color} onClick={()=>{onEdit();setColor(item.color);setAvatar(null);setUrl(null);}}>{!avatar&&color===item.color?"✓":""}</button>)}</div>
      <label className="profile-field">昵称<input value={nickname} required maxLength={24} autoComplete="nickname" onChange={event=>setNickname(event.target.value)}/><small>{nickname.length}/24</small></label>
      <label className="profile-field">个人简介<textarea value={bio} maxLength={160} rows={3} onChange={event=>setBio(event.target.value)}/><small>{bio.length}/160</small></label>
    </fieldset>
    {error&&<div className="notice error" role="alert">{error}{conflict&&<button type="button" className="text-button" onClick={reloadProfile}>重新加载资料</button>}</div>}
    <div className="profile-save"><button className="button primary" disabled={!dirty||!nickname.trim()||uploading||saving||conflict}>{saving?"保存中…":"保存资料"}</button></div>
  </form>;
}
