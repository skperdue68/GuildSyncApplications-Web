# Optional password for overwriting shared saves

Extend the open overwrite PR at the user's request. A single optional password field sets protection for a new or currently unprotected save; overwriting a protected save requires its existing password and retains protection. Password changes/removal and read protection are outside this request.

Store a random salt and scrypt hash in internal record metadata, never plaintext. Public save/list metadata exposes only passwordProtected, not hash or salt. Lua downloads contain neither. Validate password input length/type, verify hashes with constant-time comparison, authenticate before modifying storage and retain atomic replacement.

Serialize writes to each library record across store instances in the server process so simultaneous protection and overwrite requests cannot bypass newly-set protection. Existing records remain unprotected until a password is explicitly provided. Shared loading/importing remains open and the UI explains overwrite-only protection. Use HTTPS when accessing password-protected saves remotely.

Verification: correct/missing/wrong passwords, restart persistence, metadata redaction, protection of existing saves, concurrent requests, legacy unprotected flow, API enforcement and Chrome password retry workflow. Update PR and leave merging to the user.
