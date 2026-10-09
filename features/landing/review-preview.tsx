const changes = [
  { field: "Probability", before: "20%", after: "45%" },
  { field: "Stage", before: "Discovery", after: "Evaluation" },
] as const;

/** An illustrative, server-rendered preview. It never reads or mutates workspace data. */
export function ReviewPreview({ detailed = false }: { detailed?: boolean }) {
  return <figure className="landing-preview">
    <figcaption className="landing-preview-bar"><span>DealPatch / Review Queue</span><span>Illustrative preview</span></figcaption>
    <div className="landing-preview-body">
      <div className="landing-preview-heading"><div><p className="landing-eyebrow">Human review required</p><p className="landing-preview-account">Avelmere Systems</p><p>Commercial workflow rollout</p></div><span className="landing-confidence">72%<span>demo confidence</span></span></div>
      <div className="landing-source"><span>Source activity</span><strong>Call · Discovery follow-up</strong></div>
      <div className="landing-preview-diffs">
        {changes.map(change => <div className="landing-preview-change" key={change.field}>
          <div className="landing-preview-field"><span aria-hidden="true" className="landing-check">✓</span><strong>{change.field}</strong><span>Selected for review</span></div>
          <div className="landing-diff-values"><dl><dt>Current value</dt><dd>{change.before}</dd></dl><span aria-hidden="true">→</span><dl><dt>Proposed value</dt><dd>{change.after}</dd></dl></div>
        </div>)}
      </div>
      <div className="landing-evidence"><p className="landing-eyebrow">Supporting evidence</p><blockquote>The sponsor confirmed that discovery is complete and IT will begin the technical assessment.</blockquote><p>Captured from the source activity · Fictional content</p></div>
      {detailed && <p className="landing-preview-note">Only selected changes are applied. Captured values are checked against current data before approval.</p>}
    </div>
    <div className="landing-preview-actions" aria-label="Example review actions, shown for illustration"><span>Edit</span><span className="landing-example-primary">Approve selected (2)</span><span>Reject</span><span className="landing-human">Human decision</span></div>
  </figure>;
}
