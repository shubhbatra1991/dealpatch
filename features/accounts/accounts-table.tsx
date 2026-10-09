"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnFiltersState, type SortingState } from "@tanstack/react-table";
import { useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import { accountColumns } from "./accounts-columns";
import { accountStatuses, matchesAccountSearch, missingRegionFilter, type AccountRow } from "./accounts-model";

const control = "h-8 rounded-sm border border-border-strong bg-surface px-2 text-xs text-text";

export function AccountsTable({ data }: { data: AccountRow[] }) {
  "use no memo";
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [focusedId, setFocusedId] = useState<string>();
  const tableRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 uses mutable instance methods; this component opts out of compiler memoization.
  const table = useReactTable({
    data, columns: accountColumns,
    state: { globalFilter: search, columnFilters, sorting }, onGlobalFilterChange: setSearch, onColumnFiltersChange: setColumnFilters, onSortingChange: setSorting,
    getRowId: row => row.id, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(),
    getColumnCanGlobalFilter: column => column.id === "name",
    globalFilterFn: (row, _id, value: string) => matchesAccountSearch(row.original, value),
    enableMultiSort: false,
  });
  const rows = table.getRowModel().rows;
  const index = rows.findIndex(row => row.id === focusedId);
  const regions = [...new Set(data.map(row => row.region).filter((region): region is string => Boolean(region)))].sort();
  const linkFor = (id: string) => Array.from(tableRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-account-link]") ?? []).find(link => link.dataset.accountLink === id);
  function focusRow(next: number) {
    const row = rows[next];
    if (row) { setFocusedId(row.id); linkFor(row.id)?.focus(); }
  }
  useWorkspaceShortcuts({ next: () => focusRow(Math.min(rows.length - 1, index + 1)), previous: () => focusRow(index < 0 ? 0 : Math.max(0, index - 1)), open: () => { const row = rows[Math.max(0, index)]; if (row) linkFor(row.id)?.click(); } });
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const element = event.target as HTMLElement;
    const id = element.closest<HTMLAnchorElement>("a[data-account-link]")?.dataset.accountLink;
    if (!id && element !== tableRef.current) return;
    const current = rows.findIndex(row => row.id === id);
    let next: number;
    switch (event.key) {
      case "ArrowDown": next = Math.min(rows.length - 1, current + 1); break;
      case "ArrowUp": next = Math.max(0, current - 1); break;
      case "Home": next = 0; break;
      case "End": next = rows.length - 1; break;
      default: return;
    }
    event.preventDefault(); focusRow(next);
  }
  function clearFilters() { setSearch(""); setColumnFilters([]); }
  const filtered = Boolean(search.trim() || columnFilters.length);
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="workspace-toolbar flex flex-wrap items-end gap-2">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-text-muted">Search accounts<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Account, industry, region or owner…" className={`${control} w-full sm:max-w-96`} /></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">Status<select value={(table.getColumn("status")?.getFilterValue() as string) ?? ""} onChange={event => table.getColumn("status")?.setFilterValue(event.target.value || undefined)} className={control}><option value="">All statuses</option>{accountStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">Region<select value={(table.getColumn("region")?.getFilterValue() as string) ?? ""} onChange={event => table.getColumn("region")?.setFilterValue(event.target.value || undefined)} className={control}><option value="">All regions</option>{regions.map(region => <option key={region}>{region}</option>)}{data.some(row => !row.region) && <option value={missingRegionFilter}>Not set</option>}</select></label>
      <button type="button" onClick={clearFilters} disabled={!filtered} className={`${control} hover:enabled:bg-bg-subtle disabled:border-dashed`}>Clear filters</button>
    </div>
    <p role="status" className="text-xs text-text-muted">{rows.length} of {data.length} accounts</p>
    <div ref={tableRef} tabIndex={0} role="region" aria-label="Accounts table, scroll horizontally for more columns" onKeyDown={navigate} onFocusCapture={event => setFocusedId((event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-account-link]")?.dataset.accountLink)} className="min-h-48 flex-1 overflow-auto rounded-sm border border-border">
      <table className="workspace-table w-full table-fixed border-collapse text-left text-xs" style={{ minWidth: table.getTotalSize() }}>
        <caption className="sr-only">Accounts. Sort with column header buttons. Use Tab, J/K, or up/down arrows between account links, Home/End for the first/last account, and Enter to open details. Pipeline values are grouped by currency and sort by currency group, then amount.</caption>
        <thead className="sticky top-0 z-10 bg-bg-subtle">{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => {
          const direction = header.column.getIsSorted();
          return <th key={header.id} scope="col" style={{ width: header.getSize() }} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"} className="h-9 border-b border-border px-3 font-medium text-text-muted"><button type="button" onClick={header.column.getToggleSortingHandler()} className="flex w-full items-center gap-1.5 rounded-sm whitespace-nowrap text-left hover:text-text">{flexRender(header.column.columnDef.header, header.getContext())}<span aria-hidden="true" className="text-text-subtle">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span></button></th>;
        })}</tr>)}</thead>
        <tbody>{rows.map(row => <tr key={row.id} onClick={event => { if (!(event.target as HTMLElement).closest("a, button") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) linkFor(row.id)?.click(); }} className={`h-10 cursor-pointer hover:bg-bg-subtle focus-within:bg-accent-soft ${focusedId === row.id ? "bg-accent-soft outline-1 -outline-offset-1 outline-focus-ring" : ""}`}>
          {row.getVisibleCells().map(cell => <td key={cell.id} className="border-b border-border px-3 py-2 text-text tabular-nums"><div className="truncate" title={cell.getValue() == null ? undefined : String(cell.getValue())}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div></td>)}
        </tr>)}{!rows.length && <tr><td colSpan={accountColumns.length} className="p-8 text-center"><p className="font-medium text-text">{data.length ? "No matching accounts" : "No accounts yet"}</p><p className="mt-1 text-text-muted">{data.length ? "Try a different search, status or region." : "Accounts saved in this workspace will appear here."}</p>{filtered && <button type="button" onClick={clearFilters} className="mt-3 rounded-sm font-medium text-accent underline underline-offset-4">Clear all filters</button>}</td></tr>}</tbody>
      </table>
    </div>
    <p className="text-[11px] text-text-muted">J / K or ↑ / ↓ to navigate · Enter opens an account · Pipeline values remain in their original currencies.</p>
  </div>;
}
