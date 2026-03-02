---
name: commit
description: Stage and commit current changes with a clear message.
argument-hint: "[optional message override]"
user-invocable: true
allowed-tools: Bash(git *)
---

# Commit Changes

Commit the current working changes for the bartr marketplace project.

## Steps

1. **Check state** — run `git status` (never use `-uall`) and `git diff` to see all changes.

2. **Review** — read the diff to understand what changed. Do NOT commit files that contain secrets (`.env`, credentials, keys).

3. **Stage** — add specific files by name (`git add file1 file2`). Do NOT use `git add -A` or `git add .`.

4. **Commit message** — write a concise message following this project's style:
   - Prefix: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
   - Focus on the "why", not the "what"
   - 1-2 sentences max
   - Use a HEREDOC for formatting
   - End with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

5. **Verify** — run `git status` after commit to confirm clean state.

## If argument provided

Use `$ARGUMENTS` as the commit message instead of generating one. Still add the Co-Authored-By line.

## Do NOT

- Do not amend previous commits unless explicitly asked
- Do not push to remote
- Do not use `--no-verify`
- Do not commit `.env`, credentials, or key files
