import { useEffect, useRef, useState } from "react";

const outreachPath = "/api/local/pipeline/outreach";
type BusinessSummary = {
  inventory: number; qualified: number; contactable: number; awaiting: number; review: number; retry: number;
  nextRetryAt?: string; draftReady: number; reviewPackage: boolean;
  drafts: { id: number; name: string; city: string | null }[];
};
type SavedDraft = { subject: string; body: string; alternatives: string[]; eml: string; html: string };

export function useOutreachLibrary(version: number, businessBusy: boolean) {
  const [data, setData] = useState<BusinessSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const request = new AbortController();
    fetch(outreachPath, { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error("Could not load the local outreach library.");
        return response.json() as Promise<BusinessSummary>;
      })
      .then(result => { setData(result); setError(""); })
      .catch(err => { if (!request.signal.aborted) setError(err.message); });
    return () => request.abort();
  }, [version, businessBusy]);
  return { data, error };
}

export function PipelineOverview({ counts, business }: {
  counts: { raw: number; accepted: number; review: number; retries: number; enrichment: number };
  business: BusinessSummary | null;
}) {
  return <section id="overview" aria-labelledby="overview-label">
    <h2 id="overview-label">Overview</h2>
    <div className="pipeline-overview">
      <article className="note-panel">
        <h3><a href="#opportunities">Persistent freelance</a></h3>
        <p><strong>{counts.accepted}</strong> qualified / {counts.raw} active records</p>
        <p>{counts.review} in review · {counts.retries} AI retries · {counts.enrichment} awaiting evidence</p>
      </article>
      <article className="note-panel">
        <h3><a href="#marketplace">Marketplace discovery</a></h3>
        <p>Account-scoped Upwork search via Codex</p>
        <p>Previous owner session covered 101 listings across 20 searches. Open Marketplace discovery for the authorized search workflow.</p>
      </article>
      <article className="note-panel">
        <h3><a href="#businesses">Local businesses</a></h3>
        {business ? <><p><strong>{business.qualified}</strong> qualified / {business.inventory} inventory</p>
          <p>{business.contactable} contactable · {business.drafts.length}/{business.draftReady} saved drafts</p>
          <p>{business.awaiting} awaiting enrichment · {business.review} in review · {business.retry} retries</p></> : <p>Loading saved business counts…</p>}
      </article>
    </div>
  </section>;
}

const marketplaceSearches = [
  "Website development", "WordPress", "Shopify", "Mobile app", "AI agent", "API integration",
  "Workflow automation", "Java Spring Boot", "Dashboard", "MVP development", "Unity", "AR VR",
];

export function MarketplaceDiscovery() {
  const [query, setQuery] = useState("Website development");
  const [copyStatus, setCopyStatus] = useState("");
  const link = `https://www.upwork.com/nx/search/jobs/?${new URLSearchParams({ q: query, sort: "recency" })}`;
  const instruction = `Using my authorized Upwork freelancer account, search for "${query}" and show current listings with the filters I provide. Use Upwork's recency sort. For listings I select, show Upwork's available application eligibility and Connects cost. Do not apply, message or buy anything.`;
  return <section id="marketplace" className="note-panel">
    <h2>Marketplace discovery</h2>
    <p><strong>Upwork</strong> · LeadFlow AI freelancer account verified in Codex on 25 November 2026. This dashboard uses official Upwork links and leaves search results in the authorized owner session.</p>
    <p>The previous owner-directed search covered 101 distinct listings across 20 searches. Open the original Codex conversation to see those results, or start a fresh search below.</p>
    <p>Have a buyer brief with permission to retain and process it? Use <a href="#freelance">Authorized project import</a> in the freelance controls.</p>
    <div className="pipeline-filters">
      <label>Project search <select value={query} onChange={event=>{setQuery(event.target.value);setCopyStatus("");}}>
        {marketplaceSearches.map(value=><option key={value}>{value}</option>)}
      </select></label>
      <a className="button secondary" href={link} target="_blank" rel="noreferrer">Search on Upwork</a>
      <button type="button" className="button secondary" onClick={()=>void navigator.clipboard.writeText(instruction)
        .then(()=>setCopyStatus("Copied. Paste into the Codex conversation with your desired budget and competition filters."))
        .catch(()=>setCopyStatus("Select and copy the instruction below."))}>Copy Codex search request</button>
    </div>
    <p role="status">{copyStatus}</p>
    <details><summary>Authorized search workflow</summary><ol>
      <li>Open Upwork directly or paste this request into your authorized Codex conversation.</li>
      <li>Add your budget, posting age, contract type and competition criteria. Choose listings in that session for eligibility and Connects checks.</li>
      <li>Reopen shortlisted listings on Upwork for current availability and to decide whether to apply.</li>
    </ol><p>{instruction}</p><p><a href="https://www.upwork.com/ai/mcp" target="_blank" rel="noreferrer">Upwork MCP setup</a>{" · "}
      <a href="https://upwork.pactsafe.io/versions/6aee3ae4b081bf43cecf8f43.pdf" target="_blank" rel="noreferrer">API and MCP terms</a></p></details>
  </section>;
}

