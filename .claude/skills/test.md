---
name: test
description: Run project tests. Use when verifying code changes pass all tests.
argument-hint: "[--api|--web|--unit]"
user-invocable: true
allowed-tools: Bash(~/.local/bin/pnpm *), Bash(docker compose *), Bash(bash scripts/test.sh*)
---

# Run Tests

Run the bartr test suite. Argument: `$ARGUMENTS` (empty = all tests).

## Environment

- pnpm: `~/.local/bin/pnpm`
- Docker Compose file: `docker-compose.yml` (dev-default)
- Tests need: postgres on :5433, redis on :6379, minio on :9000
- Web tests: 526 tests in jsdom (no Docker needed)
- API tests: 192 tests (28 unit + 164 integration, need Docker)

## Steps

1. **Check if infra is running** (skip for `--web` or `--unit`):
   ```bash
   docker compose ps --status running 2>/dev/null | grep -q postgres
   ```
   If not running, start only what's needed:
   ```bash
   docker compose up -d --wait postgres redis minio
   ```

2. **Run the tests** based on argument:
   - No argument or `all`: `bash scripts/test.sh`
   - `--api`: `~/.local/bin/pnpm --filter @bartr/api run test`
   - `--web`: `~/.local/bin/pnpm --filter @bartr/web run test`
   - `--unit`: `~/.local/bin/pnpm --filter @bartr/web run test` (web only, no Docker)

3. **Report results** concisely:
   - Total passed / failed / skipped per suite
   - If failures: show the failing test names and the relevant error message
   - If all pass: one-line summary with counts

## Do NOT

- Do not modify any code — only run and report
- Do not start nginx, nextjs, api, or workers containers — only infra services
- Do not re-run failing tests automatically — report and let the user decide
