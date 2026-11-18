import { useCallback, useEffect, useState, type CSSProperties } from "react";

export type QualificationState =
  | "ELIGIBLE"
  | "REVIEW_INCOMPLETE"
  | "REJECTED"
  | "QUARANTINED"
  | "NEEDS_REQUALIFICATION";

export interface LeadRow {
  lead_id: string;
  title: string;
  client_name_if_public: string;
  source: string;
  discovery_context?: unknown;
  qualification_status?: string;
  qualification?: {
    is_valid_freelance_lead: boolean;
    eligibility_state: string;
    priority: string;
    quality_score: number;
    confidence_score: number;
    rejection_reason: string | null;
    evidence_quotes: { field: string; quote: string }[];
  };
  qualification_audit?: { method: string };
  extractionWarning: string;
  status: string;
}

export function qualificationState(row: LeadRow): QualificationState {
  const state = row.qualification?.eligibility_state;
  if (
    state === "ELIGIBLE" ||
    state === "REVIEW_INCOMPLETE" ||
    state === "REJECTED" ||
    state === "QUARANTINED"
  ) {
    if (
      (state === "ELIGIBLE" && !row.qualification?.is_valid_freelance_lead) ||
      (state !== "ELIGIBLE" && row.qualification?.is_valid_freelance_lead)
    ) {
      return "NEEDS_REQUALIFICATION";
    }
    return state;
  }
  return "NEEDS_REQUALIFICATION";
}

export function qualificationCounts(rows: LeadRow[]) {
  const counts = {
    raw: rows.length,
    eligible: 0,
    high: 0,
    medium: 0,
    low: 0,
    rejected: 0,
    incomplete: 0,
    quarantined: 0,
    needsRequalification: 0,
  };

  for (const row of rows) {
    const state = qualificationState(row);
    if (state === "ELIGIBLE" && row.qualification?.is_valid_freelance_lead) {
      if (row.qualification?.priority === "HIGH") {
        counts.eligible++;
        counts.high++;
      } else if (row.qualification?.priority === "MEDIUM") {
        counts.eligible++;
        counts.medium++;
      } else if (row.qualification?.priority === "LOW") {
        counts.low++;
      }
    } else if (state === "REJECTED") {
      counts.rejected++;
    } else if (state === "REVIEW_INCOMPLETE") {
      counts.incomplete++;
    } else if (state === "QUARANTINED") {
      counts.quarantined++;
    } else {
      counts.needsRequalification++;
    }
  }
  return counts;
}

function qualificationMethod(row: LeadRow) {
  const method = row.qualification_audit?.method;
  return method === "rules" || method === "gemini" ? method : "—";
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
  offset: number;
  store: { rows: LeadRow[]; requestRows: RequestRow[] };
  emailTest: EmailTest | null;
}

interface TogglePayload {
  enabled: boolean;
  configured: boolean;
}

const stages = [
  "External APIs",
  "Normalizer & Deduplicator",
  "Freelance Qualification",
  "Telegram Owner Digest",
  "Gmail Safe Owner-Test",
];

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runState, setRunState] = useState<
    "idle" | "running" | "completed" | "error"
  >("idle");
  const [runMessage, setRunMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [toggleRes, statusRes] = await Promise.all([
        fetch("/api/local/pipeline/toggle"),
        fetch("/api/local/pipeline/status"),
      ]);
      if (!toggleRes.ok || !statusRes.ok) throw new Error("unavailable");
      setToggle((await toggleRes.json()) as TogglePayload);
      setStatus((await statusRes.json()) as StatusPayload);
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
      const res = await fetch("/api/local/pipeline/toggle", { method: "POST" });
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

  async function run() {
    setRunState("running");
    setRunMessage("Running the external pipeline…");
    try {
      const res = await fetch("/api/local/pipeline/run", { method: "POST" });
      const data = (await res.json()) as { status: string; error?: string };
      if (!res.ok || data.status !== "completed") {
        setRunState("error");
        setRunMessage(
          data.error || "The pipeline run failed. Check the terminal output.",
        );
      } else {
        setRunState("completed");
        setRunMessage("Pipeline run completed.");
      }
    } catch {
      setRunState("error");
      setRunMessage("The pipeline run could not be started.");
    } finally {
      await load();
    }
  }

  const rows = status?.store?.rows ?? [];
  const requests = status?.store?.requestRows ?? [];
  const emailTest = status?.emailTest ?? null;
  const enabled = toggle?.enabled ?? false;
  const configured = toggle?.configured ?? false;
  const counts = qualificationCounts(rows);

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
      </div>

      <section className="note-panel">
        <h2>External ingestion</h2>
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
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="button secondary"
            onClick={() => void flip()}
            disabled={loading || !configured}
          >
            {enabled ? "Turn pipeline off" : "Turn pipeline on"}
          </button>
          <button
            className="button"
            onClick={() => void run()}
            disabled={!enabled || runState === "running"}
          >
            {runState === "running" ? "Running…" : "Run Full Pipeline Now"}
          </button>
          <button
            className="button secondary"
            onClick={() => void load()}
            disabled={loading || runState === "running"}
          >
            Refresh
          </button>
        </div>
        {runMessage && <p role="status">{runMessage}</p>}
        {emailTest && (
          <p role="status">
            <strong>Owner email test:</strong> {emailTest.status}
            {emailTest.to ? ` → ${emailTest.to}` : ""}
            {emailTest.error ? ` — ${emailTest.error}` : ""}
          </p>
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
            ["Eligible opportunities (HIGH/MEDIUM)", counts.eligible],
            ["Low", counts.low],
            ["Rejected", counts.rejected],
            ["Incomplete", counts.incomplete],
            ["Quarantined", counts.quarantined],
            ["Needs requalification", counts.needsRequalification],
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
            data/external-gemini.json.
          </p>
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
                    "Eligibility",
                    "Priority",
                    "Quality score / confidence",
                    "Classification method",
                    "Primary rejection reason",
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
                {rows.map((lead) => {
                  const request = requests.find(
                    (r) => r.lead_id === lead.lead_id,
                  );
                  const state = qualificationState(lead);
                  const qualification = lead.qualification;
                  const evidence = qualification?.evidence_quotes ?? [];
                  return (
                    <tr key={lead.lead_id}>
                      <td style={cell}>
                        {short(
                          lead.client_name_if_public ||
                            lead.title ||
                            lead.lead_id,
                        )}
                      </td>
                      <td style={cell}>{lead.source}</td>
                      <td style={cell}>
                        {state}
                      </td>
                      <td style={cell}>
                        {qualification?.priority || "—"}
                      </td>
                      <td style={cell}>
                        {qualification
                          ? `${qualification.quality_score}/100 · ${Math.round(qualification.confidence_score * 100)}%`
                          : "—"}
                      </td>
                      <td style={cell}>{qualificationMethod(lead)}</td>
                      <td style={cell}>
                        {qualification?.rejection_reason ||
                          (state === "NEEDS_REQUALIFICATION" ? state : "—")}
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
