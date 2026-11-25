import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { approvedCommercialContent, trackedReplyOutcome } from "../scripts/commercial-ledger";
import { businessDraft } from "../packages/core/business-draft";
import { reviseBookingCta } from "../scripts/refresh-business-booking";

type Row = Parameters<typeof trackedReplyOutcome>[0];
const tracked: Row = {
  id: "fixture", title: "Synthetic project", source: "https://example.com/project",
  channel: "DIRECT_EMAIL", assignedTo: "Test Owner", state: "PROVIDER_ACCEPTED",
  activityAt: "2026-11-26T00:00:00.000Z", nextAction: "Verify reply", deadline: null, replyIds: [],
  draft: { from: "owner@example.com", to: "buyer@example.com", subject: "Test", body: "Fixture", bookingUrl: null, attachments: [] },
  receipt: { provider: "Fixture", messageId: "<sent@example.com>", threadId: "tracked-thread", acceptedAt: "2026-11-26T00:00:00.000Z" },
};
const match = {
  from: "buyer@example.com", messageId: "<reply@example.com>", threadId: "tracked-thread",
  references: ["<sent@example.com>"], body: "Could we discuss the scope?\n> Reply to unsubscribe",
};

describe("commercial reply reconciliation", () => {
  it("does not carry approval across recipient, content, booking or attachment changes", () => {
    const draft = tracked.draft!;
    const approvedHash = createHash("sha256").update(JSON.stringify(draft)).digest("hex");
    const approved = { ...tracked, approvedHash };
    expect(approvedCommercialContent(approved)).toBe(true);
    for (const change of [
      { to: "another@example.com" }, { body: "Revised text" },
      { bookingUrl: "https://example.com/booking" }, { attachments: ["new-example.pdf"] },
    ]) {
      expect(approvedCommercialContent({ ...approved, draft: { ...draft, ...change } })).toBe(false);
    }
  });

  it("requires the same thread, original reference and buyer sender", () => {
    expect(trackedReplyOutcome(tracked, match)).toBe("REPLIED");
    expect(trackedReplyOutcome(tracked, { ...match, threadId: "private" })).toBeNull();
    expect(trackedReplyOutcome(tracked, { ...match, references: [] })).toBeNull();
    expect(trackedReplyOutcome(tracked, { ...match, from: "other@example.com" })).toBeNull();
  });

  it("ignores autos and duplicates, but recognizes a referenced delivery failure", () => {
    expect(trackedReplyOutcome(tracked, { ...match, autoSubmitted: "auto-replied" })).toBeNull();
    expect(trackedReplyOutcome({ ...tracked, replyIds: [match.messageId] }, match)).toBeNull();
    expect(trackedReplyOutcome(tracked, { ...match, from: "mailer-daemon@example.com", deliveryFailure: true })).toBe("BOUNCED");
  });

  it("separates genuine opt-outs from quoted copy and keeps a suppressed row closed", () => {
    expect(trackedReplyOutcome(tracked, { ...match, body: "Please remove me from your list." })).toBe("OPTED_OUT");
    expect(trackedReplyOutcome({ ...tracked, state: "OPTED_OUT" }, match)).toBeNull();
  });
});

describe("existing business draft booking CTA", () => {
  const facts = { name: "Synthetic Studio", category: "hair salon", city: "Pune", country: "IN",
    website: null, rating_count: null, meetingCity: "Pune" };
  const event = "https://calendly.com/example/30min";

  it("preserves all approved copy while adding the runtime booking CTA to both alternatives", () => {
    const original = businessDraft(facts, "Owner");
    const expected = businessDraft({ ...facts, bookingUrl: event }, "Owner");
    expect(reviseBookingCta(original.body, "plain", event)).toBe(expected.body);
    expect(reviseBookingCta(original.html, "html", event)).toBe(expected.html);
  });

  it("replaces an existing event idempotently and rejects an unrecognized CTA", () => {
    const previous = businessDraft({ ...facts, bookingUrl: "https://calendly.com/example/old" }, "Owner");
    const expected = businessDraft({ ...facts, bookingUrl: event }, "Owner");
    expect(reviseBookingCta(previous.body, "plain", event)).toBe(expected.body);
    expect(reviseBookingCta(previous.html, "html", event)).toBe(expected.html);
    expect(reviseBookingCta(expected.body, "plain", event)).toBe(expected.body);
    expect(() => reviseBookingCta("Changed bespoke content", "plain", event)).toThrow();
  });
});
