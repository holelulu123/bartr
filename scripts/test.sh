#!/usr/bin/env bash
set -euo pipefail

# Run all tests for the bartr marketplace.
# Usage:
#   bash scripts/test.sh          # run everything (starts Docker if needed)
#   bash scripts/test.sh --unit   # web + API unit tests only (no Docker)
#   bash scripts/test.sh --api    # API tests only (needs Docker)
#   bash scripts/test.sh --web    # web tests only

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

PNPM="${PNPM:-pnpm}"
COMPOSE_FILE="docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

mode="${1:-all}"
failed=0

log()  { printf "${BOLD}▶ %s${RESET}\n" "$*"; }
pass() { printf "${GREEN}✓ %s${RESET}\n" "$*"; }
fail() { printf "${RED}✗ %s${RESET}\n" "$*"; failed=1; }
skip() { printf "${YELLOW}⊘ %s (skipped)${RESET}\n" "$*"; }

# ── Docker helpers ───────────────────────────────────────────────────

docker_needed() {
  [[ "$mode" == "all" || "$mode" == "--api" ]]
}

docker_running() {
  docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q postgres
}

ensure_docker() {
  if docker_running; then
    log "Test containers already running"
    return
  fi

  log "Starting test containers..."
  docker compose -f "$COMPOSE_FILE" up -d --wait postgres redis minio
  log "Containers ready"
}

# ── Test runners ─────────────────────────────────────────────────────

run_web() {
  log "Running web tests (packages/web)..."
  if $PNPM --filter @bartr/web run test; then
    pass "Web tests passed"
  else
    fail "Web tests failed"
  fi
}

run_api() {
  log "Running API tests (packages/api)..."
  if $PNPM --filter @bartr/api run test; then
    pass "API tests passed"
  else
    fail "API tests failed"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────

case "$mode" in
  all)
    ensure_docker
    run_web
    run_api
    ;;
  --unit)
    run_web
    skip "API integration tests (use --api or run without flags)"
    ;;
  --web)
    run_web
    ;;
  --api)
    ensure_docker
    run_api
    ;;
  *)
    echo "Usage: bash scripts/test.sh [--unit|--web|--api]"
    exit 1
    ;;
esac

# ── Summary ──────────────────────────────────────────────────────────

echo ""
if [ "$failed" -eq 0 ]; then
  printf "${GREEN}${BOLD}All tests passed.${RESET}\n"
else
  printf "${RED}${BOLD}Some tests failed.${RESET}\n"
  exit 1
fi
