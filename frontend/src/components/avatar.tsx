"use client";
import Image from "next/image";
import {useState} from "react";

export function Avatar({name,url,color="#6551d9",className=""}:{name:string;url?:string|null;color?:string;className?:string}){
  const [failed,setFailed]=useState<string|null>(null);
  return <span className={"profile-avatar "+className} style={{backgroundColor:color,color:"white"}}>
    {url&&failed!==url?<Image unoptimized src={url} width={160} height={160} alt="" onError={()=>setFailed(url)}/>:Array.from(name)[0]||"?"}
  </span>;
}
