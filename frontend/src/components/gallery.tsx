"use client";
import Link from "next/link";
import Image from "next/image";
import {useEffect,useState} from "react";
import {api,message} from "@/lib/api";
import type {Template} from "@/lib/types";

export function Gallery(){
  const [templates,setTemplates]=useState<Template[]|null>(null),[error,setError]=useState<string|null>(null);
  const [category,setCategory]=useState("全部"),[query,setQuery]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    void api<Template[]>("/templates",{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setTemplates(data);setError(null);}})
      .catch(error=>{if(!controller.signal.aborted)setError(message(error));});
    return()=>controller.abort();
  },[revision]);
  const categories=["全部",...new Set(templates?.map(template=>template.category)||[])];
  const visible=templates?.filter(template=>(category==="全部"||template.category===category)&&
    (template.title+template.description).includes(query.trim()));
  return <>
    <section className="gallery-hero">
      <div className="hero-copy"><span className="eyebrow">A LITTLE INSPIRATION. A LOT OF POSSIBILITY.</span>
        <h1>把灵感，变成<br/><em>值得收藏的画面。</em></h1>
        <p>选择心动的模板，放入你的照片。<br/>其余的，交给 FrameForge。</p>
        <div className="hero-note"><span>01 选择模板</span><i/> <span>02 上传照片</span><i/> <span>03 收获作品</span></div>
      </div>
      <div className="hero-art" aria-hidden>
        <div className="hero-photo back"><Image src="/demo/samples/mountains.jpg" width={400} height={450} alt="" unoptimized/><span>Somewhere beautiful.</span></div>
        <div className="hero-photo front"><Image src="/demo/samples/lake.jpg" width={400} height={450} alt="" unoptimized/><span>Collect moments.</span></div>
        <span className="hero-spark">✳</span><span className="art-caption">MEMORIES, REIMAGINED.</span>
      </div>
    </section>
    <section className="gallery-section">
      <div className="section-heading"><div><span className="eyebrow">THE TEMPLATE COLLECTION</span><h2>下一份作品，从这里开始<span className="muted-count">{templates?.length??"—"}</span></h2></div>
        <label className="search"><span aria-hidden>⌕</span><span className="sr-only">搜索模板</span><input placeholder="寻找一点灵感…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      </div>
      <div className="category-tabs" aria-label="模板分类">{categories.map(name=><button key={name} aria-pressed={category===name} onClick={()=>setCategory(name)} className={category===name?"active":""}>{name}</button>)}</div>
      {error?<div role="alert" className="empty-state"><h3>暂时没有连上模板库</h3><p>{error}</p><button className="button secondary" onClick={()=>setRevision(value=>value+1)}>重新加载</button></div>:
       !templates?<div className="template-grid" aria-label="正在加载模板">{[1,2,3,4,5,6].map(i=><div key={i} className="skeleton template-skeleton"/>)}</div>:
       !visible?.length?<div className="empty-state"><h3>这里还没有匹配的模板</h3><p>试试其他分类或关键词。</p></div>:
       <div className="template-grid">{visible.map((template,index)=><Link href={"/templates/"+template.id} key={template.id} className="template-card">
         <div className="template-cover"><Image src={template.coverUrl} alt={template.title+"效果示例"} width={1200} height={900} unoptimized/><span className="image-count">{template.requiredImageCount} 张照片</span></div>
         <div className="template-copy"><span className="eyebrow">{template.category} <span className="card-index">/ 0{index+1}</span></span><h3>{template.title}<span className="card-arrow" aria-hidden>↗</span></h3><p>{template.description}</p></div>
       </Link>)}</div>}
    </section>
  </>;
}
