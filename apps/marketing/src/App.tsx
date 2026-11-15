import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  Check,
  Menu,
  X,
  Target,
  Search,
  ChartNoAxesCombined,
  Layers,
} from "lucide-react";
import { Journey } from "./Journey";
import { KapicksGallery } from "../../shared/KapicksGallery";
import { AuditForm } from "./AuditForm";
import { plans, services } from "./content";
const icons = [Target, Search, ChartNoAxesCombined, Layers];
const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
export function App() {
  const [menu, setMenu] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [metric, setMetric] = useState(0);
  const [spend, setSpend] = useState(18000);
  const [cpl, setCpl] = useState(600);
  const leads = Math.floor(spend / cpl),
    customers = leads * 0.1,
    revenue = customers * 12000;
  useEffect(() => {
    const close = () => setMenu(false);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("hashchange", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("hashchange", close);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Signal and Slate home">
          <span className="brand-symbol" aria-hidden="true">
            ✳
          </span>{" "}
          SIGNAL <span className="ampersand">&</span> SLATE
          <span className="wordmark-dot">STUDIO</span>
        </a>
        <button
          className="menu-toggle"
          onClick={() => setMenu((v) => !v)}
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          aria-controls="nav"
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav
          id="nav"
          className={menu ? "nav open" : "nav"}
          aria-label="Main navigation"
        >
          <a href="#expertise" onClick={() => setMenu(false)}>
            Our expertise
          </a>
          <a href="#perspective" onClick={() => setMenu(false)}>
            Our perspective
          </a>
          <a href="#partnerships" onClick={() => setMenu(false)}>
            Partnerships
          </a>
          <a className="nav-cta" href="#audit" onClick={() => setMenu(false)}>
            Let’s talk growth <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <Journey metric={metric} />
      <main id="main">
        <section className="hero section-shell" id="top">
          <div className="hero-topline">
            <span className="kicker">
              <i className="signal-dot" /> INDEPENDENT THINKING. MEASURABLE
              GROWTH.
            </span>
            <span className="edition">STRATEGY / CREATIVE / PERFORMANCE</span>
          </div>
          <div className="hero-content">
            <h1>
              Less noise.
              <br />
              More <span>signal.</span>
            </h1>
            <p className="hero-description">
              Considered digital marketing.
              <br />
              For brands ready to move with purpose.
            </p>
            <a className="button" href="#audit">
              Find your growth opportunity <ArrowUpRight size={18} />
            </a>
            <div className="hero-detail">
              <span>
                Built for ambitious
                <br />
                independent businesses.
              </span>
              <span className="detail-line" />
              <span>
                Clear strategy.
                <br />
                Accountable execution.
              </span>
            </div>
          </div>
          <div className="hero-caption">
            <span className="crosshair">+</span>
            <span>01 / THE SIGNAL-TO-REVENUE JOURNEY</span>
            <span className="caption-line" />
            <span>SCROLL TO FOCUS</span>
            <ArrowDown size={15} />
          </div>
          <div className="scene-label">
            <span className="label-coordinate">S / 001</span>
            <span>
              Find clarity
              <br />
              in the chaos.
            </span>
            <span className="label-coordinate">PROCEDURAL EXPLORATION</span>
          </div>
        </section>
        <div className="discipline-strip">
          <span>THE RIGHT MESSAGE.</span>
          <span className="gold-star">✳</span>
          <span>THE RIGHT PEOPLE.</span>
          <span className="gold-star">✳</span>
          <span>THE RIGHT NEXT STEP.</span>
          <span className="gold-star">✳</span>
          <span>CONNECTED BY STRATEGY.</span>
        </div>
        <section className="section-shell expertise" id="expertise">
          <div className="section-heading">
            <p className="kicker">02 / WHAT WE BRING INTO FOCUS</p>
            <h2>
              Four disciplines.
              <br />
              <span>One direction.</span>
            </h2>
            <p className="section-deck">
              No channel works alone. We connect how people find you, what they
              see, and what happens after they enquire.
            </p>
          </div>
          <div className="service-grid">
            {services.map((s, i) => {
              const Icon = icons[i];
              return (
                <article className="glass-card service-card" key={s.n}>
                  <div className="card-top">
                    <span>{s.n} /</span>
                    <Icon size={23} strokeWidth={1.3} />
                  </div>
                  <p className="kicker">{s.tag}</p>
                  <h3>{s.name}</h3>
                  <p>{s.body}</p>
                  <div className="service-deliverables">{s.items}</div>
                </article>
              );
            })}
          </div>
          <div className="service-footer">
            <span className="kicker">LESS GUESSWORK. MORE INTENTION.</span>
            <a className="text-link" href="#audit">
              Talk through your priorities <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <section className="section-shell proof" id="perspective">
          <div className="section-heading">
            <p className="kicker">03 / EVIDENCE OVER OPTICS</p>
            <h2>
              Good numbers need
              <br />
              <span>good context.</span>
            </h2>
            <p className="section-deck">
              A cheaper lead is only useful if it becomes the right customer. We
              look beyond clicks to the journey that follows.
            </p>
          </div>
          <div className="proof-layout">
            <article className="bageera-card">
              <div className="bageera-visual">
                <KapicksGallery />
                <span className="kicker">KAPICKS / WILDLIFE PHOTOGRAPHY</span>
              </div>
              <div className="bageera-copy">
                <p className="kicker">PORTFOLIO SPOTLIGHT · LIVE WEBSITE</p>
                <h3>
                  A sharper frame
                  <br />
                  for a creative brand.
                </h3>
                <p>
                  Kapicks is a live wildlife photography portfolio. Our proposed
                  growth direction connects a considered social presence with a
                  clear path for interested visitors.
                </p>
                <a className="kapicks-visit" href="https://www.kapicks.com/" target="_blank" rel="noopener noreferrer">Visit Kapicks <ArrowUpRight size={16}/></a>
                <div className="case-tags">
                  <span>Content pillars</span>
                  <span>Local discovery</span>
                  <span>Enquiry journey</span>
                </div>
                <p className="evidence-note">
                  Campaign activity and performance results are not yet
                  verified. This is a proposed direction, not a claim of
                  delivered growth.
                </p>
              </div>
            </article>
            <div className="model-card glass-card">
              <div className="card-top">
                <span className="kicker">THE ECONOMICS OF AN ENQUIRY</span>
                <span className="blue-dot" />
              </div>
              <h3>Start with the maths.</h3>
              <p>
                A planning model. Your audience, offer and conversion quality
                determine the real result.
              </p>
              <label className="range-label">
                Monthly ad spend <strong>{inr(spend)}</strong>
                <input
                  type="range"
                  min="6000"
                  max="60000"
                  step="3000"
                  value={spend}
                  onChange={(e) => setSpend(Number(e.target.value))}
                />
              </label>
              <label className="range-label">
                Assumed cost per lead <strong>{inr(cpl)}</strong>
                <input
                  type="range"
                  min="250"
                  max="1500"
                  step="50"
                  value={cpl}
                  onChange={(e) => setCpl(Number(e.target.value))}
                />
              </label>
              <div className="model-metrics">
                {[
                  { label: "Projected enquiries", value: String(leads) },
                  { label: "Cost per enquiry", value: inr(cpl) },
                  {
                    label: "Revenue / ad spend",
                    value: (revenue / spend).toFixed(1) + "×",
                  },
                ].map((m, i) => (
                  <button
                    key={m.label}
                    className={metric === i ? "selected" : ""}
                    aria-pressed={metric === i}
                    onClick={() => setMetric(i)}
                  >
                    <span>{m.label}</span>
                    <strong>{m.value}</strong>
                  </button>
                ))}
              </div>
              <p className="evidence-note">
                Illustrative inputs, not industry benchmarks or promised ROAS.
                Assumes 10% of enquiries become customers at ₹12,000 revenue
                each. Revenue is attributed in this model only; fees, tax and
                delivery costs are excluded. Your first test establishes a
                baseline.
              </p>
            </div>
          </div>
        </section>
        <section
          className="section-shell partnership-section"
          id="partnerships"
        >
          <div className="section-heading">
            <p className="kicker">04 / A MORE CONSIDERED PARTNERSHIP</p>
            <h2>
              The right pace.
              <br />
              <span>A clear commitment.</span>
            </h2>
            <p className="section-deck">
              Start with the scope you need. Every engagement begins with an
              agreed plan, access requirements and measures of progress.
            </p>
          </div>
          <div className="pricing-grid">
            {plans.map((p, i) => (
              <article
                key={p.id}
                className={
                  "price-card glass-card " + (p.featured ? "featured" : "")
                }
              >
                <div className="card-top">
                  <span>0{i + 1} /</span>
                  {p.featured && (
                    <span className="recommended">RECOMMENDED</span>
                  )}
                </div>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <div
                  className={
                    "price " + (p.id === "partner" ? "custom-price" : "")
                  }
                >
                  {p.price}
                  <span>{p.suffix}</span>
                </div>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check size={14} />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="price-note">{p.note}</p>
                <a
                  href="#audit"
                  className={"button " + (p.featured ? "" : "secondary")}
                  onClick={() => setSelectedPlan(p.id)}
                >
                  Explore {p.name}
                  <ArrowUpRight size={16} />
                </a>
              </article>
            ))}
          </div>
          <div className="scope-note">
            <p>
              <strong>Service fees, not media budgets.</strong> Ad spend is paid
              directly from your ad accounts. Taxes, production shoots, paid
              tools, major website fixes and specialist integrations are
              additional unless scoped. SEO results and ad returns are not
              guaranteed.
            </p>
            <p>
              Deliverables, approval rounds, reporting dates and cancellation
              terms are agreed in writing.
            </p>
          </div>
        </section>
        <section className="section-shell audit-section" id="audit">
          <div className="audit-intro">
            <p className="kicker">05 / YOUR NEXT CHAPTER</p>
            <h2>
              Make room
              <br />
              for <span>better growth.</span>
            </h2>
            <p>
              Bring the ambition. We’ll help find the signal, define the
              priorities, and build a practical plan.
            </p>
            <div className="audit-steps">
              {[
                [
                  "01",
                  "Share the context",
                  "Your business, audience and current challenges.",
                ],
                [
                  "02",
                  "Find the priorities",
                  "A focused review of where the opportunity sits.",
                ],
                [
                  "03",
                  "Agree the next move",
                  "A scoped proposal, with costs and expectations.",
                ],
              ].map(([n, t, b]) => (
                <div key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{t}</h3>
                    <p>{b}</p>
                  </div>
                </div>
              ))}
            </div>
            <a className="text-link" href="mailto:leadsflowwai@gmail.com">
              Prefer email? Start here <ArrowRight size={16} />
            </a>
          </div>
          <AuditForm selectedPlan={selectedPlan} onPlan={setSelectedPlan} />
        </section>
        <section className="section-shell questions">
          <p className="kicker">A FEW THINGS WORTH KNOWING</p>
          <div>
            {[
              [
                "Is ad spend included in the monthly fee?",
                "No. The package covers the agreed services. Media spend is paid separately through accounts you own. We agree a test budget before any campaign launches.",
              ],
              [
                "Can you promise a particular CPL or ROAS?",
                "No. Costs and returns vary with the offer, audience, creative and sales process. We agree a measurement plan and establish a baseline before making scaling decisions.",
              ],
              [
                "What does social management include?",
                "The scope can cover strategy, content calendars, scheduling and community management. The Scale package includes a posting calendar; content production and hands-on publishing are quoted separately.",
              ],
              [
                "Will I own my accounts and data?",
                "Yes. Your advertising, analytics and business accounts stay with you. We request only the access needed for the agreed work.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section id="privacy" className="section-shell privacy-section">
          <h2>Privacy, in plain language.</h2>
          <p>
            We use your submitted details to review and reply to this enquiry.
            Configured delivery uses Cloudflare for form protection, Google Apps
            Script and Sheets for our private CRM, Gemini to help organize
            requirements, Telegram for owner review, and Gmail for an approved
            reply. Gemini free-tier processing may be used to improve Google
            products; share only the information needed for the enquiry. We do
            not subscribe you to a mailing list. Request access, correction or
            deletion by emailing leadsflowwai@gmail.com. Project records are
            reviewed after 90 days; essential contractual records may need
            longer retention. In preview mode, briefs stay in this page until
            you copy or send them yourself.
          </p>
        </section>
      </main>
      <footer className="section-shell">
        <div className="footer-top">
          <a className="wordmark" href="#top">
            <span className="brand-symbol">✳</span> SIGNAL{" "}
            <span className="ampersand">&</span> SLATE
          </a>
          <p>
            Independent thinking.
            <br />
            Intentional growth.
          </p>
          <a href="#top" className="back-top">
            BACK TO THE SIGNAL <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Signal & Slate · A LeadFlow venture ·
            India
          </span>
          <span>STRATEGY WITH SUBSTANCE.</span>
          <a href="#privacy">Privacy information</a>
        </div>
      </footer>
    </>
  );
}
