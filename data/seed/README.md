# DealPatch demo seed

All company, person, and sales-history records in this dataset are authored fiction.
Company websites and contact email addresses use reserved `.example` domains.
No real customer records, credentials, or external services are used.

The snapshot contains 30 accounts, 80 contacts, 60 deals, 150 activities, and
15 pending review proposals. Dates are fixed around September–October 2026 so
validation does not depend on the current clock. Activities use contact IDs as
participants. Deal stages use the domain values `ClosedWon` and `ClosedLost`;
presentation code can label them “Closed Won” and “Closed Lost”.

Proposals include stage, close-date, next-step, probability, risk, contact-role,
and contact-email changes. Evidence quotes the associated activity summary.
Changes have not been applied: `before` matches the seeded target field.
Optional missing values are represented as `null` inside proposal changes.

Run `npm run validate:seed` to validate all records and relationships.
Run `npm run test:seed` for positive and negative validation tests using Node's
built-in test runner. Compilation output goes into the ignored node_modules cache.

Zod 4 was added to validate these JSON imports and their editable field values.
The entity schemas live alongside the domain models. Cross-record checks live
in `validate.ts`; they validate this initial snapshot, not future audit history.
The JSON files are initialization inputs, not the application's runtime database.
