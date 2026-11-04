import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {Providers} from "./providers";
import {Account} from "./account";
import type {UserProfile} from "@/lib/types";
vi.mock("next/navigation",()=>({usePathname:()=>"/account"}));
let owner:string;
let profiles:Record<string,UserProfile>;
const summary=(total:number)=>({totalTasks:total,activeTasks:0,succeededTasks:total,failedTasks:0,assetCount:9});
let request:ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(()=>{
  owner="alice";
  profiles=Object.fromEntries(["alice","bob"].map(id=>[id,{userId:id,nickname:id==="alice"?"Alice":"Bob",bio:"",avatarColor:"#6551d9",avatarAssetId:null,avatarUrl:null,version:0,createdAt:"2026-11-04T00:00:00Z",updatedAt:"2026-11-04T00:00:00Z"}]));
  request=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{
    const path=String(input);
    if(path==="/api/demo/users")return Response.json([{id:"alice",name:"Alice"},{id:"bob",name:"Bob"}]);
    if(path==="/api/demo/session"){
      if(init?.method==="DELETE"){owner="";return Response.json({signedOut:true});}
      if(init?.method==="POST")owner=JSON.parse(String(init.body)).userId;
      return owner?Response.json({id:owner,name:owner==="alice"?"Alice":"Bob"}):Response.json({code:"IDENTITY_REQUIRED",message:"请选择账户"},{status:401});
    }
    if(path==="/api/me/profile"){
      if(init?.method==="PUT")profiles[owner]={...profiles[owner],...JSON.parse(String(init.body)),version:profiles[owner].version+1};
      return Response.json(profiles[owner]);
    }
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
it("saves nickname and bio, restores server data on refresh and does not restart task tracking",async()=>{
  const view=render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText(/^昵称/)).toHaveValue("Alice"));
  const taskRequests=()=>request.mock.calls.filter(call=>String(call[0]).startsWith("/api/tasks")).length;
  const count=taskRequests();
  expect(screen.getByRole("button",{name:"保存资料"})).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/^昵称/),{target:{value:"林间旅人"}});
  fireEvent.change(screen.getByLabelText(/^个人简介/),{target:{value:"记录周末的光影"}});
  fireEvent.click(screen.getByRole("button",{name:"保存资料"}));
  await waitFor(()=>expect(screen.getByRole("heading",{name:"林间旅人"})).toBeInTheDocument());
  expect(taskRequests()).toBe(count);
  expect(profiles.alice.bio).toBe("记录周末的光影");expect(profiles.bob.nickname).toBe("Bob");
  view.unmount();render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText(/^昵称/)).toHaveValue("林间旅人"));
  expect(screen.getByLabelText(/^个人简介/)).toHaveValue("记录周末的光影");
});
it("validates avatar files, disables save while uploading and saves the server asset ID",async()=>{
  let resolve!:(value:Response)=>void;
  const initial=request.getMockImplementation()!;
  request.mockImplementation((input,init)=>String(input)==="/api/assets"?new Promise(done=>{resolve=done;}):initial(input,init));
  render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText("上传头像")).toBeInTheDocument());
  const upload=screen.getByLabelText("上传头像");
  fireEvent.change(upload,{target:{files:[new File(["x"],"x.txt",{type:"text/plain"})]}});
  expect(screen.getByRole("alert")).toHaveTextContent("JPEG 或 PNG");
  expect(request.mock.calls.filter(call=>String(call[0])==="/api/assets")).toHaveLength(0);
  fireEvent.change(upload,{target:{files:[new File(["x"],"x.png",{type:"image/png"})]}});
  expect(screen.getByRole("button",{name:"保存资料"})).toBeDisabled();
  await act(async()=>resolve(Response.json({id:"avatar-a",previewUrl:"/api/assets/avatar-a/content"})));
  fireEvent.click(screen.getByRole("button",{name:"保存资料"}));
  await waitFor(()=>expect(profiles.alice.avatarAssetId).toBe("avatar-a"));
  await screen.findByText("资料已保存");
  fireEvent.click(screen.getByRole("button",{name:"移除头像"}));
  expect(screen.queryByText("资料已保存")).toBeNull();
  expect(screen.getByRole("button",{name:"保存资料"})).toBeEnabled();
});
it("keeps unsaved fields on conflict and requires reloading the newer server profile",async()=>{
  const initial=request.getMockImplementation()!;
  request.mockImplementation((input,init)=>String(input)==="/api/me/profile"&&init?.method==="PUT"?Promise.resolve(Response.json({code:"PROFILE_CHANGED",message:"资料已在其他页面更新"},{status:409})):initial(input,init));
  render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText(/^昵称/)).toHaveValue("Alice"));
  fireEvent.change(screen.getByLabelText(/^昵称/),{target:{value:"本地草稿"}});
  fireEvent.click(screen.getByRole("button",{name:"保存资料"}));
  await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("资料已在其他页面更新"));
  expect(screen.getByLabelText(/^昵称/)).toHaveValue("本地草稿");expect(screen.getByRole("button",{name:"保存资料"})).toBeDisabled();
  profiles.alice={...profiles.alice,nickname:"其他页面的新资料",version:2};
  fireEvent.click(screen.getByRole("button",{name:"重新加载资料"}));
  await waitFor(()=>expect(screen.getByLabelText(/^昵称/)).toHaveValue("其他页面的新资料"));
});
it.each(["GET","PUT"])("aborts and ignores an old-user profile %s after switching accounts",async method=>{
  let resolve!:(value:Response)=>void;let signal:AbortSignal|undefined;
  const initial=request.getMockImplementation()!;
  request.mockImplementation((input,init)=>{
    if(String(input)==="/api/me/profile"&&owner==="alice"&&(init?.method||"GET")===method){signal=init?.signal as AbortSignal;return new Promise(done=>{resolve=done;});}
    return initial(input,init);
  });
  render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByRole("heading",{name:"Alice"})).toBeInTheDocument());
  if(method==="PUT"){
    await waitFor(()=>expect(screen.getByLabelText(/^昵称/)).toHaveValue("Alice"));
    fireEvent.change(screen.getByLabelText(/^昵称/),{target:{value:"旧用户资料"}});
    fireEvent.click(screen.getByRole("button",{name:"保存资料"}));
  }
  fireEvent.click(screen.getByRole("button",{name:/Bob/}));
  await waitFor(()=>expect(screen.getByLabelText(/^昵称/)).toHaveValue("Bob"));
  expect(signal?.aborted).toBe(true);
  await act(async()=>resolve(Response.json({...profiles.alice,nickname:"旧用户资料",version:5})));
  expect(screen.queryByRole("heading",{name:"旧用户资料"})).toBeNull();expect(screen.getByLabelText(/^昵称/)).toHaveValue("Bob");
});
it("signs out, clears private views and leaves personal records on the server",async()=>{
  render(<Providers><Account/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText(/^昵称/)).toHaveValue("Alice"));
  fireEvent.click(screen.getByRole("button",{name:"退出当前账户"}));
  await waitFor(()=>expect(owner).toBe(""));
  expect(screen.queryByLabelText(/^昵称/)).toBeNull();expect(screen.queryByText("207")).toBeNull();
  expect(profiles.alice.nickname).toBe("Alice");
});
