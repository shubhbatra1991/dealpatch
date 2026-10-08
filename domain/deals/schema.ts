import { z } from "zod";
import type { Deal } from "./deal";
import { isoDate, isoDateTime, nonEmptyString, percentage } from "../validation";

export const dealSchema = z.strictObject({
  id: nonEmptyString,
  accountId: nonEmptyString,
  title: nonEmptyString,
  stage: z.enum(["Discovery", "Evaluation", "Proposal", "Negotiation", "ClosedWon", "ClosedLost"]),
  value: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  probability: percentage,
  expectedCloseDate: isoDate.optional(),
  ownerId: nonEmptyString,
  risk: z.enum(["Low", "Medium", "High"]),
  nextStep: nonEmptyString.optional(),
  lastActivityAt: isoDateTime.optional(),
}) satisfies z.ZodType<Deal>;
