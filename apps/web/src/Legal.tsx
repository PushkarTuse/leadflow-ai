import { Link } from "react-router-dom";
export function Legal({ kind }: { kind: "privacy" | "terms" }) {
  const live=import.meta.env.VITE_INTAKE_ENABLED==='true';
  const email=import.meta.env.VITE_CONTACT_EMAIL||'';
  return (
    <div className="container page legal">
      <p className="eyebrow">{live?'LEADFLOW AI':'LOCAL PREVIEW'} · 12 NOVEMBER 2026</p>
      <h1>
        {kind === "privacy"
          ? "Privacy, in plain language."
          : "A clear starting agreement."}
      </h1>
      {!live && <p className="setup-notice">
        This is a pre-launch draft. The owner must confirm the legal business
        identity, contact details, provider settings and applicable obligations
        before collecting real enquiries.
      </p>}
      {live&&<p>LeadFlow AI is the operating name used on this website. For project or privacy enquiries, contact <a href={`mailto:${email}`}>{email}</a>. Any paid work requires a separate written agreement identifying the contracting parties.</p>}
      {kind === "privacy" ? (
        <>
          <h2>The interactive demo</h2>
          <p>
            Use fictional details. The simulation runs in your browser’s memory
            and does not send enquiries, create appointments or store form
            contents in browser storage. Reloading the page clears the inputs.
            No analytics or advertising trackers are installed by this
            application. A deployed hosting provider may keep operational access
            logs under its own policy.
          </p>
          <h2>Project enquiries</h2>
          {live?<p>When you submit the contact form, we collect your name, email address, business or service, project requirements, budget range and consent record. Cloudflare hosts the website, checks for automated abuse through Turnstile and forwards the enquiry to our Google Apps Script and private Google Sheets CRM. A submission reference prevents repeated attempts from creating duplicate enquiries.</p>:<p>
            Until a hosted form is configured, the contact page only prepares a
            brief locally. Copying or downloading it is your choice. If a Tally
            form is configured, it opens separately and sends the information to
            that provider and the agency owner. The owner must publish the
            applicable privacy information on that form and review its
            processing terms before enabling it.
          </p>}
          <h2>Purpose and access</h2>
          <p>
            Collect only contact details and project requirements needed to
            respond to an enquiry. Restrict access to the owner and explicitly
            authorized collaborators. Do not include identity documents, payment
            details, confidential client data or sensitive personal information
            in the form.
          </p>
          <h2>Retention and deletion</h2>
          <p>
            We review inactive enquiries after 90 days
            and remove information no longer needed, subject to applicable
            obligations. This is an owner-operated review, not an automatic
            deletion promise. Use the contact address above or the enquiry channel you originally used to request access, correction, deletion or withdrawal of contact permission. We also review provider copies in Gmail and Telegram when handling a deletion request.
          </p>
          <h2>Optional AI processing</h2>
          <p>
            The public simulation uses local rules. In the connected enquiry workflow, Google Gemini may process your project requirements to help qualify the enquiry and prepare a reply. Google's free API service may use submitted content to improve its products and may include human review. Please do not submit confidential or sensitive information. The owner's private Telegram chat receives your enquiry summary, email address and proposed reply for review. Gmail sends a response only after the owner approves that exact recipient and text. We do not add you to a mailing list. Provider processing can occur outside India under their respective policies.
          </p>
        </>
      ) : (
        <>
          <h2>Scope and pricing</h2>
          <p>
            Package prices are illustrative starting points. Deliverables,
            revisions, milestones, price, taxes, external costs and acceptance
            checks require a written agreement. The website does not form a
            binding quotation.
          </p>
          <h2>Owner-controlled workflow</h2>
          <p>
            The product can organize enquiries and prepare suggestions. The
            business owner reviews facts, permissions, responses, prices and
            bookings. No customer, conversion or revenue result is guaranteed.
          </p>
          <h2>Demo and accounts</h2>
          <p>
            Greenway Properties, its people and its enquiries are fictional.
            Services depend on the configured tools and their quotas. Clients
            should own their domains and provider accounts. Availability,
            support hours, maintenance and data handling will be agreed in
            writing; no 24/7 SLA is included by default.
          </p>
          <h2>Before paid work begins</h2>
          <p>
            We agree the contracting parties, scope, delivery milestones, payment schedule, revisions, ownership, support and data handling in writing. Submitting an enquiry does not create a service contract or guarantee a response time.
          </p>
        </>
      )}
      <Link className="button secondary" to="/contact">
        Back to enquiries
      </Link>
    </div>
  );
}
