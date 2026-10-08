import { z } from "zod";
import { accountSchema } from "../accounts/schema";
import { activitySchema } from "../activities/schema";
import { contactSchema } from "../contacts/schema";
import { dealSchema } from "../deals/schema";
import { isoDateTime, nonEmptyString, percentage } from "../validation";
import type { ProposalChange } from "./proposal-change";
import type { Proposal } from "./proposal";

const editableFields = {
  Account: accountSchema.omit({ id: true, createdAt: true, updatedAt: true }).shape,
  Contact: contactSchema.omit({ id: true, accountId: true }).shape,
  Deal: dealSchema.omit({ id: true, accountId: true }).shape,
  Activity: activitySchema.omit({ id: true, accountId: true, dealId: true }).shape,
} satisfies Record<string, Record<string, z.ZodType>>;

export const proposalChangeSchema = z.strictObject({
  id: nonEmptyString,
  entityType: z.enum(["Account", "Contact", "Deal", "Activity"]),
  entityId: nonEmptyString,
  field: nonEmptyString,
  before: z.json(),
  after: z.json(),
  selected: z.boolean(),
  status: z.enum(["Pending", "Approved", "Rejected", "Edited"]),
}).superRefine((change, ctx) => {
  const fields: Record<string, z.ZodType> = editableFields[change.entityType];
  // Own-property lookup prevents inherited names such as toString being fields.
  if (!Object.hasOwn(fields, change.field)) {
    ctx.addIssue({ code: "custom", path: ["field"], message: "Field is not editable on this entity" });
    return;
  }
  const fieldSchema = fields[change.field];
  for (const key of ["before", "after"] as const) {
    // Optional model fields represent absence as null in serialized changes.
    if (change[key] === null && fieldSchema.safeParse(undefined).success) continue;
    const result = fieldSchema.safeParse(change[key]);
    if (!result.success) {
      ctx.addIssue({ code: "custom", path: [key], message: result.error.issues.map((issue) => issue.message).join("; ") });
    }
  }
  if (JSON.stringify(change.before) === JSON.stringify(change.after)) {
    ctx.addIssue({ code: "custom", path: ["after"], message: "Change must modify the value" });
  }
// The refinement above validates the entity/field/value correlation.
}).transform((change) => change as ProposalChange);

export const evidenceSchema = z.strictObject({
  type: z.literal("activity_excerpt"),
  sourceActivityId: nonEmptyString,
  text: nonEmptyString,
});

export const proposalSchema = z.strictObject({
  id: nonEmptyString,
  accountId: nonEmptyString,
  dealId: nonEmptyString.optional(),
  sourceActivityId: nonEmptyString,
  status: z.enum(["Pending", "Approved", "PartiallyApproved", "Rejected", "Superseded"]),
  confidence: percentage,
  createdAt: isoDateTime,
  changes: z.array(proposalChangeSchema).min(1),
  evidence: z.array(evidenceSchema).min(1),
}) satisfies z.ZodType<Proposal>;
