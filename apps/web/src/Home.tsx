import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CirclePlay,
  FileCheck2,
  Layers3,
  MessageSquare,
  MousePointer2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";
import { FlowPreview } from "./FlowPreview";
import { Packages } from "./Packages";
export function Home() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="availability">
            <span className="tiny-dot" /> BUILT FOR SERVICE BUSINESSES
          </div>
          <h1>
            A better website.
            <br />A clearer inbox.
            <br />
            <span>Your next customer.</span>
          </h1>
          <p>
            Your website should do more than look good. Turn enquiries into
            clear next steps with a smart workflow that keeps you in control.
          </p>
          <div className="hero-buttons">
            <Link className="button" to="/demo">
              Try the live demo <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" to="/contact">
              Tell us what you need <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-assurance">
            <span>
              <Check size={14} /> Made for your business
            </span>
            <span>
              <Check size={14} /> Human-approved follow-ups
            </span>
          </div>
          <div className="hero-note">
            <span className="line-mark" /> FROM FIRST CLICK TO THE NEXT
            CONVERSATION.
          </div>
        </div>
        <FlowPreview />
      </section>
      <div className="audience-strip">
        <div className="container">
          <span>A GOOD FIT FOR</span>
          <p>Property consultants</p>
          <span className="strip-dot">·</span>
          <p>Professional services</p>
          <span className="strip-dot">·</span>
          <p>Local agencies</p>
          <span className="strip-dot">·</span>
          <p>Growing service businesses</p>
        </div>
      </div>
      <section className="container section problem">
        <div>
          <p className="eyebrow">THE GAP AFTER “HELLO”</p>
          <h2>
            Good enquiries deserve
            <br />
            better than a busy inbox.
          </h2>
        </div>
        <div>
          <p>
            One enquiry in email. Another in a chat. A callback you meant to
            make. When the details are scattered, the next step gets missed.
          </p>
          <p className="strong-copy">
            We bring your website, enquiry details and follow-up into one simple
            flow.
          </p>
        </div>
      </section>
      <section id="how-it-works" className="process-section">
        <div className="container section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LESS CHASING. MORE CLARITY.</p>
              <h2>
                Three steps.
                <br />
                One connected experience.
              </h2>
            </div>
            <p>
              Useful automation in the background.
              <br />
              Your judgment at the centre.
            </p>
          </div>
          <div className="steps">
            {[
              {
                n: "01",
                icon: MousePointer2,
                title: "Make the first impression.",
                body: "A fast, thoughtful website that explains your service and makes it easy to enquire.",
              },
              {
                n: "02",
                icon: Layers3,
                title: "Get the full picture.",
                body: "Capture the need, budget and timing. Turn a message into an organized, prioritized enquiry.",
              },
              {
                n: "03",
                icon: MessageSquare,
                title: "Choose the next step.",
                body: "Receive an owner alert, review a suggested response and confirm the next conversation.",
              },
            ].map((s) => (
              <article key={s.n}>
                <div className="step-top">
                  <s.icon size={26} strokeWidth={1.5} />
                  <span>{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="demo-banner">
          <div>
            <p className="eyebrow">MEET LEADFLOW AI</p>
            <h2>
              Don’t just take
              <br />
              our word for it.
              <br />
              <span>Try the whole flow.</span>
            </h2>
            <p>
              Step into a fictional property business. Send a sample enquiry and
              see exactly what the owner receives.
            </p>
            <Link className="button light" to="/demo">
              <CirclePlay size={19} /> Explore the interactive demo{" "}
              <ArrowUpRight size={17} />
            </Link>
            <small>Simulation only · No sign-up · No real messages sent</small>
          </div>
          <div className="demo-map">
            <div className="map-window">
              <span className="window-dots">● ● ●</span>
              <span>Greenway Properties</span>
              <span className="pill">SAMPLE</span>
            </div>
            <div className="map-home">
              <span className="house-illustration" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <p>
                A new home.
                <br />A clearer next step.
              </p>
              <span>Pune, Maharashtra</span>
            </div>
            <div className="map-flow">
              <span>Enquiry</span>
              <ArrowRight size={15} />
              <span>Qualified</span>
              <ArrowRight size={15} />
              <span className="active">Your decision</span>
            </div>
          </div>
        </div>
      </section>
      <section className="container section packages-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A PRACTICAL STARTING POINT</p>
            <h2>
              Small scope.
              <br />
              Built to be useful.
            </h2>
          </div>
          <p>
            Clear deliverables. Transparent starting prices.
            <br />A final quote after we understand your needs.
          </p>
        </div>
        <Packages />
        <p className="fine-print">
          Introductory prices for testing our offer, not a binding quote.
          Domain, third-party services and maintenance are scoped separately.
        </p>
      </section>
      <section id="about" className="about-section">
        <div className="container section about-grid">
          <div>
            <p className="eyebrow">THOUGHTFUL BY DESIGN</p>
            <h2>
              AI helps with the work.
              <br />
              People own the decisions.
            </h2>
            <p>
              We’re an independent, founder-led software venture in India,
              building practical websites and workflows for service businesses.
              LeadFlow AI is our working product name.
            </p>
            <p>
              Our approach is simple: show you something that works, agree on a
              focused scope, and make it easy to own what we build.
            </p>
            <Link className="text-link" to="/contact">
              Let’s find your starting point <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="principles">
            {[
              {
                icon: ShieldCheck,
                title: "Your approval comes first",
                body: "No automatic promises, pricing decisions or outbound sales messages.",
              },
              {
                icon: Workflow,
                title: "Tools you can actually operate",
                body: "A mobile-friendly website, an understandable CRM and useful owner alerts.",
              },
              {
                icon: FileCheck2,
                title: "A handover, not a black box",
                body: "Source code, setup documentation and clear account ownership.",
              },
            ].map((p) => (
              <div key={p.title}>
                <span className="icon-tile">
                  <p.icon size={21} />
                </span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="container section onboarding">
        <p className="eyebrow">FROM IDEA TO HANDOVER</p>
        <h2>A straightforward way to work together.</h2>
        <div className="onboarding-grid">
          {[
            [
              "01",
              "Understand",
              "Tell us your goal, customers and current tools.",
            ],
            [
              "02",
              "Agree",
              "Review a written scope, quote and acceptance checks.",
            ],
            ["03", "Build", "Try a working flow and give focused feedback."],
            [
              "04",
              "Own",
              "Receive tested delivery, access and an operating guide.",
            ],
          ].map(([n, t, b]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="container section faq">
        <div>
          <p className="eyebrow">A FEW GOOD QUESTIONS</p>
          <h2>Before we begin.</h2>
        </div>
        <div>
          {[
            [
              "Is the demo a real client project?",
              "No. Greenway Properties and its enquiries are fictional. The demo is a working illustration of the workflow, not a client case study or a claim of measured results.",
            ],
            [
              "Will AI message my customers automatically?",
              "The starting workflow prepares information and suggested replies for you to review. You decide what to send, when to send it and whether to book a meeting.",
            ],
            [
              "Do I need new tools?",
              "Often, a website, Google Sheets and an owner notification channel are enough. We review your existing tools before recommending anything new.",
            ],
            [
              "Are there ongoing costs?",
              "We begin with free-tier tools where they fit. Domains, usage beyond free quotas and optional maintenance are separate and agreed in advance.",
            ],
            [
              "Can this work outside property?",
              "Yes. The intake fields and qualification rules can be adapted for agencies, professional services, training providers and other service businesses.",
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
      <section className="container final-cta">
        <p className="eyebrow">YOUR NEXT STEP</p>
        <h2>
          Let’s make your enquiries
          <br />
          easier to follow through.
        </h2>
        <Link className="button" to="/contact">
          Start a conversation <ArrowUpRight size={19} />
        </Link>
        <span>A focused conversation. A practical next step.</span>
      </section>
    </>
  );
}
