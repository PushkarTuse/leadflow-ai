import { useRef, useState } from "react";

type Preview = { row:number; status:"invalid"|"valid"|"duplicate_in_file"|"already_imported"; title?:string };

export function AuthorizedProjectImport({ onImported, busy }: { onImported:()=>Promise<void>; busy:boolean }) {
  const input=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [preview,setPreview]=useState<Preview[]|null>(null);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function submit(previewOnly:boolean){
    if(!file||!confirmed)return;
    setPending(true);
    setError("");
    setMessage("");
    try{
      if(file.size>400_000)throw new Error("Choose a CSV or JSON file under 400 KB.");
      const format=file.name.split(".").at(-1)?.toLowerCase();
      if(format!=="csv"&&format!=="json")throw new Error("Choose a CSV or JSON file.");
      const response=await fetch("/api/local/pipeline/import",{method:"POST",headers:{"Content-Type":"application/json","X-LeadFlow-Local":"1"},
        body:JSON.stringify({text:await file.text(),format,permissionConfirmed:confirmed,preview:previewOnly})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Project import failed.");
      if(previewOnly){setPreview(data.rows);return;}
      setPreview(null);setFile(null);setConfirmed(false);
      if(input.current)input.current.value="";
      setMessage(`${data.inserted} added, ${data.duplicates+data.duplicatesInFile} duplicates, ${data.rejected} invalid or inactive.`);
      if(data.inserted>0)await onImported();
    }catch(cause){setError((cause as Error).message);}
    finally{setPending(false);}
  }

  return <details style={{marginBlock:"1rem"}}>
    <summary>Import authorized buyer briefs</summary>
    <p>Use a CSV file or JSON array with title, description, buyer, url, published_at, active_until and provenance. Use UTC timestamps and one of buyer_shared, authorized_alert or authorized_marketplace_export.</p>
    <label>Project file <input ref={input} type="file" accept=".csv,.json" disabled={pending} onChange={event=>{
      setFile(event.target.files?.[0]??null);setPreview(null);setMessage("");setError("");
    }} /></label>{" "}
    <label><input type="checkbox" checked={confirmed} disabled={pending} onChange={event=>{
      setConfirmed(event.target.checked);setPreview(null);
    }} /> I have permission to use this file for qualification.</label>{" "}
    <button type="button" disabled={!file||!confirmed||pending||busy} onClick={()=>void submit(true)}>Preview import</button>{" "}
    <button type="button" disabled={!file||pending} onClick={()=>{if(input.current)input.current.value="";setFile(null);setPreview(null);setConfirmed(false);setError("");}}>Clear selection</button>{" "}
    <button type="button" disabled={!preview?.some(row=>row.status==="valid")||pending||busy} onClick={()=>void submit(false)}>Import and qualify</button>
    {pending && <p role="status">Processing buyer briefs…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {preview && <ul aria-label="Import preview">{preview.map(row=><li key={row.row}>Row {row.row}{row.title&&` · ${row.title}`} · {row.status.replaceAll("_"," ")}</li>)}</ul>}
  </details>;
}
