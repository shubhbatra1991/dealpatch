# DealPatch Data Model

## 1. Purpose

This document defines the core DealPatch domain model.

It describes:
- business entities
- relationships
- ownership rules
- field meanings
- allowed states
- validation constraints
- proposal/change semantics
- audit behavior

The TypeScript types in `domain/` are the implementation.
This document is the source of truth for domain meaning.

## 2. Entity Overview

DealPatch V1 contains these primary entities:

- Account
- Contact
- Deal
- Activity
- Proposal
- ProposalChange
- AuditEvent

Relationships:

Account
├── Contacts
├── Deals
├── Activities
└── Proposals

Deal
├── Activities
├── Proposals
└── AuditEvents

## 3. Account

Represents a company or organization being worked with.

### Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| id | string | yes | Stable unique identifier |
| name | string | yes | Company name |
| industry | string | no | Business sector |
| website | string | no | Company website |
| employeeCount | number | no | Approximate employee count |
| region | string | no | Geographic sales region |
| ownerId | string | yes | Internal owner identifier |
| status | AccountStatus | yes | Current account state |
| createdAt | ISO datetime | yes | Creation timestamp |
| updatedAt | ISO datetime | yes | Last modification timestamp |

### Status

Allowed values:

- Prospect
- Active
- Customer
- Dormant

### Rules

- `name` must not be empty.
- `employeeCount` cannot be negative.
- deleting an Account is not supported in V1.

## 4. Contact

Represents an individual associated with an Account.

### Relationships

Every Contact belongs to exactly one Account.

### Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| id | string | yes | Stable unique identifier |
| accountId | string | yes | Parent Account |
| firstName | string | yes | First name |
| lastName | string | yes | Last name |
| role | string | no | Job title |
| email | string | no | Contact email |
| phone | string | no | Contact phone |
| status | ContactStatus | yes | Contact state |

## 5. Deal

Represents a sales opportunity linked to an Account.

### Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| id | string | yes | Stable unique identifier |
| accountId | string | yes | Parent Account |
| title | string | yes | Opportunity name |
| stage | DealStage | yes | Current sales stage |
| value | number | yes | Monetary value |
| currency | CurrencyCode | yes | ISO-style currency code |
| probability | number | yes | Estimated success probability |
| expectedCloseDate | ISO date | no | Expected closing date |
| ownerId | string | yes | Deal owner |
| risk | DealRisk | yes | Risk classification |
| nextStep | string | no | Next planned action |
| lastActivityAt | ISO datetime | no | Last recorded interaction |

### DealStage

- Discovery
- Evaluation
- Proposal
- Negotiation
- ClosedWon
- ClosedLost

### Rules

- `value >= 0`
- `probability` must be between 0 and 100.
- ClosedWon and ClosedLost are terminal stages in V1.
- A Deal must belong to an existing Account.
- Risk must be one of Low, Medium, High.

## 6. Activity

Represents an interaction or event related to an Account and optionally a Deal.

### ActivityType

- Meeting
- Email
- Call
- Note

### Fields

| Field | Type | Required |
|---|---|---:|
| id | string | yes |
| accountId | string | yes |
| dealId | string | no |
| type | ActivityType | yes |
| title | string | yes |
| summary | string | yes |
| occurredAt | ISO datetime | yes |
| participants | string[] | no |

## 7. Proposal

A Proposal represents a set of suggested CRM updates awaiting human review.

A Proposal does not directly mutate CRM data.

Changes are applied only after approval.

### Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| id | string | yes | Proposal identifier |
| accountId | string | yes | Related Account |
| dealId | string | no | Related Deal |
| sourceActivityId | string | yes | Activity that triggered proposal |
| status | ProposalStatus | yes | Review state |
| confidence | number | yes | 0-100 confidence |
| changes | ProposalChange[] | yes | Suggested modifications |
| evidence | Evidence[] | yes | Supporting reasoning/source |
| createdAt | ISO datetime | yes | Proposal creation time |

### ProposalStatus

- Pending
- Approved
- PartiallyApproved
- Rejected
- Superseded

## 8. ProposalChange

Represents one proposed field-level modification.

Example:

Stage:
Discovery → Evaluation

### Fields

| Field | Type | Description |
|---|---|---|
| id | string | Change identifier |
| entityType | ChangeEntityType | Entity being modified |
| entityId | string | Target record |
| field | string | Field being modified |
| before | unknown | Current value |
| after | unknown | Proposed value |
| selected | boolean | Whether the change is selected for approval |
| status | ChangeStatus | Review status |

### ChangeStatus

- Pending
- Approved
- Rejected
- Edited

`edited?: boolean` is optional review metadata retained after approval or rejection.
Existing stored changes without this flag remain valid; an `Edited` status also
identifies a previously edited suggestion. Editing never changes `before`.

### Important invariant

