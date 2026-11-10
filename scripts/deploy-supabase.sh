#!/usr/bin/env bash
# Local equivalent of .github/workflows/deploy-supabase.yml.
# Applies migration files newer than BASELINE that are not already in the
# project's migration history, then deploys Edge Functions. Use --dry-run to
# list what would be applied without changing production.
#
# Required: curl, jq, and SUPABASE_ACCESS_TOKEN in the environment.
# Optional: SUPABASE_PROJECT_REF (defaults to wqdrbywcktxgytkyqcco).
#
# The token is never printed. Anyone who can read it can act on the
# production database — keep it out of logs, commits, and chat.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=... ./scripts/deploy-supabase.sh --dry-run
#   SUPABASE_ACCESS_TOKEN=... ./scripts/deploy-supabase.sh
#   SUPABASE_ACCESS_TOKEN=... ./scripts/deploy-supabase.sh --no-functions
#   SUPABASE_ACCESS_TOKEN=... ./scripts/deploy-supabase.sh --no-migrations
#
# On Windows, run from Git Bash or WSL.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

BASELINE="20261107160000"
DEFAULT_REF="wqdrbywcktxgytkyqcco"
DRY_RUN=0
NO_FUNCTIONS=0
NO_MIGRATIONS=0

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-supabase.sh [options]

Applies pending Supabase migrations newer than the baseline (20261107160000)
and deploys Edge Functions. Same behaviour as
.github/workflows/deploy-supabase.yml.

Options:
  --dry-run        List migrations (and functions) that would be applied;
                   do not POST anything or deploy functions
  --no-functions   Skip `supabase functions deploy` after migrations
  --no-migrations  Skip applying migrations (functions only)
  -h, --help       Show this help

Environment:
  SUPABASE_ACCESS_TOKEN   Required. Never echoed.
  SUPABASE_PROJECT_REF    Optional. Defaults to wqdrbywcktxgytkyqcco.
                          PROJECT_REF is accepted as a fallback.

Requires curl and jq. On Windows, use Git Bash or WSL.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)        DRY_RUN=1 ;;
    --no-functions)   NO_FUNCTIONS=1 ;;
    --no-migrations)  NO_MIGRATIONS=1 ;;
    -h|--help)        usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    echo "Install it and re-run. On macOS: brew install $1. On Debian/Ubuntu: sudo apt-get install $1." >&2
    exit 1
  fi
}

need_cmd curl
need_cmd jq

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN is not set. Export it and re-run (the token is never printed)." >&2
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-${PROJECT_REF:-$DEFAULT_REF}}"
if [ -z "$PROJECT_REF" ]; then
  echo "SUPABASE_PROJECT_REF is empty." >&2
  exit 1
fi

if [ "$NO_MIGRATIONS" -eq 1 ] && [ "$NO_FUNCTIONS" -eq 1 ]; then
  echo "Cannot combine --no-migrations and --no-functions (nothing to do)." >&2
  exit 2
fi

API="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations"

# Isolate the token in a header file so it never appears on a command line
# that might be logged. The file is shredded on exit.
AUTH_HEADER="$(mktemp)"
chmod 600 "$AUTH_HEADER"
cleanup() {
  rm -f "$AUTH_HEADER" applied.txt resp.json
}
trap cleanup EXIT INT TERM
printf 'Authorization: Bearer %s\n' "$SUPABASE_ACCESS_TOKEN" > "$AUTH_HEADER"

echo "Project: $PROJECT_REF"
echo "Baseline: $BASELINE (files at or before this version are left alone)"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "Mode: dry-run (nothing will be applied or deployed)"
fi

pending=0
applied_count=0

if [ "$NO_MIGRATIONS" -eq 1 ]; then
  echo "Skipping migrations (--no-migrations)."
