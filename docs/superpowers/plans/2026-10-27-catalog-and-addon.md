# Template catalog and standalone add-on download

User requested the landing step mention starting a new file, duplicate prevention with already-added templates removed from selection, and a GuildSyncApplications.zip add-on download.

- Change Bring your file instructions to include starting a new file.
- Following the user's clarification, add permanent webTemplateId metadata retained across account imports and wording edits. Keep addon numeric IDs local to avoid collisions. New web templates get random identities, starters fixed catalog identities, and legacy server templates a source-account/category/original-ID identity. Also compare content for older files: chat matches message text; email matches subject/body. Hide matching templates for the selected destination account, show the hidden count and a clear empty state. Recheck duplicates at addition time. Explicit Duplicate creates a new identity.
- Bundle the unmodified GuildSyncApplications 1.4.3 Lua and manifest in a properly named folder, with installation instructions and source provenance. State LibAddonMenu-2.0 dependency. The ZIP contains add-on software, never personal SavedVariables.
- Serve the ZIP with application/zip and attachment headers; offer download from landing/header and explain installation separately from downloading edited settings.
- Verify catalog filtering, guarded starter addition, account isolation, ZIP headers and archive contents, plus Chrome catalog and download workflows. Push when checks pass.

Verification: 23 Node tests and the complete Chrome workflow pass. Independent review prompted tests for assigning legacy identities before edits and preserving intentional duplicates as distinct permanent identities. ZIP CRC validation passes; bundled Lua/manifest Git blob hashes exactly match upstream. Desktop screenshot reviewed.
