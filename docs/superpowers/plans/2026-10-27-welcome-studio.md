# GuildSyncApplications Web implementation plan

**Goal:** Let Apollonia edit welcome messages and emails outside ESO, save named copies to the shared server library, and download compatible SavedVariables.

**Architecture:** Same dependency-free Node 22 server and restricted Lua data parser as SmartChatMsg-Web. Browser-only editing; explicit shared saves; install downloads manually with ESO closed.

**User direction:** Use the same setup as SCM-Web and go ahead. Implement inline and push a new GitHub repository when verified.

## Constraints

- SavedVariables global is GuildSyncApplications. Account-wide settings live under Default / account / $AccountWide / settings.
- Preserve unknown fields, application records, account branches, numeric Lua keys, IDs and usage history.
- Chat text limit is 335 UTF-8 bytes, as implemented by GuildSyncApplications 1.4.3. Never silently truncate.
- Public shared library uses unique names, immutable records and explicit upload disclosure, matching SCM-Web.
- Server binds to loopback; configurable HOST, PORT, PUBLIC_ORIGIN and LIBRARY_DIR. Do not deploy into an existing service.

## Tasks

- [x] Data model: test imported and new profiles; create, duplicate, edit and delete chat/email templates; validate text; preserve usage and unknown data across Lua export. Reuse SCM parser with the new global and its existing regression tests.
- [x] Shared library and server: reuse SCM implementation, adapt validation and record suffix; test persistent saves, duplicate names, invalid Lua, request origin and file routes using temporary directories.
- [x] Browser editor: responsive navy/gold workspace, category list, editable title/content/enabled fields, name-token preview, byte counts, defaults, unsaved-change protection, local opening, server library, save and download.
- [x] End-to-end checks: real Chromium interactions with synthetic multi-account Lua; exercise chat and email creation, validation, preservation, server roundtrip and downloads. Review accessibility and narrow screens.
- [x] Delivery: document local run, reverse proxy and systemd installation, privacy and ESO file replacement. Verify suite and browser checks, review diff, create and push GuildSyncApplications-Web.

## Review focus

- UTF-8 and Lua byte escaping roundtrip without corrupting text.
- Sparse/malformed template lists fail clearly rather than silently losing entries.
- Editing one account preserves other accounts and application records.
- Server name collisions never overwrite existing records.
- Pending editor changes cannot be lost by selecting another item or loading a file.

## Execution notes

- Reused the SCM-Web Lua parser, immutable library store, HTTP host/origin controls and regression tests. The new server uses port 4174 to coexist with SCM-Web.
- Starter templates are optional copies from GuildSyncApplications 1.4.3; imported pools are never automatically seeded.
- An independent review found delayed-save dirty-state clearing, delayed-load replacement and raw invalid-UTF-8 import risks. All were fixed with browser regressions. Library dialog responses are ignored after their dialog is closed or replaced.
- Verification: 15 Node tests and the real Chrome workflow passed. Desktop and 390-pixel mobile screenshots visually inspected.
- The user requested a GitHub repository; no existing live service or DNS configuration is changed by this delivery.
