"use client";

import { useMemo } from "react";
import { useContactDirectory } from "./use-contacts";
import { buildContactRows } from "./contacts-model";
import { ContactsTable } from "./contacts-table";
import { ContactsQueryState } from "./contacts-query-state";

export function ContactsWorkspace() {
  const { contacts, accounts, deals, activities, proposals } = useContactDirectory();
  const data = useMemo(() => contacts.data && accounts.data && deals.data && activities.data && proposals.data ? buildContactRows(contacts.data, accounts.data, deals.data, activities.data, proposals.data) : null, [contacts.data, accounts.data, deals.data, activities.data, proposals.data]);
  const queries = [contacts, accounts, deals, activities, proposals];
  const fetching = queries.some(query => query.isFetching);
  return <section aria-labelledby="contacts-title" className="flex h-full min-h-0 flex-col gap-3">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3"><div><h1 id="contacts-title" className="text-lg font-semibold tracking-tight">Contacts</h1><p className="mt-1 text-xs text-zinc-600">People, account relationships and review priorities.</p></div><span role="status" className="text-[11px] text-zinc-500">{data && fetching ? "Updating…" : "Local workspace"}</span></header>
    <ContactsQueryState failed={queries.some(query => query.isError)} ready={Boolean(data)} fetching={fetching} retry={() => { for (const query of queries) void query.refetch(); }} />
    {data && <ContactsTable data={data} />}
  </section>;
}
