export class ApiError extends Error {
  constructor(public status:number,public code:string,message:string){super(message);}
}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{
  const controller=new AbortController(),caller=init.signal;
  const cancel=()=>controller.abort(caller?.reason);
  if(caller?.aborted)cancel();
  else caller?.addEventListener("abort",cancel,{once:true});
  let timedOut=false;
  const deadline=setTimeout(()=>{
    timedOut=true;controller.abort();
  },init.method?.toUpperCase()==="POST"?60000:15000);
  try{
    const response=await fetch("/api"+path,{...init,signal:controller.signal,cache:"no-store",credentials:"same-origin"});
    if(!response.ok){
      const error=await response.json().catch(()=>({code:"REQUEST_ERROR",message:"服务暂时不可用，请稍后重试"}));
      throw new ApiError(response.status,error.code,error.message);
    }
    return await response.json() as T;
  }catch(error){
    if(timedOut&&!caller?.aborted)throw new ApiError(0,"REQUEST_TIMEOUT","请求超时，请检查连接后重试");
    throw error;
  }finally{
    clearTimeout(deadline);caller?.removeEventListener("abort",cancel);
  }
}
export const post=(body:unknown):RequestInit=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
export const message=(error:unknown)=>error instanceof Error?error.message:"网络连接异常，请重试";
