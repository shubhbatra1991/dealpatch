const changes = [
  { field: "Probability", before: "20%", after: "45%" },
  { field: "Stage", before: "Discovery", after: "Evaluation" },
] as const;

/** Fictional composed UI; no repositories, simulation provider or workspace imports. */
export function ReviewPreview({ detailed = false, phase }: { detailed?: boolean; phase?: number }) {
  const step = phase ?? 6;
  return <figure className="landing-preview">
    <figcaption className="landing-preview-bar"><span>DealPatch / Review Queue</span><span>Illustrative preview</span></figcaption>
    <div className="landing-preview-body">
      <div className="landing-preview-heading"><div><p className="landing-eyebrow">Human review required</p><p className="landing-preview-account">Avelmere Systems</p><p>Commercial workflow rollout</p></div><span className="landing-confidence">72%<span>demo confidence</span></span></div>
      {phase !== undefined && <p className="landing-demo-status">{step === 8 ? "✓ 2 changes applied" : step === 7 ? "Applying selected changes…" : step >= 6 ? "2 changes selected · Ready for review" : step >= 5 ? "Supporting evidence matched" : step >= 3 ? "Proposed changes ready for review" : step === 2 ? "Analyzing activity..." : step === 1 ? "Source activity received" : "Waiting for source activity"}</p>}
      <div className="landing-source landing-demo-slot" data-visible={step >= 1}><span>Source activity</span><strong>Call · Discovery follow-up</strong></div>
      <div className="landing-preview-diffs">
        {changes.map((change, index) => <div className="landing-preview-change landing-demo-slot" data-visible={step >= index + 3} key={change.field}>
          <div className="landing-preview-field"><span aria-hidden="true" className="landing-check" data-checked={step >= 6}>{step >= 6 ? "✓" : ""}</span><strong>{change.field}</strong><span>{step >= 6 ? "Selected for review" : "Proposed change"}</span></div>
          <div className="landing-diff-values"><dl><dt>Current value</dt><dd>{change.before}</dd></dl><span aria-hidden="true">→</span><dl><dt>Proposed value</dt><dd>{change.after}</dd></dl></div>
        </div>)}
      </div>
      <div className="landing-evidence landing-demo-slot" data-visible={step >= 5}><p className="landing-eyebrow">Supporting evidence</p><blockquote>The sponsor confirmed that discovery is complete and IT will begin the technical assessment.</blockquote><p>Captured from the source activity · Fictional content</p></div>
      {detailed && <p className="landing-preview-note">Only selected changes are applied. Captured values are checked against current data before approval.</p>}
    </div>
    <div className="landing-preview-actions" aria-label="Example review actions, shown for illustration"><span>Edit</span><span className="landing-example-primary" data-applying={step === 7}>Approve selected ({step >= 6 ? 2 : 0})</span><span>Reject</span><span className="landing-human">Human decision</span></div>
  </figure>;
}
