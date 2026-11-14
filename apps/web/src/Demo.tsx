import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  Home,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { qualifyEnquiry, type Enquiry } from "../../../packages/core/enquiry";

const scenarios: Enquiry[] = [
  {
    name: "Aarav (sample)",
    service: "Buy a home",
    budget: "₹60–90 lakh",
    date: "Saturday afternoon",
    urgency: "This month",
    question:
      "I’m looking for a 2-bedroom apartment in Baner, Pune. Can we discuss available options?",
    consent: true,
  },
  {
    name: "Mira (sample)",
    service: "Property consultation",
    budget: "Not decided",
    date: "Next week",
    urgency: "Exploring",
    question:
      "I’m comparing neighbourhoods in Pune and would like help understanding the buying process.",
    consent: true,
  },
  {
    name: "Dev (sample)",
    service: "Sell a property",
    budget: "₹90 lakh+",
    date: "Friday morning",
    urgency: "Within 3 months",
    question:
      "I’d like to understand the process for selling a 3-bedroom apartment in Wakad.",
    consent: false,
  },
];
const stages = ["New", "Qualified", "Contacted", "Booked", "Won"];
const tourSteps = [
  { title: 'Start with a genuine need', text: 'A fictional buyer wants a 2-bedroom apartment in Pune. We have filled in a sample enquiry so you can follow the whole journey.', target: 'tour-enquiry' },
  { title: 'Turn a message into useful details', text: 'The enquiry becomes a structured lead: service, budget, timing and permission. The owner can understand the request at a glance.', target: 'tour-summary' },
  { title: 'See what deserves attention', text: 'The score explains each factor. Missing details lower the score; the owner can see what to clarify. It is not a prediction of a sale.', target: 'tour-score' },
  { title: 'Put the decision on your phone', text: 'The owner receives a Telegram-style alert with approval, defer and reject controls. A person decides the next step.', target: 'tour-alert' },
  { title: 'Review a specific response', text: 'We simulate approval: the CRM says Draft ready and a response uses the buyer’s actual requirements. The public demo sends nothing.', target: 'tour-draft' },
  { title: 'A clear next step, with you in control', text: 'Enquiry → qualification → owner review → follow-up. A connected business can send an opt-in email after explicit owner approval. Explore freely or discuss your own workflow.', target: 'tour-crm' },
];
export function Demo() {
  const [tour, setTour] = useState(-1);
  const tourHeading = useRef<HTMLHeadingElement>(null);
  const tourStart = useRef<HTMLButtonElement>(null);
  const [scenario, setScenario] = useState(0);
  const [form, setForm] = useState<Enquiry>({ ...scenarios[0] });
  const [result, setResult] = useState<ReturnType<
    typeof qualifyEnquiry
  > | null>(null);
  const [decision, setDecision] = useState<
    "pending" | "draft" | "review" | "rejected"
  >("pending");
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (tour < 0) return;
    tourHeading.current?.focus({preventScroll:true});
    document.getElementById(tourSteps[tour].target)?.scrollIntoView({block:'start',behavior:'instant'});
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setTour(-1); tourStart.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [tour]);
  function goToTourStep(next: number) {
    setScenario(0); setForm({...scenarios[0]}); setError(''); setCopied(false);
    setResult(next === 0 ? null : qualifyEnquiry(scenarios[0]));
    setStage(next === 0 ? 0 : 1); setDecision(next >= 4 ? 'draft' : 'pending'); setTour(next);
  }
  function endTour() { setTour(-1); tourStart.current?.focus(); }
  function reset(index = scenario) {
    setTour(-1);
    setForm({ ...scenarios[index] });
    setResult(null);
    setDecision("pending");
    setStage(0);
    setError("");
    setCopied(false);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const value = qualifyEnquiry(form);
      setResult(value);
      setStage(1);
      setDecision("pending");
      setError("");
    } catch {
      setError(
        "Add a sample name, preferred time and a question with at least 15 characters.",
      );
    }
  }
  function change<K extends keyof Enquiry>(key: K, value: Enquiry[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
    setStage(0);
    setDecision("pending");
  }
  return (
    <div className="container demo-page">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">THE LEADFLOW AI EXPERIENCE</p>
          <h1>
            From “hello” to
            <br />
            <span>a clear next step.</span>
          </h1>
          <p>
            Send an enquiry. Watch it take shape. Step into the owner’s shoes.
          </p>
        </div>
        <div className="simulation-label">
          <ShieldCheck size={19} />
          <div>
            <strong>Interactive simulation</strong>
            <span>
              Fictional data. No messages sent.
              <br />
              Everything stays in this page’s memory.
            </span>
          </div>
        </div>
      </div>
      <div className="guided-demo-entry">
        <button ref={tourStart} className="button" onClick={() => goToTourStep(0)}><Sparkles size={17}/> Start guided demo</button>
        <span>6 short steps · About 60–90 seconds · Or explore freely below</span>
      </div>
      {tour >= 0 && <section className="guided-tour" aria-label="Guided product tour">
        <div className="tour-progress" role="progressbar" aria-label="Guided demo progress" aria-valuemin={1} aria-valuemax={6} aria-valuenow={tour+1}>{tourSteps.map((step,i) => <span key={step.title} className={i <= tour ? 'complete' : ''}/>)}</div>
        <div className="tour-copy" aria-live="polite"><p className="eyebrow">STEP {tour + 1} OF 6 · SIMULATION</p><h2 ref={tourHeading} tabIndex={-1}>{tourSteps[tour].title}</h2><p>{tourSteps[tour].text}</p></div>
        <div className="tour-controls"><button className="text-link" onClick={endTour}>Exit tour</button><div>{tour > 0 && <button className="button secondary small" onClick={() => goToTourStep(tour - 1)}>Previous step</button>}{tour < 5 ? <button className="button small" onClick={() => goToTourStep(tour + 1)}>Next step <ArrowRight size={15}/></button> : <><button className="button secondary small" onClick={endTour}>Finish guided demo</button><Link className="button small" to="/contact">Discuss your workflow <ArrowRight size={15}/></Link></>}</div></div>
      </section>}
      <div className="scenario-bar">
        <span>TRY A SCENARIO</span>
        <div>
          {["Find a home", "Book a consultation", "Sell a property"].map(
            (s, i) => (
              <button
                key={s}
                className={scenario === i ? "selected" : ""}
                aria-pressed={scenario === i}
                onClick={() => {
                  setScenario(i);
                  reset(i);
                }}
              >
                {s}
              </button>
            ),
          )}
        </div>
        <button className="reset-button" onClick={() => reset()}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
      <div className="demo-workspace">
        <section id="tour-enquiry" className={'intake-panel '+(tour===0?'tour-highlight':'')}>
          <div className="panel-heading">
            <span className="step-badge">01</span>
            <div>
              <h2>The visitor’s enquiry</h2>
              <p>A simple, purposeful intake.</p>
            </div>
          </div>
          <div className="fictional-brand">
            <Home size={20} />
            <div>
              Greenway Properties
              <small>Fictional property consultancy · Pune</small>
            </div>
            <span className="pill">DEMO</span>
          </div>
          <form onSubmit={submit}>
            <label>
              Sample name
              <input
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
                required
                minLength={2}
                maxLength={60}
                autoComplete="off"
              />
            </label>
            <label>
              I’m interested in
              <select
                value={form.service}
                onChange={(e) =>
                  change("service", e.target.value as Enquiry["service"])
                }
              >
                {["Buy a home", "Property consultation", "Sell a property"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <div className="form-row">
              <label>
                Budget range
                <select
                  value={form.budget}
                  onChange={(e) =>
                    change("budget", e.target.value as Enquiry["budget"])
                  }
                >
                  {[
                    "Not decided",
                    "₹40–60 lakh",
                    "₹60–90 lakh",
                    "₹90 lakh+",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Timeframe
                <select
                  value={form.urgency}
                  onChange={(e) =>
                    change("urgency", e.target.value as Enquiry["urgency"])
                  }
                >
                  {["Exploring", "Within 3 months", "This month"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Preferred conversation time
              <input
                value={form.date}
                onChange={(e) => change("date", e.target.value)}
                required
                maxLength={40}
              />
            </label>
            <label>
              How can we help?
              <textarea
                rows={3}
                value={form.question}
                onChange={(e) => change("question", e.target.value)}
                required
                minLength={15}
                maxLength={1000}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => change("consent", e.target.checked)}
              />
              <span>
                Simulate permission to contact me about this enquiry.
                <small>
                  This tests the consent gate. Please use sample details only.
                </small>
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button full" type="submit">
              Run the enquiry <Sparkles size={17} />
            </button>
            <p className="form-footnote">
              No account, email address or phone number needed.
            </p>
          </form>
        </section>
        <section
          className="results-panel"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="panel-heading">
            <span className="step-badge">02</span>
            <div>
              <h2>What the owner receives</h2>
              <p>Useful information. A decision you own.</p>
            </div>
            <span className="pill muted">SIMULATED</span>
          </div>
          {!result ? (
            <div className="demo-empty">
              <div className="empty-orbit">
                <Sparkles size={30} />
              </div>
              <h3>A message becomes a next step.</h3>
              <p>
                Run the sample enquiry to reveal its qualification, CRM entry
                and owner alert.
              </p>
              <div>
                <span>Enquiry</span>
                <ArrowRight size={16} />
                <span>Clarity</span>
                <ArrowRight size={16} />
                <span>Action</span>
              </div>
            </div>
          ) : (
            <>
              <div id="tour-summary" className={'result-summary '+(tour===1?'tour-highlight':'')}>
                <div>
                  <span className="pill">{result.priority}</span>
                  <h3>{result.enquiry.name}</h3>
                  <p>
                    {result.enquiry.service} · {result.enquiry.urgency}
                  </p>
                </div>
                <div className="big-score">
                  {result.score}
                  <small>/100</small>
                </div>
              </div>
              <div id="tour-score" className={'score-breakdown '+(tour===2?'tour-highlight':'')}>
                {result.breakdown.map((b) => (
                  <div key={b.label}>
                    <span>{b.label}</span>
                    <div className="score-track">
                      <i style={{ width: `${(b.value / b.max) * 100}%` }} />
                    </div>
                    <strong>
                      {b.value}/{b.max}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="rule-note">
                Demo rules, not a live AI call. Identity is unverified. Score
                indicates completeness and fit; it does not predict a sale.
              </p>
              <div
                className={
                  "permission " + (!result.enquiry.consent ? "blocked" : "")
                }
              >
                <ShieldCheck size={16} />
                {result.permission}
              </div>
              <div id="tour-crm" className={'crm-preview '+(tour===5?'tour-highlight':'')}>
                <div className="mini-label">MOCK CRM ENTRY</div>
                <dl>
                  <div>
                    <dt>Service</dt>
                    <dd>{result.enquiry.service}</dd>
                  </div>
                  <div>
                    <dt>Budget</dt>
                    <dd>{result.enquiry.budget}</dd>
                  </div>
                  <div>
                    <dt>Preferred time</dt>
                    <dd>{result.enquiry.date}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {decision === "rejected"
                        ? "Rejected"
                        : decision === "review"
                          ? "Deferred for review"
                          : decision === "draft"
                            ? "Draft ready"
                            : stages[stage]}
                    </dd>
                  </div>
                </dl>
              </div>
              <div id="tour-alert" className={'owner-alert '+(tour===3?'tour-highlight':'')}>
                <div className="alert-label">
                  <Send size={16} />
                  <strong>LeadFlow owner alert</strong>
                  <span>Telegram preview</span>
                </div>
                <p>{result.summary}</p>
                <small>{result.next}</small>
                <div className="alert-actions">
                  <button
                    disabled={decision !== "pending"}
                    onClick={() => setDecision("draft")}
                  >
                    Approve draft <Check size={13} />
                  </button>
                  <button
                    disabled={decision !== "pending"}
                    onClick={() => setDecision("review")}
                  >
                    Review later
                  </button>
                  <button
                    disabled={decision !== "pending"}
                    onClick={() => setDecision("rejected")}
                  >
                    Reject
                  </button>
                </div>
              </div>
              {decision === "draft" && (
                <div id="tour-draft" className={'draft-preview '+(tour===4?'tour-highlight':'')}>
                  <div className="mini-label">
                    SUGGESTED RESPONSE · REVIEW BEFORE USE
                  </div>
                  {!result.enquiry.consent && (
                    <p className="form-error">
                      Follow-up is blocked. Obtain permission before sending.
                    </p>
                  )}
                  <p>{result.suggestion}</p>
                  <button
                    className="text-link"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(result.suggestion);
                        setCopied(true);
                      } catch {
                        setError(
                          "Clipboard unavailable. Select and copy the draft text.",
                        );
                      }
                    }}
                  >
                    <Copy size={14} />
                    {copied ? "Copied sample draft" : "Copy sample draft"}
                  </button>
                  <small>
                    <CheckCheck size={13} /> Draft only. No message has been
                    sent.
                  </small>
                </div>
              )}
              {decision === "review" && (
                <p className="decision-note">
                  Deferred. In the connected workflow, this appears in the
                  owner’s follow-up queue.
                </p>
              )}
              {decision === "rejected" && (
                <p className="decision-note">
                  Rejected. The simulated workflow stops here.
                </p>
              )}
              <div className="pipeline-section">
                <span className="mini-label">
                  EXPLORE THE LATER STAGES · SIMULATION
                </span>
                <div className="pipeline">
                  {stages.map((s, i) => (
                    <button
                      key={s}
                      className={stage === i ? "active" : ""}
                      onClick={() => setStage(i)}
                      aria-pressed={stage === i}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p>
                  {
                    [
                      "Enquiry captured with the visitor’s stated details.",
                      "Requirements organized for owner review.",
                      "A human confirms they sent a response through a permitted channel.",
                      "A human confirms a mutually agreed appointment. No booking is made here.",
                      "A human records the agreed outcome. This sample is not revenue.",
                    ][stage]
                  }
                </p>
              </div>
            </>
          )}
        </section>
      </div>
      <div className="demo-bottom">
        <div>
          <h2>Picture this with your business.</h2>
          <p>Your services, your questions, your next steps.</p>
        </div>
        <Link to="/contact" className="button">
          Talk about your workflow <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
