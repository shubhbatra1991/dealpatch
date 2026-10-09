import { z } from "zod";

import { accountSchema } from "../../domain/accounts/schema";
import { activitySchema } from "../../domain/activities/schema";
import { contactSchema } from "../../domain/contacts/schema";
import { dealSchema } from "../../domain/deals/schema";
import { proposalSchema } from "../../domain/proposals/schema";

/** Import boundary only; these files are not the runtime source of truth. */
export const seedDataSchema = z.strictObject({
  accounts: z.array(accountSchema),
  contacts: z.array(contactSchema),
  deals: z.array(dealSchema),
  activities: z.array(activitySchema),
  proposals: z.array(proposalSchema),
}).superRefine((data, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const accounts = new Map(data.accounts.map((record) => [record.id, record]));
  const contacts = new Map(data.contacts.map((record) => [record.id, record]));
  const deals = new Map(data.deals.map((record) => [record.id, record]));
  const activities = new Map(data.activities.map((record) => [record.id, record]));

  for (const [collection, records] of Object.entries(data)) {
    const ids = new Set<string>();
    records.forEach((record, index) => {
      if (ids.has(record.id)) issue([collection, index, "id"], "Duplicate ID");
      ids.add(record.id);
    });
  }
  for (const collection of ["contacts", "deals", "activities", "proposals"] as const) {
    data[collection].forEach((record, index) => {
      if (!accounts.has(record.accountId)) issue([collection, index, "accountId"], "Account does not exist");
    });
  }
  data.accounts.forEach((account, index) => {
    if (account.updatedAt < account.createdAt) issue(["accounts", index, "updatedAt"], "Update precedes creation");
  });
  data.activities.forEach((activity, index) => {
    if (activity.dealId && deals.get(activity.dealId)?.accountId !== activity.accountId) {
      issue(["activities", index, "dealId"], "Deal must belong to the same account");
    }
    activity.participants?.forEach((participant, participantIndex) => {
      if (contacts.get(participant)?.accountId !== activity.accountId) {
        issue(["activities", index, "participants", participantIndex], "Participant must belong to the same account");
      }
    });
  });
  const latestByDeal = new Map<string, string>();
  for (const activity of data.activities) if (activity.dealId && activity.occurredAt > (latestByDeal.get(activity.dealId) ?? "")) latestByDeal.set(activity.dealId, activity.occurredAt);
  data.deals.forEach((deal, index) => {
    const latest = latestByDeal.get(deal.id);
    if (deal.lastActivityAt !== latest) issue(["deals", index, "lastActivityAt"], "Must match latest deal activity");
    if (deal.stage === "ClosedWon" && deal.probability !== 100) issue(["deals", index, "probability"], "Won deals must have 100% probability");
    if (deal.stage === "ClosedLost" && deal.probability !== 0) issue(["deals", index, "probability"], "Lost deals must have 0% probability");
  });
  const changeIds = new Set<string>();
  data.proposals.forEach((proposal, index) => {
    const path = ["proposals", index];
    const source = activities.get(proposal.sourceActivityId);
    if (!source || source.accountId !== proposal.accountId || source.dealId !== proposal.dealId) {
      issue([...path, "sourceActivityId"], "Source activity must match the proposal account and deal");
    }
    if (source && proposal.createdAt < source.occurredAt) issue([...path, "createdAt"], "Proposal precedes its source activity");
    if (proposal.dealId && deals.get(proposal.dealId)?.accountId !== proposal.accountId) {
      issue([...path, "dealId"], "Deal must belong to the same account");
    }
    const fields = new Set<string>();
    proposal.changes.forEach((change, changeIndex) => {
      const changePath = [...path, "changes", changeIndex];
      if (changeIds.has(change.id)) issue([...changePath, "id"], "Duplicate change ID");
      changeIds.add(change.id);
      const key = `${change.entityType}:${change.entityId}:${change.field}`;
      if (fields.has(key)) issue([...changePath, "field"], "Duplicate target field within proposal");
      fields.add(key);
      const target = change.entityType === "Account" ? accounts.get(change.entityId)
        : change.entityType === "Contact" ? contacts.get(change.entityId)
        : change.entityType === "Deal" ? deals.get(change.entityId) : activities.get(change.entityId);
      if (!target) {
        issue([...changePath, "entityId"], "Target does not exist");
        return;
      }
      const accountId = "accountId" in target ? target.accountId : target.id;
      if (accountId !== proposal.accountId) issue([...changePath, "entityId"], "Target must belong to proposal account");
      if (change.entityType === "Deal" && change.entityId !== proposal.dealId) issue([...changePath, "entityId"], "Deal target must match proposal deal");
      if (proposal.status === "Pending") {
        const values = target as unknown as Record<string, unknown>;
        if (JSON.stringify(change.before) !== JSON.stringify(values[change.field] ?? null)) issue([...changePath, "before"], "Pending snapshot differs from current field value");
        if (change.status !== "Pending") issue([...changePath, "status"], "Pending proposal must contain pending changes");
      }
    });
    proposal.evidence.forEach((evidence, evidenceIndex) => {
      const activity = activities.get(evidence.sourceActivityId);
      if (!activity || activity.accountId !== proposal.accountId || evidence.sourceActivityId !== proposal.sourceActivityId) {
        issue([...path, "evidence", evidenceIndex], "Evidence must reference the proposal source activity");
      } else if (!activity.summary.includes(evidence.text)) {
        issue([...path, "evidence", evidenceIndex, "text"], "Evidence must be an exact source excerpt");
      }
    });
  });
});

