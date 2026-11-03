"use client";
export default function ErrorPage({reset}:{reset:()=>void}){
  return <div role="alert" className="empty-state"><h1>工作台暂时遇到问题</h1><p>已受理的任务会在后端继续处理。</p><button className="button primary" onClick={reset}>重新打开</button></div>;
}
