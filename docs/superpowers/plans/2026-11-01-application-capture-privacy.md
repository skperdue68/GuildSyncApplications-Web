# Shared-save privacy and optional application capture

Implement the two approved backlog items through PRs in GuildSyncApplications-Web and GuildSync (ESO/GuildSyncApplications).

## Shared contract

`settings.captureApplicationData` is boolean, default true; missing means enabled. Disabling stops new application record persistence without deleting old records or disrupting welcome chat/email. Both UIs include: "If you use this add-on with GuildSync, leave application-data capture enabled so application data can be copied automatically to Discord."

## Web tasks

- Add exportServerDocument(doc): clone Lua data preserving numeric key types and unknown fields, replace records tables with empty placeholders, then validate/serialize. Do not mutate workspace or personal export.
- Use this sanitized export in browser server-save requests, including overwrite/password retries. Enforce the same sanitization at server storage, so older clients cannot store application records. Sanitize legacy library loads without rewriting files on disk. Existing files on disk are cleared when explicitly resaved, not through a destructive migration.
- Add per-account capture checkbox, persist setting to server/personal downloads and retain it through template imports. Missing defaults enabled. Changes retain pending template drafts.
- Update shared-save disclosures and standalone instructions. Rebuild bundled ZIP/checksum from verified new addon branch and document matching version/PR.
- Tests: multiple account/character/legacy records stripped in shared copies; original/personal records retained; server enforcement, reload, overwrite/password flow; checkbox defaults/toggling/account selection; real browser request has no records and downloads retain personal records.

## Addon tasks

Delegated independently to addon_capture, using the same setting contract. Verify missing/default enabled, disabled persistence, existing record preservation and welcome behavior with executable Lua tests. Update addon version, manifest and docs.

## Delivery

Run Node suite, Chrome workflow, Lua tests, ZIP checksum/content checks and independent review. Create linked PRs against current repository defaults. Do not merge or deploy. Update backlog with PR links.
