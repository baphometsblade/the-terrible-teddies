#!/usr/bin/env bash
# Local source of truth for the checks in .github/workflows/node.js.yml.
# The workflow calls this script with --step so GitHub and a laptop run the
# exact same commands. GitHub's own runners are currently locked (billing),
# so every PR must pass this script before merge. The workflow files stay in
# the repo and will run again if Actions is unlocked.
#
# Usage:
#   ./scripts/ci-local.sh
#   ./scripts/ci-local.sh --no-install
#   ./scripts/ci-local.sh --quick          # lint, typecheck, unit only
#   ./scripts/ci-local.sh --skip-e2e
#   ./scripts/ci-local.sh --lighthouse     # off by default in a full run
#   ./scripts/ci-local.sh --step unit      # one step, same as the CI job
#
# Works on Linux and macOS bash (including the bash 3.2 that ships with macOS).
# On Windows, run it from Git Bash or WSL, not cmd.exe or PowerShell.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

NO_INSTALL=0
QUICK=0
SKIP_E2E=0
LIGHTHOUSE=0
STEP=""

usage() {
  cat <<'USAGE'
Usage: scripts/ci-local.sh [options]

Runs the same checks as .github/workflows/node.js.yml, in order, and stops
on the first failure. Prints a pass/fail/skip summary at the end. The
GitHub workflow calls this script with --step so both paths share one
implementation.

Options:
  --no-install     Skip `npm ci` (use an existing node_modules)
  --quick          Lint, typecheck, and unit tests only
  --skip-e2e       Skip the Playwright suites (dev-server and production preview)
  --lighthouse     Include the Lighthouse job in a full run (skipped by default)
  --step NAME      Run a single step and exit. NAME is one of:
                   install, lint, typecheck, build, unit, e2e,
                   e2e-prod, migrations, lighthouse
  -h, --help       Show this help

Migrations: uses DATABASE_URL if set, otherwise starts a throwaway
postgres:16 container when Docker is available. If neither is available
the migrations step is skipped with a loud warning.

On Windows, use Git Bash or WSL.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --no-install) NO_INSTALL=1 ;;
    --quick)      QUICK=1 ;;
    --skip-e2e)   SKIP_E2E=1 ;;
    --lighthouse) LIGHTHOUSE=1 ;;
    --step)
      if [ $# -lt 2 ]; then
        echo "--step requires a name (lint, typecheck, build, unit, e2e, e2e-prod, migrations, lighthouse, install)" >&2
        exit 2
      fi
      STEP="$2"
      shift
      ;;
    --step=*)
      STEP="${1#--step=}"
      ;;
    -h|--help)    usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$STEP" in
  ""|install|lint|typecheck|build|unit|e2e|e2e-prod|migrations|lighthouse) ;;
  *)
    echo "Unknown step: $STEP" >&2
    usage >&2
    exit 2
    ;;
esac

if [ -n "$STEP" ] && [ "$QUICK" -eq 1 ]; then
  echo "Cannot combine --step and --quick." >&2
  exit 2
fi
if [ -n "$STEP" ] && [ "$SKIP_E2E" -eq 1 ]; then
  case "$STEP" in
    e2e|e2e-prod)
      echo "Cannot combine --skip-e2e with --step $STEP." >&2
      exit 2
      ;;
  esac
fi

# CI=true matches GitHub Actions: Playwright retries failed tests and
# forbids test.only leftovers.
export CI=true

if [ -t 1 ]; then
  C_PASS="$(printf '\033[32m')"
  C_FAIL="$(printf '\033[31m')"
  C_SKIP="$(printf '\033[33m')"
  C_BOLD="$(printf '\033[1m')"
  C_RESET="$(printf '\033[0m')"
else
  C_PASS=""; C_FAIL=""; C_SKIP=""; C_BOLD=""; C_RESET=""
fi

RESULTS=""
FAILURES=0
PG_CID=""
PREVIEW_PID=""
MIGRATIONS_SKIPPED=0
BROWSERS_READY=0

cleanup() {
  if [ -n "$PREVIEW_PID" ]; then
    kill "$PREVIEW_PID" >/dev/null 2>&1 || true
    wait "$PREVIEW_PID" >/dev/null 2>&1 || true
    PREVIEW_PID=""
  fi
  if [ -n "$PG_CID" ]; then
    docker rm -f "$PG_CID" >/dev/null 2>&1 || true
    PG_CID=""
  fi
}
trap cleanup EXIT INT TERM

