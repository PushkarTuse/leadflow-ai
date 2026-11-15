import { ArrowUpRight, ArrowDown, ArrowRight, Code2, Smartphone, Box, Workflow, ShieldCheck } from 'lucide-react';
import { KapicksGallery } from '../../shared/KapicksGallery';
import { Link } from 'react-router-dom';
import { Packages } from './Packages';
import { StudioJourney } from './StudioJourney';
const services = [
  {icon: Code2, number: '01', name: 'The web.', title: 'A presence with purpose.', body: 'Distinctive websites, portfolios, CMS portals and e-commerce. Thoughtful interfaces backed by reliable engineering, from first impression to checkout.', stack: 'React / Next.js / TypeScript / Node.js', query: 'Website'},
  {icon: Smartphone, number: '02', name: 'In your pocket.', title: 'Products people return to.', body: 'Cross-platform mobile apps, startup MVPs and connected backends. One useful core experience, designed around the people who use it.', stack: 'Flutter / React Native / Firebase', query: 'Mobile App'},
  {icon: Box, number: '03', name: 'Beyond the screen.', title: 'A little more dimension.', body: 'Unity 2D/3D, interactive WebGL, product configurators, gamified apps and AR visualizers. Devices, assets and performance budgets scoped together.', stack: 'Unity C# / WebGL / AR', query: 'Unity 3D / AR'},
  {icon: Workflow, number: '04', name: 'Behind the scenes.', title: 'Give the busywork a system.', body: 'AI assistants, CRM integrations and approved email or WhatsApp workflows. Useful automation with human controls where they matter.', stack: 'Python / APIs / PostgreSQL / AI', query: 'AI Automation'},
];
const faq = [
  ['Is a domain included?', 'Launchpad includes the first year of one available domain up to ₹800; Growth includes up to ₹1,200. You approve the name and own the account. Premium names, any excess and renewals are additional. Custom domain costs are agreed in your quote.'],
  ['Can I get a complete app or game at the starting price?', 'Each starting offer covers one agreed scope. A mobile or Unity pilot tests one core experience. Full SaaS products, games, AR assets, multiple platforms and store submission receive a tailored quote.'],
  ['What happens after launch?', 'Source, account ownership and setup documentation are handed over. Growth includes 30 days of defect support and Scale includes 90 days of priority defect support. Hours and response targets are agreed in writing; new features and maintenance are separate.'],
  ['How do you approach security?', 'HTTPS, protected forms, input validation and security headers are baseline. JWT/RBAC, WAF rules, HMAC signing, CI/CD checks and encryption are selected for the system and verified within the agreed scope. These are engineering controls, not a security certification or blanket guarantee.'],
];
export function Home() {
  return <div className="engineering-home">
    <StudioJourney/>
    <section className="container engineering-hero" id="blueprint">
      <div className="hero-index"><span><i/> INDEPENDENT DEVELOPMENT STUDIO</span><span>INDIA · WORKING EVERYWHERE</span></div>
      <div className="engineering-hero-copy">
        <p className="eyebrow">CRAFT, IN EVERY LAYER.</p>
        <h1>From your idea.<br/>To their<br/><em>everyday.</em></h1>
        <p className="hero-description">We design and engineer websites, mobile apps and interactive worlds. Made to feel right. Built to work beautifully.</p>
        <div className="hero-buttons"><Link className="button" to="/contact">Start a conversation <ArrowUpRight size={17}/></Link><a className="text-link" href="#work">Selected work <ArrowRight size={16}/></a></div>
      </div>
      <div className="object-caption"><span className="caption-cross">+</span><span>FIG. 01 — THE ASSEMBLY<br/><b>Good products start beneath the surface.</b></span><span>PROCEDURAL 3D<br/>SCROLL TO EXPLORE</span></div>
      <div className="hero-bottom"><a href="#services"><ArrowDown size={16}/> A little further. A lot more possibility.</a><span>WEB / MOBILE / UNITY / AUTOMATION</span></div>
    </section>
    <div className="studio-manifesto"><div className="container"><span>THOUGHT THROUGH.<br/>THEN BUILT THROUGH.</span><p>A sharp first impression is only the beginning.<br/>We build <em>what comes after it.</em></p><span className="manifesto-mark" aria-hidden="true">↗</span></div></div>
    <section className="container section engineering-services" id="services">
      <div className="section-heading"><div><p className="eyebrow">01 / CAPABILITIES</p><h2>Different formats.<br/><em>The same care.</em></h2></div><p>One studio, from interface to integration.<br/>The right tools for your project.</p></div>
      <div className="engineering-service-grid">{services.map(s => <article key={s.number}>
        <div className="service-top"><span>{s.number} /</span><s.icon size={25} strokeWidth={1.25}/></div>
        <h3>{s.name}</h3><h4>{s.title}</h4><p>{s.body}</p><small>{s.stack}</small>
        <Link to={'/contact?service=' + encodeURIComponent(s.query)} aria-label={'Discuss ' + s.query}><ArrowUpRight size={22}/></Link>
      </article>)}</div>
      <div className="engineering-stack"><span>OUR MATERIALS</span><p>React · Next.js · Node.js · Python · Flutter · React Native · Unity C# · PostgreSQL · Azure · Cloudflare</p></div>
    </section>
    <section className="studio-method" id="about"><div className="container section">
      <p className="eyebrow">02 / THE STUDIO</p><div className="method-heading"><h2>Small enough to listen.<br/><em>Technical enough to deliver.</em></h2><p>LeadFlow AI is a founder-led studio in India. You work directly with the people designing, building and testing your product. Clear decisions, working previews and a practical handover.</p></div>
      <div className="onboarding-grid" id="how-it-works">{[['01', 'Understand', 'Your audience, goal, budget and constraints.'], ['02', 'Agree', 'A written scope, milestones and acceptance checks.'], ['03', 'Build', 'Working previews and focused feedback rounds.'], ['04', 'Launch', 'Testing, deployment and a product you own.']].map(([n,t,b]) => <div key={n}><span>{n}</span><h3>{t}</h3><p>{b}</p></div>)}</div>
    </div></section>
    <section className="container section engineering-pricing" id="security">
      <div className="section-heading"><div><p className="eyebrow">03 / SCOPE & ARCHITECTURE</p><h2>A solid foundation.<br/><em>A sensible starting point.</em></h2></div><p>Choose a starting scope.<br/>We’ll shape the right proposal together.</p></div>
      <div className="security-line"><ShieldCheck size={22}/><p><strong>Security belongs in the blueprint.</strong> Protected forms and secure defaults from day one. Access controls, signing and encryption matched to the system.</p><span>DESIGNED IN / NOT BOLTED ON</span></div>
      <Packages/>
    </section>
    <section className="engineering-work" id="work"><div className="container section">
      <div className="section-heading"><div><p className="eyebrow">04 / SELECTED WORK & EXPLORATIONS</p><h2>Less telling.<br/><em>More showing.</em></h2></div><p>Projects and clearly labelled concepts.<br/>A glimpse of what we can build together.</p></div>
      <div className="engineering-work-grid">
        <article className="engineering-work-card"><div className="bageera-cover"><KapicksGallery/><span className="work-tag">KAPICKS / WILDLIFE PHOTOGRAPHY</span></div><div className="work-description"><div><h3>Kapicks</h3><p>Explore the live wildlife photography portfolio and its collection of nature stories.</p></div><a href="https://www.kapicks.com/" target="_blank" rel="noopener noreferrer" aria-label="Visit Kapicks photography website"><ArrowUpRight size={24}/></a></div></article>
        <article className="engineering-work-card"><div className="product-cover"><span className="work-tag">INTERACTIVE CONCEPT / SIMULATED DATA</span><div className="product-mock"><span><i/> LEADFLOW / ENQUIRY INTELLIGENCE</span><div className="mock-line"/><p>A good enquiry.<br/>A clear next step.</p><div className="mock-score"><b>95</b><span>/ 100<br/>SAMPLE MATCH SCORE</span><ArrowUpRight size={28}/></div></div><span className="product-note">EXPLORE. QUALIFY. REVIEW.</span></div><div className="work-description"><div><h3>A smarter enquiry experience</h3><p>Try a fictional property business. Structured leads, explainable scores and a reviewed response. No messages sent.</p><Link className="text-link" to="/demo">Explore sample experience <ArrowUpRight size={16}/></Link></div></div></article>
      </div>
    </div></section>
    <section className="container section faq"><div><p className="eyebrow">THE DETAILS MATTER</p><h2>Good questions.</h2></div><div>{faq.map(([q,a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="container engineering-final" id="project"><p className="eyebrow">05 / YOUR NEXT CHAPTER</p><div><h2>Let’s make<br/><em>something matter.</em></h2><Link className="enquiry-circle" to="/contact" aria-label="Open project enquiry"><ArrowUpRight size={44} strokeWidth={1}/></Link></div><div className="final-meta"><p>A clear brief. A thoughtful proposal.<br/>Your code. Your accounts. Your next step.</p><Link className="text-link" to="/contact">Tell us about your project <ArrowUpRight size={17}/></Link></div></section>
  </div>;
}
