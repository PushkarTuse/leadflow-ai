import { describe, expect, it } from "vitest";
import { discoveryState, type DiscoveryState } from "../packages/core/discovery-state";

const fixtures: [string, Parameters<typeof discoveryState>[0], DiscoveryState][] = [
  ["paid scoped build", {decision:"ACCEPTED",source:"MODEL",boundary:"BOUNDED"}, "QUALIFIED"],
  ["real fixed contract delivered by agency", {decision:"ACCEPTED",source:"RULES_FALLBACK",boundary:"BOUNDED"}, "QUALIFIED"],
  ["ongoing staffing", {decision:"REJECTED",boundary:"ONGOING_SEAT",warning:"No AI verdict"}, "REJECTED"],
  ["full-time with transient provider error", {decision:"REJECTED",reason:"FULL_TIME_ONLY",warning:"No AI verdict"}, "REJECTED"],
  ["unclear engagement after quota", {decision:"REJECTED",source:"RULES_FALLBACK",reason:"ENGAGEMENT_UNCLEAR",warning:"No AI verdict: HTTP 429"}, "RETRY_CLASSIFICATION"],
  ["ambiguous verdict despite model response", {decision:"REJECTED",reason:"ENGAGEMENT_UNCLEAR",source:"MODEL"}, "REVIEW"],
  ["truncated buyer brief", {decision:"REJECTED",reason:"INSUFFICIENT_CONTEXT",incomplete:true,warning:"No AI verdict"}, "AWAITING_ENRICHMENT"],
  ["complete listing with provider failure", {decision:"REJECTED",reason:"INSUFFICIENT_CONTEXT",warning:"No AI verdict: HTTP 503"}, "RETRY_CLASSIFICATION"],
  ["UK eligibility requires confirmation", {decision:"ACCEPTED",provider:"uk_tender"}, "REVIEW"],
];
describe("operational project qualification",()=>{
  it.each(fixtures)("%s",(_name,input,state)=>expect(discoveryState(input)).toBe(state));
});