record() {
  # $1 = pass|fail|skip, $2 = step name
  RESULTS="${RESULTS}$1|$2"$'\n'
}

print_summary() {
  echo
  echo "${C_BOLD}==================== Local CI summary ====================${C_RESET}"
  while IFS='|' read -r status name; do
    [ -z "${status:-}" ] && continue
    case "$status" in
      pass) printf '  %s[pass]%s %s\n' "$C_PASS" "$C_RESET" "$name" ;;
      fail) printf '  %s[fail]%s %s\n' "$C_FAIL" "$C_RESET" "$name" ;;
      skip) printf '  %s[skip]%s %s\n' "$C_SKIP" "$C_RESET" "$name" ;;
      *)    printf '  [%s] %s\n' "$status" "$name" ;;
    esac
  done <<SUMMARY
${RESULTS}
SUMMARY
  if [ "$FAILURES" -ne 0 ]; then
    echo "${C_FAIL}${C_BOLD}FAILED${C_RESET}"
  else
    echo "${C_PASS}${C_BOLD}PASSED${C_RESET}"
  fi
}

fail_step() {
  record fail "$1"
  FAILURES=$((FAILURES + 1))
  print_summary
  exit 1
}

skip_step() {
  local name="$1"
  local reason="$2"
  echo
  echo "${C_SKIP}==> $name: SKIPPED ($reason)${C_RESET}"
  record skip "$name"
}

warn_migrations_skipped() {
  local reason="$1"
  cat <<WARN

**************************************************************************
WARNING: migrations check SKIPPED ($reason).
The GitHub job replays every file in supabase/migrations against a real
PostgreSQL 16 and asserts the resulting grants. Without that check, a
migration Postgres would refuse can still look fine here.

To run it:
  - Start a throwaway Postgres 16 and point DATABASE_URL at it, e.g.
      DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres
      ./scripts/ci-local.sh --step migrations
  - Or install Docker so this script can start postgres:16 itself.
**************************************************************************

WARN
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-40}"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -sf -o /dev/null "$url"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

docker_available() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1
}

start_throwaway_postgres() {
  # Publish on a random host port so a local Postgres on 5432 is left alone.
  PG_CID="$(docker run -d --rm \
    -e POSTGRES_PASSWORD=postgres \
    -p 127.0.0.1:0:5432 \
    postgres:16)"
  local port=""
  local i=1
  while [ "$i" -le 30 ]; do
    port="$(docker port "$PG_CID" 5432/tcp 2>/dev/null | head -n 1 | awk -F: '{print $NF}' | tr -d '\r')"
    if [ -n "$port" ]; then
      break
    fi
    sleep 1
    i=$((i + 1))
  done
  if [ -z "$port" ]; then
    echo "Could not discover the published port for the throwaway Postgres container." >&2
    return 1
  fi
  i=1
  while [ "$i" -le 40 ]; do
    if docker exec "$PG_CID" pg_isready -U postgres >/dev/null 2>&1; then
      DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${port}/postgres"
      export DATABASE_URL
      echo "Throwaway Postgres 16 is ready on 127.0.0.1:${port}"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "Throwaway Postgres 16 did not become ready in time." >&2
  return 1
}

ensure_node_modules() {
  if [ -d node_modules ]; then
    return 0
  fi
  if [ "$NO_INSTALL" -eq 1 ]; then
    echo "node_modules is missing; run without --no-install, or run npm ci first." >&2
    return 1
  fi
  echo "node_modules is missing; running npm ci first."
  npm ci
}

install_playwright_chromium() {
  if [ "$BROWSERS_READY" -eq 1 ]; then
    return 0
  fi
  # The GitHub job previously used `npx playwright install --with-deps chromium`.
  # --with-deps apt-gets system libraries and will hang on a sudo password
  # prompt for a non-root user, so only use it when we are already root
  # (GitHub's ubuntu-latest runners are root).
  if [ "$(id -u)" -eq 0 ]; then
    npx playwright install --with-deps chromium
  else
    npx playwright install chromium
  fi
  BROWSERS_READY=1
}

run_e2e_prod() {
  echo "Building production bundle with test Supabase credentials (same as the e2e-prod job)."
  VITE_SUPABASE_URL=https://testproject.supabase.co \
    VITE_SUPABASE_ANON_KEY=test-anon-key \
    npm run build
  echo "Running smoke.spec.js against vite preview (E2E_PREVIEW=1)."
  E2E_PREVIEW=1 npx playwright test smoke.spec.js
}

