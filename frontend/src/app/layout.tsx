import type {Metadata} from "next";
import type {ReactNode} from "react";
import {Providers} from "@/components/providers";
import {Shell} from "@/components/shell";
import "./globals.css";
export const metadata:Metadata={title:"FrameForge · 素材创作工作台",description:"把照片变成值得收藏的画面。模板、后台制作与个人创作记录。"};
export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="zh-CN"><body><a className="skip-link" href="#main-content">跳到主要内容</a><Providers><Shell>{children}</Shell></Providers></body></html>;
}
