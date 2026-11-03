import {api,message} from "./api";
import {active,type Task,type TaskPage} from "./types";

export type FeedSnapshot={
  items:Record<string,Task>;errors:Record<string,string>;loading:boolean;moreLoading:boolean;
  pageError:string|null;nextCursor:number|null;
};
export type Transport=(path:string,init?:RequestInit)=>Promise<unknown>;
const empty=():FeedSnapshot=>({items:{},errors:{},loading:true,moreLoading:false,pageError:null,nextCursor:null});

export class TaskFeed {
  private state=empty();
  private listeners=new Set<()=>void>();
  private generation=0;
  private stopped=true;
  private polling=false;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private controllers=new Set<AbortController>();
  constructor(private transport:Transport=api,private interval=1500,readonly ownerKey="anonymous"){}
  getSnapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private update(patch:Partial<FeedSnapshot>){
    this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());
  }
  private merge(incoming:Task[]){
    const items={...this.state.items},errors={...this.state.errors};
    for(const task of incoming){
      const prior=items[task.id];
      if(!prior || (task.version>=prior.version && (active(prior)||!active(task)))){
        items[task.id]=task;delete errors[task.id];
      }
    }
    this.update({items,errors});
  }
  private async request<T>(path:string){
    const controller=new AbortController();this.controllers.add(controller);
    try{return await this.transport(path,{signal:controller.signal}) as T;}
    finally{this.controllers.delete(controller);}
  }
  start=async()=>{
    this.stop();this.stopped=false;const generation=this.generation;
    this.update({loading:true,pageError:null,moreLoading:false,errors:{}});
    const results=await Promise.allSettled([
      this.request<TaskPage>("/tasks"),this.request<TaskPage>("/tasks?active=true")
    ]);
    if(this.stopped||generation!==this.generation)return;
    const history=results[0];
    if(history.status==="fulfilled")this.update({nextCursor:history.value.nextCursor});
    for(const result of results){
      if(result.status==="fulfilled")this.merge(result.value.items);
      else this.update({pageError:message(result.reason)});
    }
    this.update({loading:false});this.schedule();
  };
  stop=()=>{
    this.stopped=true;this.generation++;this.polling=false;
    clearTimeout(this.timer);this.timer=undefined;
    this.controllers.forEach(controller=>controller.abort());this.controllers.clear();
  };
  private eligible(){return Object.values(this.state.items).filter(task=>active(task)&&!this.state.errors[task.id]);}
  private schedule(){
    clearTimeout(this.timer);this.timer=undefined;
    if(!this.stopped&&!this.polling&&this.eligible().length)this.timer=setTimeout(()=>void this.poll(),this.interval);
  }
  private async poll(){
    if(this.stopped||this.polling)return;
    this.polling=true;const generation=this.generation;
    await Promise.allSettled(this.eligible().map(async task=>{
      try{
        const current=await this.request<Task>("/tasks/"+task.id);
        if(!this.stopped&&generation===this.generation)this.merge([current]);
      }catch(error){
        const latest=this.state.items[task.id];
        if(!this.stopped&&generation===this.generation&&active(latest)&&latest.version===task.version)
          this.update({errors:{...this.state.errors,[task.id]:message(error)}});
      }
    }));
    if(generation!==this.generation)return;
    this.polling=false;this.schedule();
  }
  add=(task:Task)=>{this.merge([task]);this.schedule();};
  retry=(id:string)=>{
    const errors={...this.state.errors};delete errors[id];this.update({errors});
    void this.poll();
  };
  more=async()=>{
    if(this.stopped||this.state.moreLoading||this.state.nextCursor===null)return;
    const generation=this.generation;
    this.update({moreLoading:true,pageError:null});
    try{
      const page=await this.request<TaskPage>("/tasks?before="+this.state.nextCursor);
      if(!this.stopped&&generation===this.generation){this.merge(page.items);this.update({nextCursor:page.nextCursor});}
    }catch(error){if(!this.stopped&&generation===this.generation)this.update({pageError:message(error)});}
    finally{if(!this.stopped&&generation===this.generation){this.update({moreLoading:false});this.schedule();}}
  };
}
