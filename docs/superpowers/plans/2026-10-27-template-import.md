# Import welcome templates from shared server files

User approved copying selected welcome chat/email templates into a person's own SavedVariables. Keep full-file loading available separately.

- Add an Import templates from server action to the open workspace and to server-library rows when a recipient file is open.
- Choose source saved file, source account, and individual chat/email entries. Show the destination account. Default all source entries selected; allow clearing either category.
- Copy only title, message or subject/body, and enabled state. Append with fresh local IDs and zero usage. Preserve recipient application records, other accounts, existing templates, unknown fields and selection sequence counters.
- Skip exact matching message content or subject/body pairs, without overwriting. Validate every selection before mutation so a bad source cannot produce a partial import.
- Async responses must be ignored after closing their dialog; reject stale recipient identity at confirmation. Cancel makes no changes. Imported changes require save or download.

Verification: Node tests for blank/populated destinations, selected categories, duplicate skipping, fresh history, preservation and atomic failure. Chrome workflow imports from an actual shared server record into a synthetic recipient and inspects the downloaded Lua.
