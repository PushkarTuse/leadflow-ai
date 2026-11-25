import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { LocalBusinessPanel, type BusinessPipelineControls } from "./LocalBusinessPanel";
import { AuthorizedProjectImport } from "./AuthorizedProjectImport";
import { discoveryState, type DiscoveryState } from "../../../packages/core/discovery-state";
import { discoveryAiBanner, providerHealthLine, type DiscoveryAiHealth } from "../../../packages/core/discovery-ai-health";

export type QualificationState = "ACCEPTED" | "REJECTED" | "REVIEW";

export interface LeadRow {
  lead_id: string;
  created_at?:string;
  title: string;
  raw_description?: string;
  client_name_if_public: string;
  source: string;
  discovery_context?: {
    provider?: string;
    original_url?: string;
    application_url?: string;
    expires_at?: string;
    decoded_text?: string;
    provider_verified_engagement?: { value: string } | null;
  };
  qualification_status?: string;
  qualification?: {
    is_valid_freelance_lead: boolean;
    eligibility_state: string;
    operator_decision?: "ACCEPTED" | "REJECTED";
    priority: string;
    quality_score: number;
    confidence_score: number;
    rejection_reason: string | null;
    evidence_quotes: { field: string; quote: string }[];
    budget_signal?: { kind: string; minimum: number | null; maximum: number | null; currency: string; unit: string };
    required_skills?: string[];
    contact_method?: { type: string; value: string | null };
    provider_signal?: { engagement?: { value: string }; application?: { value: string } };
  };
  qualification_audit?: {
    method: string;
    discovery_provider?: "gemini" | "groq" | "cloudflare" | "openrouter" | "openai";
    decision_source?: "MODEL" | "RULES_FALLBACK" | "NO_MODEL" | "SOURCE_GUARD";
    project_boundary?: "BOUNDED" | "ONGOING_SEAT" | "UNVERIFIED";
    operational_state?: DiscoveryState;
    discovery_semantics?: { lead_kind: string; decision?: "ACCEPT" | "REJECT"; decision_reason?: string };
  };
  extractionWarning: string;
  status: string;
}

export function qualificationState(row: LeadRow): QualificationState {
  const audit = row.qualification_audit;
  if (row.qualification?.operator_decision !== "ACCEPTED") return "REJECTED";
  if (audit?.decision_source === "MODEL" && audit.discovery_semantics?.decision === "ACCEPT") return "ACCEPTED";
  if (audit?.decision_source === "RULES_FALLBACK" && row.qualification.is_valid_freelance_lead &&
      row.qualification.eligibility_state === "ELIGIBLE") return "ACCEPTED";
  return "REJECTED";
}

function localReviewState(row:LeadRow): DiscoveryState {
  return row.qualification_audit?.operational_state ?? discoveryState({provider:row.discovery_context?.provider,
    decision:row.qualification?.operator_decision,reason:row.qualification?.rejection_reason,source:row.qualification_audit?.decision_source,
    boundary:row.qualification_audit?.project_boundary,warning:row.extractionWarning});
}
const discoveryLabels:Record<DiscoveryState,string>={QUALIFIED:"Accepted",REJECTED:"Rejected",REVIEW:"Review",
  RETRY_CLASSIFICATION:"Waiting for AI retry",AWAITING_ENRICHMENT:"Waiting for source evidence"};

export function displayPriority(state: QualificationState, priority?: string) {
  return state === "ACCEPTED" ? priority || "—" : "—";
}

function paymentLabel(budget?: NonNullable<LeadRow["qualification"]>["budget_signal"]) {
  if (!budget || budget.kind === "UNKNOWN" || budget.kind === "BOARD_PAID_INTENT_INFERRED")
    return "Not stated";
  if (budget.kind === "UNPAID_OR_EQUITY_ONLY") return "Unpaid or equity only";
  if (budget.kind === "AMOUNT_STATED") {
    const amounts = [...new Set([budget.minimum, budget.maximum].filter(amount => amount !== null))];
    const unit = ["HOUR", "DAY", "WEEK", "MONTH", "PROJECT"].includes(budget.unit) ? "/" + budget.unit.toLowerCase() : "";
    return [budget.currency !== "UNKNOWN" ? budget.currency : "", amounts.join("–") + unit].filter(Boolean).join(" ");
  }
  return budget.kind === "COMMERCIAL_HIRING" ? "Hiring language · rate not stated" : "Paid · rate not stated";
}

