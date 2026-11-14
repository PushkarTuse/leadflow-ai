import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Home } from "./Home";
import { Demo } from "./Demo";
import { Contact } from "./Contact";
import { Packages } from "./Packages";
import { Legal } from "./Legal";
export function App() {
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    const titles: Record<string, string> = {
      "/": "Make every enquiry count.",
      "/demo": "Interactive property demo",
      "/services": "Services & packages",
      "/contact": "Let’s build your next step",
      "/privacy": "Privacy — review draft",
      "/terms": "Terms — review draft",
    };
    document.title =
      (titles[location.pathname] || "Page not found") + " | LeadFlow AI";
  }, [location.pathname, location.hash]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="LeadFlow AI home">
            <span className="brand-icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            leadflow<span className="brand-ai">AI</span>
          </Link>
          <button
            className="menu-toggle icon-button"
            aria-expanded={menu}
            aria-controls="navigation"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            id="navigation"
            className={menu ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            <NavLink to="/" end>
              Home
            </NavLink>
            <Link to="/#how-it-works">How it works</Link>
            <NavLink to="/demo">
              Live demo <span className="tiny-dot" />
            </NavLink>
            <NavLink to="/services">Services</NavLink>
            <Link to="/#about">About</Link>
            <Link className="button small" to="/contact">
              Let’s talk <ArrowUpRight size={16} />
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/demo" element={<Demo />} />
          <Route
            path="/services"
            element={
              <div className="container page">
                <div className="page-intro">
                  <p className="eyebrow">SMALL SCOPE. USEFUL OUTCOMES.</p>
                  <h1>
                    A clear place
                    <br />
                    to start.
                  </h1>
                  <p>
                    Choose the foundation. We’ll shape the details around your
                    business.
                  </p>
                </div>
                <Packages />
                <section className="note-panel">
                  <h2>Know what you’re signing up for.</h2>
                  <p>
                    Every quote defines pages, integrations, revisions and
                    acceptance checks. Domain and third-party costs are
                    separate. Maintenance starts at an illustrative
                    ₹2,000–₹5,000/month for agreed updates and basic monitoring;
                    response hours and limits are written into the scope.
                    Free-tier infrastructure has limits and does not include a
                    24/7 SLA.
                  </p>
                </section>
              </div>
            }
          />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route
            path="*"
            element={
              <div className="container page">
                <h1>This page took a detour.</h1>
                <Link className="button" to="/">
                  Back home
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer>
        <div className="container footer-top">
          <Link className="brand" to="/">
            leadflow<span className="brand-ai">AI</span>
          </Link>
          <p>Thoughtful websites. Better follow-through.</p>
          <Link to="/contact">
            Build something useful <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} LeadFlow AI · Working brand · India
          </span>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <span>Human decisions, always.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
