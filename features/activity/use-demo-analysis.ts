"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { IntelligenceInput, IntelligenceProvider } from "../../lib/simulation/intelligence-provider";
import { mockIntelligenceProvider } from "../../lib/simulation/mock-intelligence-provider";
import { useAllProposals } from "../reviews/use-proposals";
import { queueProposalOptions } from "./queue-proposal";
import { reviewWriteKey } from "../reviews/approval-mutations";
import { analysisReducer, idleAnalysis } from "./analysis-state";

export function useDemoAnalysis(provider: IntelligenceProvider = mockIntelligenceProvider, sourceActivityId?: string) {
  const [state, dispatch] = useReducer(analysisReducer, idleAnalysis);
  const active = useRef<AbortController | null>(null);
  const client = useQueryClient();
  const reviewBusy = useIsMutating({ mutationKey: reviewWriteKey }) > 0;
  const proposals = useAllProposals();
  const existingProposal = proposals.data?.find(proposal => proposal.sourceActivityId === sourceActivityId);
  const queue = useMutation(queueProposalOptions(client));
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const resetQueue = queue.reset;
  const reset = useCallback(() => {
    active.current?.abort(); active.current = null;
    dispatch({ type: "reset" }); resetQueue();
  }, [resetQueue]);
  async function start(input: IntelligenceInput) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    queue.reset(); dispatch({ type: "start" });
    try {
      let terminal = false;
      for await (const event of provider.analyze(input, { signal: controller.signal })) {
        if (active.current !== controller || controller.signal.aborted) return;
        dispatch({ type: "event", event });
        terminal = event.type === "proposal_generated" || event.type === "analysis_completed";
      }
      if (active.current === controller && !controller.signal.aborted) {
        if (!terminal) throw new Error("Simulated analysis ended before producing a result. Try again.");
        dispatch({ type: "complete" });
      }
    } catch (error) {
      if (active.current !== controller) return;
      dispatch(controller.signal.aborted ? { type: "cancel" } : { type: "error", error: error instanceof Error ? error.message : "Simulated analysis failed. Try again." });
    } finally { if (active.current === controller) active.current = null; }
  }
  function cancel() {
    active.current?.abort(); active.current = null;
    dispatch({ type: "cancel" });
  }
  const generated = state.events.find(event => event.type === "proposal_generated");
  const proposal = state.status === "completed" && generated?.type === "proposal_generated" ? generated.proposal : undefined;
  return { state, start, cancel, reset, proposal, queue, reviewBusy, existingProposal, proposals, checkingSource: Boolean(sourceActivityId) && (proposals.data === undefined || proposals.isError) };
}
