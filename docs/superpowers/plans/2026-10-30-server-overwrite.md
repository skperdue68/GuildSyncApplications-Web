# Replace an existing named server save

User request: allow overwriting a saved server file with the same name. Deliver through a pull request; user merges.

- Keep case-insensitive, trimmed NFC name matching and stable file IDs.
- An ordinary same-name POST returns 409 without touching the saved copy. The browser asks whether to replace it, then retries with explicit overwrite:true. Cancel leaves the file and workspace intact.
- Write and fsync a complete temporary record, then atomically rename it over the original only for explicit overwrite. Validate before modifying storage. Preserve original createdAt and add updatedAt for ordering/display; older records remain loadable.
- Retain all origin, size and Lua validation rules. Save completion must retain newer browser edits. Ignore collision responses after the save dialog was closed/replaced.
- Test rejected and confirmed replacement, case/normalization matching, stable identity, invalid replacement preservation, reload from disk and cancelled/confirmed browser saves. Update instructions that currently say saves are immutable.