export function qualificationCounts(rows: LeadRow[]) {
  const counts = { ACCEPTED: 0, REJECTED: 0, REVIEW: 0 };
  for (const row of rows) counts[qualificationState(row)]++;
  return { raw: rows.length, accepted: counts.ACCEPTED, rejected: counts.REJECTED };
}

export function qualificationMethod(row: LeadRow) {
  if (row.qualification_audit?.decision_source === "NO_MODEL") return "No AI verdict";
  if (row.qualification_audit?.decision_source === "RULES_FALLBACK") return "Rules fallback";
  if (row.qualification_audit?.decision_source === "SOURCE_GUARD") return "Source guard";
  if (row.qualification_audit?.discovery_provider) return row.qualification_audit.discovery_provider;
  const method = row.qualification_audit?.method;
  return method === "rules" || method === "gemini" || method === "openai-compatible"
    ? method
    : "—";
}

interface RequestRow {
  lead_id: string;
  message_id: string;
  state: string;
}

interface EmailTest {
  status: string;
  at: string;
  to: string;
  messageId: string;
  error: string;
}

interface StatusPayload {
  freshSince?:string|null;
  offset: number;
  store: { rows: LeadRow[]; requestRows: RequestRow[] };
  emailTest: EmailTest | null;
  stateFile?: string | null;
  directory?: string;
  aiHealth?: DiscoveryAiHealth;
  sourceHealth?: {
    origin: string;
    state: "OK" | "NO_NEW_BUYERS" | "NO_BUYER_CANDIDATES" | "UPSTREAM_ERROR";
    at: string;
    fetched?: number;
    error?: string;
    diagnostics?: {
      legacy_google_rows: number;
      pagespeed: { cached: number; deferred: number };
      latest_runs: { source: string; fetched: number; inserted: number; failed: number; state?:string;
        raw_count?:number|null; filtered_count?:number|null; accepted_count?:number|null; last_success_at?:string|null }[];
    };
  };
}

interface TogglePayload {
  enabled: boolean;
  configured: boolean;
  locked?: boolean;
}

type LiveSources = {
  sources:{sources:{id:string;label:string;ready:boolean;configuration?:string}[]};
  diagnostics:{source_state:{key:string;next_due_at?:string|null}[]};
};

const stages = [
  "External APIs",
  "Normalizer & Deduplicator",
  "Freelance Qualification",
  "Telegram Owner Digest",
  "Gmail Safe Owner-Test",
];

export function PipelineAiHealth({ health }: { health: DiscoveryAiHealth }) {
  const banner = discoveryAiBanner(health);
  return (
    <section className="note-panel" aria-label="AI provider status">
      <h2>AI provider status</h2>
      {banner && <p role="alert"><strong>{banner}</strong></p>}
      <p>Latest classification run · {health.finalizedBy.ai} by AI, {health.finalizedBy.rules} by rules, {health.finalizedBy.sourceGuard} by source check</p>
      {health.providers.length ? (
        <ul>{health.providers.map(provider => (
          <li key={provider.id}>{providerHealthLine(provider)}</li>
        ))}</ul>
      ) : <p>No AI providers were enabled and configured.</p>}
    </section>
  );
}
const attribution: Record<string,string> = {
  authorized_projects:"Authorized buyer briefs",
  hackernews:"Hacker News", wordpress_jobs_rss:"WordPress Jobs", freelancer_rss:"Freelancer",
  himalayas:"Himalayas", jobicy_rss:"Jobicy", remotive:"Remotive",
  uk_tender:"UK Find a Tender",
  uk_contracts_finder:"UK Contracts Finder",
};

const cell: CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderBottom: "1px solid rgba(127,127,127,0.25)",
  textAlign: "left",
  verticalAlign: "top",
  fontSize: "0.9rem",
};

