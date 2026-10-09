import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { accountHref } from "../accounts/accounts-model";
import { formatPipelineDate } from "../pipeline/pipeline-model";
import { contactHref, missingContactRegion, type ContactRow } from "./contacts-model";

export const contactColumns: ColumnDef<ContactRow>[] = [
  { accessorKey: "name", header: "Name", size: 180, cell: ({ row }) => <Link data-contact-link={row.id} href={contactHref(row.id)} className="rounded-sm font-medium text-text underline-offset-4 hover:text-accent hover:underline">{row.original.name}</Link> },
  { accessorKey: "role", header: "Role", size: 220, sortUndefined: "last", cell: context => context.getValue<string>() || "—" },
  { id: "accountId", accessorFn: row => row.accountName, header: "Account", size: 190, sortUndefined: "last", filterFn: (row, _id, value: string) => row.original.accountId === value, cell: ({ row }) => row.original.accountAvailable ? <Link href={accountHref(row.original.accountId)} className="rounded-sm text-accent underline-offset-4 hover:underline">{row.original.accountName}</Link> : "Unavailable account" },
  { accessorKey: "email", header: "Email", size: 260, sortUndefined: "last", cell: context => context.getValue<string>() || "—" },
  { accessorKey: "phone", header: "Phone", size: 150, sortUndefined: "last", cell: context => context.getValue<string>() || "—" },
  { accessorKey: "status", header: "Status", size: 100, filterFn: "equals" },
  { accessorKey: "region", header: "Region", size: 150, sortUndefined: "last", filterFn: (row, id, value: string) => value === missingContactRegion ? !row.getValue(id) : row.getValue(id) === value, cell: context => context.getValue<string>() || "Not set" },
  { accessorKey: "lastActivityAt", header: "Last Activity", size: 135, sortUndefined: "last", cell: context => formatPipelineDate(context.getValue<string | undefined>()) },
  { accessorKey: "openDeals", header: "Open Deals", size: 110 },
  { accessorKey: "pendingReviews", header: "Pending Reviews", size: 135 },
];
