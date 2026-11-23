import { describe, expect, it } from "vitest";
import {
  displayPriority,
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
  it("counts provider verdicts separately from rows awaiting classification", () => {
    const accepted = row("accepted", "ELIGIBLE", "LOW", true);
    accepted.qualification!.operator_decision = "ACCEPTED";
    accepted.qualification_audit = {method:"gemini", decision_source:"MODEL",
      discovery_semantics:{lead_kind:"FREELANCE_PROJECT",decision:"ACCEPT"}};
    expect(displayPriority(qualificationState(accepted), "LOW")).toBe("LOW");
    expect(displayPriority("REJECTED", "REJECTED")).toBe("—");
    expect(qualificationCounts([
      accepted, row("old-high", "ELIGIBLE", "HIGH", true), row("legacy"),
      row("incomplete", "REVIEW_INCOMPLETE"), row("quarantined", "QUARANTINED"),
    ])).toEqual({raw:5, accepted:1, rejected:0, awaitingClassification:4, sourceGuard:0});
    const legacyNoModel = row("no-model", "REJECTED");
    legacyNoModel.qualification!.operator_decision = "REJECTED";
    legacyNoModel.qualification_audit = { method: "rules", decision_source: "NO_MODEL" };
    expect(qualificationState(legacyNoModel)).toBe("AWAITING_CLASSIFICATION");
    accepted.qualification_audit.discovery_semantics!.decision = "REJECT";
    expect(qualificationState(accepted)).toBe("REJECTED");
  });

  it("shows OpenAI-compatible provider attribution", () => {
    const candidate = row("provider", "REJECTED");
    candidate.qualification_audit = { method: "openai-compatible" };
    expect(qualificationMethod(candidate)).toBe("openai-compatible");
  });
});
