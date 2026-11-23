export type DiscoveryProviderId = "gemini" | "groq" | "cloudflare" | "openrouter" | "openai";
export type ProviderFailure = "quota" | "credits" | "unavailable" | "timeout" | "schema" | "quote" | "access" | "error";

export interface ProviderHealth {
  id: DiscoveryProviderId;
  status: ProviderFailure | "ok" | "not_called";
  requests: number;
  verdicts: number;
  failures: Partial<Record<ProviderFailure, number>>;
  cooldownUntil?: string;
}

export interface DiscoveryAiHealth {
  providers: ProviderHealth[];
  allQuotaExhausted: boolean;
  allUnavailable: boolean;
  requestBudgetReached: boolean;
  finalizedBy: { ai: number; rules: number; sourceGuard: number };
}

const providerNames: Record<DiscoveryProviderId, string> = {
  gemini: "Gemini", groq: "Groq", cloudflare: "Cloudflare", openrouter: "OpenRouter", openai: "OpenAI",
};

const failureLabels: Record<ProviderFailure, string> = {
  quota: "Credits/quota exhausted (HTTP 429 or quota response)",
  credits: "Credits/billing exhausted",
  unavailable: "Provider unavailable",
  timeout: "Request timed out",
  schema: "Invalid JSON or response schema",
  quote: "Evidence quote failed validation",
  access: "API access or model configuration error",
  error: "Provider request failed",
};

export function discoveryAiBanner(health: DiscoveryAiHealth): string | undefined {
  if (health.allQuotaExhausted) return "All configured AI APIs hit quota or ran out of credits.";
  if (health.allUnavailable) return "All configured AI APIs were unavailable or failed to return a valid verdict.";
  if (health.requestBudgetReached) return "The local AI request budget was reached.";
}

export function providerHealthLine(provider: ProviderHealth): string {
  const name = providerNames[provider.id];
  const failures = Object.entries(provider.failures)
    .map(([reason, count]) => `${failureLabels[reason as ProviderFailure]} (${count})`);
  const status = provider.status === "ok" ? "OK" : provider.status === "not_called"
    ? "Not called" : failureLabels[provider.status];
  const details = failures.length ? ` · Failures this run: ${failures.join(", ")}` : "";
  return `${name} · ${status} · ${provider.requests} requests, ${provider.verdicts} verdicts${details}`;
}
