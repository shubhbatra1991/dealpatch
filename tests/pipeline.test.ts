import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderWithKeyboard as renderToStaticMarkup } from "./keyboard-provider";
import { createTable, functionalUpdate, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type TableState } from "@tanstack/react-table";
import { QueryClientProvider } from "@tanstack/react-query";
import accountsJson from "../data/seed/accounts.json";
import dealsJson from "../data/seed/deals.json";
import { accountSchema } from "../domain/accounts/schema";
import { dealSchema } from "../domain/deals/schema";
import { buildPipelineRows, formatPipelineDate, matchesPipelineSearch, type PipelineRow } from "../features/pipeline/pipeline-model";
import { pipelineColumns } from "../features/pipeline/pipeline-columns";
import { PipelineTable } from "../features/pipeline/pipeline-table";
import { PipelineWorkspace } from "../features/pipeline/pipeline-workspace";
import { dealsQueryOptions } from "../features/pipeline/use-deals";
import { accountsQueryOptions } from "../features/accounts/use-accounts";
import { createQueryClient } from "../lib/query/client";
import { generateDemoDeals } from "../lib/simulation/generate-demo-deals";

const accounts = accountsJson.map((record) => accountSchema.parse(record));
const deals = dealsJson.map((record) => dealSchema.parse(record));
const data = buildPipelineRows(deals, accounts);

function makeTable(initial: Partial<TableState> = {}) {
  const table = createTable<PipelineRow>({
    data, columns: pipelineColumns, state: {}, onStateChange: () => {}, renderFallbackValue: null,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _id, value: string) => matchesPipelineSearch(row.original, value),
    getColumnCanGlobalFilter: (column) => column.id === "accountName",
  });
  table.setOptions((options) => ({ ...options, state: { ...table.initialState, ...initial }, onStateChange: (update) => table.setOptions((current) => ({ ...current, state: functionalUpdate(update, { ...table.initialState, ...current.state }) })) }));
  return table;
}

test("account joins, normalized search and exact stage/risk filters compose", () => {
  assert.equal(data[0].accountName, accounts[0].name);
  assert.equal(buildPipelineRows([deals[0]], [])[0].accountName, "Unknown account");
  const table = makeTable({ globalFilter: "  AVELMERE   rollout  " });
  assert.equal(table.getRowModel().rows.length, 1);
  table.setGlobalFilter("");
  table.getColumn("stage")!.setFilterValue("Proposal");
  table.getColumn("risk")!.setFilterValue("High");
  const expected = data.filter((row) => row.stage === "Proposal" && row.risk === "High");
  assert.deepEqual(table.getRowModel().rows.map((row) => row.id), expected.map((row) => row.id));
  table.setGlobalFilter("no-such-account");
  assert.equal(table.getRowModel().rows.length, 0);
});

test("sorting respects numeric probability, sales-stage order and currency groups", () => {
  const table = makeTable({ sorting: [{ id: "probability", desc: true }] });
  const probabilities = table.getRowModel().rows.map((row) => row.original.probability);
  assert.deepEqual(probabilities, [...probabilities].sort((a,b) => b-a));
  table.setSorting([{ id: "stage", desc: false }]);
  assert.equal(table.getRowModel().rows[0].original.stage, "Discovery");
  assert.equal(table.getRowModel().rows.at(-1)!.original.stage, "ClosedLost");
  table.setSorting([{ id: "value", desc: false }]);
  const rows = table.getRowModel().rows.map((row) => row.original);
  assert.deepEqual(rows.map((row) => row.id), [...data].sort((a,b) => a.currency.localeCompare(b.currency) || a.value-b.value).map((row) => row.id));
});

test("visibility does not change search and selection stays attached to deal IDs", () => {
  const table = makeTable();
  table.getColumn("nextStep")!.toggleVisibility(false);
  table.setGlobalFilter("buying committee");
  assert.ok(table.getRowModel().rows.length > 0);
  assert.equal(table.getVisibleLeafColumns().some((column) => column.id === "nextStep"), false);
  const selected = table.getRowModel().rows[0];
  selected.toggleSelected(true);
  table.setSorting([{ id: "value", desc: true }]);
  assert.equal(table.getSelectedRowModel().rows[0].id, selected.id);
  table.setGlobalFilter("no-such-account");
  assert.equal(table.getFilteredSelectedRowModel().rows.length, 0);
  assert.equal(table.getSelectedRowModel().rows.length, 1);
  table.resetRowSelection();
  assert.equal(table.getSelectedRowModel().rows.length, 0);
  assert.equal(table.getColumn("title")!.getCanHide(), false);
});

