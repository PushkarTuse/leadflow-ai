import { describe, expect, it, vi } from "vitest";
import { tavilyBusinessSearch } from "../scripts/business-search";

const row={name:"Local Dental",city:"Pune",title:"Clinic",email:"private-draft-address@example.com",phone:"0000000000",website:null};

describe("optional business search",()=>{
  it("sends a bounded public query and returns validated URL hints only",async()=>{
    const transport=vi.fn(async(_url:string,options?:RequestInit)=>{
      expect(options?.redirect).toBe("error");
      expect(options?.body).not.toContain(row.email);
      expect(options?.body).not.toContain(row.phone);
      expect(JSON.parse(String(options?.body))).toMatchObject({search_depth:"basic",auto_parameters:false,max_results:4});
      return Response.json({results:[{url:"https://127.0.0.1/private"},{url:"https://clinic-example.com/about?tracker=1",content:"Unverified claim"},{url:"https://clinic-example.com/book"}]});
    });
    const search=tavilyBusinessSearch("test",1,transport as typeof fetch);
    expect(await search(row)).toEqual([{url:"https://clinic-example.com/about",source:"tavily",observedAt:expect.any(String)}]);
    expect(await search(row)).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("stops sending requests when the account hits quota",async()=>{
    const transport=vi.fn(async()=>new Response(null,{status:429}));
    const search=tavilyBusinessSearch("test",5,transport as typeof fetch);
    await search(row);await search(row);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
