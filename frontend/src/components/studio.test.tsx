import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {UploadForm} from "./studio";
import type {Asset,Template} from "@/lib/types";

const {request,add}=vi.hoisted(()=>({request:vi.fn(),add:vi.fn()}));
vi.mock("@/lib/api",async()=>{
  const actual=await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {...actual,api:request};
});
vi.mock("./providers",()=>({useSession:()=>({simulationEnabled:false}),useFeed:()=>({feed:{add}})}));
const template:Template={id:"t",title:"Test",category:"c",description:"d",requiredImageCount:1,
  coverUrl:"/cover.png",layout:"portrait",acceptedMimeTypes:["image/png","image/jpeg"],maxFileSizeBytes:5242880};
const asset=(id:string):Asset=>({id,previewUrl:"/api/assets/"+id+"/content",mimeType:"image/png",sizeBytes:10,width:10,height:10});
beforeEach(()=>{request.mockReset();add.mockReset();vi.stubGlobal("URL",Object.assign(URL,{createObjectURL:vi.fn(()=>"blob:preview"),revokeObjectURL:vi.fn()}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("rejects invalid files and disables submit until the upload completes",async()=>{
  render(<UploadForm template={template}/>);
  expect(screen.getByRole("button",{name:/开始制作/})).toBeDisabled();
  fireEvent.change(screen.getByLabelText("选择素材 1"),{target:{files:[new File(["text"],"a.txt",{type:"text/plain"})]}});
  expect(screen.getByRole("alert")).toHaveTextContent("仅支持");
  expect(request).not.toHaveBeenCalled();
  request.mockResolvedValue(asset("a"));
  fireEvent.change(screen.getByLabelText("选择素材 1"),{target:{files:[new File(["image"],"a.png",{type:"image/png"})]}});
  await waitFor(()=>expect(screen.getByRole("button",{name:/开始制作/})).toBeEnabled());
  expect(screen.getByText("✓ 已上传")).toBeInTheDocument();
});
it("replacing a slot prevents an old upload response from overriding the new file",async()=>{
  let oldResolve!:(value:Asset)=>void;
  request.mockImplementationOnce(()=>new Promise<Asset>(resolve=>{oldResolve=resolve;})).mockResolvedValueOnce(asset("new"));
  render(<UploadForm template={template}/>);
  const input=screen.getByLabelText("选择素材 1");
  fireEvent.change(input,{target:{files:[new File(["old"],"old.png",{type:"image/png"})]}});
  const signal=request.mock.calls[0][1].signal as AbortSignal;
  fireEvent.change(input,{target:{files:[new File(["new"],"new.png",{type:"image/png"})]}});
  await waitFor(()=>expect(screen.getByRole("button",{name:/开始制作/})).toBeEnabled());
  await act(async()=>oldResolve(asset("old")));
  expect(signal.aborted).toBe(true);
  request.mockResolvedValue({taskId:"task",task:{id:"task"}});
  fireEvent.click(screen.getByRole("button",{name:/开始制作/}));
  await waitFor(()=>expect(add).toHaveBeenCalled());
  expect(JSON.parse(request.mock.calls[2][1].body).assetIds).toEqual(["new"]);
});
it("removing an image releases its preview and aborts upload",()=>{
  request.mockImplementation(()=>new Promise(()=>{}));
  const {unmount}=render(<UploadForm template={template}/>);
  fireEvent.change(screen.getByLabelText("选择素材 1"),{target:{files:[new File(["x"],"a.png",{type:"image/png"})]}});
  const signal=request.mock.calls[0][1].signal as AbortSignal;
  fireEvent.click(screen.getByRole("button",{name:"移除素材 1"}));
  expect(signal.aborted).toBe(true);expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  expect(screen.getByRole("button",{name:/开始制作/})).toBeDisabled();unmount();
});
it("creates independent batch tasks and retries only an unaccepted task with its original key",async()=>{
  const attempts:Record<string,number>={};
  request.mockImplementation(async(path:string,init:RequestInit)=>{
    if(path==="/assets")return asset((init.body as FormData).get("file") instanceof File?((init.body as FormData).get("file") as File).name:"");
    const body=JSON.parse(String(init.body));const id=body.assetIds[0];attempts[id]=(attempts[id]||0)+1;
    if(id==="b.png"&&attempts[id]===1)throw new Error("B 受理连接失败");
    return {taskId:id,task:{id}};
  });
  render(<UploadForm template={template} batch/>);
  fireEvent.change(screen.getByLabelText("批量选择图片"),{target:{files:[new File(["a"],"a.png",{type:"image/png"}),new File(["b"],"b.png",{type:"image/png"})]}});
  await waitFor(()=>expect(screen.getByRole("button",{name:/开始制作 2 个任务/})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:/开始制作 2 个任务/}));
  await waitFor(()=>expect(screen.getByRole("button",{name:/重试未受理任务/})).toBeEnabled());
  expect(add).toHaveBeenCalledTimes(1);expect(screen.getByRole("alert")).toHaveTextContent("B 受理连接失败");
  fireEvent.click(screen.getByRole("button",{name:/重试未受理任务/}));
  await waitFor(()=>expect(add).toHaveBeenCalledTimes(2));
  const bodies=request.mock.calls.filter(([path])=>path==="/tasks").map(([,init])=>JSON.parse(init.body));
  expect(bodies.map(body=>body.assetIds)).toEqual([["a.png"],["b.png"],["b.png"]]);
  expect(bodies[0].requestKey).not.toBe(bodies[1].requestKey);expect(bodies[1].requestKey).toBe(bodies[2].requestKey);
  expect(attempts).toEqual({"a.png":1,"b.png":2});expect(screen.getByRole("button",{name:/开始制作 2 个任务/})).toBeDisabled();
});
it("keeps submit disabled for an incomplete multi-image batch and rejects excessive or oversized uploads",async()=>{
  request.mockResolvedValue(asset("uploaded"));
  render(<UploadForm template={{...template,requiredImageCount:2}} batch/>);
  const files=Array.from({length:3},(_,i)=>new File(["x"],i+".png",{type:"image/png"}));
  fireEvent.change(screen.getByLabelText("批量选择图片"),{target:{files}});
  await waitFor(()=>expect(screen.getAllByText("✓ 已上传")).toHaveLength(3));
  expect(screen.getByRole("alert")).toHaveTextContent("整数倍");
  expect(screen.getByRole("button",{name:/开始制作/})).toBeDisabled();
  fireEvent.change(screen.getByLabelText("批量选择图片"),{target:{files:Array(11).fill(files[0])}});
  expect(screen.getAllByRole("alert").some(alert=>alert.textContent?.includes("最多"))).toBe(true);
  request.mockClear();
  fireEvent.change(screen.getByLabelText("选择素材 1"),{target:{files:[new File([new Uint8Array(5242881)],"large.png",{type:"image/png"})]}});
  expect(screen.getAllByRole("alert").some(alert=>alert.textContent?.includes("不能超过"))).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
it("prevents rapid duplicate submission and releases the submit button as soon as accepted",async()=>{
  let resolve!:(value:unknown)=>void;
  request.mockResolvedValueOnce(asset("a")).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  render(<UploadForm template={template}/>);
  fireEvent.change(screen.getByLabelText("选择素材 1"),{target:{files:[new File(["a"],"a.png",{type:"image/png"})]}});
  await waitFor(()=>expect(screen.getByRole("button",{name:/开始制作/})).toBeEnabled());
  const button=screen.getByRole("button",{name:/开始制作/});fireEvent.click(button);fireEvent.click(button);
  expect(request.mock.calls.filter(([path])=>path==="/tasks")).toHaveLength(1);
  await act(async()=>resolve({taskId:"running",task:{id:"running",status:"RUNNING"}}));
  expect(add).toHaveBeenCalledWith(expect.objectContaining({status:"RUNNING"}));
  expect(screen.getByRole("button",{name:/开始制作/})).toBeEnabled();
});
