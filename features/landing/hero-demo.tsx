"use client";

import { useRef, useState } from "react";
import { ReviewPreview } from "./review-preview";
import { useMotionPlayback, useSequence } from "./landing-motion";

const durations = [500, 850, 1100, 750, 750, 1000, 1000, 700, 2600] as const;

export function HeroDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const { reduced, playing } = useMotionPlayback(ref);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const active = playing && !hovered && !focused && !paused;
  const step = useSequence(durations, active, true);
  return <div ref={ref} className="landing-demo" role="group" aria-label="Scripted review demo"
    data-step={reduced ? 8 : step} data-playing={active}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <p id="hero-demo-description" className="sr-only">Fictional visual demo: a call produces probability and stage suggestions with evidence. A person selects both changes, approves them, and sees two changes applied. No workspace data is changed.</p>
    <div aria-hidden="true"><ReviewPreview phase={reduced ? 8 : step} /></div>
    <div className="landing-demo-controls"><span>{reduced ? "Static demo · Reduced motion" : paused || hovered || focused ? "Demo paused" : "Scripted demo · No CRM data changes"}</span>
      {!reduced && <button type="button" aria-describedby="hero-demo-description" aria-pressed={paused} onClick={() => setPaused(current => !current)}>{paused ? "Resume demo" : "Pause demo"}</button>}
    </div>
  </div>;
}
