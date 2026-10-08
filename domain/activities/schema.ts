import { z } from "zod";
import type { Activity } from "./activity";
import { isoDateTime, nonEmptyString } from "../validation";

export const activitySchema = z.strictObject({
  id: nonEmptyString,
  accountId: nonEmptyString,
  dealId: nonEmptyString.optional(),
  type: z.enum(["Meeting", "Email", "Call", "Note"]),
  title: nonEmptyString,
  summary: nonEmptyString,
  occurredAt: isoDateTime,
  participants: z.array(nonEmptyString).optional(),
}) satisfies z.ZodType<Activity>;