const named: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** HN stores titles HTML-escaped. Decode for display only; stored data is untouched. */
function decode(value: string) {
  return (value || "").replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (match, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return named[body.toLowerCase()] ?? match;
    },
  );
}

function short(value: string, max = 120) {
  const text = decode(value).trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function PipelineDashboard() {
  const [toggle, setToggle] = useState<TogglePayload | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [liveSources,setLiveSources]=useState<LiveSources|null>(null);
  const [sourceConnection,setSourceConnection]=useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runState, setRunState] = useState<
    "idle" | "running" | "completed" | "error"
  >("idle");
  const [runMessage, setRunMessage] = useState("");
  const [collected, setCollected] = useState<{source: string; state: string; raw?: number; filtered?:number; fetched?: number;
    inserted?: number; duplicates?: number;filterReasons?:Record<string,number>}[]>([]);
  const [target, setTarget] = useState(500);
  const [resultFilter,setResultFilter]=useState("all");
  const [selected, setSelected] = useState(["hackernews","wordpress_jobs_rss","uk_tender","uk_contracts_finder"]);
  const businessControls=useRef<BusinessPipelineControls>(null);
  const [businessBusy,setBusinessBusy]=useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [toggleRes, statusRes, workers] = await Promise.all([
        fetch("/api/local/pipeline/toggle"),
        fetch("/api/local/pipeline/status"),
        fetch("/api/local/pipeline/sources",{signal:AbortSignal.timeout(5000)}).catch(()=>null),
      ]);
      if (!toggleRes.ok || !statusRes.ok) throw new Error("unavailable");
      setToggle((await toggleRes.json()) as TogglePayload);
      setStatus((await statusRes.json()) as StatusPayload);
      setLiveSources(workers?.ok?await workers.json():null);
      setSourceConnection(workers?.ok?"":"Could not reach the local lead API. Saved run results are shown below.");
    } catch {
      setError(
        "The local pipeline API is not available. Start the dashboard with npm run dev.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function flip() {
    setError("");
    try {
      const res = await fetch("/api/local/pipeline/toggle", { method: "POST", headers: { "X-LeadFlow-Local": "1" } });
      const data = (await res.json()) as TogglePayload & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update EXTERNAL_LEADS_ENABLED.");
        return;
      }
      setToggle(data);
    } catch {
      setError("Could not update EXTERNAL_LEADS_ENABLED.");
    }
  }

  async function run(action: "collect" | "run" | "complete" | "retry", imported=false) {
    setRunState("running");
    const refreshing = action === "complete" || action === "collect";
    if (refreshing) setCollected([]);
    setRunMessage(action==="complete"?"Polling sources and qualifying opportunities…":refreshing ? "Polling freelance sources…" : "Qualifying opportunities…");
    try {
      const res = await fetch(`/api/local/pipeline/${action}`, { method: "POST", headers: { "X-LeadFlow-Local": "1","Content-Type":"application/json" },
        ...(refreshing || action==="retry" ? {body:JSON.stringify({sources:selected,target})} : imported?{body:JSON.stringify({sources:["authorized_projects"],drain:true})}:{}) });
      const data = (await res.json()) as { status: string; error?: string; sources?: typeof collected };
      if (!res.ok || !["completed","partial"].includes(data.status)) {
        setRunState("error");
        setRunMessage(
          data.error || "The pipeline run failed. Check the terminal output.",
        );
      } else {
        setRunState("completed");
        setRunMessage(refreshing ? (data.status === "partial" ? "Some sources were unavailable. See source outcomes and qualification results." : "Run completed. See per-source results below.") : "Qualification completed.");
        if (refreshing) setCollected(data.sources ?? []);
      }
    } catch {
      setRunState("error");
      setRunMessage("The pipeline run could not be started.");
    } finally {
      await load();
    }
  }

  const rows = (status?.store?.rows ?? []).filter(lead => {
    const expires = lead.discovery_context?.expires_at;
    return !expires || Date.parse(expires) > Date.now();
  });
  const requests = status?.store?.requestRows ?? [];
  const emailTest = status?.emailTest ?? null;
  const enabled = toggle?.enabled ?? false;
  const configured = toggle?.configured ?? false;
  const counts = {raw:rows.length,accepted:rows.filter(row=>localReviewState(row)==="QUALIFIED").length,
    rejected:rows.filter(row=>localReviewState(row)==="REJECTED").length,review:rows.filter(row=>localReviewState(row)==="REVIEW").length,
    retries:rows.filter(row=>localReviewState(row)==="RETRY_CLASSIFICATION").length,
    enrichment:rows.filter(row=>localReviewState(row)==="AWAITING_ENRICHMENT").length};
  const health = status?.sourceHealth;
  const healthLabel = health ? {
    OK: "Buyer candidates received",
    NO_NEW_BUYERS: "No new buyer candidates since the last run",
    NO_BUYER_CANDIDATES: "No buyer candidates stored for the selected sources",
    UPSTREAM_ERROR: "Upstream request failed",
  }[health.state] : "Run the pipeline to check the upstream connection";
  const canRunFreelance=Boolean(enabled&&runState!=="running"&&selected.length&&target>=1&&target<=500);
  const processing=runState==="running"||businessBusy;

  return (
    <div className="container page">
      <div className="page-intro">
        <p className="eyebrow">LOCAL ONLY · DEVELOPMENT DASHBOARD</p>
        <h1>Pipeline control</h1>
        <p>
          Inspect and drive the local external-lead runner. These controls exist
          only while the Vite development server is running and never reach
          production.
        </p>
        <nav aria-label="Pipeline sections"><a href="#freelance">Freelance leads</a>{" · "}<a href="#businesses">Local businesses</a></nav>
      </div>

      <section className="note-panel" aria-label="Pipeline actions">
        <h2>Run a pipeline</h2>
        <div style={{display:"flex",flexWrap:"wrap",gap:"0.6rem"}}>
          <button className="button" disabled={!canRunFreelance} onClick={()=>void run("complete")}>Run Freelance Pipeline</button>
          <button className="button" disabled={businessBusy} onClick={()=>void businessControls.current?.run()}>Run Local Business Pipeline</button>
          <button className="button secondary" disabled={!canRunFreelance||businessBusy} onClick={()=>void Promise.all([run("complete"),businessControls.current?.run()])}>Run Both Pipelines</button>
          <button className="button secondary" disabled={businessBusy} onClick={()=>void businessControls.current?.metros()}>Run All Seven Indian Metros</button>
          <button className="button secondary" disabled={businessBusy} onClick={()=>void businessControls.current?.resume()}>Resume Pending Work</button>
          <button className="button secondary" disabled={processing} onClick={()=>void Promise.all([canRunFreelance?run("retry"):undefined,businessControls.current?.retry()])}>Retry Eligible Failures</button>
        </div>
        {processing && <p role="status"><progress aria-label="Pipeline processing" /> {runState==="running"&&businessBusy?"Both pipelines running":businessBusy?"Business evidence processing":"Freelance acquisition or qualification running"}</p>}
      </section>

      <LocalBusinessPanel controlsRef={businessControls} onBusy={setBusinessBusy} />

      <section id="freelance" className="note-panel">
        <h2>Freelance ingestion</h2>
        {!configured && !loading && (
          <p role="alert">
            <strong>.env.external is missing.</strong> Copy{" "}
            <code>.env.external.example</code> to <code>.env.external</code> at
            the repository root, then reload this page.
          </p>
        )}
        <p>
          <strong>{enabled ? "ON" : "OFF"}</strong> — EXTERNAL_LEADS_ENABLED
        </p>
        <details><summary>Advanced freelance controls and source selection</summary>
        <p>The default polls Hacker News buyer requests, WordPress projects and eligible UK tenders. Enable employment-oriented boards for diagnostics. Active source cooldowns are respected.</p>
        <fieldset><legend>Sources for the next poll</legend><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:"0.5rem"}}>
          {Object.entries(attribution).map(([source,label]) => <label key={source} style={{display:"flex",alignItems:"baseline",gap:"0.45rem"}}>
            <input type="checkbox" disabled={liveSources?.sources.sources.find(item=>item.id===source)?.ready===false} checked={selected.includes(source)} onChange={event => setSelected(current =>
              event.target.checked ? [...current,source] : current.filter(item=>item!==source))} /> {label}
          </label>)}
          </div>
          <label>Maximum new candidates <input type="number" min="1" max="500" value={target} onChange={event=>setTarget(Number(event.target.value))} /></label>
        </fieldset>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="button secondary"
            onClick={() => void flip()}
            disabled={loading || !configured || toggle?.locked}
          >
            {enabled ? "Turn pipeline off" : "Turn pipeline on"}
          </button>
          <button
            className="button secondary"
            onClick={() => void run("collect")}
            disabled={!enabled || runState === "running" || !selected.length || target < 1 || target > 500}
          >
            Refresh freelance feeds
          </button>
          <button
            className="button secondary"
            onClick={() => void run("run")}
            disabled={!enabled || runState === "running"}
          >
            Qualify next batch
          </button>
          <button className="button secondary" onClick={()=>void run("retry")} disabled={!enabled||!selected.length||runState==="running"}>Retry failed classifications</button>
          <button
            className="button secondary"
            onClick={() => void load()}
            disabled={loading || runState === "running"}
          >
            Reload results
          </button>
        </div>
        <AuthorizedProjectImport busy={!enabled||runState==="running"} onImported={()=>run("run",true)} />
        </details>
        {runMessage && <p role="status">{runMessage}</p>}
        {collected.length > 0 && <ul aria-label="Latest feed poll">
          {collected.map(source => <li key={source.source}>
            <strong>{attribution[source.source] || source.source}</strong> · {source.state} · {source.raw ?? 0} raw · {source.filtered ?? 0} filtered · {source.fetched ?? 0} fetched · {source.inserted ?? 0} new · {source.duplicates ?? 0} duplicates
            {source.filterReasons&&Object.keys(source.filterReasons).length>0&&<details><summary>Collector filter reasons</summary>
              <ul>{Object.entries(source.filterReasons).map(([reason,count])=><li key={reason}>{reason.replaceAll("_"," ")} · {count}</li>)}</ul>
            </details>}
          </li>)}
        </ul>}
        {emailTest && (
          <p role="status">
            <strong>Owner email test:</strong> {emailTest.status}
            {emailTest.to ? ` → ${emailTest.to}` : ""}
            {emailTest.error ? ` — ${emailTest.error}` : ""}
          </p>
        )}
      </section>

      {status?.aiHealth && <PipelineAiHealth health={status.aiHealth} />}

      <section className="note-panel" aria-label="Source health">
        <h2>Source health</h2>
        {sourceConnection && <p role="alert">{sourceConnection}</p>}
        {liveSources && <ul aria-label="Current source readiness">{liveSources.sources.sources.filter(source=>source.id in attribution).map(source=>{
          const due=liveSources.diagnostics.source_state.filter(item=>item.key===`board:${source.id}`||item.key.startsWith(`feed:${source.id}:`))
            .flatMap(item=>item.next_due_at??[]).sort().at(0);
          return <li key={source.id}><strong>{attribution[source.id]}</strong> · {source.ready?"Configured":source.configuration??"Unconfigured"}
            {due&&Date.parse(due)>Date.now()&&<> · Cooldown until <time dateTime={due}>{new Date(due).toLocaleString()}</time></>}</li>;
        })}</ul>}
        <p><strong>{healthLabel}</strong></p>
        {health && <p>Upstream <code>{health.origin}</code> · {health.fetched ?? 0} fetched · <time dateTime={health.at}>{new Date(health.at).toLocaleString()}</time></p>}
        {health?.error && <p role="alert">{health.error}</p>}
        {health?.diagnostics && (
          <>
            <p>PageSpeed · {health.diagnostics.pagespeed.cached} cached · {health.diagnostics.pagespeed.deferred} deferred. Google inventory · {health.diagnostics.legacy_google_rows} isolated.</p>
            <ul>
              {health.diagnostics.latest_runs.map((source) => (
                <li key={source.source}>
                  <strong>{attribution[source.source] || source.source}</strong> · {source.state || (source.failed ? "PROVIDER_UNAVAILABLE" : "OK")}
                  {source.raw_count != null && <> · {source.raw_count} raw, {source.filtered_count ?? 0} filtered, {source.accepted_count ?? 0} passed collector checks</>}
                  {source.last_success_at && <> · Last successful poll <time dateTime={source.last_success_at}>{new Date(source.last_success_at).toLocaleString()}</time></>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="Pipeline stages" style={{ margin: "1.5rem 0" }}>
        <ol
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {stages.map((stage, index) => (
            <li
              key={stage}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span
                style={{
                  border: "1px solid rgba(127,127,127,0.4)",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.85rem",
                }}
              >
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}{" "}
                </span>
                {stage}
              </span>
              {index < stages.length - 1 && <span aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Latest local results</h2>
        {status?.freshSince && <p>Fresh run since <time dateTime={status.freshSince}>{new Date(status.freshSince).toLocaleString()}</time>
          {" · "}{rows.filter(row=>row.created_at && row.created_at>=status.freshSince!).length} fresh
          {" · "}{rows.filter(row=>!row.created_at || row.created_at<status.freshSince!).length} earlier records</p>}
        <label>Show decisions <select value={resultFilter} onChange={event=>setResultFilter(event.target.value)}>
          <option value="all">All decisions</option>
          {Object.entries(discoveryLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <div
          aria-label="Qualification counts"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {[
            ["Raw candidates", counts.raw],
            ["Accepted", counts.accepted],
            ["Rejected", counts.rejected],
            ["Review", counts.review],
            ["AI retry", counts.retries],
            ["Missing source evidence", counts.enrichment],
          ].map(([label, count]) => (
            <span
              key={label}
              style={{
                border: "1px solid rgba(127,127,127,0.3)",
                borderRadius: "0.5rem",
                padding: "0.4rem 0.65rem",
                fontSize: "0.85rem",
              }}
            >
              {label}: <strong>{count}</strong>
            </span>
          ))}
        </div>
        {loading && <p role="status">Loading local pipeline state…</p>}
        {!loading && error && <p role="alert">{error}</p>}
        {!loading && !error && !enabled && (
          <p role="status">
            The pipeline is disabled. Turn it on to run a local pass.
          </p>
        )}
        {!loading && !error && rows.length === 0 && (
          <p role="status">
            No local leads yet. Run the pipeline to populate
            the latest local pipeline state.
          </p>
        )}
        {!loading && !error && status?.stateFile && (
          <p>Latest state <code>{status.directory || "data"}/{status.stateFile}</code></p>
        )}
        {!loading && !error && rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <caption
                style={{
                  textAlign: "left",
                  paddingBottom: "0.5rem",
                  fontSize: "0.85rem",
                }}
              >
                The owner email test is a single run-level receipt, shown on
                every row.
              </caption>
              <thead>
                <tr>
                  {[
                    "Candidate / company",
                    "Source",
                    "Decision",
                    "Advisory priority",
                    "Advisory score / confidence",
                    "Classification method",
                    "Qualification reason",
                    "Payment",
                    "Publisher engagement",
                    "Scope and skills",
                    "Contact path",
                    "Evidence highlights",
                    "Prior Telegram message ID",
                    "Email test",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      style={{ ...cell, fontWeight: 600 }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.filter(lead=>resultFilter==="all"||localReviewState(lead)===resultFilter).map((lead) => {
                  const request = requests.find(
                    (r) => r.lead_id === lead.lead_id,
                  );
                  const state = qualificationState(lead);
                  const qualification = lead.qualification;
                  const evidence = qualification?.evidence_quotes ?? [];
                  const context = lead.discovery_context;
                  const description = context?.decoded_text?.trim() || lead.raw_description?.trim();
                  const engagement = context?.provider_verified_engagement ?? qualification?.provider_signal?.engagement;
                  const scope = evidence.find(quote => quote.field === "scope")?.quote;
                  const contact = qualification?.contact_method;
                  const sourceLabel = attribution[context?.provider || ""] || lead.source;
                  const sourceLink = context?.provider === "himalayas" ? context.application_url : context?.original_url;
                  return (
                    <tr key={lead.lead_id}>
                      <td style={cell}>
                        <strong>{lead.title || lead.lead_id}</strong>
                        {lead.client_name_if_public && lead.client_name_if_public !== lead.title &&
                          <div>{lead.client_name_if_public}</div>}
                        {description ? (
                          <details style={{ minWidth: "14rem", maxWidth: "28rem", marginTop: "0.35rem" }}>
                            <summary style={{ cursor: "pointer" }}>Job description</summary>
                            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "20rem", overflowY: "auto", marginTop: "0.35rem" }}>
                              {description}
                            </div>
                          </details>
                        ) : <div>Job description unavailable</div>}
                      </td>
                      <td style={cell}>{sourceLink && /^https:\/\//.test(sourceLink)
                        ? <a href={sourceLink} target="_blank" rel="noreferrer">{sourceLabel}</a>
                        : sourceLabel}</td>
                      <td style={cell}>
                        <strong>{discoveryLabels[localReviewState(lead)]}</strong>
                      </td>
                      <td style={cell}>
                        {displayPriority(state, qualification?.priority)}
                      </td>
                      <td style={cell}>
                        {qualification
                          ? `${qualification.quality_score}/100 · ${Math.round(qualification.confidence_score * 100)}%`
                          : "—"}
                      </td>
                      <td style={cell}>{qualificationMethod(lead)}</td>
                      <td style={cell}>
                        {lead.qualification_audit?.discovery_semantics?.decision_reason ||
                          lead.extractionWarning || qualification?.rejection_reason ||
                          (state === "REJECTED" ? "No validated AI verdict" : "—")}
                        {lead.qualification_audit?.project_boundary && (
                          <div>{{
                            BOUNDED: "Defined project boundary",
                            ONGOING_SEAT: "Ongoing contractor seat",
                            UNVERIFIED: "Project boundary unverified",
                          }[lead.qualification_audit.project_boundary]}</div>
                        )}
                        {lead.qualification_audit?.discovery_semantics && (
                          <div>{lead.qualification_audit.discovery_semantics.lead_kind.replaceAll("_", " ")}</div>
                        )}
                      </td>
                      <td style={cell}>{paymentLabel(qualification?.budget_signal)}
                        {qualification?.budget_signal?.kind === "BOARD_PAID_INTENT_INFERRED" &&
                          <div>Paid intent inferred · 0 points</div>}
                      </td>
                      <td style={cell}>{engagement ? <strong>{engagement.value}</strong> : "—"}</td>
                      <td style={{ ...cell, minWidth: "12rem" }}>
                        <div>{scope || "Scope not located"}</div>
                        <div>{qualification?.required_skills?.join(", ") || "Skills not identified"}</div>
                      </td>
                      <td style={cell}>
                        {contact?.value ? (
                          contact.type === "APPLICATION_URL" || contact.type === "FORM_URL"
                            ? /^https:\/\/[^\s/@]+(?:[/:?#][^\s@]*)?$/i.test(contact.value)
                              ? <a href={contact.value} target="_blank" rel="noreferrer">Open application path</a>
                              : contact.value
                            : contact.value
                        ) : "Not found"}
                      </td>
                      <td style={cell}>
                        {evidence.length ? (
                          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                            {evidence.slice(0, 3).map((quote, index) => (
                              <li key={`${quote.field}-${index}`}>
                                <strong>{quote.field}:</strong>{" "}
                                {short(quote.quote, 100)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                        {evidence.length > 3 && (
                          <span> +{evidence.length - 3} more</span>
                        )}
                      </td>
                      <td style={cell}>{request?.message_id || "—"}</td>
                      <td style={cell}>
                        <div>{emailTest?.status || "—"}</div>
                        {emailTest?.error && (
                          <div
                            style={{
                              opacity: 0.7,
                              fontSize: "0.78rem",
                              marginTop: "0.2rem",
                            }}
                          >
                            {emailTest.error}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
