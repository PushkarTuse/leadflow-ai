import { useEffect, useState } from "react";
import type { readCommercialLedger } from "../../../scripts/commercial-ledger";

type Activity = Awaited<ReturnType<typeof readCommercialLedger>>;
type CommercialState = { applications: Activity; ownerCheck?: {
  email?: { state: string; messageId?: string; mailboxVerifiedAt?: string }; telegram?: { state: string; messageId?: number };
} };

const stageName = (stage: string) => stage.toLowerCase().replaceAll("_", " ");

export function CommercialPipeline() {
  const [activity, setActivity] = useState<CommercialState>();
  const [error, setError] = useState("");
  async function refresh(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/local/pipeline/commercial", { signal });
      if (!response.ok) throw new Error();
      setActivity(await response.json() as CommercialState);
      setError("");
    } catch {
      if (!signal?.aborted) setError("Could not read the local sales activity.");
    }
  }
  useEffect(() => {
    const request = new AbortController();
    void refresh(request.signal);
    return () => request.abort();
  }, []);
  const rows = activity?.applications ?? [];
  const counts = [
    ["Pending approval", rows.filter(row => row.state === "AWAITING_APPROVAL").length],
    ["Applications with send receipts", rows.filter(row => row.receipt).length],
    ["Replies", rows.reduce((total, row) => total + row.replyIds.length, 0)],
    ["Meetings scheduled", rows.filter(row => row.state === "MEETING_SCHEDULED").length],
    ["Follow-ups due", rows.filter(row => row.followUpDue).length],
    ["In negotiation", rows.filter(row => ["NEGOTIATION", "PROPOSAL_PREPARED"].includes(row.state)).length],
    ["Won", rows.filter(row => row.state === "WON").length],
    ["Lost", rows.filter(row => row.state === "LOST").length],
  ] as const;
  return <section id="commercial" className="note-panel">
    <h2>Sales activity</h2>
    <p>Recorded sales outcomes are separate from acquisition, qualification, and owner-only tests.</p>
    <button type="button" onClick={() => void refresh()}>Refresh sales activity</button>
    {error && <p role="alert">{error}</p>}
    {activity ? <ul className="pipeline-filters" aria-label="Commercial totals">{counts.map(([title, count]) =>
      <li key={title}>{title} <strong>{count}</strong></li>)}</ul> : <p role="status">Loading sales activity…</p>}
    {activity?.ownerCheck && <p>Owner-only test · SMTP {stageName(activity.ownerCheck.email?.state ?? "pending")}
      {activity.ownerCheck.email?.mailboxVerifiedAt && " · Gmail inbox verified"} · Telegram {stageName(activity.ownerCheck.telegram?.state ?? "pending")}</p>}
    {rows.map(row => <article className="pipeline-draft-preview" key={row.id}>
      <h3>{row.title}</h3>
      <p><strong>{stageName(row.state)}</strong> · {stageName(row.channel)} · {row.assignedTo}</p>
      <p>{row.nextAction}</p>
      {row.receipt && <p>Provider receipt <code>{row.receipt.messageId}</code></p>}
      {row.receipt && <p>Owner Telegram · {row.ownerNotification ? stageName(row.ownerNotification.state) : "No alert recorded"}
        {row.ownerNotification?.messageId && <> · message {row.ownerNotification.messageId}</>}</p>}
      {row.lastReplyAssessment && <p>Latest reply · {stageName(row.lastReplyAssessment)} · Review in the original thread</p>}
      {row.draft && <details>
        <summary>Exact application draft</summary>
        <p>From {row.draft.from} · To {row.draft.to}</p>
        <p><strong>{row.draft.subject}</strong></p>
        <pre>{row.draft.body}</pre>
        {row.draft.html && <details><summary>HTML version</summary><iframe title="Application HTML preview" sandbox=""
          srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'">${row.draft.html}`} /></details>}
        <p>{row.draft.attachments.length} attachments · {row.draft.bookingUrl ? "Booking link included" : "No booking link configured"}</p>
        <p>Version <code>{row.draftHash}</code></p>
      </details>}
      <p><a href={row.source} target="_blank" rel="noreferrer">Open original listing</a></p>
    </article>)}
  </section>;
}
