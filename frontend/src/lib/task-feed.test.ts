import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {TaskFeed,type Transport} from "./task-feed";
import type {Task,TaskPage} from "./types";
import {api} from "./api";

const task=(id:string,status:Task["status"]="QUEUED",version=0):Task=>({
  id,templateId:"t",templateTitle:id,coverUrl:"/demo.png",status,currentStage:null,resultUrl:null,
  errorCode:null,errorMessage:null,version,createdAt:"2026-11-02T10:00:00Z",updatedAt:"2026-11-02T10:00:00Z",stages:[],assets:[]
});
const page=(items:Task[]):TaskPage=>({items,nextCursor:null});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
describe("task tracking business lifecycle",()=>{
  let feed:TaskFeed;
  beforeEach(()=>vi.useFakeTimers());
  afterEach(()=>{feed?.stop();vi.useRealTimers();vi.unstubAllGlobals();});
  it("isolates tasks and never turns a query error into execution failure; manual recovery works",async()=>{
    const transport=vi.fn<Transport>().mockResolvedValue(page([task("a"),task("b")]));
    feed=new TaskFeed(transport);await feed.start();
    transport.mockImplementation(async <T,>(path:string)=>{
      if(path==="/tasks/a")throw new Error("network unavailable");
      return task("b","SUCCEEDED",7) as T;
    });
    await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().items.a.status).toBe("QUEUED");
    expect(feed.getSnapshot().errors.a).toContain("network");
    expect(feed.getSnapshot().items.b.status).toBe("SUCCEEDED");
    expect(vi.getTimerCount()).toBe(0);
    transport.mockResolvedValue(task("a","FAILED",3));feed.retry("a");
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.getSnapshot().items.a.status).toBe("FAILED");
    expect(feed.getSnapshot().errors.a).toBeUndefined();
    expect(feed.getSnapshot().items.b.status).toBe("SUCCEEDED");
  });
  it("one failed task does not interrupt another running task",async()=>{
    const transport=vi.fn<Transport>().mockResolvedValue(page([task("a"),task("b")]));
    feed=new TaskFeed(transport);await feed.start();
    transport.mockImplementation(async <T,>(path:string)=>(path.endsWith("/a")?task("a","FAILED",2):task("b","RUNNING",2)) as T);
    await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().items.a.status).toBe("FAILED");
    expect(feed.getSnapshot().items.b.status).toBe("RUNNING");
    expect(vi.getTimerCount()).toBe(1);
    transport.mockClear();await vi.advanceTimersByTimeAsync(1500);
    expect(transport.mock.calls.map(call=>call[0])).toEqual(["/tasks/b"]);
  });
  it("stops polling terminal tasks and never schedules without active tasks",async()=>{
    const transport=vi.fn<Transport>().mockResolvedValue(page([]));
    feed=new TaskFeed(transport);await feed.start();
    await vi.advanceTimersByTimeAsync(6000);expect(transport).toHaveBeenCalledTimes(2);
    feed.add(task("new"));transport.mockResolvedValue(task("new","SUCCEEDED",7));
    await vi.advanceTimersByTimeAsync(1500);expect(transport).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(10000);expect(transport).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores stale versions and preserves terminal state",async()=>{
    const transport=vi.fn<Transport>().mockResolvedValue(page([]));
    feed=new TaskFeed(transport);await feed.start();
    feed.add(task("a","RUNNING",5));feed.add(task("a","QUEUED",1));
    expect(feed.getSnapshot().items.a.status).toBe("RUNNING");
    feed.add(task("a","SUCCEEDED",7));feed.add(task("a","RUNNING",6));
    expect(feed.getSnapshot().items.a.status).toBe("SUCCEEDED");
  });
  it("restores unfinished tasks beyond the first history page",async()=>{
    const transport=vi.fn<Transport>().mockImplementation(async <T,>(path:string)=>page(path.includes("active=true")?[task("old","RUNNING",4)]:[task("recent","SUCCEEDED",7)]) as T);
    feed=new TaskFeed(transport);await feed.start();
    expect(Object.keys(feed.getSnapshot().items)).toEqual(["recent","old"]);
    expect(vi.getTimerCount()).toBe(1);
  });
  it("aborts and rejects old responses after user switch",async()=>{
    const late=deferred<TaskPage>();
    const transport=vi.fn<Transport>().mockImplementation(()=>late.promise as ReturnType<Transport>);
    const alice=new TaskFeed(transport,1500,"alice");
    const loading=alice.start();alice.stop();
    const bobTransport=vi.fn<Transport>().mockResolvedValue(page([task("bob","SUCCEEDED",7)]));
    feed=new TaskFeed(bobTransport,1500,"bob");await feed.start();
    late.resolve(page([task("private-alice")]));await loading;
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(alice.getSnapshot().items).toEqual({});
    expect(Object.keys(feed.getSnapshot().items)).toEqual(["bob"]);
  });
  it("does not let an old refresh overwrite the current generation",async()=>{
    const old=deferred<TaskPage>();
    const transport=vi.fn<Transport>().mockImplementation(()=>old.promise as ReturnType<Transport>);
    feed=new TaskFeed(transport);const first=feed.start();
    transport.mockResolvedValue(page([task("current","SUCCEEDED",7)]));await feed.start();
    old.resolve(page([task("obsolete")]));await first;
    expect(Object.keys(feed.getSnapshot().items)).toEqual(["current"]);
  });
  it("a stalled query times out without failing its task or blocking the next poll",async()=>{
    let bQueries=0;
    vi.stubGlobal("fetch",vi.fn((url:string,init:RequestInit)=>{
      if(url==="/api/tasks/a")return new Promise((_resolve,reject)=>{
        init.signal!.addEventListener("abort",()=>reject(init.signal!.reason),{once:true});
      });
      const data=url==="/api/tasks/b"?task("b",++bQueries===1?"RUNNING":"SUCCEEDED",bQueries):page([task("a"),task("b")]);
      return Promise.resolve({ok:true,json:async()=>data} as Response);
    }));
    feed=new TaskFeed(api);await feed.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().items.b.status).toBe("RUNNING");
    await vi.advanceTimersByTimeAsync(15000);
    expect(feed.getSnapshot().items.a.status).toBe("QUEUED");
    expect(feed.getSnapshot().errors.a).toContain("超时");
    await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().items.b.status).toBe("SUCCEEDED");
    expect(bQueries).toBe(2);expect(vi.getTimerCount()).toBe(0);
  });
  it("retains RUNNING A on HTTP 500, completes B once, and recovers only A on retry",async()=>{
    const originalA={...task("A","RUNNING",2),currentStage:"GENERATING" as const};
    const originalB={...task("B","RUNNING",3),currentStage:"ORGANIZING" as const};
    let aQueries=0,bQueries=0;
    vi.stubGlobal("fetch",vi.fn((input:string)=>{
      if(input==="/api/tasks/A"){
        aQueries++;
        return Promise.resolve(aQueries===1?
          Response.json({code:"INTERNAL_ERROR",message:"模拟 HTTP 500"},{status:500}):
          Response.json(task("A",aQueries===2?"RUNNING":"SUCCEEDED",aQueries+2)));
      }
      if(input==="/api/tasks/B"){
        bQueries++;return Promise.resolve(Response.json(task("B","SUCCEEDED",7)));
      }
      return Promise.resolve(Response.json(page([originalA,originalB])));
    }));
    feed=new TaskFeed(api);await feed.start();await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().items.A).toEqual(originalA);
    expect(feed.getSnapshot().errors.A).toBe("模拟 HTTP 500");
    expect(feed.getSnapshot().items.B.status).toBe("SUCCEEDED");
    expect(feed.getSnapshot().errors.B).toBeUndefined();
    await vi.advanceTimersByTimeAsync(6000);
    expect(aQueries).toBe(1);expect(bQueries).toBe(1);
    feed.retry("A");await vi.advanceTimersByTimeAsync(0);
    expect(feed.getSnapshot().items.A.status).toBe("RUNNING");
    expect(feed.getSnapshot().errors.A).toBeUndefined();
    expect(aQueries).toBe(2);expect(bQueries).toBe(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().items.A.status).toBe("SUCCEEDED");
    await vi.advanceTimersByTimeAsync(6000);
    expect(aQueries).toBe(3);expect(bQueries).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("a late query failure cannot attach an error to a newer terminal snapshot",async()=>{
    let reject!:(reason:Error)=>void;
    const pending=new Promise<unknown>((_resolve,fail)=>{reject=fail;});
    const transport=vi.fn<Transport>().mockImplementation(path=>path==="/tasks/a"?pending:Promise.resolve(page([task("a","RUNNING",2)])));
    feed=new TaskFeed(transport);await feed.start();await vi.advanceTimersByTimeAsync(1500);
    feed.add(task("a","SUCCEEDED",7));reject(new Error("obsolete query failure"));
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.getSnapshot().items.a.status).toBe("SUCCEEDED");
    expect(feed.getSnapshot().errors.a).toBeUndefined();
    await vi.advanceTimersByTimeAsync(6000);
    expect(transport.mock.calls.filter(([path])=>path==="/tasks/a")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("a newer successful snapshot clears a query error but a stale snapshot does not",async()=>{
    const transport=vi.fn<Transport>().mockResolvedValue(page([task("a","RUNNING",2)]));
    feed=new TaskFeed(transport);await feed.start();transport.mockRejectedValue(new Error("temporary query error"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().errors.a).toBe("temporary query error");
    feed.add(task("a","QUEUED",1));
    expect(feed.getSnapshot().errors.a).toBe("temporary query error");
    feed.add(task("a","RUNNING",4));
    expect(feed.getSnapshot().errors.a).toBeUndefined();
    transport.mockResolvedValue(task("a","SUCCEEDED",7));await vi.advanceTimersByTimeAsync(1500);
    expect(feed.getSnapshot().items.a.status).toBe("SUCCEEDED");
    expect(vi.getTimerCount()).toBe(0);
  });
});
