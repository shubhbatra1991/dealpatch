import { z } from "zod";
import type { AuditAction, AuditEvent } from "./audit.types";
import { isoDateTime, nonEmptyString } from "../validation";

/** Validate event input, without creating a mutable audit-history collection. */
export const auditEventSchema = z.strictObject({
  id: nonEmptyString,
  entityType: nonEmptyString,
  entityId: nonEmptyString,
  action: z.enum(["ProposalApproved", "ProposalPartiallyApproved", "ProposalRejected", "FieldEdited", "ApprovalUndone"] satisfies AuditAction[]),
  // unknown in the model, but runtime snapshots must be serializable data.
  // Use null to represent an absent value, never undefined or executable input.
  previousValue: z.json(),
  nextValue: z.json(),
  proposalId: nonEmptyString.nullable(),
  occurredAt: isoDateTime,
}).readonly() satisfies z.ZodType<AuditEvent>;
