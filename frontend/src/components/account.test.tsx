import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {Providers} from "./providers";
import {Account} from "./account";
vi.mock("next/navigation",()=>({usePathname:()=>"/account"}));
let owner:string;
const summary=(total:number)=>({totalTasks:total,activeTasks:0,succeededTasks:total,failedTasks:0,assetCount:9});
let request:ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(()=>{
  owner="alice";
  request=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{
    const path=String(input);
    if(path==="/api/demo/users")return Response.json([{id:"alice",name:"Alice"},{id:"bob",name:"Bob"}]);
    if(path==="/api/demo/session"){if(init?.method==="POST")owner=JSON.parse(String(init.body)).userId;return Response.json({id:owner,name:owner==="alice"?"Alice":"Bob"});}
    if(path==="/api/config")return Response.json({simulationEnabled:true});
    if(path==="/api/me/summary")return Response.json(summary(owner==="alice"?207:3));
    return Response.json({items:[],nextCursor:null});
  });vi.stubGlobal("fetch",request);
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it("uses server totals rather than the loaded history page and makes no idle polling requests",async()=>{
  render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByText("全部任务").parentElement?.querySelector("dd")).toHaveTextContent("207"));
  expect(screen.getByRole("heading",{name:"Alice"})).toBeInTheDocument();
  const count=request.mock.calls.length;vi.useFakeTimers();
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(request).toHaveBeenCalledTimes(count);expect(vi.getTimerCount()).toBe(0);
});
it("cancels and ignores a late old-user summary after switching accounts",async()=>{
  let resolve!:(value:Response)=>void;let signal:AbortSignal|undefined;
  const initial=request.getMockImplementation()!;
  request.mockImplementation((input,init)=>{
    if(String(input)==="/api/me/summary"&&owner==="alice"){signal=init?.signal as AbortSignal;return new Promise(done=>{resolve=done;});}
    return initial(input,init);
  });
  render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByRole("heading",{name:"Alice"})).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button",{name:/Bob/}));
  await waitFor(()=>expect(screen.getByRole("heading",{name:"Bob"})).toBeInTheDocument());
  await waitFor(()=>expect(screen.getAllByText("3")).not.toHaveLength(0));
  expect(signal?.aborted).toBe(true);
  await act(async()=>resolve(Response.json(summary(999))));
  expect(screen.queryByText("999")).toBeNull();expect(screen.queryByRole("heading",{name:"Alice"})).toBeNull();
});
