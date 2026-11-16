# Shared starter catalogue management

User approved adding/editing/removing public starter messages and emails, with management restricted to anyone knowing one starter-management password. Public browsing/use remains open. Continue the established Node setup and PR-only delivery workflow.

## Design

- Persist a full catalogue in STARTERS_DIR (default data/starters), initially seeded from the ten built-in starters. Preserve existing starter permanent IDs. New entries receive gsa-shared UUID identities. Edits retain identity; deletion removes an entry from the catalogue without changing personal copies. An empty persisted catalogue stays empty across restarts.
- Configure STARTER_MANAGEMENT_PASSWORD through the server environment/.env. Missing password disables mutations, never public browsing. A masked unlock form keeps the entered password only in browser memory; logout/refresh discards it. No account system or public first-admin signup.
- Public GET /api/starters returns templates, catalogue revision and managementEnabled. Password-protected POST /api/starters/session verifies access; POST /api/starters upserts; DELETE /api/starters/:id removes. Every mutation checks the same password server-side, same-origin/host rules, JSON size limits and catalogue revision. Stale revisions reject with 409 instead of overwriting concurrent changes.
- Validate title and content using the new editor limits (335/37/680), normalize newlines, allow only template fields and stable identity metadata. Store no account names, applicant records or usage. Bound catalogue size and credential input. Atomic temporary write/rename and serialized writes protect persistence. Rate-limit repeated bad management passwords.
- Browse starters fetches the public catalogue, hiding identities already added to the selected account. Preserve original built-in legacy aliases for identity matching. Management lists every entry, independent of account filtering, with add/edit/delete and exact counters. Public catalogue is accessible from the header, including before a local file is opened. Use requires opening/creating a workspace. Manager form uses live preview and bounded text editing; deleting asks for confirmation.
- The optional per-file overwrite passwords remain separate and cannot grant starter-management access.

## Execution

Backend/store/API and frontend/browser work can proceed independently on the contract above; integrate and run all checks. This feature builds on pending editor PR #11, so its PR targets that feature branch until #11 merges (then retarget main).

Verification: store persistence/restart/empty catalogue, CRUD identity, wrong/missing management password, metadata redaction, revision conflicts, input limits/invalid bodies, origin enforcement, independent personal copies, public filtering, manager workflow and mobile layout in Chrome. Independent review before PR; do not merge or deploy.
