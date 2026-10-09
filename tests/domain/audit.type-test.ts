import type { AuditEvent } from "../../domain/audit/audit.types";

export function assertAuditHistoryReadonly(event: AuditEvent) {
  // @ts-expect-error Historical actions cannot be rewritten.
  event.action = "ApprovalUndone";
  // @ts-expect-error Undo does not replace historical snapshots.
  event.previousValue = null;
  // @ts-expect-error An absent proposal relationship is null, not undefined.
  event.proposalId = undefined;
}
