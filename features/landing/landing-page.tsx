import Link from "next/link";
import { ThemeControl } from "@/components/layout/theme-control";
import { EntityIcon } from "@/components/shared/entity-icon";
import { projectLinks } from "@/lib/project";
import { ReviewPreview } from "./review-preview";
import { HeroDemo } from "./hero-demo";
import { LandingReveals } from "./landing-motion";
import { WorkflowPreview } from "./workflow-preview";
import { ProductShowcase } from "./product-showcase";

const capabilities = [
  ["deal", "Pipeline", "Work through dense opportunity data with filters, saved views and keyboard navigation."],
  ["account", "Context", "Connect accounts, contacts, deals and the activities behind them."],
  ["review", "Review", "Inspect the source, evidence and field diffs before approving an update."],
  ["view", "Control", "Edit, partially approve, reject and undo. Keep an append-only audit trail."],
] as const;

const engineering = [
  ["Accessibility-first", "Semantic structure, visible focus and reduced-motion support."],
  ["Keyboard navigation", "Move through records and review changes without reaching for a mouse."],
  ["Virtualized large datasets", "Keep long tables and activity feeds bounded as local datasets grow."],
  ["Optimistic updates", "See approvals immediately, with rollback if persistence fails."],
  ["Stale-change protection", "Check captured values before applying changes to newer records."],
  ["Automated tests", "Exercise domain rules and real local persistence workflows."],
  ["Cross-browser validation", "Validate core workflows in Chromium, Firefox and WebKit."],
] as const;

function ExploreLink({ children = "Explore workspace", secondary = false }: { children?: React.ReactNode; secondary?: boolean }) {
  return <Link href="/workspace" prefetch={false} className={secondary ? "landing-link" : "landing-button"}>{children}<span aria-hidden="true">↗</span></Link>;
}

