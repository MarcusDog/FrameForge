import {afterEach,expect,it,vi} from "vitest";
import {requestKey} from "./request-key";
afterEach(()=>vi.unstubAllGlobals());
it("creates independent valid submission keys on HTTP origins without randomUUID",()=>{
  const getRandomValues=crypto.getRandomValues.bind(crypto);
  vi.stubGlobal("crypto",{getRandomValues});
  const keys=Array.from({length:100},()=>requestKey());
  expect(new Set(keys).size).toBe(100);
  expect(keys.every(key=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key))).toBe(true);
});
