export const studio = {
  name: "LeadFlow AI",
  description: "Web, mobile & interactive development studio",
  siteUrl: import.meta.env.VITE_SITE_URL || "https://leadflow-agency.pages.dev",
};
export const serviceTypes = [
  "Website",
  "Mobile App",
  "Unity 3D / AR",
  "AI Automation",
];
export const offers = [
  {
    id: "launch",
    name: "Launchpad Starter",
    price: "₹5,999",
    label: "A focused first presence",
    featured: false,
    scope: "One polished page for a local business, portfolio or new offer.",
    items: [
      "Up to 6 sections using a tailored layout",
      "Contact form + WhatsApp click-to-chat link",
      "Mobile layouts, metadata and sitemap",
      "First-year domain allowance up to ₹800",
      "HTTPS, Turnstile and security headers",
      "1 consolidated revision round",
      "Source handover + 7 days of defect fixes",
    ],
    excludes: "Extra pages, CMS, payments and copywriting quoted separately.",
  },
  {
    id: "business",
    name: "Growth Web & App Suite",
    price: "₹18,999",
    label: "Room for your business to grow",
    featured: true,
    scope:
      "One selected scope: a business website, focused app pilot or Unity WebGL experience.",
    items: [
      "Up to 5 web pages OR 3 pilot screens OR 1 Unity scene",
      "One enquiry workflow connected to email or CRM",
      "First-year domain allowance up to ₹1,200",
      "JWT/RBAC and WAF configuration where applicable",
      "2 revision rounds + handover session",
      "Source handover + 30 days of defect fixes",
    ],
    excludes:
      "One platform and core flow. Full apps, payments, assets and additional roles need a tailored scope.",
  },
  {
    id: "pilot",
    name: "Scale, Custom Apps & Unity 3D",
    price: "₹44,999+",
    label: "Custom scope, built around you",
    featured: false,
    scope:
      "A scoped first release of a SaaS, mobile app, Unity 3D/AR experience or connected system.",
    items: [
      "Discovery, user flow and acceptance checks",
      "One core journey on one target platform",
      "HMAC-SHA256 signing and CI/CD checks as applicable",
      "AES-256 at rest through a suitable data provider",
      "2 milestone reviews + setup documentation",
      "Source handover + 90 days of priority defect support",
    ],
    excludes:
      "Final features, domain allowance, infrastructure, security controls and SLA response hours agreed in the custom quote.",
  },
];
