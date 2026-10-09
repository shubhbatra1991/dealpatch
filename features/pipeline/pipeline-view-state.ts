import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import { pipelineViewColumns, type PipelineViewConfig } from "../../domain/saved-views/saved-view";
import { pipelineViewConfigSchema } from "../../domain/saved-views/schema";

export const defaultPipelineView: PipelineViewConfig = { search: "", filters: {}, sorting: [{ id: "accountName", desc: false }], visibleColumns: [...pipelineViewColumns] };

export function capturePipelineView(search: string, filters: ColumnFiltersState, sorting: SortingState, visibility: VisibilityState): PipelineViewConfig {
  return pipelineViewConfigSchema.parse({ search, filters: {
    stage: filters.find(filter => filter.id === "stage")?.value,
    risk: filters.find(filter => filter.id === "risk")?.value,
  }, sorting, visibleColumns: pipelineViewColumns.filter(id => visibility[id] !== false) });
}

export function restorePipelineView(input: PipelineViewConfig = defaultPipelineView) {
  const config = pipelineViewConfigSchema.parse({ search: input.search, filters: input.filters, sorting: input.sorting, visibleColumns: input.visibleColumns });
  const columnFilters: ColumnFiltersState = [];
  if (config.filters.stage) columnFilters.push({ id: "stage", value: config.filters.stage });
  if (config.filters.risk) columnFilters.push({ id: "risk", value: config.filters.risk });
  const columnVisibility: VisibilityState = Object.fromEntries(pipelineViewColumns.map(id => [id, config.visibleColumns.includes(id)]));
  return { search: config.search, columnFilters, sorting: config.sorting, columnVisibility };
}
