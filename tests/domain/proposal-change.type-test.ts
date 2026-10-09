import type { ProposalChange } from "../../domain/proposals/proposal-change";

// Compile-time contracts, checked by tsc --noEmit; no test runtime is needed.
type DealStageChange = Extract<ProposalChange, { entityType: "Deal"; field: "stage" }>;
type DealValueChange = Extract<ProposalChange, { entityType: "Deal"; field: "value" }>;
type DealNextStepChange = Extract<ProposalChange, { entityType: "Deal"; field: "nextStep" }>;

export const validStage: DealStageChange["after"] = "Evaluation";
export const validValue: DealValueChange["after"] = 1250;
export const clearedNextStep: DealNextStepChange["after"] = null;

// @ts-expect-error A numeric field cannot receive text.
export const invalidValue: DealValueChange["after"] = "1250";
// @ts-expect-error A stage must be one of the documented stages.
export const invalidStage: DealStageChange["after"] = "Active";
// @ts-expect-error Required fields cannot be cleared.
export const clearedStage: DealStageChange["after"] = null;
// @ts-expect-error Identity fields are not proposal-editable.
export const identityField: ProposalChange["field"] = "id";
// @ts-expect-error Relationship fields are not proposal-editable.
export const relationshipField: ProposalChange["field"] = "accountId";

type ContactChange = Extract<ProposalChange, { entityType: "Contact" }>;
// @ts-expect-error Deal fields cannot be applied to contacts.
export const invalidContactField: ContactChange["field"] = "stage";

const snapshot: DealStageChange = { id: "change", entityType: "Deal", entityId: "deal", field: "stage", before: "Discovery", after: "Evaluation", selected: true, status: "Pending" };
// @ts-expect-error A proposal editor must never refresh its generation-time snapshot.
snapshot.before = "Negotiation";

type ParticipantChange = Extract<ProposalChange, { entityType: "Activity"; field: "participants" }>;
const participants: ParticipantChange = { id: "change", entityType: "Activity", entityId: "activity", field: "participants", before: ["contact"], after: [], selected: true, status: "Pending" };
if (participants.before) {
  // @ts-expect-error Snapshot arrays must not be edited in place.
  participants.before.push("another-contact");
}
