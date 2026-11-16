# Template text and apply controls

User requested four concrete changes: Lua newline escapes, character limits, apply to multiple accounts, and visible unapplied state. Deliver as a PR for the user to merge.

- Normalize CRLF and CR in template text to LF. Serialize template LF as Lua \n; paragraph gaps are \n\n. Preserve unrelated saved Lua bytes. Count Unicode code points, including one character per LF.
- Enforce message335, subject37, body680 while typing, pasting, inserting {name}, and through model validation. Avoid clipping an unchanged suffix when inserting into a full field. Imported oversized templates remain visible and intact until explicitly shortened; counters identify them.
- Apply-to-account checkboxes default to current account, with additional accounts selectable. Stage all chosen account settings before committing. New copies share a permanent template ID but retain per-account numeric IDs and usage state. Later edits update those matching copies; unrelated templates/settings/records remain intact. Reset account choices when changing template/account.
- Highlight an existing dirty row or show a new unsaved draft row, add an Unapplied badge and highlight the Apply action. Remove indicators after applying/discarding. Retain current navigation autosave and unload warning behavior.
- Shorten only the two built-in web starter fields that exceed the newly requested limits, preserving their catalog identities. Do not silently shorten imported user templates.
- Verify model/codec tests, three-field input boundaries, multiline download, multi-account creation/update and dirty-list state in real Chrome, then independent review and PR.

## Compatibility findings

- Keep legacy oversized server saves loadable via a worker option enabled only for library reads. New saves and applies retain strict limits.
- Preserve original starter identities with content aliases; resolve those aliases for catalog hiding and updating older recipient copies.
- Review found the addon still clamped chat by bytes. A companion GuildSync branch updates its clamp to UTF-8 characters, preserves latest 1.5.2 functionality and bumps to 1.5.3. Rebuild the web ZIP/checksum from commit3056077 and submit a linked addon PR so web exports are not silently truncated.
- Token insertion is atomic: it inserts all of {name} or leaves the field unchanged.

Verification: all 51 Node tests, both Chrome workflows and all three Lua 5.1 addon suites pass. ZIP checksum/content checks pass; pending-state desktop screenshot and 390px layout reviewed. Independent rereview found no remaining actionable defects. Deliver linked feature PRs; do not merge or deploy.
