import type { DealRisk, DealStage } from "../deals/deal";

export const pipelineViewColumns = ["accountName", "title", "stage", "value", "ownerId", "probability", "lastActivityAt", "expectedCloseDate", "risk", "nextStep"] as const;
export type PipelineViewColumn = typeof pipelineViewColumns[number];

export interface PipelineViewConfig {
  search: string;
  filters: { stage?: DealStage; risk?: DealRisk };
  sorting: { id: PipelineViewColumn; desc: boolean }[];
  visibleColumns: PipelineViewColumn[];
}

/** Configuration only; no deal records or row selection are copied. */
export interface SavedView extends PipelineViewConfig {
  id: string;
  name: string;
  entityType: "pipeline";
  createdAt: string;
  updatedAt: string;
}
