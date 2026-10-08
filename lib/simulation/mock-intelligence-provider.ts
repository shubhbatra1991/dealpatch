import { activitySchema } from "../../domain/activities/schema";
import { proposalSchema } from "../../domain/proposals/schema";
import type { IntelligenceEvent, IntelligenceProvider } from "./intelligence-provider";
import { detectDemoChanges, evidenceForSignals, findDemoSignals } from "./demo-rules";

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Simulated analysis cancelled.", "AbortError");
}
async function pause(ms: number, signal?: AbortSignal): Promise<void> {
  checkAbort(signal);
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new DOMException("Simulated analysis cancelled.", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
  checkAbort(signal);
}

export function createMockIntelligenceProvider({ stepDelayMs = 650, now = () => new Date().toISOString(), createId = () => crypto.randomUUID() }: {
  stepDelayMs?: number; now?: () => string; createId?: () => string;
} = {}): IntelligenceProvider {
  if (!Number.isFinite(stepDelayMs) || stepDelayMs < 0) throw new RangeError("Step delay must be a finite non-negative number.");
  return {
    label: "Demo intelligence",
    async *analyze(input, { signal } = {}) {
      checkAbort(signal);
      const activity = activitySchema.parse(input.activity);
      let sequence = 0;
      const event = <T extends Omit<IntelligenceEvent, "sequence" | "at">>(payload: T) => ({ ...payload, sequence: ++sequence, at: now() });
      yield event({ type: "activity_received", activityId: activity.id });
      await pause(stepDelayMs, signal);
      const signals = findDemoSignals(activity.summary);
      yield event({ type: "extracting_entities", participantIds: activity.participants ?? [], signals });
      await pause(stepDelayMs, signal);
      const account = input.accounts.find(account => account.id === activity.accountId);
      yield event({ type: "matching_account", account: account ? { id: account.id, name: account.name } : null });
      await pause(stepDelayMs, signal);
      const deal = account ? input.deals.find(deal => deal.id === activity.dealId && deal.accountId === account.id) : undefined;
      yield event({ type: "matching_deal", deal: deal ? { id: deal.id, title: deal.title } : null });
      await pause(stepDelayMs, signal);
      const changes = deal ? detectDemoChanges(activity, deal, signals) : [];
      yield event({ type: "detecting_changes", changes });
      await pause(stepDelayMs, signal);
      const confidence = changes.length ? 88 : 0;
      yield event({ type: "evaluating_confidence", confidence, basis: changes.length ? "A supported demo phrase matched a linked, open deal. This fixed demo score is not a calibrated probability." : "No supported change to an open, linked deal was found." });
      await pause(stepDelayMs, signal);
      checkAbort(signal);
      if (!account || !deal || !changes.length) {
        yield event({ type: "analysis_completed", reason: !account ? "No linked account was found. No proposal was generated." : !deal ? "No deal linked to this activity and account was found. No proposal was generated." : "No new supported changes detected. The deal may already reflect the suggestion or be closed. No proposal was generated." });
        return;
      }
      const proposal = proposalSchema.parse({
        id: `demo-proposal-${createId()}`, accountId: account.id, dealId: deal.id,
        sourceActivityId: activity.id, status: "Pending", confidence, createdAt: now(), changes,
        evidence: evidenceForSignals(activity.summary, signals).map(text => ({ type: "activity_excerpt", sourceActivityId: activity.id, text })),
      });
      yield event({ type: "proposal_generated", proposal });
    },
  };
}

export const mockIntelligenceProvider = createMockIntelligenceProvider();
