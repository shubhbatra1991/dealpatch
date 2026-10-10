"use client";

import { useRef, useState, type KeyboardEvent } from "react";

const views = ["Pipeline", "Activity", "Review", "Audit"] as const;
const descriptions = [
  "Find the next opportunity to move forward. Compact filters and saved views keep a dense pipeline navigable.",
  "Start with the source. Local simulated analysis proposes changes and keeps the original activity in view.",
  "Compare the difference and read the evidence. A person chooses which proposed changes to apply.",
  "Follow each decision back to its source. Safe Undo restores values while preserving the audit trail.",
] as const;

export function ProductShowcase() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return <div className="landing-showcase">
    <div role="tablist" aria-label="Product views" className="landing-showcase-tabs">{views.map((view, index) => <button key={view} ref={node => { tabs.current[index] = node; }} type="button" role="tab" id={`showcase-tab-${index}`} aria-controls={`showcase-panel-${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => navigate(event, index)}>{view}</button>)}</div>
    {views.map((view, index) => <section key={view} role="tabpanel" id={`showcase-panel-${index}`} aria-labelledby={`showcase-tab-${index}`} tabIndex={0} hidden={selected !== index} className="landing-showcase-panel">
      <p className="landing-showcase-description">{descriptions[index]}</p>
      <div className="landing-showcase-surface"><p className="landing-eyebrow">Illustrative {view.toLowerCase()} preview · Fictional data</p>
        {index === 0 && <div className="landing-showcase-table" role="region" aria-label="Example pipeline table" tabIndex={0}><table><caption className="sr-only">Example pipeline opportunities</caption><thead><tr><th>Account</th><th>Deal</th><th>Stage</th><th>Risk</th><th>Value</th></tr></thead><tbody>
          <tr><th scope="row">Avelmere Systems</th><td>Commercial workflow rollout</td><td>Discovery</td><td>Low</td><td>EUR 18,000</td></tr><tr><th scope="row">Corvellan Logistics</th><td>Regional operations expansion</td><td>Evaluation</td><td>Medium</td><td>GBP 42,000</td></tr><tr><th scope="row">Arvenlis Learning</th><td>Learning platform renewal</td><td>Proposal</td><td>High</td><td>GBP 244,200</td></tr>
        </tbody></table></div>}
        {index === 1 && <div className="landing-showcase-content"><h3>Discovery follow-up · Call</h3><p>Avelmere Systems · Commercial workflow rollout</p><p>The sponsor confirmed discovery is complete. IT will begin the technical assessment.</p><ol className="landing-showcase-events"><li>✓ Source received</li><li>✓ Account and deal matched</li><li>✓ 2 proposed changes · Awaiting human review</li></ol></div>}
        {index === 2 && <div className="landing-showcase-content"><h3>Avelmere Systems · 2 proposed changes</h3><p>Current value → Proposed value</p><dl className="landing-showcase-diffs"><div><dt>Probability</dt><dd>20% <span aria-label="to">→</span> <strong>45%</strong></dd></div><div><dt>Stage</dt><dd>Discovery <span aria-label="to">→</span> <strong>Evaluation</strong></dd></div></dl><p>Evidence: discovery is complete and IT will begin assessment. Nothing is applied without approval.</p><p className="landing-showcase-example-actions">Illustrative actions: Approve selected · Edit · Reject</p></div>}
        {index === 3 && <ol className="landing-showcase-content landing-showcase-audit"><li><strong>Proposal approved</strong> · <time dateTime="2026-10-01T10:42:00Z">1 Oct · 10:42 UTC</time><p>Probability 20% → 45% · Stage Discovery → Evaluation</p><span>Source: Discovery follow-up call</span></li><li><strong>Approval undone</strong> · <time dateTime="2026-10-01T10:44:00Z">1 Oct · 10:44 UTC</time><p>Original values restored. Both decisions remain in history.</p><span>Undo checks for newer changes before restoring values.</span></li></ol>}
      </div>
    </section>)}
  </div>;
}
