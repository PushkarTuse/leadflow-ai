import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { offers } from "./studio";
export function Packages() {
  return (
    <div>
      <div className="packages">
        {offers.map((p) => (
          <article
            className={"package " + (p.featured ? "featured" : "")}
            key={p.id}
          >
            {p.featured && (
              <span className="recommended">A LITTLE MORE POSSIBILITY</span>
            )}
            <p className="package-kicker">{p.label}</p>
            <h3>{p.name}</h3>
            <div className="price">
              {p.price}
              <span className="starting"> onwards</span>
            </div>
            <p className="price-caption">
              One-time development fee · agreed scope
            </p>
            <p>{p.scope}</p>
            <ul>
              {p.items.map((i) => (
                <li key={i}>
                  <Check size={16} />
                  {i}
                </li>
              ))}
            </ul>
            <p className="package-limit">{p.excludes}</p>
            <Link
              className={"button " + (p.featured ? "" : "secondary")}
              to={"/contact?tier=" + p.id}
            >
              Discuss {p.name}
              <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
      <div className="pricing-terms">
        <h3>Clear costs. Clear ownership.</h3>
        <p>
          Starting prices are planning estimates, confirmed in a written quote.
          You supply approved copy, images and brand assets. Launchpad includes
          one first-year domain up to ₹800; Growth includes up to ₹1,200.
          You approve the name and own the account. Premium names, any excess,
          renewals, hosting usage, payment fees, paid plugins, app-store accounts
          and applicable taxes are additional. Custom domain costs are quoted.
        </p>
        <p>
          Defect support covers agreed functionality during business hours. New
          features and content changes need a separate scope. Ongoing care,
          backups and response times are agreed separately. Security controls
          depend on the agreed architecture; provider encryption is not a certification.
          Scale’s 90-day priority support has written hours and response targets.
          Source and account
          handover are included in every package, subject to third-party
          licences.
        </p>
      </div>
    </div>
  );
}
