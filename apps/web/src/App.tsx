import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { studio } from "./studio";
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
      "/": "Web, mobile & interactive development studio",
      "/demo": "Interactive property demo",
      "/services": "Services & packages",
      "/contact": "Let’s build your next step",
      "/privacy": "Privacy — review draft",
      "/terms": "Terms — review draft",
    };
    document.title =
      (titles[location.pathname] || "Page not found") + " | " + studio.name;
  }, [location.pathname, location.hash]);
  return (
    <div className={location.pathname === '/demo' ? 'demo-shell' : 'engineering-shell'}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label={studio.name + " home"}>
            <span className="brand-icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {studio.name}
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
            <NavLink to="/services">Services & pricing</NavLink>
            <Link to="/#work">Our work</Link>
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
                  <p className="eyebrow">WEB · MOBILE · UNITY · AUTOMATION</p>
                  <h1>Services with a clear starting point.</h1>
                  <p>
                    From a focused website to a custom product. Agree the scope,
                    costs and acceptance checks before work begins.
                  </p>
                </div>
                <Packages />
                <section className="note-panel">
                  <h2>Need something more specific?</h2>
                  <p>
                    E-commerce with Razorpay, UPI or Stripe, custom CMS portals,
                    production mobile apps, Unity 3D/AR and AI integrations
                    receive a tailored quote. We define payment flows, devices,
                    assets, security controls and recurring costs together.
                  </p>
                  <Link className="text-link" to="/contact">
                    Request a custom scope <ArrowUpRight size={16} />
                  </Link>
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
            {studio.name}
          </Link>
          <p>Websites. Apps. Interactive experiences.</p>
          <Link to="/contact">
            Build something useful <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} {studio.name} · Development studio ·
            India
          </span>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <span>Built with care. Yours to own.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
