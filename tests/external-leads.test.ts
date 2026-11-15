import {describe,it,expect} from 'vitest';
import {externalOrigin,externalToLead,pullExternalLeads} from '../apps/automation/external-leads';
import {Engine} from '../packages/core/workflow';
import {MemoryStore} from '../packages/core/memory-store';
import {defaults} from '../packages/core/model';
import type {Http} from '../apps/automation/adapters';

const time='2026-11-16T00:00:00.000Z';
const row={source:'hackernews',source_id:'12345',category:'freelance_request',name:'public-handle',
  title:'Truncated headline',url:'https://example.com/untrusted',found_at:time,
  score:100,status:'won',email:'person@example.com',consent_at:time,contact_permission_state:'EXPLICIT_OPT_IN'};
const item={id:12345,type:'comment',time:Date.parse(time)/1000,
  text:'SEEKING FREELANCER: We need a React website developer for a fixed scope API integration project. Budget USD 3000, launch next month.'};
const options={origin:'https://scout.example.com',token:'x'.repeat(40),offset:0,limit:5,allowedSources:['hackernews']};
const page=(leads:unknown[],total=leads.length)=>({ok:true,total,count:leads.length,offset:0,leads});

describe('external discovery pull',()=>{
  it('maps actual HN evidence and never imports upstream authority/contact consent',()=>{
    const lead=externalToLead(row,item);
    expect(lead).toMatchObject({source:'hn',source_external_id:'12345',source_url:'https://news.ycombinator.com/item?id=12345',
      posted_at:time,discovered_at:time,contact_permission_state:'UNKNOWN',contact_email:'',client_name_if_public:'',
      stated_budget_min:null,currency:'UNKNOWN'});
    expect(lead.raw_description).toContain('React website');expect(lead).not.toHaveProperty('score');
    expect(lead).not.toHaveProperty('status');expect(lead).not.toHaveProperty('consent_at');
  });
  it('ingests through the existing classifier and deduplicates repeat pages',()=>{
    const store=new MemoryStore(),engine=new Engine(store,defaults,{now:()=>time});
    const calls:string[]=[];
    const http:Http={json:(url,request)=>{calls.push(url);if(url.includes('/leads?')){
      expect(request?.headers?.Authorization).toBe(`Bearer ${options.token}`);return page([row]);
    }expect(request?.headers).toBeUndefined();return item;}};
    expect(pullExternalLeads(http,options,l=>engine.ingest(l))).toMatchObject({imported:1,nextOffset:0});
    expect(pullExternalLeads(http,options,l=>engine.ingest(l))).toMatchObject({duplicates:1});
    expect(store.leads()).toHaveLength(1);expect(store.leads()[0].method).toBe('rules');
    expect(store.leads()[0].source).toBe('hn');expect(calls).toHaveLength(4);
  });
  it('isolates malformed/unknown/Places rows and rejects mismatched HN evidence',()=>{
    const http:Http={json:url=>url.includes('/leads?')?page([{...row,source:'google_places'},null,{...row,source_id:'wrong'},row]):{...item,deleted:true}};
    let ingested=0;
    expect(pullExternalLeads(http,options,()=>{ingested++;return {duplicate:false};})).toMatchObject({invalid:4});
    expect(ingested).toBe(0);
    expect(()=>externalToLead(row,{...item,id:999})).toThrow();
    expect(()=>externalToLead(row,{...item,text:'SEEKING WORK: I build websites'})).toThrow();
  });
  it('keeps non-HN identities namespaced with incomplete evidence notes',()=>{
    const lead=externalToLead({...row,source:'arbeitnow',source_id:'company-job',category:'company_hiring',name:'Company',title:'React engineer'});
    expect(lead.source).toBe('csv');expect(lead.source_external_id).toBe('arbeitnow:company-job');
    expect(lead.owner_notes).toContain('Incomplete');expect(lead.posted_at).toBeUndefined();
  });
  it('aborts provider failure instead of returning a checkpoint; validates page bounds',()=>{
    const http:Http={json:url=>{if(url.includes('/leads?'))return page([row],10);throw new Error('Provider failure');}};
    expect(()=>pullExternalLeads(http,options,()=>({duplicate:false}))).toThrow('Provider failure');
    expect(()=>pullExternalLeads({json:()=>({...page([]),offset:99})},options,()=>({duplicate:false}))).toThrow();
    const r=pullExternalLeads({json:()=>page([{...row,source:'osm'}],10)},options,()=>({duplicate:false}));
    expect(r).toMatchObject({invalid:1,nextOffset:1});
  });
  it('rejects unsafe origins, weak tokens, oversized pages and unsupported allowlists',()=>{
    for(const origin of ['http://localhost:8787','https://127.0.0.1','https://a.example/path','https://user@a.example','https://a.local'])
      expect(()=>externalOrigin(origin)).toThrow();
    const http:Http={json:()=>page(Array(6).fill(row))};
    expect(()=>pullExternalLeads(http,{...options,token:'dev-token'},()=>({duplicate:false}))).toThrow();
    expect(()=>pullExternalLeads(http,options,()=>({duplicate:false}))).toThrow();
    expect(()=>pullExternalLeads(http,{...options,allowedSources:['google_places']},()=>({duplicate:false}))).toThrow();
  });
});
