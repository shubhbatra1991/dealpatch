import { z } from "zod";
import { dealSchema } from "../deals/schema";
import { isoDateTime, nonEmptyString } from "../validation";
import { pipelineViewColumns, type PipelineViewConfig, type SavedView } from "./saved-view";

export const savedViewNameSchema = z.string().trim().min(1, "Enter a view name.").max(80, "Use 80 characters or fewer.");
export const pipelineViewConfigSchema = z.strictObject({
  search: z.string().max(1000),
  filters: z.strictObject({ stage: dealSchema.shape.stage.optional(), risk: dealSchema.shape.risk.optional() }),
  sorting: z.array(z.strictObject({ id: z.enum(pipelineViewColumns), desc: z.boolean() })).max(1),
  visibleColumns: z.array(z.enum(pipelineViewColumns)).max(pipelineViewColumns.length).refine(columns => new Set(columns).size === columns.length, "Columns must be unique.").refine(columns => columns.includes("accountName") && columns.includes("title"), "Account and Deal columns must remain visible."),
}) satisfies z.ZodType<PipelineViewConfig>;

export const savedViewInputSchema = pipelineViewConfigSchema.extend({ name: savedViewNameSchema, entityType: z.literal("pipeline") });
export const savedViewSchema = savedViewInputSchema.extend({ id: nonEmptyString, createdAt: isoDateTime, updatedAt: isoDateTime }) satisfies z.ZodType<SavedView>;
