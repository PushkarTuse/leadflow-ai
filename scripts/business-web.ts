import { lookup } from "node:dns/promises";
import { request as http } from "node:http";
import { request as https } from "node:https";
import { BlockList, isIP } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const blocked = new BlockList();
for (const [ip, bits] of [
  ["0.0.0.0",8], ["10.0.0.0",8], ["100.64.0.0",10], ["127.0.0.0",8], ["169.254.0.0",16],
  ["172.16.0.0",12], ["192.0.0.0",24], ["192.0.2.0",24], ["192.88.99.0",24], ["192.168.0.0",16],
  ["198.18.0.0",15], ["198.51.100.0",24], ["203.0.113.0",24], ["224.0.0.0",4], ["240.0.0.0",4],
] as const) blocked.addSubnet(ip,bits,"ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::",3,"ipv6");
for (const [ip,bits] of [["2001::",23],["2001:db8::",32],["2002::",16],["3fff::",20]] as const) blocked.addSubnet(ip,bits,"ipv6");

export const publicAddress = (value:string) => isIP(value) === 4 ? !blocked.check(value,"ipv4") :
  isIP(value) === 6 && globalV6.check(value,"ipv6") && !blocked.check(value,"ipv6");

export function publicWebsite(value:string, base?:URL): URL {
  const url = new URL(value,base);
  const host = url.hostname.toLowerCase();
  if (url.href.length > 1600 || !["http:","https:"].includes(url.protocol) || url.username || url.password || url.port ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/i.test(host) || isIP(host) ||
    /\.(?:localhost|internal|local|test|example|invalid|onion|lan|home|corp)$/i.test(host))
    throw new Error("UNSAFE_PUBLIC_URL");
  url.hash = "";
  return url;
}

const userAgent = "LeadFlowResearch";
const redirectCodes = new Set([301,302,303,307,308]);
type Reply = {status:number; text:string; location?:string};

function remaining(end:number) {
  const ms=end-Date.now();
  if(ms<=0) throw new Error("PUBLIC_PAGE_TIMEOUT");
  return ms;
}

async function get(url:URL, max:number, kind:"html"|"robots", end:number):Promise<Reply> {
  const signals=AbortSignal.timeout(remaining(end));
  const addresses = await Promise.race([
    lookup(url.hostname,{all:true,verbatim:true}),
    delay(remaining(end),undefined,{ref:false}).then(()=>{throw new Error("PUBLIC_DNS_TIMEOUT");}),
  ]);
  if (!addresses.length || addresses.some(value=>!publicAddress(value.address))) throw new Error("UNSAFE_DNS_ADDRESS");
  const pinned=addresses.find(address=>address.family===4) ?? addresses[0];
  return new Promise((resolve,reject)=>{
    const socket=(url.protocol==="https:"?https:http)(url,{
      agent:false,family:pinned.family,signal:signals,maxHeaderSize:16*1024,
      lookup:(_host,_options,callback)=>callback(null,pinned.address,pinned.family),
      headers:{"user-agent":userAgent,accept:kind==="html"?"text/html,application/xhtml+xml":"text/plain","accept-encoding":"identity"},
    },response=>{
      const status=response.statusCode??0;
      if(status!==200){
        resolve({status,text:"",location:response.headers.location});
        response.destroy();
        return;
      }
      const type=String(response.headers["content-type"]??"").split(";")[0].trim().toLowerCase();
      if((kind==="html"?!["text/html","application/xhtml+xml"].includes(type):type!=="text/plain") ||
        !["","identity"].includes(String(response.headers["content-encoding"]??"")) ||
        Number(response.headers["content-length"]??0)>max) {
        response.destroy();
        reject(new Error("PUBLIC_CONTENT_REJECTED"));
        return;
      }
      let length=0;
      const chunks:Buffer[]=[];
      response.on("data",(chunk:Buffer)=>{
        length+=chunk.length;
        if(length>max) response.destroy(new Error("PUBLIC_BODY_TOO_LARGE"));
        else chunks.push(chunk);
      });
      response.once("error",reject);
      response.once("aborted",()=>reject(new Error("PUBLIC_BODY_ABORTED")));
      response.once("end",()=>resolve({status,text:Buffer.concat(chunks).toString("utf8")}));
    });
    socket.once("error",reject);
    socket.end();
  });
}

