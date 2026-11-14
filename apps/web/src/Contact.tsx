import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Download,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { LiveContact } from './LiveContact';
import { contactSchema } from "../../../packages/core/enquiry";
function allowedUrl(raw: string | undefined, host: string) {
  try {
    const u = new URL(raw || "");
    return u.protocol === "https:" &&
      (u.hostname === host || u.hostname.endsWith("." + host))
      ? u.href
      : "";
  } catch {
    return "";
  }
}
const tally = allowedUrl(import.meta.env.VITE_TALLY_URL, "tally.so");
const cal = allowedUrl(import.meta.env.VITE_CAL_URL, "cal.com");
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
  import.meta.env.VITE_CONTACT_EMAIL || "",
)
  ? import.meta.env.VITE_CONTACT_EMAIL
  : "";
export function Contact(){return import.meta.env.VITE_INTAKE_ENABLED==='true'?<LiveContact/>:<OfflineContact/>;}
function OfflineContact() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [brief, setBrief] = useState("");
  const [notice, setNotice] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const result = contactSchema.safeParse({
      name: d.get("name"),
      email: d.get("email"),
      business: d.get("business"),
      goal: d.get("goal"),
      budget: d.get("budget"),
      consent: d.get("consent") === "on",
    });
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      );
      return;
    }
    setErrors({});
    const f = result.data;
    setBrief(
      `Project enquiry\nName: ${f.name}\nEmail: ${f.email}\nBusiness: ${f.business}\nBudget: ${f.budget}\nGoal: ${f.goal}\nPermission: contact me about this project only.\nNo submission has been made by this page.`,
    );
  }
  return (
    <div className="container page contact-page">
      <div className="contact-copy">
        <p className="eyebrow">LET’S BUILD SOMETHING USEFUL</p>
        <h1>
          What’s your
          <br />
          next step?
        </h1>
        <p>
          Tell us what you do, where enquiries get stuck and what a better
          workflow would look like.
        </p>
        <div className="contact-points">
          <p>
            <CheckCircle2 size={18} /> A focused scope, shaped around your needs
          </p>
          <p>
            <CheckCircle2 size={18} /> Clear pricing before work begins
          </p>
          <p>
            <CheckCircle2 size={18} /> Your accounts and your approval
          </p>
        </div>
        {cal && (
          <a
            href={cal}
            target="_blank"
            rel="noreferrer"
            className="button secondary"
          >
            Schedule an introduction <ArrowUpRight size={17} />
          </a>
        )}
        {email && (
          <a className="text-link" href={"mailto:" + email}>
            <Mail size={16} />
            {email}
          </a>
        )}
        <div className="privacy-note">
          <ShieldCheck size={20} />
          <p>
            Use only the information needed to describe your project.{" "}
            <Link to="/privacy">Read the privacy draft</Link>.
          </p>
        </div>
      </div>
      <section className="contact-form-card">
        <p className="eyebrow">YOUR PROJECT BRIEF</p>
        {tally ? (
          <>
            <h2>Send your enquiry.</h2>
            <p>
              Our hosted enquiry form collects your project details and
              permission to respond. It opens in a new tab and shows a
              confirmation after submission.
            </p>
            <a
              className="button full"
              href={tally}
              target="_blank"
              rel="noreferrer"
            >
              Open secure enquiry form <ArrowUpRight size={18} />
            </a>
            <p className="fine-print">
              Hosted by Tally. Review the form’s privacy information before
              sending.
            </p>
          </>
        ) : (
          <>
            <div className="setup-notice">
              <strong>Enquiry delivery isn’t connected yet.</strong>
              <span>
                Prepare a brief below. It stays in this page until you copy or
                download it; it will not be submitted.
              </span>
            </div>
            {brief ? (
              <div className="brief-result">
                <CheckCircle2 size={32} />
                <h2>Your brief is ready.</h2>
                <p>Prepared locally. Not sent to the agency.</p>
                <pre>{brief}</pre>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(brief);
                        setNotice("Brief copied. Nothing has been sent.");
                      } catch {
                        setNotice(
                          "Clipboard unavailable. Select the text above or download it.",
                        );
                      }
                    }}
                  >
                    <Copy size={16} /> Copy brief
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([brief], { type: "text/plain" }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "my-project-brief.txt";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      setNotice(
                        "Downloaded to your device. Nothing has been sent.",
                      );
                    }}
                  >
                    <Download size={16} /> Download
                  </button>
                </div>
                {email && (
                  <a
                    className="text-link"
                    href={
                      "mailto:" +
                      email +
                      "?subject=" +
                      encodeURIComponent("Project enquiry") +
                      "&body=" +
                      encodeURIComponent(brief)
                    }
                  >
                    Open an email draft <ArrowUpRight size={16} />
                  </a>
                )}
                <p role="status">{notice}</p>
                <button
                  className="text-link"
                  onClick={() => {
                    setBrief("");
                    setNotice("");
                  }}
                >
                  Start another brief
                </button>
              </div>
            ) : (
              <form noValidate onSubmit={submit}>
                {[
                  {
                    name: "name",
                    label: "Your name",
                    type: "text",
                    placeholder: "Your name",
                  },
                  {
                    name: "email",
                    label: "Email address",
                    type: "email",
                    placeholder: "you@business.com",
                  },
                  {
                    name: "business",
                    label: "Business / service",
                    type: "text",
                    placeholder: "What does your business do?",
                  },
                ].map((f) => (
                  <label key={f.name}>
                    {f.label}
                    <input
                      name={f.name}
                      type={f.type}
                      placeholder={f.placeholder}
                      required
                      maxLength={160}
                      aria-invalid={Boolean(errors[f.name])}
                      aria-describedby={
                        errors[f.name] ? f.name + "-error" : undefined
                      }
                    />
                    {errors[f.name] && (
                      <span id={f.name + "-error"} className="field-error">
                        {errors[f.name]}
                      </span>
                    )}
                  </label>
                ))}
                <label>
                  What would you like to improve?
                  <textarea
                    name="goal"
                    rows={4}
                    required
                    minLength={20}
                    maxLength={2000}
                    placeholder="Your goal, current tools, pages or integrations, and ideal launch timing…"
                    aria-invalid={Boolean(errors.goal)}
                    aria-describedby="goal-error"
                  />
                  {errors.goal && (
                    <span id="goal-error" className="field-error">
                      Tell us a little more (at least 20 characters).
                    </span>
                  )}
                </label>
                <label>
                  Indicative setup budget
                  <select name="budget" required>
                    <option value="">Choose a range</option>
                    <option>₹15,000–₹30,000</option>
                    <option>₹30,000–₹60,000</option>
                    <option>₹60,000+</option>
                    <option>I’d like guidance</option>
                  </select>
                  {errors.budget && (
                    <span className="field-error">Choose a budget range.</span>
                  )}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="consent" required />
                  <span>
                    Include permission to contact me about this project in my
                    brief.
                  </span>
                </label>
                {errors.consent && (
                  <p className="field-error">
                    Please confirm permission to include in the brief.
                  </p>
                )}
                <button className="button full" type="submit">
                  Prepare my brief <ArrowUpRight size={17} />
                </button>
                <p className="form-footnote">
                  Local preparation only. This button does not send anything.
                </p>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
