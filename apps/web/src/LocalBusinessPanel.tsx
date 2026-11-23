import { useEffect, useState, type FormEvent } from "react";
import type { Business, BusinessScan } from "../../../scripts/local-business";

const endpoint = "/api/local/pipeline/business";
const labels = { osm: "OpenStreetMap", overture: "Overture Places", fsq_os: "Foursquare Open Source" };
type Draft = { subject: string; body: string; method: string; eml: string };

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
    try { setScan((await request<{ scan: BusinessScan }>("/scan", { location: query })).scan); }
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

  const city = scan?.cities.find(item => item.city === activeCity) ?? scan?.cities[0];
  const rows = city?.rows.filter(row => (showScreened || row.qualification?.status === "prospect") &&
    (!withEmailOnly || Boolean(row.email))) ?? [];

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
            <strong>{item.city}</strong> · {item.rows.length} listings · {item.rows.filter(row => row.qualification?.status === "prospect").length} prospects · {item.rows.filter(row => row.qualification?.status === "prospect" && row.email).length} prospects with email
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
          <label><input type="checkbox" checked={withEmailOnly} onChange={event => setWithEmailOnly(event.target.checked)} /> With listed email only</label>
          <label><input type="checkbox" checked={showScreened} onChange={event => setShowScreened(event.target.checked)} /> Show held and excluded listings</label>
          <button className="button secondary" disabled={busy || draftBusy} onClick={() => void review()}>AI screen priority prospects</button>
        </div>
        {draftBusy && <p role="status">Preparing email draft…</p>}
        {draft && <div className="note-panel" aria-label="Outreach draft" style={{ marginBlock: "1rem" }}>
          <img src="/email/leadflow-signature.gif" alt="LeadFlow AI" width="180" height="45" className="business-signature-motion" />
          <img src="/email/leadflow-signature.png" alt="LeadFlow AI" width="180" height="45" className="business-signature-still" />
          <style>{".business-signature-still{display:none}@media(prefers-reduced-motion:reduce){.business-signature-motion{display:none}.business-signature-still{display:block}}"}</style>
          <h3>{draft.subject}</h3>
          <p>Draft written by {draft.method === "Rules" ? "the fallback template" : draft.method}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{draft.body}</p>
          <button className="button secondary" onClick={() => void navigator.clipboard.writeText(draft.subject + "\n\n" + draft.body)
            .then(() => setMessage("Draft copied.")).catch(() => setMessage("Clipboard unavailable. Use the draft download."))}>Copy draft</button>{" "}
          <button className="button secondary" onClick={saveDraft}>Download branded draft</button>
          {message && <p role="status">{message}</p>}
        </div>}
        {rows.length ? <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["Business", "Source", "Screening", "Website", "Listed email", "Listed phone", "Draft"].map(title =>
              <th scope="col" key={title} style={{ padding: "0.55rem" }}>{title}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.id} style={{ borderTop: "1px solid #7f7f7f55" }}>
              <td style={{ padding: "0.55rem" }}><strong>{row.name}</strong>{row.title && <div>{row.title}</div>}</td>
              <td>{row.url?.startsWith("https://") ? <a href={row.url} target="_blank" rel="noreferrer">{labels[row.source]}</a> : labels[row.source]}</td>
              <td>{row.qualification?.status === "excluded" ? "Excluded" : row.qualification?.status === "review" ? "Held" : "Prospect"}
                {row.qualification && <div>{row.qualification.reason} · {row.qualification.method}</div>}</td>
              <td>{row.website ? "Listed" : "Unlisted"}</td>
              <td>{row.email || "Unlisted"}</td>
              <td>{row.phone || "Unlisted"}</td>
              <td>{row.qualification?.status === "prospect" && <button className="button secondary"
                disabled={draftBusy || busy} onClick={() => void prepare(row)}>Draft for {row.name}</button>}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p>No businesses match the current view.</p>}
      </>}
    </section>
  );
}
