import { useEffect, useState, type FormEvent } from "react";
import type { Business, BusinessScan } from "../../../scripts/local-business";

const endpoint = "/api/local/pipeline/business";
const labels = { osm: "OpenStreetMap", overture: "Overture Places", fsq_os: "Foursquare Open Source" };
type Draft = { id:number; fingerprint:string; subject: string; alternatives: string[]; body: string; method: string; eml: string };

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
    try { setScan((await request<{ scan: BusinessScan }>("/scan", { location: query, budget })).scan); }
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
    (!withEmailOnly || Boolean(row.outreach?.contactable))) ?? [];
  async function enrich(){
    setBusy(true);setError("");
    try{
      const result=await request<{scan:BusinessScan;evaluated:number;counts:Record<string,number>}>("/enrich",{metros:scan?.query==="india-metros"});
      setScan(result.scan);
      setMessage(`${result.evaluated} evaluated · ${result.counts.qualified} qualified · ${result.counts.excluded} excluded · ${result.counts.review} review · ${result.counts.retry} waiting for a source retry`);
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
        <button className="button" disabled={busy || !location.trim()} type="submit">Find businesses</button>
        <button className="button secondary" disabled={busy} type="button" onClick={() => void search("india-metros")}>Run 7 Indian metros</button>
        <button className="button secondary" disabled={busy} type="button" onClick={() => void restoreMetros()}>View saved metros</button>
      </form>
      {busy && <p role="status">Scanning or screening businesses…</p>}
      {error && <p role="alert">{error}</p>}
      {!draft && message && <p role="status">{message}</p>}
      {scan && <>
        <h3>{scan.query === "india-metros" ? "Indian metro scan" : scan.query}</h3>
        {scan.countrySample && <p>Country sample from up to three major cities.</p>}
        <p>Last updated <time dateTime={scan.updatedAt}>{new Date(scan.updatedAt).toLocaleString()}</time></p>
        <ul>
          {scan.cities.map(item => <li key={item.city}>
            <strong>{item.city}</strong> · {item.sources.reduce((total, source) => total + source.fetched, 0)} fetched · {item.rows.length} unique displayed · {item.rows.filter(row => row.outreach?.status === "excluded").length} excluded · {item.rows.filter(row => row.outreach?.status === "review").length} in review · {item.rows.filter(row => row.outreach?.status === "qualified").length} qualified / 50 target · {item.rows.filter(row => row.outreach?.draftReady).length} draft-ready
            <ul>{item.sources.map(source => <li key={source.source}>
              {labels[source.source]} · {source.shown ?? 0} in inventory · {source.fetched} fetched, {source.inserted} added · {source.status}
            </li>)}</ul>
          </li>)}
        </ul>
        <p style={{ fontSize: "0.9rem" }}>Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>,{" "}
          <a href="https://docs.overturemaps.org/attribution/">Overture Maps</a>, and <a href="https://www.geonames.org/export/">GeoNames</a> for locations.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBlock: "1rem" }}>
          <label>Show city{" "}
            <select value={city?.city ?? ""} onChange={event => setActiveCity(event.target.value)}>
              {scan.cities.map(item => <option key={item.city} value={item.city}>{item.city}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={withEmailOnly} onChange={event => setWithEmailOnly(event.target.checked)} /> Verified contact route only</label>
          <label><input type="checkbox" checked={showScreened} onChange={event => setShowScreened(event.target.checked)} /> Show review and excluded listings</label>
          <button className="button secondary" disabled={busy || draftBusy} onClick={() => void review()}>AI screen priority listings</button>
          <button className="button secondary" disabled={busy || draftBusy} onClick={() => void enrich()}>Verify public business evidence</button>
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
            <tbody>{rows.map(row => <tr key={row.id} style={{ borderTop: "1px solid #7f7f7f55" }}>
              <td style={{ padding: "0.55rem" }}><strong>{row.name}</strong>{row.title && <div>{row.title}</div>}</td>
              <td>{row.url?.startsWith("https://") ? <a href={row.url} target="_blank" rel="noreferrer">{labels[row.source]}</a> : labels[row.source]}</td>
              <td>{row.outreach?.status} · {row.outreach?.score ?? 0}/100
                {row.outreach && <div>{row.outreach.reason}</div>}
                {row.evidence && <><a href={row.evidence.ownershipUrl} target="_blank" rel="noreferrer">Ownership evidence</a>{" · "}
                  <a href={row.evidence.opportunityUrl} target="_blank" rel="noreferrer">Opportunity evidence</a><div>{row.evidence.opportunity}</div></>}</td>
              <td>{row.evidence?.websiteStatus.replaceAll("_"," ") ?? (row.website ? "Listed, unverified" : "Unlisted in source")}</td>
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
        </div> : <p>No qualified prospects in this view. Open the review listings to inspect the available evidence.</p>}
      </>}
    </section>
  );
}