export function OutreachLibrary({ library }: { library: ReturnType<typeof useOutreachLibrary> }) {
  const [city, setCity] = useState("");
  const [open, setOpen] = useState<{ id: number; draft: SavedDraft } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const previewPanel = useRef<HTMLElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const { data, error } = library;
  const cities = [...new Set(data?.drafts.map(entry=>entry.city).filter(Boolean) ?? [])];

  useEffect(() => {
    if (open) previewPanel.current?.focus();
  }, [open]);

  async function preview(id: number) {
    setLoading(true);
    setOpen(null);
    setResult("");
    try {
      const response = await fetch(`${outreachPath}/${id}`);
      if (!response.ok) throw new Error("This saved draft is unavailable. Refresh the dashboard and check its current eligibility.");
      setOpen({ id, draft: await response.json() as SavedDraft });
    } catch (error) {
      setResult((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function download(format: "eml" | "html") {
    if (!open) return;
    const url = URL.createObjectURL(new Blob([open.draft[format]], {
      type: format === "eml" ? "message/rfc822" : "text/html;charset=utf-8",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `draft-${open.id}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value).then(()=>setResult(`${label} copied.`))
      .catch(()=>setResult("Clipboard access failed. Select and copy the displayed text."));
  }

  return <section id="drafts" className="note-panel">
    <h2>Outreach drafts</h2>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading saved drafts…</p>}
    {data && <>
      <p>{data.drafts.length} existing unsent drafts · {data.draftReady} businesses eligible for drafts</p>
      {data.reviewPackage && <p><a href={`${outreachPath}/package.pdf`} target="_blank" rel="noreferrer">Open review package (PDF)</a>{" · "}
        <a href={`${outreachPath}/package.zip`}>Download review package (ZIP)</a></p>}
      <label>Draft city <select value={city} onChange={event=>setCity(event.target.value)}>
        <option value="">All cities</option>{cities.map(name=><option key={name}>{name}</option>)}
      </select></label>
      <ul className="pipeline-drafts">
        {data.drafts.filter(entry=>!city || entry.city===city).map(entry=><li key={entry.id}>
          <span><strong>{entry.name}</strong>{entry.city && ` · ${entry.city}`}</span>
          <button type="button" aria-label={`Preview ${entry.name}`} disabled={loading} onClick={event=>{
            previewButton.current=event.currentTarget;
            void preview(entry.id);
          }}>Preview</button>
        </li>)}
      </ul>
    </>}
    {loading && <p role="status">Opening draft…</p>}
    {result && <p role="status">{result}</p>}
    {open && <article className="pipeline-draft-preview" ref={previewPanel} tabIndex={-1} aria-label="Selected outreach draft">
      <h3>{open.draft.subject}</h3>
      {open.draft.alternatives.length>0 && <details><summary>Alternative subjects</summary><ul>{open.draft.alternatives.map(subject=><li key={subject}>{subject}</li>)}</ul></details>}
      <div className="pipeline-filters">
        <button type="button" onClick={()=>copy(open.draft.subject,"Subject")}>Copy subject</button>
        <button type="button" onClick={()=>copy(open.draft.body,"Body")}>Copy body</button>
        <button type="button" onClick={()=>download("eml")}>Download EML</button>
        <button type="button" onClick={()=>download("html")}>Download HTML</button>
        <button type="button" onClick={()=>{setOpen(null);previewButton.current?.focus();}}>Close preview</button>
      </div>
      <pre>{open.draft.body}</pre>
      <details><summary>HTML preview</summary><iframe title="Saved outreach HTML preview" sandbox=""
        srcDoc={open.draft.html.replace(/<head>/i, "<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'\">")} /></details>
    </article>}
  </section>;
}
