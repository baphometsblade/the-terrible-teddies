# Local CI and local Supabase deploy

`scripts/ci-local.sh` (`npm run ci:local`) is the **single source of truth**
for the checks in `.github/workflows/node.js.yml`. The workflow does not
reimplement those commands: every job calls the same script with `--step`
(for example `bash scripts/ci-local.sh --no-install --step lint`). A laptop
and GitHub therefore run the exact same lint, typecheck, build, unit, e2e,
e2e-prod, migrations, and lighthouse steps.

The same rule applies to Supabase deploys: `.github/workflows/deploy-supabase.yml`
calls `scripts/deploy-supabase.sh` (`npm run deploy:supabase`), with
`--no-functions` for the migrate job and `--no-migrations` for the functions
job.

GitHub Actions on this account is currently locked over a billing issue, so
**GitHub checks are not running and are not the source of truth.** Every
pull request must pass `npm run ci:local` on a developer machine (or this
script in a local environment) before it is merged. The workflow files stay
in place. They will start running again if billing is ever fixed; until then,
do not wait on them and do not treat a missing or failed Actions run as a
merge blocker when the local script has passed. The Node.js workflow also
uses concurrency with `cancel-in-progress` per ref, so a new push cancels a
superseded run once Actions is unlocked. The Supabase deploy workflow still
queues (it does not cancel) so two production deploys cannot overlap.

Vercel builds run on Vercel's own infrastructure, not GitHub Actions, so a
production or preview deploy is unaffected by the lock. Connecting the
`baphometsblade/the-terrible-teddies` repo to the `cheeky-teddy-brawl`
project in Vercel Git settings makes those deploys automatic. Until that
connection exists, deploy the frontend with `npx vercel --prod` (or the
Vercel dashboard) after a merge.

On Windows, run both scripts from **Git Bash** or **WSL**. They are bash
scripts and will not run under cmd.exe or PowerShell.

## `npm run ci:local`

Runs every check the GitHub workflow runs, in order, and stops on the first
failure. It prints a pass / fail / skip summary at the end.

```sh
npm run ci:local
```

Equivalent to `./scripts/ci-local.sh`. Useful flags (pass them after `--`):

| Flag | Effect |
| --- | --- |
| `--no-install` | Skip `npm ci` and use the existing `node_modules` |
| `--quick` | Lint, typecheck, and unit tests only |
| `--skip-e2e` | Skip both Playwright suites (dev-server and production preview) |
| `--lighthouse` | Include the Lighthouse job in a full run (skipped by default) |
| `--step NAME` | Run a single step and exit, the same way a GitHub job does |

`NAME` is one of: `install`, `lint`, `typecheck`, `build`, `unit`, `e2e`,
`e2e-prod`, `migrations`, `lighthouse`.

```sh
npm run ci:local -- --quick
npm run ci:local -- --no-install --skip-e2e
npm run ci:local -- --lighthouse
npm run ci:local -- --no-install --step unit
```

The steps, matching the GitHub workflow, are:

1. `npm ci` (unless `--no-install`)
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm test` (Vitest unit suite)
6. `npm run test:e2e` (Playwright against the Vite dev server), after
   installing the Chromium browser
7. The `e2e-prod` job: build with the test `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`, then `E2E_PREVIEW=1 npx playwright test smoke.spec.js`

Playwright listens on `127.0.0.1:8090` by default. If that port is already
in use, set `E2E_PORT` to a free port instead of killing the process that
owns 8090.
8. `./scripts/check-migrations.sh` against a throwaway PostgreSQL 16
9. Lighthouse, only if you passed `--lighthouse` or `--step lighthouse`

A full local run skips Lighthouse by default because it is slower and
needs a clean production preview. GitHub still runs that job via
`--step lighthouse`.

### Migrations

The migrations step uses `DATABASE_URL` if it is already set. Otherwise
the script starts a throwaway `postgres:16` Docker container, points
`DATABASE_URL` at it, runs the check, and removes the container. The
GitHub job provides a Postgres 16 service and sets `DATABASE_URL`.

If `DATABASE_URL` is unset and Docker is not available (or the daemon is
not reachable), the step is **skipped with a loud warning**. That is not a
pass of the migrations job — it only means the check could not run. To run
it yourself:

```sh
# After starting a scratch Postgres 16, for example:
#   docker run -d --rm --name tt-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm run ci:local -- --step migrations
```

`psql` must be on your `PATH`. On macOS: `brew install libpq` and link it.
On Debian/Ubuntu: `sudo apt-get install postgresql-client`.

## `npm run deploy:supabase`

Local equivalent of `.github/workflows/deploy-supabase.yml`. It applies
migration files newer than `BASELINE=20261107160000` that are not already
recorded on the project (matched by the name suffix after the timestamp),
posting each `{query, name}` to the Supabase Management API in version
order and stopping on the first failure. It then deploys Edge Functions
with `supabase functions deploy --project-ref $PROJECT_REF --use-api`
(or `npx supabase` if the CLI is not already on your `PATH`).

Requires `curl` and `jq`. The access token is never printed.

```sh
# Always dry-run first: lists pending migrations and the functions deploy
# command. It does not POST migrations and does not deploy functions.
export SUPABASE_ACCESS_TOKEN=...   # do not commit or paste this into chat
# Optional; defaults to wqdrbywcktxgytkyqcco
export SUPABASE_PROJECT_REF=wqdrbywcktxgytkyqcco

npm run deploy:supabase -- --dry-run
```

Only after you have reviewed the dry-run list:

```sh
npm run deploy:supabase
npm run deploy:supabase -- --no-functions    # migrations only
npm run deploy:supabase -- --no-migrations   # functions only
```

`--dry-run` is read-only. Anyone with the access token can use the
production database (and, depending on the token, the rest of the
Supabase account), so keep it as an environment variable, not a file in
the repo, and limit GitHub / team admin access accordingly.

## Merge rule

1. Run `npm run ci:local` and keep the pass summary.
2. If the change includes new files under `supabase/migrations/` or
   `supabase/functions/`, run `npm run deploy:supabase -- --dry-run`,
   then apply for real (`npm run deploy:supabase`) as part of taking the
   change live — GitHub's deploy workflow will not run while Actions is
   locked.
3. Merge the pull request. Deploy the frontend on Vercel if the Git
   integration is not connected yet.
