import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { formatPipelineDate } from "../pipeline/pipeline-model";
import { accountHref, compareAccountPipeline, missingRegionFilter, pipelineLabel, type AccountRow } from "./accounts-model";

export const accountColumns: ColumnDef<AccountRow>[] = [
  { accessorKey: "name", header: "Account", size: 240, cell: ({ row }) => <Link data-account-link={row.id} href={accountHref(row.id)} className="rounded-sm font-medium text-text underline-offset-4 hover:text-accent hover:underline">{row.original.name}</Link> },
  { accessorKey: "status", header: "Status", size: 105, filterFn: "equals" },
  { accessorKey: "industry", header: "Industry", size: 155, cell: context => context.getValue<string>() || "—", sortUndefined: "last" },
  { accessorKey: "region", header: "Region", size: 145, cell: context => context.getValue<string>() || "Not set", sortUndefined: "last", filterFn: (row, id, value: string) => value === missingRegionFilter ? !row.getValue(id) : row.getValue(id) === value },
  { accessorKey: "ownerId", header: "Owner", size: 140 },
  { accessorKey: "openDeals", header: "Open Deals", size: 110 },
  { id: "pipeline", accessorFn: row => pipelineLabel(row.pipeline), header: "Open Pipeline Value", size: 230, sortingFn: (a, b) => compareAccountPipeline(a.original, b.original) },
  { accessorKey: "lastActivityAt", header: "Last Activity", size: 135, cell: context => formatPipelineDate(context.getValue<string | undefined>()), sortUndefined: "last" },
  { accessorKey: "pendingReviews", header: "Pending Reviews", size: 135 },
];
