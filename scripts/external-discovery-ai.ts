import { classifyDiscoveryAI, type Http } from '../apps/automation/adapters';
import type { DiscoveryContext } from '../packages/core/qualification';
import { discoveryBackupBaseUrls } from './external-local-config.mjs';

type ProviderOptions = Parameters<typeof classifyDiscoveryAI>[2];
type ProviderId = 'gemini' | 'groq' | 'cloudflare' | 'openrouter' | 'openai';
export type DiscoveryProvider = { id: ProviderId; options: ProviderOptions };
type Cooldown = { until: number; warning: string };

export function freeDiscoveryBackups(get: (name: string) => string): DiscoveryProvider[] {
  const urls = discoveryBackupBaseUrls(get('CLOUDFLARE_ACCOUNT_ID'));
  const settings = [
    { id: 'groq', apiKey: get('GROQ_API_KEY'), model: 'openai/gpt-oss-120b', reasoningEffort: 'low' },
    { id: 'cloudflare', apiKey: get('CLOUDFLARE_AI_API_TOKEN'), model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
    { id: 'openrouter', apiKey: get('OPENROUTER_API_KEY'), model: 'openrouter/free' },
  ] as const;
  return settings.flatMap(({ id, ...options }) => options.apiKey && urls[id] ? [{
    id,
    options: { ...options, baseUrl: urls[id], provider: 'openai', enabled: true, freeTierConfirmed: true, dataUseApproved: true,
      compactVerdict: true },
  }] : []);
}

export function discoveryAiChain(providers: DiscoveryProvider[], transport: Http, limit: number,
  cooldowns: Partial<Record<ProviderId, Cooldown>>, now = Date.now) {
  const coverage = { requests: 0, attempted: 0, succeeded: 0, failed: 0 };
  const callsByProvider: Partial<Record<ProviderId, number>> = {};
  const verdictsByProvider: Partial<Record<ProviderId, number>> = {};
  const failures: Record<string, number> = {};
  const available = () => providers.some(({ id }) => (cooldowns[id]?.until ?? 0) <= now());
  const exhausted = () => coverage.requests >= limit;

  function classify(context: DiscoveryContext) {
    const before = coverage.requests;
    const warnings: string[] = [];
    for (const { id, options } of providers) {
      if (exhausted()) {
        warnings.push('Local discovery AI request budget reached');
        break;
      }
      const cooldown = cooldowns[id];
      if (cooldown && cooldown.until > now()) {
        warnings.push(cooldown.warning);
        continue;
      }
      let failedTransport = '';
      const result = classifyDiscoveryAI({
        json(url, request) {
          coverage.requests++;
          callsByProvider[id] = (callsByProvider[id] ?? 0) + 1;
          try {
            return transport.json(url, request);
          } catch (error) {
            failedTransport = error instanceof Error ? error.message : '';
            throw error;
          }
        },
      }, context, options);
      if (result.signals?.decision) {
        delete cooldowns[id];
        if (coverage.requests > before) coverage.attempted++;
        coverage.succeeded++;
        verdictsByProvider[id] = (verdictsByProvider[id] ?? 0) + 1;
        return { discoverySignals: result.signals, method: result.method, discoveryProvider: id };
      }
      const warning = `${id}: ${(result.warning ?? 'No validated decision').replace(/; (?:deterministic )?(?:local )?rules used$/i, '')}`;
      failures[warning] = (failures[warning] ?? 0) + 1;
      warnings.push(warning);
      const status = Number(failedTransport.match(/\bHTTP (\d{3})/)?.[1]);
      const retryAfter = Number(failedTransport.match(/\bretry-after=(\d{1,5})\b/)?.[1] ?? 0);
      const permissionError = [401, 402, 403, 404].includes(status);
      if (permissionError || status === 429 || status >= 500 ||
          /timeout|ETIMEDOUT|transport failure|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_(?:CONNECT_TIMEOUT|SOCKET)/i.test(failedTransport)) {
        const wait = retryAfter || (permissionError ? 300 : 60);
        cooldowns[id] = { until: now() + wait * 1_000, warning };
      }
    }
    if (coverage.requests > before) {
      coverage.attempted++;
      coverage.failed++;
    }
    return { warning: `No AI verdict: ${warnings.join('; ') || 'no approved classifier configured'}`.slice(0, 240) };
  }

  return { classify, available, exhausted, coverage, callsByProvider, verdictsByProvider, failures };
}
