# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private
reporting instead: open the **Security** tab of this repository and choose
**Report a vulnerability**. Include what you found, how to reproduce it, and
which version or commit you tested.

Only the latest commit on `main` is supported.

## Scope and design notes

- The shared server library has **no logins**. Anyone who can reach the site can
  list, load and download saved files. This is intentional and documented in the
  README. Do not store anything private in it.
- An overwrite password protects against replacing a saved file only. It does
  not hide the file.
- Lua uploads are parsed as restricted data and never executed. A way to make
  the parser execute code, read other files, or exhaust the server's resources
  is in scope.

## Hardening already in place

- Host and Origin checks, a restrictive Content-Security-Policy, and `nosniff`
  on every response.
- Passwords are stored as salted scrypt hashes and compared in constant time.
- CI runs with read-only token permissions, pinned action versions, CodeQL, and
  an `npm audit` check. Dependabot keeps dependencies and actions current.
