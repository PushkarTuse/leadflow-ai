import { z } from "zod";
import { externalOrigin } from "./external-leads";
import type { Http } from "./adapters";

const localBusinessSchema = z.object({
  id: z.number().int().positive(),
  source: z.string().min(1).max(80),
  source_id: z.string().min(1).max(500),
  category: z.literal("local_business"),
  name: z.string().min(1).max(500),
  title: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().nullish(),
  pagespeed_mobile: z.number().nullable().optional(),
  rating: z.number().nullable().optional(),
  rating_count: z.number().int().nullable().optional(),
  score: z.number().min(0).max(100),
  signal: z.string().max(2000),
  url: z.string().nullish(),
  status: z.enum(["new", "contacted", "replied", "won", "lost", "ignored"]).optional(),
  notes: z.string().nullish(),
});

const pageSchema = z.object({
  ok: z.literal(true),
  total: z.number().int().nonnegative(),
  count: z.number().int().min(0).max(200),
  offset: z.literal(0),
  leads: z.array(z.unknown()).max(200),
});

const GOOGLE_PLACES_SOURCES = new Set(["google_places", "google_nearby"]);
const apiLeadSchema = z.object({
  ok: z.literal(true),
  lead: z.object({
    category: z.literal("local_business"),
    source: z.string(),
  }),
});
const updateSchema = z.object({ ok: z.literal(true) });
const statuses = ["new", "contacted", "replied", "won", "lost", "ignored"] as const;

/**
 * Manual-only sync into the separate local-business calling queue.
 * Google Places API content is intentionally excluded from prospect exports.
 */
export function pullLocalBusinesses(
  http: Http,
  options: { origin: string; token: string },
  upsert: (row: Record<string, unknown>) => boolean,
  guard: () => void = () => {},
) {
  const origin = externalOrigin(options.origin);
  if (options.token.length < 32 || /[\r\n]/.test(options.token)) {
    throw new Error("External API token must be at least 32 characters");
  }
  guard();
  const rawPage = http.json(
    `${origin}/leads?category=local_business&exclude_source=google_places%2Cgoogle_nearby&sort=score&order=desc&limit=200&offset=0`,
    { headers: { Authorization: `Bearer ${options.token}` } },
  );
  const page = pageSchema.parse(rawPage);
  if (page.count !== page.leads.length) throw new Error("Local-business page mismatch");

  const counts = { imported: 0, duplicates: 0, invalid: 0, excluded: 0 };
  for (const raw of page.leads) {
    guard();
    const parsed = localBusinessSchema.safeParse(raw);
    if (!parsed.success) {
      counts.invalid++;
      continue;
    }
    const lead = parsed.data;
    if (GOOGLE_PLACES_SOURCES.has(lead.source)) {
      counts.excluded++;
      continue;
    }
    const existed = upsert({
      business_key: `${lead.source}:${lead.source_id}`.slice(0, 600),
      api_id: String(lead.id),
      source: lead.source,
      source_id: lead.source_id,
      name: lead.name,
      category: "local_business",
      title: lead.title ?? "",
      city: lead.city ?? "",
      country: lead.country ?? "",
      address: lead.address ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      website: lead.website ?? "",
      website_status: !lead.website
        ? "NO_WEBSITE"
        : lead.pagespeed_mobile == null
          ? "NOT_CHECKED"
          : `PAGESPEED_${lead.pagespeed_mobile}`,
      pagespeed_mobile: lead.pagespeed_mobile ?? "",
      rating: lead.rating ?? "",
      rating_count: lead.rating_count ?? "",
      score: lead.score,
      signal: lead.signal,
      source_url: lead.url ?? "",
      campaign_status: lead.status ?? "new",
      last_contacted_at: "",
      campaign_notes: lead.notes ?? "",
      synced_at: new Date().toISOString(),
    });
    existed ? counts.duplicates++ : counts.imported++;
  }
  return counts;
}

/** Push only the selected manual status/notes back to an existing non-Google local-business row. */
export function saveLocalBusinessFollowup(
  http: Http,
  options: { origin: string; token: string },
  input: { apiId: string; status: string; notes: string },
  guard: () => void = () => {},
) {
  const origin = externalOrigin(options.origin);
  if (options.token.length < 32 || /[\r\n]/.test(options.token)) {
    throw new Error("External API token must be at least 32 characters");
  }
  if (!/^[1-9]\d{0,14}$/.test(input.apiId)) throw new Error("Select a synced local-business row with a valid API ID");
  if (!(statuses as readonly string[]).includes(input.status)) throw new Error("Select a valid campaign status");
  if (input.notes.length > 2000) throw new Error("Campaign notes must be 2000 characters or fewer");

  const headers = { Authorization: `Bearer ${options.token}` };
  guard();
  const current = apiLeadSchema.parse(http.json(`${origin}/leads/${input.apiId}`, { headers }));
  if (GOOGLE_PLACES_SOURCES.has(current.lead.source)) {
    throw new Error("Google Places records cannot be added to the outreach campaign");
  }
  guard();
  updateSchema.parse(http.json(`${origin}/leads/${input.apiId}`, {
    method: "patch",
    headers,
    body: { status: input.status, notes: input.notes },
    retrySafe: false,
  }));
  return { apiId: input.apiId, status: input.status };
}
