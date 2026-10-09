"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (update: () => void) => {
  const query = matchMedia(reducedQuery);
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
};
const subscribeVisibility = (update: () => void) => {
  document.addEventListener("visibilitychange", update);
  return () => document.removeEventListener("visibilitychange", update);
};
const reducedSnapshot = () => matchMedia(reducedQuery).matches;
const visibleSnapshot = () => document.visibilityState === "visible";
const staticSnapshot = () => true;
const useReducedMotion = () => useSyncExternalStore(subscribeMotion, reducedSnapshot, staticSnapshot);

export function useMotionPlayback(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  const visible = useSyncExternalStore(subscribeVisibility, visibleSnapshot, staticSnapshot);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return { reduced, playing: !reduced && visible && inView };
}

/** One timeout while playing; pauses preserve the remaining time of this stage. */
export function useSequence(durations: readonly number[], playing: boolean, loop = false) {
  const [step, setStep] = useState(0);
  const clock = useRef({ step: 0, remaining: durations[0] });
  useEffect(() => {
    if (clock.current.step !== step) clock.current = { step, remaining: durations[step] };
    if (!playing || !loop && step === durations.length - 1) return;
    const started = performance.now();
    const timer = window.setTimeout(() => setStep(current => (current + 1) % durations.length), clock.current.remaining);
    return () => {
      window.clearTimeout(timer);
      clock.current.remaining = Math.max(0, clock.current.remaining - (performance.now() - started));
    };
  }, [durations, playing, loop, step]);
  return step;
}

/** Progressive enhancement: server/no-JS content stays visible. Reveal only once. */
export function LandingReveals() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".landing [data-landing-reveal]"));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        (entry.target as HTMLElement).dataset.reveal = "visible";
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    for (const section of sections) {
      if (section.getBoundingClientRect().top > innerHeight) section.dataset.reveal = "waiting";
      observer.observe(section);
    }
    return () => { observer.disconnect(); sections.forEach(section => delete section.dataset.reveal); };
  }, [reduced]);
  return null;
}
