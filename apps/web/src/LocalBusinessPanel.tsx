import { useEffect, useState, type FormEvent } from "react";
import type { Business, BusinessScan } from "../../../scripts/local-business";

const endpoint = "/api/local/pipeline/business";
const labels = { osm: "OpenStreetMap", overture: "Overture Places", fsq_os: "Foursquare Open Source" };
type Draft = { id:number; fingerprint:string; subject: string; alternatives: string[]; body: string; method: string; eml: string };
const businessState=(row:Business)=>{
  if(row.processing)return "Processing";
  if(row.outreach?.status==="excluded")return "Excluded";
  if(row.outreach?.status==="qualified")return "Qualified";
  if(row.enrichment?.status==="retry")return "Source retry";
  return row.enrichment||row.evidence?"Evidence review":"Awaiting enrichment";
};
const publicContact=(row:Business)=>Boolean(row.outreach?.contactable||row.enrichment?.observations.some(item=>item.field==="contact"));

async function request<T>(path = "", body?: object): Promise<T> {
  const response = await fetch(endpoint + path, body ? {
    method: "POST", headers: { "Content-Type": "application/json", "X-LeadFlow-Local": "1" },
    body: JSON.stringify(body),
  } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Local business pipeline unavailable");
  return data as T;
}

export function LocalBusinessPanel() {
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState(250);
  const [target, setTarget] = useState(50);
  const [jobActive, setJobActive] = useState(false);
  const [page, setPage] = useState(0);
  const [scan, setScan] = useState<BusinessScan | null>(null);
  const [activeCity, setActiveCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [withEmailOnly, setWithEmailOnly] = useState(false);
  const [showScreened, setShowScreened] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void request<{ scan: BusinessScan | null }>("?metros=1")
      .then(result => result.scan ? result : request<{ scan: BusinessScan | null }>())
      .then(result => setScan(result.scan))
      .catch(error => setError(error.message));
  }, []);
  const metroView=scan?.query==="india-metros";
  const scanQuery=scan?.query;
  useEffect(()=>{
    if(!scanQuery)return;
    const interval=window.setInterval(()=>{
      void request<{scan:BusinessScan|null;scanning:boolean}>(metroView?"?metros=1":"").then(({scan:latest,scanning})=>{
        if(latest?.query!==scanQuery)return;
        setScan(latest);
        setJobActive(scanning||latest.cities.some(city=>city.rows.some(row=>row.processing)));
      }).catch(()=>{});
    },busy?2000:8000);
    return ()=>window.clearInterval(interval);
  },[scanQuery,metroView,busy]);

  async function search(query: string) {
    setBusy(true);
    setActiveCity("");
    setDraft(null);
    setError("");
    setMessage("");
    const started = new Date().toISOString();
    const interval = window.setInterval(() => {
      void request<{ scan: BusinessScan | null }>().then(result => {
        if (result.scan?.query === query && result.scan.updatedAt >= started) setScan(result.scan);
      }).catch(() => {});
    }, 5000);
    try { setScan((await request<{ scan: BusinessScan }>("/scan", { location: query, budget,target,complete:true })).scan); }
    catch (error) { setError((error as Error).message); }
    finally { window.clearInterval(interval); setBusy(false); }
  }

  async function restoreMetros() {
    setError("");
    setDraft(null);
    try {
      const result = await request<{ scan: BusinessScan | null }>("?metros=1");
      if (result.scan) { setScan(result.scan); setActiveCity(""); }
      else setError("No metro scan has been saved yet.");
    } catch (error) { setError((error as Error).message); }
  }

  async function prepare(row: Business) {
    setDraftBusy(true);
    setDraft(null);
    setError("");
    setMessage("");
    try { setDraft(await request<Draft>("/draft", { id: row.id, source: row.source, sourceId: row.source_id, country: row.country, useAi: true })); }
    catch (error) { setError((error as Error).message); }
    finally { setDraftBusy(false); }
  }

  async function review() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<{ scan: BusinessScan; checked: number }>("/review", { metros: scan?.query === "india-metros" });
      setScan(result.scan);
      setMessage(result.checked ? `AI screened ${result.checked} priority records.` : "No additional AI screens completed. Rules results are shown.");
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function saveDraft() {
    if (!draft) return;
    const url = URL.createObjectURL(new Blob([draft.eml], { type: "message/rfc822" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leadflow-outreach-draft.eml";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function decideDraft(decision:"approved"|"rejected") {
    if (!draft) return;
    setDraftBusy(true);
    try {
      await request("/draft-review",{id:draft.id,fingerprint:draft.fingerprint,decision});
      setMessage(`Draft ${decision} for local review. Delivery status: unsent.`);
    } catch (error) { setError((error as Error).message); }
    finally { setDraftBusy(false); }
  }

  const city = scan?.cities.find(item => item.city === activeCity) ?? scan?.cities[0];
  const rows = city?.rows.filter(row => (showScreened || row.outreach?.status === "qualified") &&
    (!withEmailOnly || publicContact(row))) ?? [];
  const shownPage=Math.min(page,Math.max(0,Math.ceil(rows.length/25)-1));
  async function enrich(mode:"backlog"|"updated-rules"|"retries", selection?:string){
    setBusy(true);setError("");
    try{
      const result=await request<{scan:BusinessScan;evaluated:number;counts:Record<string,number>;paused:boolean}>("/enrich",{metros:metroView,mode,city:selection,target});
      setScan(result.scan);
      setMessage(`${result.paused?"Paused · ":""}${result.evaluated} evaluated · ${result.counts.qualified} qualified · ${result.counts.excluded} excluded · ${result.counts.review} review · ${result.counts.retry} waiting for a source retry`);
    }catch(error){setError((error as Error).message);}
    finally{setBusy(false);}
  }

  async function verify(row: Business, data: FormData) {
    setBusy(true); setError("");
    try {
      await request("/evidence", { id: row.id, source: row.source, sourceId: row.source_id, ...Object.fromEntries(data) });
      setScan((await request<{scan: BusinessScan | null}>(scan?.query === "india-metros" ? "?metros=1" : "")).scan);
      setMessage("Evidence saved.");
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section id="businesses" className="note-panel" aria-labelledby="business-title" style={{ margin: "1.5rem 0" }}>
      <h2 id="business-title">Local businesses</h2>
      <p>Find businesses by city or country and prepare an outreach draft for review.</p>
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); if (location.trim()) void search(location.trim()); }}
        style={{ display: "flex", alignItems: "end", gap: "0.6rem", flexWrap: "wrap" }}>
        <label>
          <span style={{ display: "block" }}>City or country</span>
          <input value={location} onChange={event => setLocation(event.target.value)} maxLength={100}
            placeholder="London, UK" style={{ padding: "0.65rem", border: "1px solid currentColor" }} />
        </label>
        <label>Raw budget per city <input type="number" min="20" max="400" value={budget} onChange={event => setBudget(Number(event.target.value))} /></label>
        <label>Qualified target per city <input type="number" min="1" max="400" value={target} onChange={event=>setTarget(Number(event.target.value))} required /></label>
        <button className="button" disabled={busy || jobActive || !location.trim()} type="submit">Run complete business pipeline</button>
        <button className="button secondary" disabled={busy || jobActive} type="button" onClick={() => void search("india-metros")}>Run all 7 Indian metros</button>
        <button className="button secondary" disabled={busy} type="button" onClick={() => void restoreMetros()}>View saved metros</button>
      </form>
      {(busy||jobActive) && <p role="status">Processing businesses… <button type="button" onClick={()=>void request("/pause",{}).then(()=>setMessage("Pausing after the active batch.")).catch(error=>setError(error.message))}>Pause enrichment</button></p>}
      {error && <p role="alert">{error}</p>}
      {!draft && message && <p role="status">{message}</p>}
      {scan && <>
        <h3>{scan.query === "india-metros" ? "Indian metro scan" : scan.query}</h3>
        {scan.countrySample && <p>Country sample from up to three major cities.</p>}
        <p>Last updated <time dateTime={scan.updatedAt}>{new Date(scan.updatedAt).toLocaleString()}</time></p>
        {scan.freshSince && <p>Fresh scan since <time dateTime={scan.freshSince}>{new Date(scan.freshSince).toLocaleString()}</time></p>}
        <ul>
          {scan.cities.map(item => <li key={item.city}>
            <strong>{item.city}</strong> · {item.rows.length} publisher records · {item.rows.filter(row=>row.enrichment).length} evaluated · {(["Awaiting enrichment","Processing","Excluded","Evidence review","Source retry","Qualified"] as const).map(state=>`${item.rows.filter(row=>businessState(row)===state).length} ${state.toLowerCase()}`).join(" · ")} · {item.rows.filter(publicContact).length} verified contact routes · {item.rows.filter(row=>row.outreach?.draftReady).length} draft-ready
            <ul>{item.sources.map(source => <li key={source.source}>
              {labels[source.source]} · {source.shown ?? 0} in inventory · {source.fetched} fetched, {source.inserted} added · {source.source==="fsq_os"&&!source.shown?"Unconfigured for this city. An authorized Foursquare Places export is required.":source.status}
            </li>)}</ul>
          </li>)}
        </ul>
        <p style={{ fontSize: "0.9rem" }}>Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>,{" "}
          <a href="https://docs.overturemaps.org/attribution/">Overture Maps</a>, and <a href="https://www.geonames.org/export/">GeoNames</a> for locations.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBlock: "1rem" }}>
          <label>Show city{" "}
            <select value={city?.city ?? ""} onChange={event => {setActiveCity(event.target.value);setPage(0);}}>
              {scan.cities.map(item => <option key={item.city} value={item.city}>{item.city}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={withEmailOnly} onChange={event => {setWithEmailOnly(event.target.checked);setPage(0);}} /> Verified contact route only</label>
          <label><input type="checkbox" checked={showScreened} onChange={event => {setShowScreened(event.target.checked);setPage(0);}} /> Show all listings</label>
          <button className="button secondary" disabled={busy || draftBusy || jobActive} onClick={() => void review()}>AI screen priority listings</button>
          <button className="button secondary" disabled={busy || draftBusy || jobActive} onClick={() => void enrich("backlog")}>Resume existing backlog</button>
          <button className="button secondary" disabled={busy || draftBusy || jobActive || !city} onClick={() => void enrich("backlog",city?.city)}>Enrich selected city</button>
          <button className="button secondary" disabled={busy || draftBusy || jobActive} onClick={() => void enrich("retries")}>Retry eligible failures</button>
          <button className="button secondary" disabled={busy || draftBusy || jobActive} onClick={() => void enrich("updated-rules")}>Reprocess under updated rules</button>
        </div>
        {draftBusy && <p role="status">Preparing email draft…</p>}
        {draft && <div className="note-panel" aria-label="Outreach draft" style={{ marginBlock: "1rem" }}>
          <img src="/email/leadflow-signature.gif" alt="LeadFlow AI" width="180" height="45" className="business-signature-motion" />
          <img src="/email/leadflow-signature.png" alt="LeadFlow AI" width="180" height="45" className="business-signature-still" />
          <style>{".business-signature-still{display:none}@media(prefers-reduced-motion:reduce){.business-signature-motion{display:none}.business-signature-still{display:block}}"}</style>
          <h3>{draft.subject}</h3>
          <details><summary>Alternative subject lines</summary><ul>{draft.alternatives.map(subject => <li key={subject}>{subject}</li>)}</ul></details>
          <p>Draft written by {draft.method === "Rules" ? "the fallback template" : draft.method}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{draft.body}</p>
          <button className="button secondary" onClick={() => void navigator.clipboard.writeText(draft.subject + "\n\n" + draft.body)
            .then(() => setMessage("Draft copied.")).catch(() => setMessage("Clipboard unavailable. Use the draft download."))}>Copy draft</button>{" "}
          <button className="button secondary" onClick={saveDraft}>Download branded draft</button>
          <button className="button secondary" disabled={draftBusy} onClick={()=>void decideDraft("approved")}>Approve draft locally</button>
          <button className="button secondary" disabled={draftBusy} onClick={()=>void decideDraft("rejected")}>Reject draft locally</button>
          {message && <p role="status">{message}</p>}
        </div>}
        {rows.length ? <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["Business", "Source", "Screening", "Website", "Listed email", "Listed phone", "Draft"].map(title =>
              <th scope="col" key={title} style={{ padding: "0.55rem" }}>{title}</th>)}</tr></thead>
            <tbody>{rows.slice(shownPage*25,shownPage*25+25).map(row => <tr key={row.id} style={{ borderTop: "1px solid #7f7f7f55" }}>
              <td style={{ padding: "0.55rem" }}><strong>{row.name}</strong>{row.title && <div>{row.title}</div>}</td>
              <td>{row.url?.startsWith("https://") ? <a href={row.url} target="_blank" rel="noreferrer">{labels[row.source]}</a> : labels[row.source]}</td>
              <td>{businessState(row)} · {row.outreach?.score ?? 0}/100
                {row.outreach && (row.enrichment||row.outreach.status==="excluded") && <div>{row.outreach.reason}</div>}
                {row.evidence && <><a href={row.evidence.ownershipUrl} target="_blank" rel="noreferrer">Ownership evidence</a>{" · "}
                  <a href={row.evidence.opportunityUrl} target="_blank" rel="noreferrer">Opportunity evidence</a><div>{row.evidence.opportunity}</div></>}
                {Boolean(row.enrichment?.observations.length) && <details><summary>Public observations</summary>
                  <ul>{row.enrichment?.observations.map((item,index)=><li key={`${item.field}-${index}`}><a href={item.url} target="_blank" rel="noreferrer">{item.field}</a> · {item.value}</li>)}</ul>
                </details>}</td>
              <td>{(row.evidence?.websiteStatus??row.enrichment?.websiteObservation)?.replaceAll("_"," ") ?? (row.website ? "Listed, unverified" : "Unlisted in source")}</td>
              <td>{row.email || "Unlisted"}</td>
              <td>{row.phone || "Unlisted"}</td>
              <td>{row.outreach?.draftReady && <button className="button secondary"
                disabled={draftBusy || busy} onClick={() => void prepare(row)}>Draft for {row.name}</button>}
                {row.outreach?.status !== "excluded" && <details>
                  <summary>Record verified evidence</summary>
                  <form onSubmit={event => {event.preventDefault(); void verify(row,new FormData(event.currentTarget));}}>
                    <label>Ownership <select name="ownership" defaultValue={row.evidence?.ownership ?? "independent"}>
                      <option value="independent">Independent</option><option value="locally_controlled">Locally controlled</option><option value="corporate">Corporate</option>
                    </select></label>
                    <label>Official ownership evidence <input type="url" name="ownershipUrl" defaultValue={row.evidence?.ownershipUrl} required /></label>
                    <label>Website status <select name="websiteStatus" defaultValue={row.evidence?.websiteStatus ?? "unknown"}>
                      {["unknown","official_site","parent_site","social_only_observed","listed_site_unavailable","not_found_after_checks","not_listed"].map(status =>
                        <option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}
                    </select></label>
                    <label>Opportunity source <input type="url" name="opportunityUrl" defaultValue={row.evidence?.opportunityUrl} required /></label>
                    <label>Verified observation <textarea name="opportunity" minLength={12} maxLength={350} defaultValue={row.evidence?.opportunity} required /></label>
                    <label>Service idea, starting with “We could” <textarea name="serviceIdea" maxLength={250} defaultValue={row.evidence?.serviceIdea} /></label>
                    <label>Preferred subject <input name="subjectIdea" maxLength={84} defaultValue={row.evidence?.subjectIdea} /></label>
                    <label>Public contact page <input type="url" name="contactUrl" defaultValue={row.evidence?.contactUrl} /></label>
                    <button type="submit" disabled={busy}>Save review</button>
                  </form>
                </details>}</td>
            </tr>)}</tbody>
          </table>
          <p>{shownPage*25+1}–{Math.min(rows.length,(shownPage+1)*25)} of {rows.length}{" "}<button type="button" disabled={!shownPage} onClick={()=>setPage(shownPage-1)}>Previous</button>{" "}<button type="button" disabled={(shownPage+1)*25>=rows.length} onClick={()=>setPage(shownPage+1)}>Next</button></p>
        </div> : <p>No matches in this view. Show all listings to inspect availability and evidence.</p>}
      </>}
    </section>
  );
}
