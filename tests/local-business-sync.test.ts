import { describe, expect, it } from "vitest";
import { pullLocalBusinesses, pullManualProspects, saveLocalBusinessFollowup, saveManualProspectFollowup } from "../apps/automation/local-business-sync";
import type { Http } from "../apps/automation/adapters";

const origin = "https://scout.example.com";
const token = "x".repeat(40);
const row = {
  id: 21,
  source: "osm",
  source_id: "node/21",
  category: "local_business",
  name: "Kothrud Dental",
  title: "dentist",
  city: "Pune",
  phone: "+91 98765 43210",
  website: null,
  pagespeed_mobile: null,
  rating: null,
  rating_count: null,
  score: 90,
  signal: "No website listed",
  url: "https://www.openstreetmap.org/node/21",
  status: "new",
  notes: null,
};

describe("isolated local-business Sheet sync", () => {
  it("syncs new companies only into a separate manual category",()=>{
    const http:Http={json:()=>({ok:true,total:1,count:1,offset:0,leads:[{
      id:31,source:"mca",source_id:"U74110PN2026PTC000099",category:"new_company",
      name:"Manifest Company",title:"Retail",registered_on:"2026-11-10",
      activity_code:"46909",activity_label:"Retail",city:"Pune",country:"IN",
      address:"Pune",score:75,signal:"Registered recently",url:"https://example.com",
    }]})};
    const rows:Record<string,unknown>[]=[];
    expect(pullManualProspects(http,{origin,token,category:"new_company"},(row)=>{rows.push(row);return false;}))
      .toEqual({imported:1,duplicates:0,invalid:0,excluded:0});
    expect(rows[0]).toMatchObject({category:"new_company",source:"mca",registered_on:"2026-11-10"});
  });
  it("checks category identity and expected revision before a manual save",()=>{
    const calls:{method:string}[]=[];
    const http:Http={json:(_url,request)=>{
      calls.push({method:request?.method||"get"});
      return request?.method==="patch"?{ok:true,lead:{queue_revision:3}}:{ok:true,lead:{category:"new_company",source:"mca"}};
    }};
    expect(saveManualProspectFollowup(http,{origin,token,category:"new_company"},{
      apiId:"31",status:"contacted",notes:"Owner review",expectedRevision:2,
    })).toMatchObject({apiId:"31",status:"contacted"});
    expect(calls.map(x=>x.method)).toEqual(["get","patch"]);
  });
  it("requests only local businesses, maps the calling fields, and excludes Google Places", () => {
    let requestUrl = "";
    let requestHeaders: Record<string, string> | undefined;
    const http: Http = {
      json: (url, request) => {
        requestUrl = url;
        requestHeaders = request?.headers;
        return {
          ok: true,
          total: 3,
          count: 3,
          offset: 0,
          leads: [
            row,
            { ...row, id: 22, source: "google_places", source_id: "place/22" },
            { ...row, id: 23, category: "company_hiring" },
          ],
        };
      },
    };
    const records: Record<string, unknown>[] = [];
    const result = pullLocalBusinesses(http, { origin, token }, (record) => {
      records.push(record);
      return false;
    });

    expect(requestUrl).toContain("/leads?category=local_business");
    expect(requestUrl).toContain("limit=200");
    expect(requestHeaders?.Authorization).toBe(`Bearer ${token}`);
    expect(result).toEqual({ imported: 1, duplicates: 0, invalid: 1, excluded: 1 });
    expect(records[0]).toMatchObject({
      business_key: "osm:node/21",
      api_id: "21",
      category: "local_business",
      website_status: "NO_WEBSITE",
      campaign_status: "new",
      phone: "+91 98765 43210",
    });
  });

  it("counts existing rows as refreshed without replacing their identity", () => {
    const seen = new Set<string>();
    const http: Http = {
      json: () => ({ ok: true, total: 1, count: 1, offset: 0, leads: [row] }),
    };
    const upsert = (record: Record<string, unknown>) => {
      const key = String(record.business_key);
      const existed = seen.has(key);
      seen.add(key);
      return existed;
    };
    expect(pullLocalBusinesses(http, { origin, token }, upsert)).toMatchObject({ imported: 1 });
    expect(pullLocalBusinesses(http, { origin, token }, upsert)).toMatchObject({ duplicates: 1 });
  });

  it("fails closed on unsafe API origins and weak credentials", () => {
    const http: Http = { json: () => ({}) };
    expect(() => pullLocalBusinesses(http, { origin: "http://127.0.0.1:8787", token }, () => false)).toThrow();
    expect(() => pullLocalBusinesses(http, { origin, token: "short" }, () => false)).toThrow();
  });

  it("writes only status and notes after confirming the row is a non-Google local business", () => {
    const calls: { url: string; method: string }[] = [];
    const http: Http = {
      json: (url, request) => {
        calls.push({ url, method: request?.method ?? "get" });
        return request?.method === "patch"
          ? { ok: true }
          : { ok: true, lead: { category: "local_business", source: "osm" } };
      },
    };
    expect(saveLocalBusinessFollowup(http, { origin, token }, {
      apiId: "21", status: "contacted", notes: "Call next week",
    })).toEqual({ apiId: "21", status: "contacted" });
    expect(calls.map((call) => call.method)).toEqual(["get", "patch"]);

    calls.length = 0;
    const googleHttp: Http = {
      json: (url, request) => {
        calls.push({ url, method: request?.method ?? "get" });
        return { ok: true, lead: { category: "local_business", source: "google_places" } };
      },
    };
    expect(() => saveLocalBusinessFollowup(googleHttp, { origin, token }, {
      apiId: "22", status: "contacted", notes: "",
    })).toThrow("Google Places");
    expect(calls.map((call) => call.method)).toEqual(["get"]);
  });
});
