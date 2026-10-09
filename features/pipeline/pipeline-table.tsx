"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnFiltersState, type RowSelectionState, type SortingState, type VisibilityState } from "@tanstack/react-table";
import type { Account } from "../../domain/accounts/account";
import type { Deal } from "../../domain/deals/deal";
import { buildPipelineRows, matchesPipelineSearch, riskOrder, stageLabels, stageOrder } from "./pipeline-model";
import { pipelineColumns } from "./pipeline-columns";
import { useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import Link from "next/link";
import { dealHref } from "../deals/deal-detail-model";
import type { PipelineViewConfig } from "../../domain/saved-views/saved-view";
import { capturePipelineView, restorePipelineView } from "./pipeline-view-state";

const controlClass = "h-8 rounded-sm border border-border-strong bg-surface px-2 text-xs text-text";
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 36;
const OVERSCAN = 8;

export function PipelineTable({ deals, accounts, initialDealId, initialView, onSaveView }: { deals: Deal[]; accounts: Account[]; initialDealId?: string; initialView?: PipelineViewConfig; onSaveView?: (config: PipelineViewConfig) => void }) {
  "use no memo"; // TanStack Table v8 uses mutable instance methods.
  const data = useMemo(() => buildPipelineRows(deals, accounts), [deals, accounts]);
  const [initial] = useState(() => restorePipelineView(initialView));
  const [search, setSearch] = useState(initial.search);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initial.columnFilters);
  const [sorting, setSorting] = useState<SortingState>(initial.sorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initial.columnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | undefined>(initialDealId);
  const openLink = useRef<HTMLAnchorElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- This component explicitly opts out of compiler memoization for TanStack Table v8.
  const table = useReactTable({
    data, columns: pipelineColumns,
    state: { globalFilter: search, columnFilters, sorting, columnVisibility, rowSelection },
    onGlobalFilterChange: setSearch, onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting, onColumnVisibilityChange: setColumnVisibility, onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, value: string) => matchesPipelineSearch(row.original, value),
    getColumnCanGlobalFilter: (column) => column.id === "accountName",
    enableMultiSort: false,
  });
  const rows = table.getRowModel().rows;
  const focusedIndex = useMemo(() => focusedRowId ? rows.findIndex((row) => row.id === focusedRowId) : -1, [rows, focusedRowId]);
  // Keep a focused checkbox mounted even when pointer scrolling moves it offscreen.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index].id,
    overscan: OVERSCAN,
    scrollMargin: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    initialRect: { width: 0, height: 360 },
    rangeExtractor: (range) => {
      const visible = defaultRangeExtractor(range);
      return focusedIndex < 0 || visible.includes(focusedIndex) ? visible : [...visible, focusedIndex].sort((a, b) => a - b);
    },
  });
  const virtualRows = virtualizer.getVirtualItems();
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  useEffect(() => { virtualizer.scrollToOffset(0); }, [search, columnFilters, sorting, rows.length, virtualizer]);

  function focusRow(index: number) {
    const row = rows[index];
    if (!row) return;
    // Mount the destination before moving focus, including beyond the overscan.
    flushSync(() => setFocusedRowId(row.id));
    virtualizer.scrollToIndex(index, { align: "auto" });
    const element = Array.from(scrollRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]") ?? [])
      .find((element) => element.dataset.rowId === row.id);
    element?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
  }

  function handleRowNavigation(event: KeyboardEvent<HTMLDivElement>) {
    const element = event.target as HTMLElement;
    const rowId = element.closest<HTMLTableRowElement>("tr[data-row-id]")?.dataset.rowId;
    if (!rowId && element !== scrollRef.current) return;
    const index = rowId ? rows.findIndex((row) => row.id === rowId) : -1;
    const pageSize = Math.max(1, Math.floor(((scrollRef.current?.clientHeight ?? 360) - HEADER_HEIGHT) / ROW_HEIGHT));
    let next: number;
    switch (event.key) {
      case "ArrowDown": next = Math.min(rows.length - 1, index + 1); break;
      case "ArrowUp": next = Math.max(0, index - 1); break;
      case "Home": next = 0; break;
      case "End": next = rows.length - 1; break;
      case "PageDown": next = Math.min(rows.length - 1, Math.max(0, index) + pageSize); break;
      case "PageUp": next = Math.max(0, index - pageSize); break;
      default: return;
    }
    if (rows.length === 0) return;
    event.preventDefault();
    focusRow(next);
  }

  const highlighted = rows[Math.max(0, focusedIndex)]?.original;
  useWorkspaceShortcuts({
    next: () => focusRow(Math.min(rows.length - 1, focusedIndex + 1)),
    previous: () => focusRow(focusedIndex < 0 ? 0 : Math.max(0, focusedIndex - 1)),
    open: () => openLink.current?.click(),
  });

  function spacer(key: string, height: number) {
    return height > 0 ? <tr key={key} aria-hidden="true" role="presentation"><td colSpan={visibleColumnCount} style={{ height, padding: 0, border: 0, lineHeight: 0 }} /></tr> : null;
  }
  const selectedCount = table.getSelectedRowModel().rows.length;
  const matchingSelectedCount = table.getFilteredSelectedRowModel().rows.length;
  const filtered = search.trim() !== "" || columnFilters.length > 0;
  function clearFilters() { setSearch(""); setColumnFilters([]); }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="workspace-toolbar flex flex-wrap items-end gap-2">
        {onSaveView && <button type="button" onClick={() => onSaveView(capturePipelineView(search, columnFilters, sorting, columnVisibility))} className={controlClass}>Save view</button>}
        {highlighted ? <Link ref={openLink} href={dealHref(highlighted.id)} className={`${controlClass} flex items-center`}>Open deal</Link> : <button type="button" disabled className={`${controlClass} border-dashed`}>Open deal</button>}
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-text-muted">
          Search deals
          <input type="search" maxLength={1000} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Account, deal, owner or next step…" className={`${controlClass} w-full sm:max-w-96`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">Stage
          <select value={(table.getColumn("stage")?.getFilterValue() as string) ?? ""} onChange={(event) => table.getColumn("stage")?.setFilterValue(event.target.value || undefined)} className={controlClass}>
            <option value="">All stages</option>{stageOrder.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">Risk
          <select value={(table.getColumn("risk")?.getFilterValue() as string) ?? ""} onChange={(event) => table.getColumn("risk")?.setFilterValue(event.target.value || undefined)} className={controlClass}>
            <option value="">All risks</option>{riskOrder.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
          </select>
        </label>
        <button type="button" onClick={clearFilters} disabled={!filtered} className={`${controlClass} disabled:border-dashed hover:enabled:bg-bg-subtle`}>Clear filters</button>
        <details className="relative" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary className={`${controlClass} flex cursor-pointer list-none items-center gap-2 hover:bg-bg-subtle`}>Columns <span aria-hidden="true">⌄</span></summary>
          <fieldset className="absolute left-0 z-30 mt-1 max-h-[70dvh] w-48 space-y-1 overflow-y-auto sm:right-0 sm:left-auto rounded-sm border border-border bg-surface p-3 shadow-sm">
            <legend className="sr-only">Visible pipeline columns</legend>
            {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => <label key={column.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-text"><input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} className="size-4 accent-focus-ring" />{String(column.columnDef.header)}</label>)}
            <button type="button" onClick={() => setColumnVisibility({})} className="mt-2 text-xs font-medium underline underline-offset-4">Restore columns</button>
          </fieldset>
        </details>
      </div>
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <p role="status">{rows.length} of {data.length} deals · {selectedCount} selected{selectedCount !== matchingSelectedCount ? ` (${selectedCount - matchingSelectedCount} hidden by filters)` : ""}</p>
        {selectedCount > 0 && <button type="button" onClick={() => setRowSelection({})} className="text-text underline underline-offset-4">Clear selection</button>}
      </div>
      <div ref={scrollRef} role="region" aria-label="Pipeline deals, scroll horizontally for more columns" tabIndex={0} onKeyDown={handleRowNavigation}
        onFocusCapture={(event) => setFocusedRowId((event.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-row-id]")?.dataset.rowId)}
        className="workspace-table-scroll min-h-48 flex-1 overflow-auto rounded-sm border border-border [overflow-anchor:none]">
        <table aria-rowcount={rows.length + 1} className="workspace-table w-full table-fixed border-collapse text-left text-xs" style={{ minWidth: table.getTotalSize() }}>
          <caption className="sr-only">Sales pipeline. Sort using column header buttons. Values sort by currency, then amount. Selection applies to matching deals. Rows are virtualized. Use Tab for row actions and links, arrow keys between row checkboxes, Home or End for the first or last deal, and Page Up or Page Down to move a viewport.</caption>
          <thead className="sticky top-0 z-10 bg-bg-subtle">
            {table.getHeaderGroups().map((group) => <tr key={group.id} aria-rowindex={1} className="h-9">{group.headers.map((header) => {
              const direction = header.column.getIsSorted();
              return <th key={header.id} scope="col" aria-sort={header.column.getCanSort() ? direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none" : undefined} style={{ width: header.getSize() }} className="h-9 border-b border-border px-3 py-0 font-medium text-text-muted">
                {header.column.getCanSort() ? <button type="button" onClick={header.column.getToggleSortingHandler()} className="flex w-full items-center gap-2 whitespace-nowrap rounded-sm text-left hover:text-text" title={header.column.id === "value" ? "Sort by currency, then amount" : undefined}>
                  {flexRender(header.column.columnDef.header, header.getContext())}<span aria-hidden="true" className={direction ? "text-text" : "text-text-subtle"}>{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span>
                </button> : flexRender(header.column.columnDef.header, header.getContext())}
              </th>;
            })}</tr>)}
          </thead>
          <tbody>
            {virtualRows.map((item, index) => {
              const row = rows[item.index];
              const previousEnd = index === 0 ? HEADER_HEIGHT : virtualRows[index - 1].end;
              return <Fragment key={row.id}>
                {spacer(`${row.id}-gap`, item.start - previousEnd)}
                <tr data-row-id={row.id} data-selected={row.getIsSelected()} onDoubleClick={event => { if (!(event.target as HTMLElement).closest("input, button, a")) event.currentTarget.querySelector<HTMLAnchorElement>(`a[href]`)?.click(); }} aria-rowindex={item.index + 2} className={`h-9 ${focusedRowId === row.id ? "bg-accent-soft outline-1 -outline-offset-1 outline-focus-ring" : row.getIsSelected() ? "bg-accent-soft hover:bg-accent-soft/60" : "hover:bg-bg-subtle"}`}>
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="h-9 border-b border-border p-0 text-text">
                    <div className="flex h-[35px] items-center overflow-hidden px-3"><span className="block min-w-0 truncate" title={cell.getValue() == null ? undefined : String(cell.getValue())}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span></div>
                  </td>)}
                </tr>
              </Fragment>;
            })}
            {spacer("end-gap", virtualizer.getTotalSize() - ((virtualRows.at(-1)?.end ?? HEADER_HEIGHT) - HEADER_HEIGHT))}
            {rows.length === 0 && <tr><td colSpan={table.getVisibleLeafColumns().length} className="p-8 text-center text-text-muted">
              <p className="font-medium text-text">{data.length === 0 ? "No deals yet" : "No matching deals"}</p>
              <p className="mt-1">{data.length === 0 ? "Deals will appear here when added to the workspace." : "Try a different search, stage or risk filter."}</p>
              {filtered && <button type="button" onClick={clearFilters} className="mt-3 font-medium text-text underline underline-offset-4">Clear all filters</button>}
            </td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">J / K or arrow keys to navigate · Enter opens a highlighted deal · Space toggles its checkbox. Scroll horizontally for all columns.</p>

    </div>
  );
}

