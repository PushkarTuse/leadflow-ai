import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
const packages = [
  {
    name: "Launch Website",
    label: "A strong first impression",
    price: "₹15,000",
    suffix: "starting scope",
    items: [
      "Up to 5 responsive pages",
      "Clear calls to action & enquiry form",
      "Basic SEO & owner handover",
    ],
    featured: false,
  },
  {
    name: "Website + Smart Enquiries",
    label: "The LeadFlow AI workflow",
    price: "₹25,000",
    suffix: "illustrative starting scope",
    items: [
      "Everything in Launch Website",
      "Structured intake & Sheets CRM",
      "Owner alerts & reviewed follow-ups",
    ],
    featured: true,
  },
  {
    name: "Custom Automation",
    label: "Connect the work behind the scenes",
    price: "Let’s scope it",
    suffix: "projects typically ₹20,000–₹60,000",
    items: [
      "A defined business workflow",
      "API & tool integrations",
      "Testing, documentation & handover",
    ],
    featured: false,
  },
];
export function Packages() {
  return (
    <div className="packages">
      {packages.map((p) => (
        <article
          className={"package " + (p.featured ? "featured" : "")}
          key={p.name}
        >
          {p.featured && (
            <span className="recommended">OUR SIGNATURE OFFER</span>
          )}
          <p className="package-kicker">{p.label}</p>
          <h3>{p.name}</h3>
          <div className="price">{p.price}</div>
          <p className="price-caption">{p.suffix}</p>
          <ul>
            {p.items.map((i) => (
              <li key={i}>
                <Check size={16} />
                {i}
              </li>
            ))}
          </ul>
          <Link
            className={"button " + (p.featured ? "" : "secondary")}
            to="/contact"
          >
            Discuss your project <ArrowUpRight size={16} />
          </Link>
        </article>
      ))}
    </div>
  );
}