test("semantic table, labelled selection and empty state render correctly", () => {
  const html = renderToStaticMarkup(createElement(PipelineTable, { accounts, deals }));
  assert.ok(html.includes("<table"));
  assert.ok(html.includes("<caption"));
  assert.ok(html.includes('aria-sort="ascending"'));
  assert.ok(html.includes('aria-label="Select all matching deals"'));
  assert.ok(html.includes("High</span>"));
  assert.ok(html.includes("60 of 60 deals"));
  const empty = renderToStaticMarkup(createElement(PipelineTable, { accounts: [], deals: [] }));
  assert.ok(empty.includes("No deals yet"));
  assert.equal(formatPipelineDate("2026-10-08"), "8 Oct 2026");
});

test("pipeline loading and storage error states render without fetching during SSR", () => {
  const client = createQueryClient();
  const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(PipelineWorkspace)));
  try {
    assert.ok(render().includes("Loading pipeline"));
    client.getQueryCache().build(client, { queryKey: dealsQueryOptions.queryKey }).setState({ status: "error", error: new Error("Storage unavailable") });
    assert.ok(render().includes("Unable to load the pipeline"));
    assert.ok(render().includes("Retry"));
    client.setQueryData(dealsQueryOptions.queryKey, deals);
    client.setQueryData(accountsQueryOptions.queryKey, accounts);
    assert.ok(render().includes("60 of 60 deals"));
  } finally { client.clear(); }
});



test("large fixture generation is deterministic, valid and does not alter seed inputs", () => {
  const originalAccounts = structuredClone(accounts);
  const originalDeals = structuredClone(deals);
  const generated = generateDemoDeals(accounts, 10_000);
  assert.equal(generated.length, 10_000);
  assert.equal(new Set(generated.map((deal) => deal.id)).size, 10_000);
  const accountIds = new Set(accounts.map((account) => account.id));
  for (const deal of generated) {
    dealSchema.parse(deal);
    assert.ok(accountIds.has(deal.accountId));
  }
  assert.equal(new Set(generated.map((deal) => deal.stage)).size, 6);
  assert.equal(new Set(generated.map((deal) => deal.risk)).size, 3);
  assert.deepEqual(generateDemoDeals(accounts, 50), generated.slice(0, 50));
  assert.deepEqual(accounts, originalAccounts);
  assert.deepEqual(deals, originalDeals);
  assert.equal(deals.length, 60);
  assert.deepEqual(generateDemoDeals([], 0), []);
  for (const count of [-1, 1.5, Infinity, 100_001]) assert.throws(() => generateDemoDeals(accounts, count), RangeError);
  assert.throws(() => generateDemoDeals([], 10), /fictional account/);
});

test("large tables render a bounded virtual window with total row metadata", () => {
  const generated = generateDemoDeals(accounts, 10_000);
  const html = renderToStaticMarkup(createElement(PipelineTable, { accounts, deals: generated }));
  const renderedRows = [...html.matchAll(/data-row-id=/g)].length;
  assert.ok(renderedRows > 0 && renderedRows <= 30, `Expected at most 30 initial rows, received ${renderedRows}`);
  assert.ok(html.includes('aria-rowcount="10001"'));
  assert.ok(html.includes('aria-rowindex="2"'));
  assert.ok(html.includes('role="presentation"'));
  assert.ok(html.includes("10000 of 10000 deals"));
  const table = makeTable({ globalFilter: "avelmere" });
  table.setOptions((options) => ({ ...options, data: buildPipelineRows(generated, accounts) }));
  assert.ok(table.getRowModel().rows.length > 300);
  assert.ok(table.getRowModel().rows.every((row) => row.original.accountName === accounts[0].name));
});