start_lighthouse_preview() {
  npx vite preview --host 127.0.0.1 --port 4173 &
  PREVIEW_PID=$!
  if ! wait_for_http "http://127.0.0.1:4173" 40; then
    echo "vite preview did not become ready on :4173" >&2
    return 1
  fi
}

run_lighthouse() {
  # Always build with the same test credentials the lighthouse job uses, so
  # a leftover dist/ from a different env cannot mask a production-only break.
  echo "Building production bundle with test Supabase credentials for Lighthouse."
  VITE_SUPABASE_URL=https://testproject.supabase.co \
    VITE_SUPABASE_ANON_KEY=test-anon-key \
    npm run build
  start_lighthouse_preview
  npx --yes @lhci/cli@0.14.0 autorun
  local status=$?
  if [ -n "$PREVIEW_PID" ]; then
    kill "$PREVIEW_PID" >/dev/null 2>&1 || true
    wait "$PREVIEW_PID" >/dev/null 2>&1 || true
    PREVIEW_PID=""
  fi
  return $status
}

run_migrations_body() {
  MIGRATIONS_SKIPPED=0
  if ! command -v psql >/dev/null 2>&1; then
    warn_migrations_skipped "psql is not installed"
    MIGRATIONS_SKIPPED=1
    return 0
  fi
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "Using DATABASE_URL from the environment."
    ./scripts/check-migrations.sh
    return $?
  fi
  if docker_available; then
    echo "No DATABASE_URL set; starting a throwaway postgres:16 container."
    start_throwaway_postgres
    ./scripts/check-migrations.sh
    return $?
  fi
  if command -v docker >/dev/null 2>&1; then
    warn_migrations_skipped "Docker is installed but the daemon is not reachable"
  else
    warn_migrations_skipped "no DATABASE_URL and Docker is not available"
  fi
  MIGRATIONS_SKIPPED=1
  return 0
}

# The actual work for one named step. Callers handle logging and the summary.
invoke_step() {
  local name="$1"
  case "$name" in
    install)
      if [ "$NO_INSTALL" -eq 1 ]; then
        echo "Skipping npm ci (--no-install)."
        return 0
      fi
      npm ci
      ;;
    lint)
      ensure_node_modules
      npm run lint
      ;;
    typecheck)
      ensure_node_modules
      npm run typecheck
      ;;
    build)
      ensure_node_modules
      npm run build --if-present
      ;;
    unit)
      ensure_node_modules
      npm test
      ;;
    e2e)
      ensure_node_modules
      install_playwright_chromium
      npm run test:e2e
      ;;
    e2e-prod)
      ensure_node_modules
      install_playwright_chromium
      run_e2e_prod
      ;;
    migrations)
      run_migrations_body
      ;;
    lighthouse)
      ensure_node_modules
      run_lighthouse
      ;;
    *)
      echo "Unknown step: $name" >&2
      return 2
      ;;
  esac
}

run_step() {
  local name="$1"
  echo
  echo "${C_BOLD}==> $name${C_RESET}"
  if invoke_step "$name"; then
    if [ "$name" = migrations ] && [ "$MIGRATIONS_SKIPPED" -eq 1 ]; then
      record skip "migrations"
      return 0
    fi
    if [ "$name" = install ] && [ "$NO_INSTALL" -eq 1 ]; then
      record skip "install"
      return 0
    fi
    record pass "$name"
  else
    fail_step "$name"
  fi
}

echo "${C_BOLD}Local CI${C_RESET} — same checks as .github/workflows/node.js.yml"
echo "Repo: $ROOT"
echo "Node: $(node -v 2>/dev/null || echo unavailable)   npm: $(npm -v 2>/dev/null || echo unavailable)"

if [ -n "$STEP" ]; then
  run_step "$STEP"
  print_summary
  exit 0
fi

run_step install
run_step lint
run_step typecheck

if [ "$QUICK" -eq 1 ]; then
  skip_step "build" "--quick"
  run_step unit
  skip_step "e2e" "--quick"
  skip_step "e2e-prod" "--quick"
  skip_step "migrations" "--quick"
  skip_step "lighthouse" "--quick"
  print_summary
  exit 0
fi

run_step build
run_step unit

if [ "$SKIP_E2E" -eq 1 ]; then
  skip_step "e2e" "--skip-e2e"
  skip_step "e2e-prod" "--skip-e2e"
else
  run_step e2e
  run_step e2e-prod
fi

run_step migrations

if [ "$LIGHTHOUSE" -eq 1 ]; then
  run_step lighthouse
else
  skip_step "lighthouse" "default; pass --lighthouse to run"
fi

print_summary
exit 0
