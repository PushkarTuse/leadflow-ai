export const brand = {
  name: "Signal & Slate",
  vertical: "digital-marketing",
  email: "leadsflowwai@gmail.com",
} as const;
export const plans = [
  {
    id: "launch",
    name: "Launchpad Growth",
    price: "₹12,999",
    suffix: "/ month",
    description: "Put the right foundations in place.",
    features: [
      "1 Meta ad account · up to 2 active campaigns",
      "Local SEO setup for 1 business location",
      "Up to 4 ad variations from supplied assets",
      "A performance review every two weeks",
    ],
    note: "Best for a focused local offer. Ad spend is separate.",
    featured: false,
  },
  {
    id: "scale",
    name: "Scale Accelerator",
    price: "₹29,999",
    suffix: "/ month",
    description: "Connect your acquisition and follow-through.",
    features: [
      "Meta funnel · up to 4 active campaigns",
      "Technical + on-page SEO · up to 10 priority pages",
      "Weekly analytics and action report",
      "1 monthly social calendar · up to 12 planned posts",
    ],
    note: "Content production and community management scoped separately.",
    featured: true,
  },
  {
    id: "partner",
    name: "Omnichannel Partner",
    price: "Let’s scope it",
    suffix: "custom engagement",
    description: "A joined-up strategy for a more complex business.",
    features: [
      "Meta + Google Ads with an agreed channel plan",
      "Custom CRM lead routing and measurement design",
      "A named strategy lead for your engagement",
      "Weekly strategy calls and a shared roadmap",
    ],
    note: "Scope, capacity and fees agreed before kickoff.",
    featured: false,
  },
];
export const services = [
  {
    n: "01",
    name: "Paid media, with a point.",
    tag: "META ADS & LEAD GENERATION",
    body: "Reach the people who matter, with an offer worth responding to. We connect audience research, creative testing and a clear next step.",
    items: "Audience & offer strategy / Campaign setup / Creative testing",
  },
  {
    n: "02",
    name: "Be found. For the right reasons.",
    tag: "TECHNICAL & LOCAL SEO",
    body: "Build a search presence on solid foundations. From site structure and on-page clarity to a useful local business profile.",
    items: "Technical audits / On-page priorities / Local visibility",
  },
  {
    n: "03",
    name: "Know what moved the needle.",
    tag: "ANALYTICS & WEEKLY REPORTING",
    body: "An understandable view of spend, enquiries and the path to a sale. Every report ends with what we will change next.",
    items: "Measurement plans / Weekly insights / Funnel diagnostics",
  },
  {
    n: "04",
    name: "Show up with something to say.",
    tag: "SOCIAL STRATEGY & MANAGEMENT",
    body: "A consistent voice and a purposeful content calendar. Production, scheduling and community care shaped around your capacity.",
    items: "Content pillars / Publishing calendars / Scoped management",
  },
];
