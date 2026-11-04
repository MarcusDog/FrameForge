export type Stage = "MATERIAL_CHECK" | "GENERATING" | "ORGANIZING";
export type Status = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
export type User = {id:string;name:string};
export type UserProfile={userId:string;nickname:string;bio:string;avatarColor:string;avatarAssetId:string|null;avatarUrl:string|null;version:number;createdAt:string;updatedAt:string};
export type ProfileInput=Pick<UserProfile,"nickname"|"bio"|"avatarColor"|"avatarAssetId"|"version">;
export type UserSummary={totalTasks:number;activeTasks:number;succeededTasks:number;failedTasks:number;assetCount:number};
export type Template = {
  id:string;title:string;category:string;description:string;requiredImageCount:number;
  coverUrl:string;layout:string;acceptedMimeTypes:string[];maxFileSizeBytes:number;
};
export type Asset = {id:string;previewUrl:string;mimeType:string;sizeBytes:number;width:number;height:number};
export type TaskStage = {
  stage:Stage;status:"PENDING"|"RUNNING"|"SUCCEEDED"|"FAILED"|"SKIPPED";
  startedAt:string|null;endedAt:string|null;durationMs:number|null;errorMessage:string|null;
};
export type Task = {
  id:string;templateId:string;templateTitle:string;coverUrl:string;status:Status;
  currentStage:Stage|null;resultUrl:string|null;errorCode:string|null;errorMessage:string|null;
  version:number;createdAt:string;updatedAt:string;stages:TaskStage[];assets:Asset[];
};
export type TaskPage={items:Task[];nextCursor:number|null};
export type Simulation={failAt:Stage|null;checkMs:number;generationMs:number;organizeMs:number};
export const STAGES:Stage[]=["MATERIAL_CHECK","GENERATING","ORGANIZING"];
export const stageName:Record<Stage,string>={MATERIAL_CHECK:"素材检查",GENERATING:"模拟生成",ORGANIZING:"结果整理"};
export const statusName:Record<Status,string>={QUEUED:"等待处理",RUNNING:"处理中",SUCCEEDED:"已完成",FAILED:"制作失败"};
export const active=(task:Task)=>task.status==="QUEUED"||task.status==="RUNNING";
export const dateTime=(value:string)=>new Date(value).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
