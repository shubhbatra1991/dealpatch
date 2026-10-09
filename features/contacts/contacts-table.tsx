"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnFiltersState, type SortingState } from "@tanstack/react-table";
import { useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import { contactColumns } from "./contacts-columns";
import { matchesContactSearch, missingContactRegion, type ContactRow } from "./contacts-model";

const control = "h-8 rounded-sm border border-border-strong bg-surface px-2 text-xs text-text";

export function ContactsTable({ data }: { data: ContactRow[] }) {
  "use no memo";
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [focusedId, setFocusedId] = useState<string>();
  const tableRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 uses mutable instance methods; this component opts out of compiler memoization.
  const table = useReactTable({
    data, columns: contactColumns,
    state: { globalFilter: search, columnFilters, sorting }, onGlobalFilterChange: setSearch, onColumnFiltersChange: setColumnFilters, onSortingChange: setSorting,
    getRowId: row => row.id, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(),
    getColumnCanGlobalFilter: column => column.id === "name",
    globalFilterFn: (row, _id, value: string) => matchesContactSearch(row.original, value),
    enableMultiSort: false,
  });
  const rows = table.getRowModel().rows;
  const index = rows.findIndex(row => row.id === focusedId);
  const virtual = rows.length > 200;
  const virtualizer = useVirtualizer({ count: rows.length, enabled: virtual, getScrollElement: () => tableRef.current, estimateSize: () => 40, getItemKey: i => rows[i].id, overscan: 8, scrollMargin: 36, scrollPaddingStart: 36, initialRect: { width: 0, height: 360 }, rangeExtractor: range => { const visible = defaultRangeExtractor(range); return index < 0 || visible.includes(index) ? visible : [...visible, index].sort((a, b) => a - b); } });
  const rendered = virtual ? virtualizer.getVirtualItems() : rows.map((row, index) => ({ key: row.id, index, start: 36 + index * 40, end: 36 + (index + 1) * 40 }));
  useEffect(() => { if (virtual) virtualizer.scrollToOffset(0); }, [search, columnFilters, sorting, virtual, virtualizer]);
  const regions = useMemo(() => [...new Set(data.map(row => row.region).filter((region): region is string => Boolean(region)))].sort(), [data]);
  const accounts = useMemo(() => [...new Map(data.map(row => [row.accountId, row.accountName ?? "Unavailable account"])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [data]);
  const linkFor = (id: string) => Array.from(tableRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-contact-link]") ?? []).find(link => link.dataset.contactLink === id);
  function focusRow(next: number) {
    const row = rows[next];
    if (row) { flushSync(() => setFocusedId(row.id)); if (virtual) virtualizer.scrollToIndex(next, { align: "auto" }); linkFor(row.id)?.focus(); }
  }
  useWorkspaceShortcuts({ next: () => focusRow(Math.min(rows.length - 1, index + 1)), previous: () => focusRow(index < 0 ? 0 : Math.max(0, index - 1)), open: () => { const row = rows[Math.max(0, index)]; if (row) linkFor(row.id)?.click(); } });
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const element = event.target as HTMLElement;
    const id = element.closest<HTMLAnchorElement>("a[data-contact-link]")?.dataset.contactLink;
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
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-text-muted">Search contacts<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, role, email or account…" className={`${control} w-full sm:max-w-96`} /></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">Status<select value={(table.getColumn("status")?.getFilterValue() as string) ?? ""} onChange={event => table.getColumn("status")?.setFilterValue(event.target.value || undefined)} className={control}><option value="">All statuses</option>{(["Active", "Inactive"] as const).map(status => <option key={status}>{status}</option>)}</select></label>
      <label className="flex max-w-full flex-col gap-1 text-xs font-medium text-text-muted">Account<select value={(table.getColumn("accountId")?.getFilterValue() as string) ?? ""} onChange={event => table.getColumn("accountId")?.setFilterValue(event.target.value || undefined)} className={`${control} max-w-64`}><option value="">All accounts</option>{accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">Region<select value={(table.getColumn("region")?.getFilterValue() as string) ?? ""} onChange={event => table.getColumn("region")?.setFilterValue(event.target.value || undefined)} className={control}><option value="">All regions</option>{regions.map(region => <option key={region}>{region}</option>)}{data.some(row => !row.region) && <option value={missingContactRegion}>Not set</option>}</select></label>
      <button type="button" onClick={clearFilters} disabled={!filtered} className={`${control} hover:enabled:bg-bg-subtle disabled:border-dashed`}>Clear filters</button>
    </div>
    <p role="status" className="text-xs text-text-muted">{rows.length} of {data.length} contacts</p>
    <div ref={tableRef} tabIndex={0} role="region" aria-label="Contacts table, scroll horizontally for more columns" onKeyDown={navigate} onFocusCapture={event => setFocusedId((event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-contact-link]")?.dataset.contactLink)} className="min-h-48 flex-1 overflow-auto rounded-sm border border-border">
      <table aria-rowcount={rows.length + 1} className="workspace-table w-full table-fixed border-collapse text-left text-xs" style={{ minWidth: table.getTotalSize() }}>
        <caption className="sr-only">Contacts. Sort with column header buttons. Use Tab, J/K, or up/down arrows between contact links, Home/End for the first/last contact, and Enter to open details. Open Deals counts account opportunities. Pending Reviews counts proposals targeting this contact. Large lists are virtualized; use arrows, Home and End to reach rows outside the rendered window.</caption>
        <thead className="sticky top-0 z-10 bg-bg-subtle">{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => {
          const direction = header.column.getIsSorted();
          return <th key={header.id} scope="col" style={{ width: header.getSize() }} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"} className="h-9 border-b border-border px-3 font-medium text-text-muted"><button type="button" onClick={header.column.getToggleSortingHandler()} className="flex w-full items-center gap-1.5 rounded-sm whitespace-nowrap text-left hover:text-text">{flexRender(header.column.columnDef.header, header.getContext())}<span aria-hidden="true" className="text-text-subtle">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span></button></th>;
        })}</tr>)}</thead>
        <tbody>{rendered.map((item, i) => { const row = rows[item.index]; const gap = item.start - (i ? rendered[i - 1].end : 36); return <Fragment key={row.id}>
          {virtual && gap > 0 && <tr aria-hidden="true" role="presentation"><td colSpan={contactColumns.length} style={{ height: gap, padding: 0, border: 0 }} /></tr>}
          <tr data-contact-row={row.id} aria-rowindex={item.index + 2} onClick={event => { if (!(event.target as HTMLElement).closest("a, button") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) linkFor(row.id)?.click(); }} className={`h-10 cursor-pointer hover:bg-bg-subtle focus-within:bg-accent-soft ${focusedId === row.id ? "bg-accent-soft outline-1 -outline-offset-1 outline-focus-ring" : ""}`}>
          {row.getVisibleCells().map(cell => <td key={cell.id} className="h-10 border-b border-border px-3 py-0 text-text tabular-nums"><div className="truncate" title={cell.getValue() == null ? undefined : String(cell.getValue())}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div></td>)}
        </tr></Fragment>; })}{virtual && <tr aria-hidden="true" role="presentation"><td colSpan={contactColumns.length} style={{ height: Math.max(0, virtualizer.getTotalSize() - ((rendered.at(-1)?.end ?? 36) - 36)), padding: 0, border: 0 }} /></tr>}{!rows.length && <tr><td colSpan={contactColumns.length} className="p-8 text-center"><p className="font-medium text-text">{data.length ? "No matching contacts" : "No contacts yet"}</p><p className="mt-1 text-text-muted">{data.length ? "Try a different search, status, account or region." : "Contacts saved in this workspace will appear here."}</p>{filtered && <button type="button" onClick={clearFilters} className="mt-3 rounded-sm font-medium text-accent underline underline-offset-4">Clear all filters</button>}</td></tr>}</tbody>
      </table>
    </div>
    <p className="text-[11px] text-text-muted">J / K or ↑ / ↓ to navigate · Enter opens a contact · Open Deals is account-level. Last Activity requires recorded participation.</p>
  </div>;
}

