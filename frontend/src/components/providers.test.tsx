import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {Providers,useSession} from "./providers";

const {request,route}=vi.hoisted(()=>({request:vi.fn(),route:{path:"/history"}}));
vi.mock("next/navigation",()=>({usePathname:()=>route.path}));
vi.mock("@/lib/api",async()=>{
  const actual=await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {...actual,api:request};
});
function Probe(){
  const session=useSession();
  return <><output aria-label="当前用户">{session.user?.id||"none"}</output><output aria-label="身份加载">{String(session.sessionLoading)}</output>
    <button onClick={()=>{void session.switchUser("bob");void session.switchUser("alice");}}>连续切换</button>
  </>;
}
beforeEach(()=>{
  route.path="/history";request.mockReset();
  request.mockImplementation(async(path:string)=>{
    if(path==="/demo/users")return [{id:"alice",name:"Alice"},{id:"bob",name:"Bob"}];
    if(path==="/config")return {simulationEnabled:true};
    if(path==="/demo/session")return {id:"alice",name:"Alice"};
    return {items:[],nextCursor:null};
  });
});
afterEach(cleanup);
it("locks consecutive identity changes synchronously",async()=>{
  render(<Providers><Probe/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText("当前用户")).toHaveTextContent("alice"));
  let resolve!:(value:unknown)=>void;
  request.mockImplementation((path:string,init?:RequestInit)=>{
    if(init?.method==="POST")return new Promise(done=>{resolve=done;});
    return Promise.resolve(path==="/demo/session"?{id:"alice",name:"Alice"}:{items:[],nextCursor:null});
  });
  fireEvent.click(screen.getByText("连续切换"));
  expect(request.mock.calls.filter(call=>call[1]?.method==="POST")).toHaveLength(1);
  expect(screen.getByLabelText("当前用户")).toHaveTextContent("none");
  await act(async()=>resolve({id:"bob",name:"Bob"}));
  expect(screen.getByLabelText("当前用户")).toHaveTextContent("bob");
});
it("waits for all bootstrap requests and cancels them on unmount",async()=>{
  let resolve!:(value:unknown)=>void;
  request.mockImplementation((path:string)=>path==="/demo/session"?new Promise(done=>{resolve=done;}):Promise.resolve(
    path==="/demo/users"?[{id:"alice",name:"Alice"}]:{simulationEnabled:true}));
  const view=render(<Providers><Probe/></Providers>);
  await act(async()=>{});
  expect(screen.getByLabelText("身份加载")).toHaveTextContent("true");
  fireEvent.click(screen.getByText("连续切换"));
  expect(request.mock.calls.filter(call=>call[1]?.method==="POST")).toHaveLength(0);
  const signal=request.mock.calls.find(call=>call[0]==="/demo/session")![1].signal as AbortSignal;
  view.unmount();expect(signal.aborted).toBe(true);
  await act(async()=>resolve({id:"alice",name:"Alice"}));
});

it("does not track tasks on the gallery page",async()=>{
  route.path="/";
  render(<Providers><Probe/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText("当前用户")).toHaveTextContent("alice"));
  expect(request.mock.calls.filter(call=>call[0].startsWith("/tasks"))).toHaveLength(0);
});
it.each(["/history","/account"])("aborts tracking when leaving %s and restores it on return",async path=>{
  route.path=path;
  const defaults=request.getMockImplementation()!;
  request.mockImplementation((path:string,init?:RequestInit)=>path.startsWith("/tasks")?new Promise(()=>{}):defaults(path,init));
  const view=render(<Providers><Probe/></Providers>);
  await waitFor(()=>expect(request.mock.calls.filter(call=>call[0].startsWith("/tasks"))).toHaveLength(2));
  const signals=request.mock.calls.filter(call=>call[0].startsWith("/tasks")).map(call=>call[1].signal as AbortSignal);
  route.path="/";view.rerender(<Providers><Probe/></Providers>);
  expect(signals.every(signal=>signal.aborted)).toBe(true);
  route.path=path;view.rerender(<Providers><Probe/></Providers>);
  await waitFor(()=>expect(request.mock.calls.filter(call=>call[0].startsWith("/tasks"))).toHaveLength(4));
});
