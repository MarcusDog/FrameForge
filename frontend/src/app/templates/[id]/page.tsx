import {Studio} from "@/components/studio";
export default async function TemplatePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;return <Studio key={id} templateId={id}/>;
}