export function robotsAllows(text:string,url:URL):boolean {
  const groups:{agents:string[];rules:{allow:boolean;value:string}[]}[]=[];
  let group:{agents:string[];rules:{allow:boolean;value:string}[]}|undefined;
  let directive=false;
  for(const line of text.split(/\r?\n/)){
    const row=line.split("#",1)[0].trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if(!row) continue;
    const key=row[1].toLowerCase(),value=row[2].trim();
    if(key==="user-agent"){
      if(!group || directive){ group={agents:[],rules:[]};groups.push(group);directive=false; }
      group.agents.push(value.toLowerCase());
    }else if(group && ["allow","disallow","crawl-delay"].includes(key)){
      directive=true;
      if(value)group.rules.push({allow:key==="allow",value:key==="crawl-delay"?"*":value});
    }
  }
  const exact=groups.filter(g=>g.agents.includes(userAgent.toLowerCase()));
  const eligible=exact.length?exact:groups.filter(g=>g.agents.includes("*"));
  if(eligible.some(g=>g.rules.some(rule=>!rule.allow&&rule.value==="*"))) return false;
  const path=url.pathname+url.search;
  // Decode only unreserved characters, so an encoded slash cannot change path boundaries.
  const normalize=(value:string)=>value.replace(/%[a-f0-9]{2}/gi,token=>{
    const char=String.fromCharCode(Number.parseInt(token.slice(1),16));
    return /^[a-z0-9._~-]$/i.test(char)?char:token.toUpperCase();
  });
  let best:{length:number;allow:boolean}|undefined;
  for(const rule of eligible.flatMap(g=>g.rules)){
    if(rule.value.length>300 || (rule.value.match(/\*/g)?.length??0)>6) return false;
    const anchored=rule.value.endsWith("$");
    const value=normalize(anchored?rule.value.slice(0,-1):rule.value);
    const pattern=value.split("*").map(part=>part.replace(/[\\^$.*+?()[\]{}|]/g,"\\$&")).join(".*");
    if(!new RegExp("^"+pattern+(anchored?"$":"")).test(normalize(path))) continue;
    const length=value.replaceAll("*","").length;
    if(!best||length>best.length||(length===best.length&&rule.allow))best={length,allow:rule.allow};
  }
  return best?.allow ?? true;
}

export function publicPageReader() {
  const policies=new Map<string,string|null>();
  const nextRequest=new Map<string,number>();
  async function spaced(url:URL,kind:"html"|"robots",end:number) {
    const at=Math.max(Date.now(),nextRequest.get(url.hostname)??0);
    nextRequest.set(url.hostname,at+1100);
    if(at>Date.now()) await delay(at-Date.now(),undefined,{signal:AbortSignal.timeout(remaining(end))});
    return get(url,kind==="html"?550_000:96_000,kind,end);
  }
  return async (initial:string) => {
    let url=publicWebsite(initial);
    const end=Date.now()+18000;
    for(let redirect=0;redirect<4;redirect++){
      if(!policies.has(url.origin)){
        const robots=new URL("/robots.txt",url);
        let response=await spaced(robots,"robots",end);
        if(redirectCodes.has(response.status)&&response.location){
          const target=publicWebsite(response.location,robots);
          if(target.hostname===robots.hostname &&
            (target.protocol===robots.protocol || target.protocol==="https:"))response=await spaced(target,"robots",end);
        }
        policies.set(url.origin,response.status===200?response.text:[404,410].includes(response.status)?"":null);
      }
      const rules=policies.get(url.origin);
      if(rules==null || !robotsAllows(rules,url)) throw new Error("PUBLIC_ROBOTS_RESTRICTED");
      const response=await spaced(url,"html",end);
      if(response.status===200) return {url:url.href,html:response.text};
      if(!redirectCodes.has(response.status)||!response.location) throw new Error(`PUBLIC_HTTP_${response.status}`);
      const target=publicWebsite(response.location,url);
      if(url.protocol==="https:"&&target.protocol!=="https:") throw new Error("PUBLIC_REDIRECT_DOWNGRADE");
      url=target;
    }
    throw new Error("PUBLIC_REDIRECT_LIMIT");
  };
}
