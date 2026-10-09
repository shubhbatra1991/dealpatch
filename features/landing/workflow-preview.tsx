"use client";

import { useRef } from "react";
import { useMotionPlayback, useSequence } from "./landing-motion";

const workflow = [
  ["Activity", "Start with a meeting, email, call or note."],
  ["Analysis", "Local rules inspect the activity and its context."],
  ["Proposal", "Proposed values arrive with supporting evidence."],
  ["Human Review", "Edit, select, approve or reject each suggestion."],
  ["Apply", "Approved changes update the local workspace."],
  ["Audit / Undo", "Trace the decision. Restore values safely."],
] as const;
const durations = [800, 800, 800, 800, 800, 800, 0] as const;

export function WorkflowPreview() {
  const ref = useRef<HTMLOListElement>(null);
  const { reduced, playing } = useMotionPlayback(ref);
  const step = useSequence(durations, playing);
  const progress = reduced ? 6 : step;
  return <ol ref={ref} className="landing-workflow" aria-label="Human-reviewed workflow" data-progress={progress} data-playing={playing && step < 6}>
    {workflow.map(([title, text], index) => <li key={title} data-complete={progress > index} data-active={progress === index}>
      <span className="landing-step-number">{String(index + 1).padStart(2, "0")}<span aria-hidden="true"> →</span></span><h3>{title}</h3><p>{text}</p>
    </li>)}
  </ol>;
}