export function LandingPage() {
  return <div className="landing">
    <LandingReveals />
    <a href="#landing-main" className="landing-skip">Skip to content</a>
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <a href="#" aria-label="DealPatch home" className="landing-brand"><span aria-hidden="true">DP</span>DealPatch</a>
        <nav aria-label="Product navigation"><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#open-source">Open source</a></nav>
        <div className="landing-header-controls"><ThemeControl /><ExploreLink /></div>
      </div>
    </header>
    <main id="landing-main" tabIndex={-1}>
      <section className="landing-container landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span className="landing-status-dot" aria-hidden="true" />Open source · Local first · Human reviewed</p>
          <h1 id="landing-title">Human-reviewed automation for <span>modern sales workflows.</span></h1>
          <p className="landing-lead">Activities become proposed CRM updates. See exactly what will change, decide what gets applied, and keep every decision auditable and undoable.</p>
          <div className="landing-cta"><ExploreLink /><a href={projectLinks.source} className="landing-secondary">View source <span aria-hidden="true">↗</span></a></div>
          <p className="landing-hero-footnote">An educational B2B sales workspace. Fictional data. No account required.</p>
        </div>
        <div className="landing-hero-preview"><HeroDemo /><p className="landing-preview-caption">A suggestion is a starting point. You make the decision.</p></div>
      </section>

      <section data-landing-reveal id="how-it-works" className="landing-section landing-band" aria-labelledby="workflow-title">
        <div className="landing-container">
          <div className="landing-section-heading"><div><p className="landing-eyebrow">How it works</p><h2 id="workflow-title">From source activity to a reviewed change.</h2></div><p>V1 uses deterministic local simulated intelligence, not an external LLM. Nothing is applied automatically.</p></div>
          <WorkflowPreview />
        </div>
      </section>

      <section data-landing-reveal id="product" className="landing-container landing-section" aria-labelledby="product-title">
        <p className="landing-eyebrow">Interactive product showcase</p><h2 id="product-title">Context for the work. Control over the changes.</h2>
        <ProductShowcase />
        <div className="landing-capabilities">{capabilities.map(([type, title, description]) => <div key={title}><EntityIcon type={type} className="size-5 text-accent" /><h3>{title}</h3><p>{description}</p></div>)}</div>
      </section>

      <section data-landing-reveal id="human-review" className="landing-container landing-section landing-review-section" aria-labelledby="review-title">
        <div><p className="landing-eyebrow">Why human review matters</p><h2 id="review-title">See the evidence.<br />Review the difference.</h2><p className="landing-lead">A proposed update should explain itself. Compare current and proposed values, read the source, and approve only what you trust.</p><ul className="landing-review-principles"><li><strong>Visibility.</strong> See every field difference and the evidence behind it.</li><li><strong>Control.</strong> Edit a suggestion, approve selected fields, or reject it. Newer values are protected.</li><li><strong>Traceability.</strong> Follow each decision back to its source activity and append-only audit history.</li><li><strong>Undoability.</strong> Restore previous values safely while keeping the original decision on record.</li></ul><ExploreLink secondary>Try the review workflow</ExploreLink></div>
        <ReviewPreview detailed />
      </section>

      <section data-landing-reveal id="local-first" className="landing-section landing-band" aria-labelledby="local-title"><div className="landing-container landing-local">
        <div><p className="landing-eyebrow">Local-first by design</p><h2 id="local-title">A workspace you can explore.<br />No service to configure.</h2><p>Built for learning, experimentation and portfolio demonstration. DealPatch explores frontend engineering and human-reviewed automation; it is not a production-ready CRM.</p></div>
        <div><ul className="landing-local-facts">{["Fictional companies and people", "No account required", "No external database", "No external AI provider", "No API keys or environment variables", "Runs locally · Data stays in this browser"].map(fact => <li key={fact}><span aria-hidden="true">✓</span>{fact}</li>)}</ul><pre aria-label="Local setup commands"><code>npm install{"\n"}npm run dev</code></pre><p className="landing-storage-note">Workspace data lives in IndexedDB. Clearing browser storage resets local work.</p></div>
      </div></section>

      <section data-landing-reveal id="engineering" className="landing-container landing-section" aria-labelledby="engineering-title">
        <div className="landing-section-heading"><div><p className="landing-eyebrow">Engineering quality</p><h2 id="engineering-title">Built to make the details inspectable.</h2></div><p>A working educational project, with care for the interactions that make a dense workspace usable.</p></div>
        <ul className="landing-engineering">{engineering.map(([title, description]) => <li key={title}><span aria-hidden="true">✓</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ul>
        <a className="landing-link" href={projectLinks.documentation}>Explore the engineering notes <span aria-hidden="true">↗</span></a>
      </section>

      <section data-landing-reveal id="open-source" className="landing-section landing-band" aria-labelledby="source-title"><div className="landing-container landing-open"><div><p className="landing-eyebrow">Read it. Run it. Learn from it.</p><h2 id="source-title">Open source, under the MIT license.</h2><p>An educational CRM workspace you can explore, run locally and learn from. Read the implementation or try the fictional demo.</p><div className="landing-source-links"><a href={projectLinks.documentation}>Documentation <span aria-hidden="true">↗</span></a><a href={projectLinks.license}>MIT License <span aria-hidden="true">↗</span></a></div></div><div className="landing-open-actions"><ExploreLink /><a href={projectLinks.source} className="landing-secondary">View source <span aria-hidden="true">↗</span></a></div></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-container"><div><strong>DealPatch</strong><p>Open-source educational CRM workspace</p><ul className="landing-stack" aria-label="Built with"><li>Next.js</li><li>React</li><li>TypeScript</li></ul></div><nav aria-label="Project links"><Link href="/workspace" prefetch={false}>Workspace</Link><a href={projectLinks.source}>GitHub</a><a href={projectLinks.documentation}>Documentation</a><a href={projectLinks.security}>Security</a><a href={projectLinks.license}>MIT License</a></nav></div></footer>
  </div>;
}
