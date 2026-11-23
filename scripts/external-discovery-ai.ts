import { classifyDiscoveryAI, type Http } from '../apps/automation/adapters';
import type { DiscoveryContext } from '../packages/core/qualification';
import type { DiscoveryAiHealth, DiscoveryProviderId, ProviderFailure, ProviderHealth } from '../packages/core/discovery-ai-health';
import { discoveryBackupBaseUrls } from './external-local-config.mjs';

type ProviderOptions = Parameters<typeof classifyDiscoveryAI>[2];
type ProviderId = DiscoveryProviderId;
export type DiscoveryProvider = { id: ProviderId; options: ProviderOptions };
type Cooldown = { until: number; warning: string; reason?: ProviderFailure };

function failureReason(message: string): ProviderFailure {
  if (/\bHTTP 402\b|\bbilling\b|\bcredit balance\b|\binsufficient.credits\b|credits exhausted/i.test(message)) return 'credits';
  if (/\bHTTP 429\b|quota exhausted|quota exceeded/i.test(message)) return 'quota';
  if (/HTTP 5\d\d|service error/i.test(message)) return 'unavailable';
  if (/ETIMEDOUT|timeout|timed out/i.test(message)) return 'timeout';
  if (/evidence quote|evidence did not match/i.test(message)) return 'quote';
  if (/invalid JSON|schema|HTTP 400/i.test(message)) return 'schema';
  if (/HTTP (?:401|403|404)|(?:model|api_key).*(?:missing|invalid)|configuration/i.test(message)) return 'access';
  return 'error';
}

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
  const failureCounts = new Map<ProviderId, ProviderHealth['failures']>();
  const lastStatus = new Map<ProviderId, ProviderHealth['status']>();
  const available = () => providers.some(({ id }) => (cooldowns[id]?.until ?? 0) <= now());
  const exhausted = () => coverage.requests >= limit;

  function classify(context: DiscoveryContext) {
    const before = coverage.requests;
    const warnings: string[] = [];
    const retry = new Set<ProviderId>();
    for (const pass of [1, 2]) {
      for (const { id, options } of providers) {
        if (pass === 2 && !retry.has(id)) continue;
        if (exhausted()) {
          warnings.push('Local discovery AI request budget reached');
          break;
        }
        const cooldown = cooldowns[id];
        if (pass === 1 && cooldown && cooldown.until > now()) {
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
          lastStatus.set(id, 'ok');
          return { discoverySignals: result.signals, method: result.method, discoveryProvider: id };
        }
        const warning = `${id}: ${(result.warning ?? 'No validated decision').replace(/; (?:deterministic )?(?:local )?rules used$/i, '')}`;
        failures[warning] = (failures[warning] ?? 0) + 1;
        warnings.push(warning);
        const reason = failureReason(failedTransport + ' ' + warning);
        lastStatus.set(id, reason);
        const counts = failureCounts.get(id) ?? {};
        counts[reason] = (counts[reason] ?? 0) + 1;
        failureCounts.set(id, counts);
        const status = Number(failedTransport.match(/\bHTTP (\d{3})/)?.[1]);
        const retryAfter = Number(failedTransport.match(/\bretry-after=(\d{1,5})\b/)?.[1] ?? 0);
        const permissionError = [401, 402, 403, 404].includes(status);
        if (pass === 1 && !retryAfter && status !== 400 &&
            ['unavailable', 'timeout', 'schema', 'quote'].includes(reason)) retry.add(id);
        if (permissionError || reason === 'quota' || reason === 'credits' || status >= 500 ||
            /timeout|ETIMEDOUT|transport failure|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_(?:CONNECT_TIMEOUT|SOCKET)/i.test(failedTransport)) {
          const wait = retryAfter || (permissionError ? 300 : 60);
          cooldowns[id] = { until: now() + wait * 1_000, warning, reason };
        }
      }
    }
    if (coverage.requests > before) {
      coverage.attempted++;
      coverage.failed++;
    }
    return { warning: `Rules fallback. No AI verdict: ${[...new Set(warnings)].join('; ') || 'no approved classifier configured'}`.slice(0, 240) };
  }

  function health(finalizedBy: DiscoveryAiHealth['finalizedBy']): DiscoveryAiHealth {
    const reports = providers.map(({ id }): ProviderHealth => {
      const cooldown = cooldowns[id];
      const active = cooldown && cooldown.until > now() ? cooldown : undefined;
      return {
        id, status: active ? active.reason ?? failureReason(active.warning) : lastStatus.get(id) ?? 'not_called',
        requests: callsByProvider[id] ?? 0, verdicts: verdictsByProvider[id] ?? 0,
        failures: { ...failureCounts.get(id) },
        ...(active ? { cooldownUntil: new Date(active.until).toISOString() } : {}),
      };
    });
    return {
      providers: reports,
      allQuotaExhausted: reports.length > 0 && reports.every(p => p.status === 'quota' || p.status === 'credits'),
      allUnavailable: reports.length > 0 && reports.every(p => p.status !== 'ok' && p.status !== 'not_called'),
      requestBudgetReached: exhausted(),
      finalizedBy: { ...finalizedBy },
    };
  }

  return { classify, available, exhausted, coverage, callsByProvider, verdictsByProvider, failures, health };
}
