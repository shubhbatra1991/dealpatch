import { z } from "zod";
import { isoDateTime, nonEmptyString } from "../validation";
import type { Favorite, FavoriteTarget } from "./favorite";

export const favoriteTargetSchema = z.strictObject({
  entityType: z.enum(["account", "contact", "deal"]),
  entityId: nonEmptyString,
}) satisfies z.ZodType<FavoriteTarget>;

export const favoriteSchema = favoriteTargetSchema.extend({
  id: nonEmptyString,
  createdAt: isoDateTime,
}) satisfies z.ZodType<Favorite>;
