import type { ColumnDef } from "@tanstack/react-table";
import { formatDealValue, formatPipelineDate, riskOrder, stageLabels, stageOrder, type PipelineRow } from "./pipeline-model";
import { SelectionCheckbox } from "./selection-checkbox";
import Link from "next/link";
import { dealHref } from "../deals/deal-detail-model";

export const pipelineColumns: ColumnDef<PipelineRow>[] = [
  {
    id: "select", size: 40, enableHiding: false, enableSorting: false, enableGlobalFilter: false,
    header: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const selected = rows.filter((row) => row.getIsSelected()).length;
      return <SelectionCheckbox label="Select all matching deals" checked={rows.length > 0 && selected === rows.length} indeterminate={selected > 0 && selected < rows.length} disabled={rows.length === 0} onChange={(event) => {
        const checked = event.target.checked;
        table.setRowSelection((current) => {
          const next = { ...current };
          for (const row of rows) { if (checked) next[row.id] = true; else delete next[row.id]; }
          return next;
        });
      }} />;
    },
    cell: ({ row }) => <SelectionCheckbox label={`Select ${row.original.title}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />,
  },
  { accessorKey: "accountName", header: "Account", size: 190, enableHiding: false, cell: ({ row }) => <span className="font-medium text-text">{row.original.accountName}</span> },
  { accessorKey: "title", header: "Deal", size: 280, enableHiding: false, cell: ({ row }) => <Link href={dealHref(row.id)} className="rounded-sm font-medium text-text underline-offset-4 hover:text-accent hover:underline">{row.original.title}</Link> },
  { accessorKey: "stage", header: "Stage", size: 130, filterFn: "equals", sortingFn: (a, b) => stageOrder.indexOf(a.original.stage) - stageOrder.indexOf(b.original.stage), cell: ({ row }) => <span className="workspace-stage">{stageLabels[row.original.stage]}</span> },
  { accessorKey: "value", header: "Value", size: 140, sortingFn: (a, b) => a.original.currency.localeCompare(b.original.currency) || a.original.value - b.original.value, cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDealValue(row.original.value, row.original.currency)}</span> },
  { accessorKey: "ownerId", header: "Owner", size: 110 },
  { accessorKey: "probability", header: "Probability", size: 110, cell: ({ row }) => <span className="tabular-nums">{row.original.probability}%</span> },
  { accessorKey: "lastActivityAt", header: "Last Activity", size: 145, sortUndefined: "last", cell: ({ row }) => row.original.lastActivityAt ? <time dateTime={row.original.lastActivityAt}>{formatPipelineDate(row.original.lastActivityAt)}</time> : "—" },
  { accessorKey: "expectedCloseDate", header: "Expected Close", size: 145, sortUndefined: "last", cell: ({ row }) => row.original.expectedCloseDate ? <time dateTime={row.original.expectedCloseDate}>{formatPipelineDate(row.original.expectedCloseDate)}</time> : "—" },
  {
    accessorKey: "risk", header: "Risk", size: 95, filterFn: "equals",
    sortingFn: (a, b) => riskOrder.indexOf(a.original.risk) - riskOrder.indexOf(b.original.risk),
    cell: ({ row }) => <span className={`workspace-risk inline-flex items-center gap-1.5 whitespace-nowrap ${row.original.risk === "High" ? "font-medium text-danger" : row.original.risk === "Medium" ? "text-warning" : "text-text-muted"}`}><span aria-hidden="true">{row.original.risk === "High" ? "▲" : row.original.risk === "Medium" ? "◒" : "○"}</span>{row.original.risk}</span>,
  },
  { accessorKey: "nextStep", header: "Next Step", size: 300, sortUndefined: "last", cell: ({ row }) => row.original.nextStep ?? "—" },
];
