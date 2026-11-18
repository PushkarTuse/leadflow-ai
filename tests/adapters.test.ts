import { describe, expect, it } from "vitest";
import type { DiscoverySignals } from "../packages/core/scoring";
import type { DiscoveryContext } from "../packages/core/qualification";
import {
  classifyGeminiDiscovery,
  type Http,
} from "../apps/automation/adapters";

const now = "2026-11-18T00:00:00.000Z";
const context: DiscoveryContext = {
  provider: "hackernews",
  provider_record_id: "adapter-test-1",
  original_url: "https://news.ycombinator.com/item?id=adapter-test-1",
  item_type: "comment",
  author_handle: "founder",
  parent_id: "123",
  thread_id: "123",
  thread_title: "Who is hiring?",
  thread_date: now,
  original_title: "Seeking a contractor",
  raw_text: "We need an independent contractor to build a React checkout.",
  decoded_text: "We need an independent contractor to build a React checkout.",
  published_at: now,
  collected_at: now,
  fetched_at: now,
  tags: [],
  location: "",
  contact_link_targets: [],
  deleted: false,
  dead: false,
  source_hash: "adapter-test-source-hash-000000000000000000000000000000",
  truncated: false,
  complete: true,
};

const signals: DiscoverySignals = {
  intent: "BUYER",
  lead_type: "CONTRACT_ROLE",
  requester_type: "COMPANY",
  engagement_type: "INDEPENDENT_CONTRACT",
  budget_signal: {
    kind: "UNKNOWN",
    minimum: null,
    maximum: null,
    currency: "UNKNOWN",
    unit: "UNKNOWN",
  },
  timeline_signal: null,
  required_skills: ["React"],
  seniority: "UNKNOWN",
  location_or_remote_policy: null,
  contact_method: { type: "UNKNOWN", value: null },
  rejection_reason: null,
  evidence_quotes: [
    { field: "intent", quote: "We need an independent contractor" },
    { field: "engagement", quote: "independent contractor" },
    { field: "skill", quote: "React checkout" },
  ],
};

const options = {
  enabled: true,
  freeTierConfirmed: true,
  dataUseApproved: true,
  apiKey: "test-key",
  model: "gemini-3.5-flash-lite",
};

describe("Gemini discovery adapter", () => {
  it("returns validated extraction signals to the qualification workflow", () => {
    const http: Http = {
      json: (url, request) => {
        expect(url).toContain("/models/gemini-3.5-flash-lite:generateContent");
        expect(request?.body).toMatchObject({
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: expect.any(Object),
          },
        });
        return {
          candidates: [{ content: { parts: [{ text: JSON.stringify(signals) }] } }],
        };
      },
    };

    expect(classifyGeminiDiscovery(http, {
      ...context,
      source_hash: context.source_hash.replace("adapter", "unique"),
    }, options)).toEqual({ signals });
  });

  it("reports quota and model errors safely without exposing provider details", () => {
    const quotaHttp: Http = {
      json: () => {
        throw new Error("Provider request failed (HTTP 429); request body suppressed");
      },
    };
    const modelHttp: Http = {
      json: () => {
        throw new Error("Provider request failed (HTTP 404); request body suppressed");
      },
    };

    expect(classifyGeminiDiscovery(quotaHttp, {
      ...context,
      source_hash: context.source_hash.replace("adapter", "quota"),
    }, options).warning).toContain("quota/rate limit (HTTP 429)");
    expect(classifyGeminiDiscovery(modelHttp, {
      ...context,
      source_hash: context.source_hash.replace("adapter", "model"),
    }, options).warning).toContain("verify GEMINI_MODEL");
  });
});
