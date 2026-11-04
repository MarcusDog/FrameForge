import {act,cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {Providers,useFeed,useSession} from "./providers";
import {TaskCard} from "./task-card";
import {TaskDetail} from "./task-pages";
import type {Task,TaskPage} from "@/lib/types";

vi.mock("next/navigation",()=>({usePathname:()=>"/history"}));
const task=(id:string,status:Task["status"]="RUNNING",version=2):Task=>({
  id,templateId:"travel-postcard",templateTitle:"任务 "+id,coverUrl:"/demo/travel-postcard.png",
  status,currentStage:"GENERATING",resultUrl:status==="SUCCEEDED"?"/api/tasks/"+id+"/result":null,
  errorCode:null,errorMessage:null,version,createdAt:"2026-11-02T13:00:00Z",updatedAt:"2026-11-02T13:00:00Z",
  stages:[{stage:"GENERATING",status:status==="SUCCEEDED"?"SUCCEEDED":"RUNNING",
    startedAt:"2026-11-02T13:00:00Z",endedAt:null,durationMs:null,errorMessage:null}],assets:[{id:"asset-"+id,previewUrl:"/api/assets/"+id+"/content",mimeType:"image/png",sizeBytes:100,width:10,height:10}]
});
const page=(items:Task[]):TaskPage=>({items,nextCursor:null});
function deferred<T>(){
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(done=>{resolve=done;});
  return {promise,resolve};
}
function Scenario(){
  const {user,switchUser}=useSession(),state=useFeed();
  return <>
    <output aria-label="当前身份">{user?.id||"none"}</output>
    <button onClick={()=>void switchUser("bob")}>切换到 Bob</button>
    {Object.values(state.items).map(task=><TaskCard key={task.id} task={task} error={state.errors[task.id]} onRetry={()=>state.feed.retry(task.id)}/>)}
  </>;
}
let owner:string,mode:"initial"|"failure"|"recovery";
let fetchMock:ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(()=>{
  vi.useFakeTimers();owner="alice";mode="initial";
  fetchMock=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{
    const url=String(input);
    if(url==="/api/demo/users")return Response.json([{id:"alice",name:"Alice"},{id:"bob",name:"Bob"}]);
    if(url==="/api/config")return Response.json({simulationEnabled:true});
    if(url==="/api/demo/session"){
      if(init?.method==="POST")owner=JSON.parse(String(init.body)).userId;
      return Response.json({id:owner,name:owner==="alice"?"Alice":"Bob"});
    }
    if(url==="/api/tasks"||url==="/api/tasks?active=true")return Response.json(page(owner==="alice"?[task("A"),task("B")]:[task("Bob")]));
    if(url==="/api/tasks/A")return mode==="failure"?
      Response.json({code:"INTERNAL_ERROR",message:"同步接口暂时不可用"},{status:500}):
      Response.json(task("A",mode==="recovery"?"SUCCEEDED":"RUNNING",mode==="recovery"?4:2));
    if(url==="/api/tasks/B")return Response.json(task("B","SUCCEEDED",4));
    if(url==="/api/tasks/Bob")return Response.json(task("Bob"));
    throw new Error("Unexpected request: "+url);
  });
  vi.stubGlobal("fetch",fetchMock);
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
const flush=()=>act(async()=>{await vi.advanceTimersByTimeAsync(0);});
const advance=(ms:number)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});

it("renders RUNNING A with a retryable sync error while B succeeds and stops polling",async()=>{
  render(<Providers><Scenario/></Providers>);await flush();
  const a=screen.getByRole("heading",{name:"任务 A"}).closest("article")!;
  const b=screen.getByRole("heading",{name:"任务 B"}).closest("article")!;
  expect(a.querySelector(".status")).toHaveTextContent("处理中");
  expect(b.querySelector(".status")).toHaveTextContent("处理中");
  mode="failure";await advance(1500);
  const alert=within(a).getByRole("alert");
  expect(alert).toHaveTextContent("状态同步失败，可重试");
  expect(alert).toHaveTextContent("同步接口暂时不可用");
  expect(a.querySelector(".status")).toHaveTextContent("处理中");
  expect(a.querySelector(".task-failure")).toBeNull();
  expect(b.querySelector(".status")).toHaveTextContent("已完成");
  expect(within(a).getByAltText("上传素材预览")).toHaveAttribute("src","/api/assets/A/content");
  expect(within(b).getByAltText("上传素材预览")).toHaveAttribute("src","/api/assets/B/content");
  expect(within(b).queryByRole("alert")).toBeNull();
  await advance(6000);
  const queries=(id:string)=>fetchMock.mock.calls.filter(([url])=>url==="/api/tasks/"+id).length;
  expect(queries("A")).toBe(1);expect(queries("B")).toBe(1);
  mode="recovery";
  fireEvent.click(within(a).getByRole("button",{name:"恢复查询"}));await flush();
  expect(within(a).queryByRole("alert")).toBeNull();
  expect(a.querySelector(".status")).toHaveTextContent("已完成");
  expect(queries("A")).toBe(2);expect(queries("B")).toBe(1);
  await advance(6000);
  expect(queries("A")).toBe(2);expect(queries("B")).toBe(1);
});

