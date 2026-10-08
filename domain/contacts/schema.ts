import { z } from "zod";
import type { Contact } from "./contact";
import { nonEmptyString } from "../validation";

export const contactSchema = z.strictObject({
  id: nonEmptyString,
  accountId: nonEmptyString,
  firstName: nonEmptyString,
  lastName: nonEmptyString,
  role: nonEmptyString.optional(),
  email: z.email().optional(),
  phone: nonEmptyString.optional(),
  status: z.enum(["Active", "Inactive"]),
}) satisfies z.ZodType<Contact>;
