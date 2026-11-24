import { publicWebsite } from "./business-web";
import type { EvidenceInput } from "./business-evidence";

export type BusinessSearchHint={url:string;source:"tavily"|"operator_search";observedAt:string};

export function tavilyBusinessSearch(apiKey:string,limit:number,fetcher=fetch){
  let remaining=limit;
  let blocked=false;
  return async (identity:EvidenceInput):Promise<BusinessSearchHint[]>=>{
    if(!apiKey || blocked || remaining<1 || !identity.city || !identity.name.trim())return [];
    remaining--;
    const quote=(text:string,max:number)=>text.replace(/["\p{C}]/gu," ").trim().slice(0,max);
    const query=`"${quote(identity.name,110)}" ${quote(identity.city,60)} ${quote(identity.title??"",40)} official business website about contact`;
    try{
      const result=await fetcher("https://api.tavily.com/search",{
        method:"POST",redirect:"error",signal:AbortSignal.timeout(9000),
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
        body:JSON.stringify({query,search_depth:"basic",auto_parameters:false,max_results:4,include_answer:false,include_raw_content:false,include_images:false}),
      });
      if([401,402,403,429,432,433].includes(result.status))blocked=true;
      if(!result.ok || !result.body){await result.body?.cancel();return [];}
      const reader=result.body.getReader();
      const decoder=new TextDecoder();
      let bytes=0,text="";
      try{
        for(;;){
          const item=await reader.read();if(item.done)break;
          bytes+=item.value.byteLength;
          if(bytes>160_000){await reader.cancel();return [];}
          text+=decoder.decode(item.value,{stream:true});
        }
      }finally{reader.releaseLock();}
      const json=JSON.parse(text+decoder.decode());
      if(!Array.isArray(json.results))return [];
      const unique=new Set<string>();
      const observedAt=new Date().toISOString();
      return json.results.slice(0,4).flatMap((row:{url?:unknown})=>{
        if(typeof row?.url!=="string"||row.url.length>1500)return [];
        try{
          const url=publicWebsite(row.url);
          if(url.protocol!=="https:"||unique.has(url.origin))return [];
          unique.add(url.origin);
          url.search="";
          return [{url:url.href,source:"tavily" as const,observedAt}];
        }catch{return [];}
      });
    }catch{return [];}
  };
}
