import { z } from "zod";
import type { Account } from "./account";
import { isoDateTime, nonEmptyString, websiteUrl } from "../validation";

export const accountSchema = z.strictObject({
  id: nonEmptyString,
  name: nonEmptyString,
  industry: nonEmptyString.optional(),
  website: websiteUrl.optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  region: nonEmptyString.optional(),
  ownerId: nonEmptyString,
  status: z.enum(["Prospect", "Active", "Customer", "Dormant"]),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}) satisfies z.ZodType<Account>;