else
  # Fetch already-applied migration names. A non-2xx or a non-array body is fatal.
  http_code="$(curl -sS -o applied.json -w '%{http_code}' \
    -H @"$AUTH_HEADER" \
    "$API" || true)"

  if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
    echo "GET $API failed with HTTP $http_code" >&2
    if [ -f applied.json ]; then
      # Show the API's error message without risking a token leak.
      jq -r 'if type == "object" then (.message // .error // .msg // tostring) else tostring end' applied.json 2>/dev/null \
        | sed -E 's/Bearer[[:space:]]+[A-Za-z0-9._\-]+/Bearer [redacted]/g' >&2 || true
    fi
    rm -f applied.json
    exit 1
  fi

  if ! jq -e 'type == "array"' applied.json >/dev/null 2>&1; then
    echo "Supabase migrations endpoint did not return a JSON array." >&2
    rm -f applied.json
    exit 1
  fi

  jq -r '.[].name // empty' applied.json | sort -u > applied.txt
  rm -f applied.json
  applied_existing="$(wc -l < applied.txt | tr -d ' ')"
  echo "Already recorded on the project: $applied_existing migration name(s)."

  # Filename sort is version order: each file starts with a 14-digit timestamp.
  for f in $(ls supabase/migrations/*.sql | sort); do
    base="$(basename "$f" .sql)"
    version="${base%%_*}"
    name="${base#*_}"

    if ! printf '%s' "$version" | grep -Eq '^[0-9]{14}$'; then
      continue
    fi
    # Numeric compare matches the previous workflow. 14-digit values fit in signed 64-bit.
    if [ "$version" -le "$BASELINE" ]; then
      continue
    fi
    if grep -qxF "$name" applied.txt; then
      echo "skip $base (already applied)"
      continue
    fi

    pending=$((pending + 1))

    if [ "$DRY_RUN" -eq 1 ]; then
      echo "would apply $base"
      continue
    fi

    echo "apply $base"
    body="$(jq -n --rawfile q "$f" --arg n "$name" '{query:$q, name:$n}')"
    code="$(curl -sS -o resp.json -w '%{http_code}' -X POST "$API" \
      -H @"$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "$body" || true)"
    if [ -f resp.json ]; then
      sed -E 's/Bearer[[:space:]]+[A-Za-z0-9._\-]+/Bearer [redacted]/g' resp.json
      echo
    fi
    if [ -z "$code" ] || [ "$code" -ge 300 ]; then
      echo "$base failed with HTTP ${code:-000}" >&2
      exit 1
    fi
    applied_count=$((applied_count + 1))
  done

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Dry-run: $pending migration(s) would be applied. None were posted."
  else
    echo "Applied $applied_count migration(s)."
  fi
fi

if [ "$NO_FUNCTIONS" -eq 1 ]; then
  echo "Skipping Edge Functions deploy (--no-functions)."
  exit 0
fi

# List function names for the report (and for dry-run).
fn_list=""
if [ -d supabase/functions ]; then
  for d in supabase/functions/*; do
    [ -d "$d" ] || continue
    fn_list="${fn_list}$(basename "$d") "
  done
fi

# Prefer a preinstalled `supabase` binary (GitHub's setup-cli, a global
# install) and fall back to npx so a laptop without the CLI still works.
if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="supabase"
else
  SUPABASE_CMD="npx supabase"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry-run: would deploy Edge Functions with:"
  echo "  $SUPABASE_CMD functions deploy --project-ref $PROJECT_REF --use-api"
  if [ -n "$fn_list" ]; then
    echo "Functions in supabase/functions/: $fn_list"
  else
    echo "No function directories found under supabase/functions/."
  fi
  echo "Dry-run complete. Nothing was applied or deployed."
  exit 0
fi

echo "Deploying Edge Functions for $PROJECT_REF"
# Word-splitting of SUPABASE_CMD is intentional so `npx supabase` works.
# shellcheck disable=SC2086
$SUPABASE_CMD functions deploy --project-ref "$PROJECT_REF" --use-api
echo "Edge Functions deploy finished."
