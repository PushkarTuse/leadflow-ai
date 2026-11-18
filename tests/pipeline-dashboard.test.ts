import { describe, expect, it } from "vitest";
import {
  qualificationCounts,
  qualificationMethod,
  qualificationState,
  type LeadRow,
} from "../apps/web/src/PipelineDashboard";

function row(
  lead_id: string,
  eligibility_state?: string,
  priority = "REJECTED",
  is_valid_freelance_lead = false,
): LeadRow {
  return {
    lead_id,
    title: "Test candidate",
    client_name_if_public: "",
    source: "hn",
    qualification: eligibility_state
      ? {
          is_valid_freelance_lead,
          eligibility_state,
          priority,
          quality_score: is_valid_freelance_lead ? 75 : 0,
          confidence_score: is_valid_freelance_lead ? 0.85 : 0.95,
          rejection_reason: is_valid_freelance_lead ? null : "FULL_TIME_ONLY",
          evidence_quotes: [],
        }
      : undefined,
    extractionWarning: "",
    status: "NEW",
  };
}

describe("qualification dashboard view", () => {
  it("labels records without qualification as needing requalification", () => {
    expect(qualificationState(row("legacy"))).toBe("NEEDS_REQUALIFICATION");
  });

  it("separates high/medium opportunities from low and held candidates", () => {
    const counts = qualificationCounts([
      row("high", "ELIGIBLE", "HIGH", true),
      row("medium", "ELIGIBLE", "MEDIUM", true),
      row("low", "ELIGIBLE", "LOW", true),
      row("rejected", "REJECTED"),
      row("incomplete", "REVIEW_INCOMPLETE"),
      row("quarantined", "QUARANTINED"),
      row("legacy"),
    ]);

    expect(counts).toEqual({
      raw: 7,
      eligible: 2,
      high: 1,
      medium: 1,
      low: 1,
      rejected: 1,
      incomplete: 1,
      quarantined: 1,
      needsRequalification: 1,
    });
  });

  it("does not promote a contradictory eligibility record", () => {
    expect(
      qualificationState(row("invalid", "ELIGIBLE", "HIGH", false)),
    ).toBe("NEEDS_REQUALIFICATION");
  });

  it("shows OpenAI-compatible provider attribution", () => {
    const candidate = row("provider", "REJECTED");
    candidate.qualification_audit = { method: "openai-compatible" };
    expect(qualificationMethod(candidate)).toBe("openai-compatible");
  });
});
