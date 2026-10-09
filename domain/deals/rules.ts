import type { DealStage } from "./deal";

export function isTerminalDealStage(stage: DealStage): boolean {
  return stage === "ClosedWon" || stage === "ClosedLost";
}

/** A terminal deal may be saved unchanged, but cannot be reopened in V1. */
export function assertDealStageTransition(current: DealStage, next: DealStage): void {
  if (isTerminalDealStage(current) && next !== current) {
    throw new Error("ClosedWon and ClosedLost are terminal deal stages in V1.");
  }
}
