import type { IntelligenceEvent } from "../../lib/simulation/intelligence-provider";

export interface AnalysisState {
  status: "idle" | "running" | "completed" | "cancelled" | "error";
  events: IntelligenceEvent[];
  error?: string;
}
export const idleAnalysis: AnalysisState = { status: "idle", events: [] };
export type AnalysisAction = { type: "start" } | { type: "event"; event: IntelligenceEvent } | { type: "complete" } | { type: "cancel" } | { type: "error"; error: string } | { type: "reset" };

export function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case "start": return { status: "running", events: [] };
    case "event": return state.status === "running" ? { ...state, events: [...state.events, action.event] } : state;
    case "complete": return { ...state, status: "completed" };
    case "cancel": return { ...state, status: "cancelled" };
    case "error": return { ...state, status: "error", error: action.error };
    case "reset": return idleAnalysis;
  }
}
