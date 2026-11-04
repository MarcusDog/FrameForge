import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {Providers} from "./providers";
import {AuthForm} from "./auth-form";
const {replace,request}=vi.hoisted(()=>({replace:vi.fn(),request:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/register",useRouter:()=>({replace})}));
vi.mock("@/lib/api",async()=>({...await vi.importActual<typeof import("@/lib/api")>("@/lib/api"),api:request}));
beforeEach(()=>{
  request.mockReset();replace.mockReset();
  request.mockImplementation(async(path:string)=>{
    if(path==="/demo/users")return [{id:"alice",name:"Alice"},{id:"bob",name:"Bob"}];
    if(path==="/demo/session"){const {ApiError}=await import("@/lib/api");throw new ApiError(401,"IDENTITY_REQUIRED","请登录");}
    if(path==="/config")return {simulationEnabled:true};
    if(path==="/me/profile")return {userId:"u_test",nickname:"旅人",version:0};
    return {id:"u_test",name:"creator"};
  });
});
afterEach(cleanup);
async function fillRegister(){
  await waitFor(()=>expect(screen.getByLabelText(/^用户名/)).toBeEnabled());
  fireEvent.change(screen.getByLabelText(/^用户名/),{target:{value:"creator"}});
  fireEvent.change(screen.getByLabelText("昵称"),{target:{value:"旅人"}});
  fireEvent.change(screen.getByLabelText(/^密码/),{target:{value:"test password!"}});
  fireEvent.change(screen.getByLabelText("确认密码"),{target:{value:"test password!"}});
}
it("registers with a synchronous submit lock and navigates only after acceptance",async()=>{
  let resolve!:(value:unknown)=>void;const defaults=request.getMockImplementation()!;
  request.mockImplementation((path,init)=>path==="/auth/register"?new Promise(done=>{resolve=done;}):defaults(path,init));
  render(<Providers><AuthForm mode="register"/></Providers>);await fillRegister();
  fireEvent.submit(screen.getByRole("button",{name:"创建账户并登录"}).closest("form")!);
  fireEvent.submit(screen.getByRole("button",{name:"请稍候…"}).closest("form")!);
  expect(request.mock.calls.filter(c=>c[0]==="/auth/register")).toHaveLength(1);expect(replace).not.toHaveBeenCalled();
  await act(async()=>resolve({id:"u_test",name:"creator"}));expect(replace).toHaveBeenCalledWith("/account");
});
it("keeps input and displays real server login errors without navigating",async()=>{
  const defaults=request.getMockImplementation()!;
  request.mockImplementation(async(path,init)=>{if(path==="/auth/login")throw new Error("用户名或密码不正确");return defaults(path,init);});
  render(<Providers><AuthForm mode="login"/></Providers>);
  await waitFor(()=>expect(screen.getByLabelText(/^用户名/)).toBeEnabled());
  fireEvent.change(screen.getByLabelText(/^用户名/),{target:{value:"creator"}});fireEvent.change(screen.getByLabelText(/^密码/),{target:{value:"wrong password"}});
  fireEvent.submit(screen.getByRole("button",{name:"登录"}).closest("form")!);
  await screen.findByText("用户名或密码不正确");expect(screen.getByLabelText(/^用户名/)).toHaveValue("creator");expect(replace).not.toHaveBeenCalled();
});
it("rejects mismatched passwords without a register request",async()=>{
  render(<Providers><AuthForm mode="register"/></Providers>);await fillRegister();
  fireEvent.change(screen.getByLabelText("确认密码"),{target:{value:"different password"}});fireEvent.submit(screen.getByRole("button",{name:"创建账户并登录"}).closest("form")!);
  expect(screen.getByRole("alert")).toHaveTextContent("两次输入的密码不一致");expect(request.mock.calls.filter(c=>c[0]==="/auth/register")).toHaveLength(0);
});
it("cancels a pending registration on leaving and ignores its late response",async()=>{
  let resolve!:(value:unknown)=>void,signal!:AbortSignal;const defaults=request.getMockImplementation()!;
  request.mockImplementation((path,init)=>{if(path==="/auth/register"){signal=init.signal;return new Promise(done=>{resolve=done;});}return defaults(path,init);});
  const view=render(<Providers><AuthForm mode="register"/></Providers>);await fillRegister();
  fireEvent.submit(screen.getByRole("button",{name:"创建账户并登录"}).closest("form")!);view.unmount();expect(signal.aborted).toBe(true);
  await act(async()=>resolve({id:"u_test",name:"creator"}));expect(replace).not.toHaveBeenCalled();
});
