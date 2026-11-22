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
  it('maps strict WordPress RSS evidence and rejects missing evidence',()=>{
    const evidence={
      version:1,
      original_title:'Build a React booking system',
      original_url:'https://jobs.wordpress.net/project/101/',
      raw_text:'<p>Client needs a React booking application. Budget USD 900.</p>',
      decoded_text:'Client needs a React booking application. Budget USD 900.',
      published_at:time,
      observed_at:time,
      link_targets:['https://jobs.wordpress.net/project/101/'],
      content_hash:'a'.repeat(64),
      complete:true,
      truncated:false,
    };
    const rss={...row,source:'wordpress_jobs_rss',source_id:'post:101',category:'freelance_request',
      name:'Unverified requester',title:evidence.original_title,url:evidence.original_url,
      published_at:time,listing_evidence:evidence};
    const lead=externalToLead(rss);
    expect(lead.source).toBe('csv');
    expect(lead.source_external_id).toBe('wordpress_jobs_rss:post:101');
    expect(lead.discovery_context).toMatchObject({
      provider:'wordpress_jobs_rss',item_type:'listing',source_hash:'a'.repeat(64),complete:true,
    });
    expect(()=>externalToLead({...rss,listing_evidence:undefined})).toThrow();
  });
  it('maps actual HN evidence and never imports upstream authority/contact consent',()=>{
    const lead=externalToLead(row,item);
    expect(lead).toMatchObject({source:'hn',source_external_id:'12345',source_url:'https://news.ycombinator.com/item?id=12345',
      posted_at:time,discovered_at:time,contact_permission_state:'UNKNOWN',contact_email:'',client_name_if_public:'',
      stated_budget_min:null,currency:'UNKNOWN'});
    expect(lead.raw_description).toContain('React website');expect(lead).not.toHaveProperty('score');
    expect(lead).not.toHaveProperty('status');expect(lead).not.toHaveProperty('consent_at');
  });
  it('carries only source-matched structured engagement through normal ingestion',()=>{
    const body='Project scope: implement a React checkout integration. Compensation: USD 100 per hour.';
    const candidate=(source:string,url:string,engagement?:unknown)=>({...row,source,url,source_id:'post:555',
      listing_evidence:{version:1,original_title:'Frontend development',original_url:url,raw_text:body,decoded_text:body,
        published_at:time,observed_at:time,link_targets:[],content_hash:'a'.repeat(64),complete:true,truncated:false,
        provider_verified_engagement:engagement}});
    const jobicyUrl='https://jobicy.com/jobs/555-react';
    const signal={field:'job_type',value:'contract'};
    const input=externalToLead(candidate('jobicy_rss',jobicyUrl,signal));
    const engine=new Engine(new MemoryStore(),defaults,{now:()=>time});
    const lead=engine.ingest(input).lead;
    expect(lead.qualification?.operator_decision).toBe('REJECTED');
    expect(lead.qualification_audit?.decision_source).toBe('NO_MODEL');
    expect(lead.qualification_audit?.provider_signal?.engagement).toEqual(signal);
    expect(lead.contact_permission_state).toBe('UNKNOWN');
    expect(externalToLead(candidate('jobicy_rss',jobicyUrl)).discovery_context?.provider_verified_engagement).toBeUndefined();
    expect(externalToLead(candidate('remotive','https://remotive.com/remote-jobs/software-dev/react-555',signal))
      .discovery_context?.provider_verified_engagement).toBeUndefined();
  });
  it('ingests through the existing classifier and deduplicates repeat pages',()=>{
    const store=new MemoryStore(),engine=new Engine(store,defaults,{now:()=>time});
    const calls:string[]=[];
    const http:Http={json:(url,request)=>{calls.push(url);if(url.includes('/leads?')){
      expect(url).toContain('category=freelance_request');
      expect(url).toContain('source=hackernews');
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
  it('keeps local-business prospects and non-HN company hiring out of the freelance CRM',()=>{
    const hiring={...row,category:'company_hiring'};
    const local={...row,category:'local_business'};
    const http:Http={json:url=>url.includes('/leads?')?page([hiring,local]):item};
    let ingested=0;
    expect(pullExternalLeads(http,options,()=>{ingested++;return {duplicate:false};})).toMatchObject({imported:0,invalid:2});
    expect(ingested).toBe(0);

    const boardOptions={...options,allowedSources:['arbeitnow']};
    const boardRow={...row,source:'arbeitnow',category:'company_hiring'};
    const boardHttp:Http={json:url=>url.includes('/leads?')?page([boardRow]):undefined};
    expect(()=>pullExternalLeads(boardHttp,boardOptions,()=>{ingested++;return {duplicate:false};})).toThrow();
    expect(ingested).toBe(0);
  });
  it('keeps non-HN identities namespaced with incomplete evidence notes',()=>{
    const lead=externalToLead({...row,source:'arbeitnow',source_id:'company-job',category:'company_hiring',name:'Company',title:'React engineer'});
    expect(lead.source).toBe('csv');expect(lead.source_external_id).toBe('arbeitnow:company-job');
    expect(lead.owner_notes).toContain('evidence unavailable');expect(lead.posted_at).toBeUndefined();
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
