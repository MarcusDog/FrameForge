import {Studio} from "@/components/studio";
export default async function TemplatePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{batch?:string}>}){
  const {id}=await params;const {batch}=await searchParams;return <Studio key={id+batch} templateId={id} initialBatch={batch==="1"}/>;
}
