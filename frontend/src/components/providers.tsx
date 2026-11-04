"use client";
import {createContext,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from "react";
import {api,ApiError,message,post} from "@/lib/api";
import {TaskFeed} from "@/lib/task-feed";
import {usePathname} from "next/navigation";
import type {User,UserProfile,ProfileInput} from "@/lib/types";

type ContextValue={
  user:User|null;users:User[];switching:boolean;sessionLoading:boolean;sessionError:string|null;
  simulationEnabled:boolean;switchUser:(id:string)=>Promise<void>;reloadSession:()=>void;feed:TaskFeed;
  profile:UserProfile|null;profileLoading:boolean;profileError:string|null;reloadProfile:()=>void;
  saveProfile:(input:ProfileInput,signal:AbortSignal)=>Promise<UserProfile>;signOut:()=>Promise<void>;
};
const Context=createContext<ContextValue|null>(null);
export function Providers({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null),[users,setUsers]=useState<User[]>([]);
  const [sessionLoading,setLoading]=useState(true),[switching,setSwitching]=useState(false);
  const [sessionError,setError]=useState<string|null>(null),[revision,setRevision]=useState(0);
  const [simulationEnabled,setSimulation]=useState(false);
  const [profileState,setProfile]=useState<{owner:string;value:UserProfile|null;error:string|null;loading:boolean}|null>(null);
  const [profileRevision,setProfileRevision]=useState(0);
  const epoch=useRef(0),switchLock=useRef(false);
  const bootstrap=useRef<AbortController|null>(null),switchRequest=useRef<AbortController|null>(null);
  const feed=useMemo(()=>new TaskFeed(api,1500,user?.id),[user?.id]);
  const pathname=usePathname();
  const trackingPage=pathname==="/account"||pathname==="/tasks"||pathname.startsWith("/tasks/")||pathname==="/history"||pathname.startsWith("/templates/");
  useEffect(()=>{if(user&&trackingPage)void feed.start();return feed.stop;},[feed,user,trackingPage]);
  useEffect(()=>()=>{epoch.current++;bootstrap.current?.abort();switchRequest.current?.abort();},[]);
  useEffect(()=>{
    if(!user)return;
    const owner=user.id,generation=epoch.current,controller=new AbortController();
    void api<UserProfile>("/me/profile",{signal:controller.signal}).then(value=>{
      if(!controller.signal.aborted&&generation===epoch.current)setProfile({owner,value,error:null,loading:false});
    }).catch(error=>{
      if(!controller.signal.aborted&&generation===epoch.current)setProfile(previous=>({owner,value:previous?.owner===owner?previous.value:null,error:message(error),loading:false}));
    });
    return()=>controller.abort();
  },[user,profileRevision]);
  useEffect(()=>{
    const controller=new AbortController(),generation=++epoch.current;
    bootstrap.current=controller;
    void Promise.allSettled([
      api<User[]>("/demo/users",{signal:controller.signal}),
      api<{simulationEnabled:boolean}>("/config",{signal:controller.signal}),
      api<User>("/demo/session",{signal:controller.signal})
    ]).then(([usersResult,configResult,sessionResult])=>{
      if(controller.signal.aborted||generation!==epoch.current)return;
      if(usersResult.status==="fulfilled")setUsers(usersResult.value);
      if(configResult.status==="fulfilled")setSimulation(configResult.value.simulationEnabled);
      if(sessionResult.status==="fulfilled")setUser(sessionResult.value);
      else if(sessionResult.reason instanceof ApiError&&sessionResult.reason.status===401)setUser(null);
      for(const result of [usersResult,configResult,sessionResult]){
        if(result.status==="rejected"&&!(result.reason instanceof ApiError&&result.reason.status===401))setError(message(result.reason));
      }
      setLoading(false);
    });
    return()=>controller.abort();
  },[revision]);
  async function changeSession(id:string|null){
    if(switchLock.current||sessionLoading)return;
    switchLock.current=true;
    bootstrap.current?.abort();feed.stop();
    const generation=++epoch.current,controller=new AbortController();switchRequest.current=controller;
    setUser(null);setProfile(null);setSwitching(true);setError(null);
    try{
      const selected=await api<User>("/demo/session",{...(id?post({userId:id}):{method:"DELETE"}),signal:controller.signal});
      if(!controller.signal.aborted&&generation===epoch.current)setUser(id?selected:null);
    }catch(error){if(!controller.signal.aborted&&generation===epoch.current)setError(message(error));}
    finally{
      switchLock.current=false;
      if(!controller.signal.aborted&&generation===epoch.current)setSwitching(false);
    }
  }
  async function saveProfile(input:ProfileInput,signal:AbortSignal){
    const generation=epoch.current,owner=user?.id;
    if(!owner)throw new ApiError(401,"IDENTITY_REQUIRED","请先选择账户");
    const value=await api<UserProfile>("/me/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal});
    if(signal.aborted||generation!==epoch.current||value.userId!==owner)throw new DOMException("账户已切换","AbortError");
    setProfile({owner,value,error:null,loading:false});
    return value;
  }
  const profile=profileState?.owner===user?.id?profileState:null;
  return <Context.Provider value={{user,users,switching,sessionLoading,sessionError,simulationEnabled,switchUser:id=>changeSession(id),signOut:()=>changeSession(null),
    profile:profile?.value??null,profileError:profile?.error??null,profileLoading:!!user&&(!profile||profile.loading),reloadProfile:()=>{setProfile(previous=>previous?{...previous,loading:true,error:null}:null);setProfileRevision(value=>value+1);},saveProfile,
    reloadSession:()=>{if(!switchLock.current){setLoading(true);setError(null);setRevision(value=>value+1);}},feed}}>{children}</Context.Provider>;
}
export function useSession(){const value=useContext(Context);if(!value)throw new Error("Providers missing");return value;}
export function useFeed(){
  const {feed}=useSession();
  const snapshot=useSyncExternalStore(feed.subscribe,feed.getSnapshot,feed.getSnapshot);
  return {...snapshot,feed};
}
export function IdentityPrompt(){
  const session=useSession();
  return <section className="identity-panel">
    <div><h2>选择账户</h2></div>
    <div className="button-row">{session.users.map(user=><button key={user.id} className="button secondary" disabled={session.switching||session.sessionLoading} onClick={()=>void session.switchUser(user.id)}>以 {user.name} 体验 <span aria-hidden>↗</span></button>)}</div>
  </section>;
}
