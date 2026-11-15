import { useCallback, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { inboundSchema } from "../../../packages/core/intake";
import { Turnstile } from "../../web/src/Turnstile";
import { brand, plans } from "./content";
export function AuditForm({
  selectedPlan,
  onPlan,
}: {
  selectedPlan: string;
  onPlan: (id: string) => void;
}) {
  const [id, setId] = useState(() => crypto.randomUUID());
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [brief, setBrief] = useState("");
  const live =
    import.meta.env.VITE_MARKETING_INTAKE_ENABLED === "true" &&
    Boolean(import.meta.env.VITE_MARKETING_TURNSTILE_SITE_KEY);
  const securityError = useCallback(
    () =>
      setError(
        "The security check could not load. Please refresh and try again.",
      ),
    [],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const data = new FormData(event.currentTarget);
    const details = String(data.get("details") || "").trim();
    if (details.length < 20) {
      setError("Please describe your business goal in at least 20 characters.");
      return;
    }
    const plan = plans.find((p) => p.id === selectedPlan);
    const goal = `Digital marketing audit request. Service: ${data.get("service")}. Package: ${plan?.name || "Help me choose"}. Monthly ad spend (separate from service fees): ${data.get("spend")}. Business website: ${data.get("url") || "Not supplied"}.\n${details}`;
    const parsed = inboundSchema.safeParse({
      submission_id: id,
      name: data.get("name"),
      email: data.get("email"),
      business: data.get("business"),
      goal,
      budget: "I’d like guidance",
      consent: data.get("consent") === "on",
      consent_version: "enquiry-email-v1",
      vertical: brand.vertical,
      brand: brand.name,
    });
    if (!parsed.success) {
      setError(
        "Check your name, email, business details and permission to reply.",
      );
      return;
    }
    if (data.get("website")) {
      setError("Request rejected.");
      return;
    }
    if (!live) {
      setBrief(
        `Signal & Slate growth audit brief\nName: ${parsed.data.name}\nEmail: ${parsed.data.email}\nBusiness: ${parsed.data.business}\nvertical: digital-marketing\nbrand: Signal & Slate\n${goal}\nConsent: reply about this enquiry only.\nPrepared locally. Nothing has been sent.`,
      );
      return;
    }
    if (!token) {
      setError("Please complete the security check before sending.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          turnstile_token: token,
          website: "",
        }),
        signal: AbortSignal.timeout(35000),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        reference?: string;
        error?: string;
      };
      if (
        !response.ok ||
        !result.ok ||
        !/^lf_[a-f0-9]{16}$/.test(result.reference || "")
      )
        throw Error(
          result.error || "Receipt could not be confirmed. Please retry.",
        );
      setReceipt(result.reference!);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Delivery could not be confirmed. Please retry.",
      );
      setToken("");
      setReset((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="audit-card">
      {receipt ? (
        <div role="status" className="receipt">
          <CheckCircle2 />
          <p className="kicker">ENQUIRY RECEIVED</p>
          <h3>We have your brief.</h3>
          <p>
            We’ll review it and reply by email. This confirms receipt, not a
            quote or a promised result.
          </p>
          <p>
            Reference <strong>{receipt}</strong>
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setReceipt("");
              setId(crypto.randomUUID());
              setToken("");
              setReset((v) => v + 1);
            }}
          >
            Start a new enquiry
          </button>
        </div>
      ) : brief ? (
        <div role="status" className="receipt">
          <p className="kicker">LOCAL PREVIEW</p>
          <h3>Your audit brief is ready.</h3>
          <p>
            Nothing has been sent. Copy this brief into an email to{" "}
            <a href={"mailto:" + brand.email}>{brand.email}</a>.
          </p>
          <pre>{brief}</pre>
          <button className="button secondary" onClick={() => setBrief("")}>
            Edit my brief
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <div className="form-title">
            <span className="kicker">A USEFUL FIRST CONVERSATION</span>
            <span className="small-star">✳</span>
          </div>
          <h3>Let’s find your signal.</h3>
          <p className="form-intro">
            Tell us what you’re growing. We’ll start with the right questions.
          </p>
          {!live && (
            <p className="local-notice">
              Preview mode — this form prepares a local brief. Email delivery is
              not connected for this website yet.
            </p>
          )}
          <div className="form-pair">
            <label>
              Your name
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
            <label>
              Work email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={160}
              />
            </label>
          </div>
          <label>
            Business / brand
            <input
              name="business"
              autoComplete="organization"
              required
              maxLength={120}
            />
          </label>
          <label>
            Website or social profile (optional)
            <input
              name="url"
              type="url"
              maxLength={200}
              placeholder="https://"
            />
          </label>
          <div className="form-pair">
            <label>
              Primary focus
              <select name="service" defaultValue="Meta Ads & lead generation">
                <option>Meta Ads & lead generation</option>
                <option>Technical & local SEO</option>
                <option>Analytics & reporting</option>
                <option>Social media management</option>
                <option>A joined-up strategy</option>
              </select>
            </label>
            <label>
              Package
              <select
                name="package"
                aria-label="Package"
                value={selectedPlan}
                onChange={(e) => onPlan(e.target.value)}
              >
                <option value="">Help me choose</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Monthly ad spend
            <select name="spend" defaultValue="Not decided">
              <option>Not decided</option>
              <option>Under ₹15,000</option>
              <option>₹15,000–₹50,000</option>
              <option>₹50,000–₹1,00,000</option>
              <option>₹1,00,000+</option>
            </select>
          </label>
          <label>
            What would you like to change?
            <textarea
              name="details"
              required
              minLength={20}
              maxLength={1400}
              rows={3}
              placeholder="Your offer, your audience, and where growth feels stuck…"
            />
          </label>
          <label hidden>
            Leave this blank
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="consent">
            <input name="consent" type="checkbox" required />
            <span>
              I agree to email about this enquiry and the processing in the{" "}
              <a href="#privacy">privacy information</a>, including AI-assisted
              preparation of an owner-reviewed reply.
            </span>
          </label>
          {live && (
            <Turnstile
              siteKey={import.meta.env.VITE_MARKETING_TURNSTILE_SITE_KEY}
              resetKey={reset}
              onVerify={setToken}
              onError={securityError}
            />
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="button submit" disabled={busy}>
            {busy
              ? "Sending your enquiry…"
              : live
                ? "Request my growth audit"
                : "Prepare my audit brief"}
            <ArrowUpRight size={17} />
          </button>
          <p className="form-footnote">
            No mailing list. No ad account access required for this enquiry.
          </p>
        </form>
      )}
    </div>
  );
}
