# Pipeline Saved Views

Saved Views persist configuration, while Favorites reference individual records.
Only Pipeline is supported. A view stores search, exact stage/risk filters, one
sort (matching the existing table), visible column IDs, a name and timestamps.
Deal data, selection and temporary performance datasets are never copied.
Account, Deal and selection columns retain the table's existing visibility rules.

The version 4 Dexie store starts empty and preserves existing records. Repositories
validate writes and reads. Create/rename transactions reject names that match
after trimming and case folding, including writes from concurrent tabs.
Names are limited to 80 characters. Unsupported filters, columns, sorts and entity
types are rejected; a malformed stored view produces a recoverable loading error.
Demo reset explicitly clears Saved Views.

The Pipeline toolbar captures the live table state when Save view is clicked.
Naming, rename and delete dialogs use the existing native modal and mutation
patterns. Successful persistence updates the shared TanStack Query cache, so the
sidebar updates immediately. Failed writes leave the previous configuration
intact and show an error; deletion requires explicit confirmation in the dialog.

Sidebar links use `/workspace/pipeline?view=<encoded ID>`. The route loads local configuration
before mounting the table, so refresh and back/forward restore the selected view.
The URL references a local view rather than duplicating its configuration. Manual
table changes are temporary until saved as a new view; reopening the active view
reloads its stored configuration. Rename preserves its ID and settings. Deleted
or missing view IDs show a notice and the default Pipeline instead of failing.

No new packages, cloud sync, sharing, or Accounts/Contacts Saved Views are added.
