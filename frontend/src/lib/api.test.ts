import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {api} from "./api";

function hanging(signal:AbortSignal){
  return new Promise<never>((_resolve,reject)=>{
    if(signal.aborted)reject(signal.reason);
    else signal.addEventListener("abort",()=>reject(signal.reason),{once:true});
  });
}
let signal:AbortSignal;
beforeEach(()=>{
  vi.useFakeTimers();
  vi.stubGlobal("fetch",vi.fn((_url:string,init:RequestInit)=>{
    signal=init.signal||new AbortController().signal;
    return hanging(signal);
  }));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it("times out an unresponsive query with a recoverable request error",async()=>{
  const result=api("/tasks/a").catch(error=>error);
  await vi.advanceTimersByTimeAsync(15000);
  expect(signal.aborted).toBe(true);
  await expect(result).resolves.toMatchObject({code:"REQUEST_TIMEOUT"});
});
it("allows uploads and submission sixty seconds before timing out",async()=>{
  const result=api("/assets",{method:"POST"}).catch(error=>error);
  await vi.advanceTimersByTimeAsync(15000);expect(signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(45000);expect(signal.aborted).toBe(true);
  await expect(result).resolves.toMatchObject({code:"REQUEST_TIMEOUT"});
});
it("preserves caller cancellation and clears the request deadline",async()=>{
  const caller=new AbortController();
  const result=api("/tasks/a",{signal:caller.signal}).catch(error=>error);
  caller.abort();
  await expect(result).resolves.toMatchObject({name:"AbortError"});
  expect(vi.getTimerCount()).toBe(0);
});
it("also times out if the server stalls while sending JSON",async()=>{
  vi.mocked(fetch).mockImplementation(async(_url,init)=>{
    signal=init!.signal||new AbortController().signal;
    return {ok:true,json:()=>hanging(signal)} as unknown as Response;
  });
  const result=api("/tasks/a").catch(error=>error);
  await vi.advanceTimersByTimeAsync(15000);expect(signal.aborted).toBe(true);
  await expect(result).resolves.toMatchObject({code:"REQUEST_TIMEOUT"});
});
