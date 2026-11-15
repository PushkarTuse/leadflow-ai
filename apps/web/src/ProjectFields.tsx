import { useSearchParams } from "react-router-dom";
import { offers, serviceTypes } from "./studio";
export function ProjectFields() {
  const [params] = useSearchParams();
  const tier = offers.some((p) => p.id === params.get("tier"))
    ? params.get("tier")!
    : "";
  const service = serviceTypes.includes(params.get("service") || "")
    ? params.get("service")!
    : "Website";
  return (
    <>
      <label>
        Service type
        <select name="service" defaultValue={service}>
          {serviceTypes.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Package of interest
        <select name="tier" defaultValue={tier}>
          <option value="">Help me choose / custom scope</option>
          {offers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — from {p.price}
            </option>
          ))}
        </select>
      </label>
      <label>
        Phone (optional)
        <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
      </label>
    </>
  );
}
export function projectGoal(form: FormData) {
  const tier =
    offers.find((p) => p.id === form.get("tier"))?.name ||
    "Custom / help me choose";
  const phone = String(form.get("phone") || "").trim();
  const budget = String(form.get("budget") || "");
  return [
    String(form.get("goal") || ""),
    `Service: ${form.get("service")}. Package: ${tier}. Budget selection: ${budget === "launch-budget" ? "Under ₹15,000" : budget}.`,
    phone
      ? `Phone supplied for project context: ${phone}. Email is the agreed reply channel.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
