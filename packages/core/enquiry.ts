import { z } from "zod";
export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(60),
  service: z.enum(["Buy a home", "Property consultation", "Sell a property"]),
  budget: z.enum(["Not decided", "₹40–60 lakh", "₹60–90 lakh", "₹90 lakh+"]),
  date: z.string().min(1).max(40),
  urgency: z.enum(["Exploring", "Within 3 months", "This month"]),
  question: z.string().trim().min(15).max(1000),
  consent: z.boolean(),
});
export type Enquiry = z.infer<typeof enquirySchema>;
export function qualifyEnquiry(raw: unknown) {
  const e = enquirySchema.parse(raw);
  const breakdown = [
    {
      label: "Clear requirement",
      value: e.question.length >= 35 ? 30 : 20,
      max: 30,
    },
    { label: "Service match", value: 25, max: 25 },
    {
      label: "Budget clarity",
      value: e.budget === "Not decided" ? 5 : 20,
      max: 20,
    },
    {
      label: "Timeframe",
      value:
        e.urgency === "This month"
          ? 10
          : e.urgency === "Within 3 months"
            ? 7
            : 3,
      max: 10,
    },
    { label: "Details supplied", value: 5, max: 10 },
    { label: "Contact consent", value: e.consent ? 5 : 0, max: 5 },
  ];
  const score = breakdown.reduce((sum, b) => sum + b.value, 0);
  return {
    enquiry: e,
    score,
    breakdown,
    priority: score >= 75 ? "High priority" : "Needs clarification",
    permission: e.consent
      ? "Opt-in selected (simulation)"
      : "Follow-up blocked",
    summary: `${e.name} · ${e.service} · ${e.budget} · ${e.urgency}`,
    suggestion: `Hi ${e.name}, thanks for your enquiry about ${e.service.toLowerCase()}. You mentioned: “${e.question}” ${e.budget === "Not decided" ? "Could you share a comfortable budget range?" : `We have noted your ${e.budget} budget.`} Which area would you prefer, and would ${e.date} suit an initial conversation? We will confirm availability before booking.`,
    next: e.consent
      ? "Review requirements, then confirm a suitable consultation slot."
      : "Ask for permission before any follow-up.",
  };
}
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  business: z.string().trim().min(2).max(120),
  goal: z.string().trim().min(20).max(2000),
  budget: z.string().min(1),
  consent: z.literal(true),
});
