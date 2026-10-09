import Link from "next/link";
import { ThemeControl } from "@/components/layout/theme-control";
import { EntityIcon } from "@/components/shared/entity-icon";
import { projectLinks } from "@/lib/project";
import { ReviewPreview } from "./review-preview";

const workflow = [
  ["Activity", "Start with a meeting, email, call or note."],
  ["Analysis", "Local rules inspect the activity and its context."],
  ["Suggested change", "Proposed values arrive with supporting evidence."],
  ["Human review", "Edit, select, approve or reject each suggestion."],
  ["Apply", "Approved changes update the local workspace."],
  ["Audit / Undo", "Trace the decision. Restore values safely."],
] as const;
const capabilities = [
  ["deal", "Pipeline", "Work through dense opportunity data with filters, saved views and keyboard navigation."],
  ["account", "Context", "Connect accounts, contacts, deals and the activities behind them."],
  ["review", "Review", "Inspect the source, evidence and field diffs before approving an update."],
  ["view", "Control", "Edit, partially approve, reject and undo. Keep an append-only audit trail."],
] as const;

function ExploreLink({ children = "Explore workspace", secondary = false }: { children?: React.ReactNode; secondary?: boolean }) {
  return <Link href="/workspace" prefetch={false} className={secondary ? "landing-link" : "landing-button"}>{children}<span aria-hidden="true">↗</span></Link>;
}

export function LandingPage() {
  return <div className="landing">
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
        <div className="landing-hero-preview"><ReviewPreview /><p className="landing-preview-caption">A suggestion is a starting point. You make the decision.</p></div>
      </section>

      <section id="how-it-works" className="landing-section landing-band" aria-labelledby="workflow-title">
        <div className="landing-container">
          <div className="landing-section-heading"><div><p className="landing-eyebrow">A transparent workflow</p><h2 id="workflow-title">From source activity to a reviewed change.</h2></div><p>V1 uses deterministic local simulated intelligence, not an external LLM. Nothing is applied automatically.</p></div>
          <ol className="landing-workflow">{workflow.map(([title, text], index) => <li key={title}><span className="landing-step-number">{String(index + 1).padStart(2, "0")}<span aria-hidden="true"> →</span></span><h3>{title}</h3><p>{text}</p></li>)}</ol>
        </div>
      </section>

      <section id="product" className="landing-container landing-section" aria-labelledby="product-title">
        <p className="landing-eyebrow">The workspace</p><h2 id="product-title">Context for the work. Control over the changes.</h2>
        <div className="landing-capabilities">{capabilities.map(([type, title, description]) => <div key={title}><EntityIcon type={type} className="size-5 text-accent" /><h3>{title}</h3><p>{description}</p></div>)}</div>
      </section>

      <section className="landing-container landing-section landing-review-section" aria-labelledby="review-title">
        <div><p className="landing-eyebrow">The decision belongs to you</p><h2 id="review-title">See the evidence.<br />Review the difference.</h2><p className="landing-lead">A proposed update should explain itself. Compare current and proposed values, read the source, and approve only what you trust.</p><ul className="landing-review-principles"><li><strong>Edit before applying.</strong> Refine a suggested value without changing the record.</li><li><strong>Approve selectively.</strong> Apply one field, several fields, or reject the proposal.</li><li><strong>Protect newer work.</strong> Stale values block unsafe approval. Undo preserves the audit history.</li></ul><ExploreLink secondary>Try the review workflow</ExploreLink></div>
        <ReviewPreview detailed />
      </section>

      <section className="landing-section landing-band" aria-labelledby="local-title"><div className="landing-container landing-local">
        <div><p className="landing-eyebrow">Local by design</p><h2 id="local-title">A workspace you can explore.<br />No service to configure.</h2><p>Built for learning, experimentation and portfolio demonstration. DealPatch explores frontend engineering and human-reviewed automation; it is not a production-ready CRM.</p></div>
        <div><ul className="landing-local-facts">{["Fictional companies and people", "No account required", "No external database", "No external AI provider", "No API keys or environment variables", "Runs locally · Data stays in this browser"].map(fact => <li key={fact}><span aria-hidden="true">✓</span>{fact}</li>)}</ul><pre aria-label="Local setup commands"><code>npm install{"\n"}npm run dev</code></pre><p className="landing-storage-note">Workspace data lives in IndexedDB. Clearing browser storage resets local work.</p></div>
      </div></section>

      <section id="open-source" className="landing-container landing-section landing-open" aria-labelledby="source-title"><div><p className="landing-eyebrow">Read it. Run it. Learn from it.</p><h2 id="source-title">Open source, under the MIT license.</h2><p>Explore the implementation of dense tables, optimistic updates, safe Undo, accessible navigation and local persistence.</p><div className="landing-source-links"><a href={projectLinks.source}>GitHub source <span aria-hidden="true">↗</span></a><a href={projectLinks.documentation}>Documentation <span aria-hidden="true">↗</span></a><a href={projectLinks.license}>MIT License <span aria-hidden="true">↗</span></a></div></div><ExploreLink /></section>
    </main>
    <footer className="landing-footer"><div className="landing-container"><div><strong>DealPatch</strong><p>Open-source educational project</p></div><nav aria-label="Project links"><a href={projectLinks.source}>GitHub</a><a href={projectLinks.documentation}>Documentation</a><a href={projectLinks.security}>Security</a><a href={projectLinks.license}>MIT License</a></nav></div></footer>
  </div>;
}
