import assert from "node:assert/strict";
import test from "node:test";
import { accountSchema } from "../domain/accounts/schema";
import { contactSchema } from "../domain/contacts/schema";
import { dealSchema } from "../domain/deals/schema";
import { activitySchema } from "../domain/activities/schema";
import { proposalSchema, proposalChangeSchema } from "../domain/proposals/schema";
import { auditEventSchema } from "../domain/audit/audit.schema";
import { assertDealStageTransition, isTerminalDealStage } from "../domain/deals/rules";
import { assertProposalChangeCurrent, isProposalChangeStale, proposalWithApproval } from "../domain/proposals/review";
import type { ProposalChange } from "../domain/proposals/proposal-change";

const occurredAt = "2026-10-08T10:30:00.000Z";
const stageChange: ProposalChange = { id: "change", entityType: "Deal", entityId: "opaque-opportunity", field: "stage", before: "Discovery", after: "Evaluation", selected: true, status: "Pending" };
const audit = { id: "opaque-event", entityType: "Deal", entityId: "opaque-opportunity", action: "ProposalApproved", previousValue: "Discovery", nextValue: "Evaluation", proposalId: "opaque-suggestion", occurredAt };

test("entity shapes preserve documented relationships, optional fields and ISO timestamps", () => {
  assert.ok(accountSchema.safeParse({ id: "company", name: "Example", ownerId: "demo-owner", status: "Prospect", createdAt: occurredAt, updatedAt: occurredAt }).success);
  assert.ok(contactSchema.safeParse({ id: "person", accountId: "company", firstName: "Mara", lastName: "Brenlow", status: "Active" }).success);
  const deal = { id: "opportunity", accountId: "company", title: "Rollout", stage: "Discovery", value: 0, currency: "EUR", probability: 0, ownerId: "demo-owner", risk: "Low" };
  assert.ok(dealSchema.safeParse(deal).success);
  for (const invalid of [{ value: -1 }, { probability: -1 }, { probability: 101 }, { expectedCloseDate: "08/10/2026" }, { expectedCloseDate: "2026-02-30" }, { currency: "euro" }, { risk: "Critical" }]) assert.equal(dealSchema.safeParse({ ...deal, ...invalid }).success, false);
  const activity = { id: "interaction", accountId: "company", type: "Note", title: "Follow-up", summary: "Discovery completed.", occurredAt };
  assert.ok(activitySchema.safeParse(activity).success);
  assert.ok(activitySchema.safeParse({ ...activity, dealId: "opportunity", participants: ["person"] }).success);
  assert.equal(activitySchema.safeParse({ ...activity, occurredAt: "08/10/2026" }).success, false);
});

test("staleness checks compare the generation snapshot, never the edited proposed value", () => {
  assert.equal(isProposalChangeStale(stageChange, "Discovery"), false);
  assert.equal(isProposalChangeStale(stageChange, "Evaluation"), true);
  assert.throws(() => assertProposalChangeCurrent(stageChange, "Negotiation"), /stale/);
  assert.equal(isProposalChangeStale({ ...stageChange, after: "Proposal", status: "Edited" }, "Discovery"), false);
  assert.equal(isProposalChangeStale(stageChange, undefined), true);
});

test("optional absence and participant snapshots compare by value, including order", () => {
  const nextStep: ProposalChange = { ...stageChange, field: "nextStep", before: null, after: "Schedule assessment." };
  assert.equal(isProposalChangeStale(nextStep, undefined), false);
  assert.equal(isProposalChangeStale(nextStep, null), false);
  assert.equal(isProposalChangeStale(nextStep, ""), true);
  const participants: ProposalChange = { ...stageChange, entityType: "Activity", field: "participants", before: ["first", "second"], after: ["first"] };
  assert.equal(isProposalChangeStale(participants, ["first", "second"]), false);
  assert.equal(isProposalChangeStale(participants, ["second", "first"]), true);
  assert.equal(isProposalChangeStale(participants, ["first"]), true);
});

test("partial review preserves generation snapshots and informational confidence", () => {
  const nextStep: ProposalChange = { ...stageChange, id: "next", field: "nextStep", before: null, after: "Schedule assessment." };
  const proposal = proposalSchema.parse({ id: "suggestion", accountId: "company", sourceActivityId: "interaction", status: "Pending", confidence: 100, createdAt: occurredAt, changes: [stageChange, nextStep], evidence: [{ type: "activity_excerpt", sourceActivityId: "interaction", text: "Discovery completed." }] });
  const approved = proposalWithApproval(proposal, [stageChange.id]);
  assert.equal(proposal.status, "Pending");
  assert.equal(approved.status, "PartiallyApproved");
  assert.equal(approved.changes[0].before, "Discovery");
  assert.equal(approved.changes[1].status, "Pending");
  assert.equal(proposalSchema.safeParse({ ...proposal, confidence: 101 }).success, false);
  assert.equal(proposalChangeSchema.safeParse({ ...stageChange, field: "id" }).success, false);
});

test("both closed stages are terminal while non-stage edits and idempotent saves remain possible", () => {
  for (const stage of ["ClosedWon", "ClosedLost"] as const) {
    assert.equal(isTerminalDealStage(stage), true);
    assert.doesNotThrow(() => assertDealStageTransition(stage, stage));
    assert.throws(() => assertDealStageTransition(stage, "Discovery"), /terminal/);
  }
  assert.throws(() => assertDealStageTransition("ClosedWon", "ClosedLost"), /terminal/);
  assert.equal(isTerminalDealStage("Negotiation"), false);
  assert.doesNotThrow(() => assertDealStageTransition("Negotiation", "ClosedWon"));
});

test("audit events validate immutable history, nullable proposal relationships and serializable snapshots", () => {
  const event = auditEventSchema.parse(audit);
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Reflect.set(event, "action", "ApprovalUndone"), false);
  const undo = auditEventSchema.parse({ ...audit, id: "another-event", action: "ApprovalUndone", previousValue: audit.nextValue, nextValue: audit.previousValue });
  assert.equal(event.action, "ProposalApproved");
  assert.notEqual(event.id, undo.id);
  assert.ok(auditEventSchema.safeParse({ ...audit, proposalId: null, previousValue: null, nextValue: { stage: "Evaluation" } }).success);
  for (const invalid of [{ action: "DeleteHistory" }, { occurredAt: "08/10/2026" }, { proposalId: undefined }, { previousValue: undefined }, { nextValue: () => "executable" }, { nextValue: BigInt(1) }, { unexpected: true }]) assert.equal(auditEventSchema.safeParse({ ...audit, ...invalid }).success, false);
});