it("keeps the task detail RUNNING and provides the same recoverable sync feedback",async()=>{
  render(<Providers><TaskDetail id="A"/></Providers>);await flush();
  expect(screen.getByText("处理中")).toBeInTheDocument();
  mode="failure";await advance(1500);
  expect(screen.getByRole("alert")).toHaveTextContent("状态同步失败，可重试");
  expect(screen.getByText("处理中")).toBeInTheDocument();
  mode="recovery";fireEvent.click(screen.getByRole("button",{name:"恢复查询"}));await flush();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("已完成",{selector:".status"})).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url])=>url==="/api/tasks/A")).toHaveLength(2);
});

function RefreshFeed(){const {feed}=useFeed();return <button onClick={()=>void feed.start()}>刷新服务端记录</button>;}
it("clears a detail load error when a subsequent history refresh restores the task",async()=>{
  let restored=false;
  const initial=fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((input,init)=>{
    if(String(input)==="/api/tasks"||String(input)==="/api/tasks?active=true")return Promise.resolve(Response.json(page(restored?[task("A","SUCCEEDED",7)]:[])));
    if(String(input)==="/api/tasks/A")return Promise.resolve(Response.json({code:"INTERNAL_ERROR",message:"详情首次查询异常"},{status:500}));
    return initial(input,init);
  });
  render(<Providers><RefreshFeed/><TaskDetail id="A"/></Providers>);await flush();
  expect(screen.getByRole("alert")).toHaveTextContent("详情首次查询异常");
  restored=true;fireEvent.click(screen.getByRole("button",{name:"刷新服务端记录"}));await flush();
  expect(screen.getByText("已完成",{selector:".status"})).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("does not carry an Alice detail error into Bob while Bob's detail response is pending",async()=>{
  const bob=deferred<Response>(),initial=fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((input,init)=>{
    if(String(input)==="/api/tasks"||String(input)==="/api/tasks?active=true")return Promise.resolve(Response.json(page([])));
    if(String(input)==="/api/tasks/A")return owner==="alice"?
      Promise.resolve(Response.json({code:"INTERNAL_ERROR",message:"Alice 的旧详情错误"},{status:500})):bob.promise;
    return initial(input,init);
  });
  render(<Providers><Scenario/><TaskDetail id="A"/></Providers>);await flush();
  expect(screen.getByRole("alert")).toHaveTextContent("Alice 的旧详情错误");
  fireEvent.click(screen.getByRole("button",{name:"切换到 Bob"}));await flush();
  expect(screen.getByLabelText("当前身份")).toHaveTextContent("bob");
  expect(screen.queryByText("Alice 的旧详情错误")).toBeNull();
  expect(screen.getByText("正在读取任务…")).toBeInTheDocument();
  await act(async()=>{bob.resolve(Response.json({code:"NOT_FOUND",message:"Bob 无权访问此任务"},{status:404}));await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole("alert")).toHaveTextContent("Bob 无权访问此任务");
});

it("ignores late success and HTTP 500 poll responses after the actual Provider switches user",async()=>{
  const a=deferred<Response>(),b=deferred<Response>();
  const initial=fetchMock.getMockImplementation()!;
  const signals:AbortSignal[]=[];
  fetchMock.mockImplementation((input,init)=>{
    const url=String(input);
    if(owner==="alice"&&(url==="/api/tasks/A"||url==="/api/tasks/B")){
      signals.push(init!.signal!);
      // Deliberately ignore abort to prove the generation guard also rejects late results.
      return url.endsWith("/A")?a.promise:b.promise;
    }
    return initial(input,init);
  });
  render(<Providers><Scenario/></Providers>);await flush();await advance(1500);
  expect(signals).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"切换到 Bob"}));await flush();
  expect(screen.getByLabelText("当前身份")).toHaveTextContent("bob");
  expect(signals.every(signal=>signal.aborted)).toBe(true);
  expect(screen.getByRole("heading",{name:"任务 Bob"})).toBeInTheDocument();
  await act(async()=>{
    a.resolve(Response.json(task("A","SUCCEEDED",99)));
    b.resolve(Response.json({code:"INTERNAL_ERROR",message:"旧用户错误"},{status:500}));
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.queryByRole("heading",{name:"任务 A"})).toBeNull();
  expect(screen.queryByRole("heading",{name:"任务 B"})).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  const bob=screen.getByRole("heading",{name:"任务 Bob"}).closest("article")!;
  expect(bob.querySelector(".status")).toHaveTextContent("处理中");
});
