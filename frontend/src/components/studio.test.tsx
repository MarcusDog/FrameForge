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
