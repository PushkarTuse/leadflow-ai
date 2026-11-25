import { describe, expect, it, vi } from "vitest";
import type { DiscoverySignals } from "../packages/core/scoring";
import type { DiscoveryContext } from "../packages/core/qualification";
import { discoveryAiChain, freeDiscoveryBackups } from "../scripts/external-discovery-ai";
import {
  classifyDiscoveryAI,
  classifyGeminiDiscovery,
  openAICompletionEndpoint,
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
  decision: "REJECT",
  decision_reason: "Project details are insufficient.",
  lead_kind: "UNKNOWN",
  buyer_or_seller: "BUYER",
  engagement_boundary: "UNKNOWN",
  term_hint: "UNKNOWN",
  engagement_evidence: null,
  paid_evidence: null,
  scope_evidence: "build a React checkout",
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

describe("local discovery AI failover", () => {
  const compactRejection = {
    decision: signals.decision, decision_reason: signals.decision_reason,
    lead_kind: signals.lead_kind, buyer_or_seller: signals.buyer_or_seller,
    engagement_boundary: signals.engagement_boundary, term_hint: signals.term_hint,
    engagement_evidence: null, paid_evidence: null, scope_evidence: signals.scope_evidence,
  };
  const backups = freeDiscoveryBackups(key => ({
    GROQ_API_KEY: "test-groq-key",
    CLOUDFLARE_AI_API_TOKEN: "test-cloudflare-key",
    CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    OPENROUTER_API_KEY: "test-openrouter-key",
  } as Record<string, string>)[key] || "");

  it("uses recent validated provider performance without changing the decision cache key", () => {
    const providers = [{id:'gemini' as const, options}, ...backups];
    const cache = {};
    const transport = {json: vi.fn((_url:string) => ({choices:[{message:{content:JSON.stringify(compactRejection)}}]}))};
    const recent = [{id:'cloudflare' as const,status:'ok' as const,requests:5,verdicts:4,failures:{}}];
    const sample = {...context,source_hash:'provider-health-test'};
    const first = discoveryAiChain(providers, transport, 10, {}, () => 1000, cache, recent);
    expect(first.classify(sample)).toMatchObject({discoveryProvider:'cloudflare'});
    expect(transport.json.mock.calls[0][0]).toContain('api.cloudflare.com');
    const later = discoveryAiChain([...providers].reverse(), transport, 10, {}, () => 2000, cache);
    expect(later.classify(sample)).toMatchObject({discoveryProvider:'cloudflare'});
    expect(transport.json).toHaveBeenCalledTimes(1);
  });

  it("uses the next valid AI decision and isolates a quota cooldown across runs", () => {
    const providers = [{ id: "gemini" as const, options }, ...backups];
    const cooldowns = {};
    const calls: string[] = [];
    const transport: Http = {
      json(url) {
        calls.push(new URL(url).hostname);
        if (url.includes("googleapis")) throw new Error("HTTP 429 retry-after=120");
        if (url.includes("groq")) return { choices: [{ message: { content: "invalid JSON" } }] };
        if (url.includes("cloudflare")) return { choices: [{ message: { content: JSON.stringify(compactRejection) } }] };
        throw new Error("unneeded fallback");
      },
    };
    const first = discoveryAiChain(providers, transport, 10, cooldowns, () => 1_000);
    expect(first.classify({ ...context, source_hash: context.source_hash + "-chain-a" }))
      .toMatchObject({ discoveryProvider: "cloudflare", discoverySignals: { decision: "REJECT" } });
    expect(calls).toEqual(["generativelanguage.googleapis.com", "api.groq.com", "api.cloudflare.com"]);
    calls.length = 0;
    const next = discoveryAiChain(providers, transport, 10, cooldowns, () => 70_000);
    expect(next.classify({ ...context, source_hash: context.source_hash + "-chain-b" }))
      .toHaveProperty("discoveryProvider", "cloudflare");
    expect(calls).toEqual(["api.groq.com", "api.cloudflare.com"]);
  });

  it("reports no AI verdict when the available providers fail", () => {
    const chain = discoveryAiChain(backups, { json() { throw new Error("HTTP 503"); } }, 10, {});
    expect(chain.classify(context)).toEqual({ warning: expect.stringMatching(/^No AI verdict:/) });
    expect(chain.coverage).toEqual({ requests: 3, attempted: 1, succeeded: 0, failed: 1, cacheHits: 0 });
    expect(chain.available()).toBe(false);
    expect(chain.health({ ai: 0, rules: 1, sourceGuard: 0 })).toMatchObject({
      allUnavailable: true, allQuotaExhausted: false,
      providers: backups.map(({ id }) => ({ id, status: "unavailable", failures: { unavailable: 1 } })),
    });
  });

  it("reports all quota or credit failures and carries their cooldowns into a later run", () => {
    const providers = [{ id: "gemini" as const, options }, ...backups];
    const cooldowns = {};
    const transport: Http = { json(url) { throw new Error(url.includes("groq") ? "HTTP 402" : "HTTP 429 retry-after=120"); } };
    const chain = discoveryAiChain(providers, transport, 10, cooldowns, () => 1_000);
    chain.classify({ ...context, source_hash: context.source_hash + "-quota" });
    const counts = { ai: 0, rules: 1, sourceGuard: 0 };
    expect(chain.health(counts)).toMatchObject({
      allQuotaExhausted: true, allUnavailable: true, finalizedBy: counts,
      providers: providers.map(p => ({ id: p.id, status: p.id === "groq" ? "credits" : "quota", requests: 1 })),
    });
    const next = discoveryAiChain(providers, transport, 10, cooldowns, () => 2_000);
    expect(next.classify(context).warning).toContain("No AI verdict");
    expect(next.coverage.requests).toBe(0);
    expect(next.health(counts).allQuotaExhausted).toBe(true);
  });

  it("retries invalid JSON and unsupported quotes after trying the other providers", () => {
    const calls: string[] = [];
    const chain = discoveryAiChain(backups, { json(url) {
      const host = new URL(url).hostname;
      calls.push(host);
      if (host === "openrouter.ai") throw new Error("ETIMEDOUT");
      const content = calls.length === 1 ? "not JSON" : JSON.stringify(calls.length === 2
        ? { ...compactRejection, scope_evidence: "invented quote" } : compactRejection);
      return { choices: [{ message: { content } }] };
    } }, 10, {});
    expect(chain.classify({ ...context, source_hash: context.source_hash + "-retry" }))
      .toMatchObject({ discoveryProvider: "groq", discoverySignals: { decision: "REJECT" } });
    expect(calls).toEqual(["api.groq.com", "api.cloudflare.com", "openrouter.ai", "api.groq.com"]);
    expect(chain.health({ ai: 1, rules: 0, sourceGuard: 0 }).providers).toMatchObject([
      { id: "groq", status: "ok", failures: { schema: 1 } },
      { id: "cloudflare", status: "quote", failures: { quote: 1 } },
      { id: "openrouter", status: "timeout", failures: { timeout: 1 } },
    ]);
  });

  it("ground compact verdict quotes in the original listing without dropping long input", () => {
    const decoded_text = "We're hiring an independent contractor to build a React checkout.\n" + "Background. ".repeat(920);
    const provider = backups[1];
    const chain = discoveryAiChain([provider], { json(_url, request) {
      expect(JSON.stringify(request?.body)).toContain("Background.");
      return { choices: [{ message: { content: JSON.stringify({
        ...compactRejection, decision: "ACCEPT",
        engagement_evidence: "We’re hiring an independent contractor",
      }) } }] };
    } }, 1, {});
    expect(chain.classify({ ...context, decoded_text })).toMatchObject({
      discoverySignals: { decision: "ACCEPT", engagement_evidence: "We're hiring an independent contractor" },
    });
  });

  it("grounds compact evidence identifiers and fails closed on a made-up identifier", () => {
    const provider = backups[1];
    const sample = { ...context, source_hash:"model-evidence-numbered-test" };
    const chain = discoveryAiChain([provider], { json(_url, request) {
      const body = request?.body as {messages:Array<{content:string}>};
      const text = JSON.parse(body.messages[1].content).DATA as Record<string,string>;
      const match = Object.entries(text).find(([,value])=>value.includes("build a React checkout"));
      expect(match).toBeTruthy();
      return {choices:[{message:{content:JSON.stringify({...compactRejection, scope_evidence:match![0]})}}]};
    } },1,{});
    expect(chain.classify(sample).discoverySignals?.scope_evidence).toContain("build a React checkout");
    const ungrounded = discoveryAiChain([provider], {json:()=>({choices:[{message:{content:JSON.stringify({
      ...compactRejection,scope_evidence:"[S9999]",
    })}}]})},1,{});
    expect(ungrounded.classify({...sample,source_hash:"model-evidence-missing-test"}).warning).toContain("unsupported evidence quote");
  });
});

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

describe("OpenAI-compatible discovery adapter", () => {
  const openAiOptions = {
    enabled: true,
    freeTierConfirmed: false,
    dataUseApproved: true,
    apiKey: "sk-test-key",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
  };

  it("requests JSON and returns source-validated criteria for Stage C", () => {
    let requestBody: any;
    const http: Http = {
      json: (url, request) => {
        expect(url).toBe("https://api.openai.com/v1/chat/completions");
        expect(request?.headers?.Authorization).toBe("Bearer sk-test-key");
        requestBody = request?.body;
        return { choices: [{ message: { content: JSON.stringify(signals) } }] };
      },
    };
    const result = classifyDiscoveryAI(http, {
      ...context,
      source_hash: context.source_hash.replace("adapter", "openai-success"),
    }, { ...openAiOptions, provider: "openai" });

    expect(result).toEqual({ signals, method: "openai-compatible" });
    expect(requestBody).toMatchObject({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
    });
    expect(requestBody.messages[0].content).toContain('"required_skills"');
  });

  it("fails closed without data-use approval and validates endpoint/model errors", () => {
    let calls = 0;
    const http: Http = { json: () => { calls++; return {}; } };
    expect(classifyDiscoveryAI(http, context, {
      ...openAiOptions, provider: "openai", dataUseApproved: false, freeTierConfirmed: false,
    }).warning).toContain("data-use approval");
    expect(classifyDiscoveryAI(http, context, {
      ...openAiOptions, provider: "openai", baseUrl: "http://127.0.0.1:8080/v1",
    }).warning).toContain("AI_API_BASE_URL");
    expect(calls).toBe(0);
    expect(openAICompletionEndpoint("https://openrouter.ai/api/v1")).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(() => openAICompletionEndpoint("https://127.0.0.1/v1")).toThrow();
    expect(() => openAICompletionEndpoint("https://api.openai.com/v1?redirect=https://example.com")).toThrow();
  });

  it("uses deterministic fallback on provider quota errors and invalid evidence", () => {
    const quota: Http = {
      json: () => { throw new Error("Provider request failed: HTTP 429"); },
    };
    const invalidEvidence: Http = {
      json: () => ({
        choices: [{ message: { content: JSON.stringify({
          ...signals,
          evidence_quotes: [{ field: "skill", quote: "invented framework" }],
        }) } }],
      }),
    };
    expect(classifyDiscoveryAI(quota, {
      ...context, source_hash: context.source_hash.replace("adapter", "openai-quota"),
    }, { ...openAiOptions, provider: "openai" }).warning).toContain("quota/rate limit");
    expect(classifyDiscoveryAI(invalidEvidence, {
      ...context, source_hash: context.source_hash.replace("adapter", "openai-invalid"),
    }, { ...openAiOptions, provider: "openai" }).signals).toBeUndefined();
  });
});