`before` must represent the value that existed when the proposal was generated.

Before applying a change, DealPatch must verify that the target record
has not changed unexpectedly.

If the current value differs from `before`, the proposal is stale
and should not be silently applied.

## 9. Evidence

Evidence explains why a Proposal or ProposalChange exists.

### Example

{
  "type": "activity_excerpt",
  "sourceActivityId": "activity_104",
  "text": "We will move forward with the technical evaluation next week."
}


- Evidence is informational.
- Evidence must never be treated as executable input.
- Evidence text must be rendered as plain text.

## 10. AuditEvent

Represents a meaningful change applied to DealPatch data.

Examples:
- proposal approved
- proposal rejected
- field edited
- approval undone

Audit machine actions are `ProposalApproved`, `ProposalPartiallyApproved`,
`ProposalRejected`, `FieldEdited`, and `ApprovalUndone`. Approval and undo append
one event per applied field, referencing its target and proposal. Edit/reject
events describe proposal state rather than claiming the CRM entity was changed.

### Fields

| Field | Type |
|---|---|
| id | string |
| entityType | string |
| entityId | string |
| action | AuditAction |
| previousValue | unknown |
| nextValue | unknown |
| proposalId | string or null |
| occurredAt | ISO datetime |

## 11. Proposal Application Flow

Activity
↓
Simulated intelligence analyzes activity
↓
Proposal created
↓
Proposal contains one or more ProposalChanges
↓
User reviews changes
↓
User approves/rejects/edits individual changes
↓
Approved changes update the target entity
↓
AuditEvent created
↓
UI offers Undo


## 12. Partial Approval

A Proposal may contain multiple changes.

Example:

Stage:
Discovery → Evaluation

Close Date:
Oct 15 → Oct 28

Next Step:
null → Send technical proposal

The user may approve only:

- Stage
- Next Step

and reject:

- Close Date

The resulting Proposal status becomes:

PartiallyApproved

## 13. Referential Integrity

- Contact.accountId must reference an existing Account.
- Deal.accountId must reference an existing Account.
- Activity.accountId must reference an existing Account.
- Activity.dealId, when present, must reference an existing Deal.
- Proposal.sourceActivityId must reference an existing Activity.
- Proposal.dealId, when present, must reference an existing Deal.


## 14. Deletion and Archival

Hard deletion is not supported in V1 unless explicitly introduced later.

Records may eventually support archival instead of deletion.

Do not implement cascade deletion unless explicitly required by the PRD.

Deleting or archiving one entity must never silently remove unrelated audit history.

## 15. Identifiers

All entity IDs are opaque strings.

Application logic must not infer entity type or meaning from an ID format.

Example seed IDs such as:

- account_001
- deal_002
- proposal_003

are acceptable for demo data, but production logic must never depend on those prefixes.

## 16. Date and Time Handling

Persist dates and timestamps in ISO 8601 format.

Examples:

2026-10-08

2026-10-08T10:30:00.000Z

Formatting for display belongs to the presentation layer.

Do not persist locale-specific values such as:

08/10/2026
10/08/2026

## 17. Proposal Confidence

Proposal confidence is represented as a number between 0 and 100.

Confidence is informational only.

A high confidence score must never cause a Proposal or ProposalChange to be applied automatically.

All V1 changes require explicit user review.

## 18. Proposal Staleness

Before applying a ProposalChange, DealPatch must compare the entity's current field value against the ProposalChange.before value.

If they differ:

- the change is considered stale
- the change must not be silently applied
- the user must be informed
- the current and proposed values should be shown for review

Stale proposals may later be refreshed or superseded.


## 19. Audit Rules

AuditEvents are append-only in V1.

Existing AuditEvents must not be modified to hide or rewrite historical actions.

An undo operation creates a new AuditEvent rather than deleting the original event.

Example:

1. Proposal approved
2. Deal stage changed
3. User selects Undo
4. Deal stage restored
5. New "approval undone" AuditEvent created

## 20. Derived Data

Derived values should not be persisted unless necessary.

Examples may include:

- total pipeline value for an Account
- number of open Deals
- number of pending Proposals
- formatted currency
- human-readable dates

These values should normally be calculated from source data.

Avoid storing duplicate values that can become inconsistent.


## 21. Ownership

V1 uses ownerId values only as demo ownership references.

There is no User entity, authentication system, permission model, or multi-user workspace in V1.

ownerId is used only for:

- filtering
- display
- grouping
- realistic CRM behavior

Do not introduce authentication or authorization around ownerId.


## 22. Out of Scope for V1

Do not add these entities without an explicit product decision:

- User
- Team
- Workspace
- Organization / Tenant
- Permission Role
- Authentication Session
- Subscription
- Billing Plan
- Invoice
- Email Mailbox
- Calendar Connection
- External CRM Connection
- AI Provider Credential
- API Key

