#!/usr/bin/env bash
#
# demo-incident.sh — one command from healthy app to live incident.
#
#   ./scripts/demo-incident.sh 6      # merge PR #6, redeploy, drive traffic
#   pnpm demo:incident 6              # same, via package.json
#
# Merges the given "bad commit" PR on GitHub, pulls it into this checkout,
# logs the deploy, makes sure mini-shop is running the new code, then drives
# continuous traffic so the broken endpoint fires and the error reporter
# opens an incident with the responder. Ctrl-C stops the traffic; the app
# keeps running.
set -euo pipefail

PR="${1:?usage: demo-incident.sh <pr-number>   (gh pr list shows the break PRs)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPO="alexkuzmanov1/ai-sre-demo-app"
PORT="$(grep -s '^PORT=' .env | cut -d= -f2- || true)"
PORT="${PORT:-3000}"

# Fire-and-forget error reports get dropped if the responder is asleep
# (Render free tier) — wake it BEFORE shipping the bug.
WEBHOOK="$(grep -s '^RESPONDER_WEBHOOK_URL=' .env | cut -d= -f2- || true)"
if [ -n "$WEBHOOK" ]; then
  BASE="${WEBHOOK%/api/incidents}"
  echo "==> Waking the responder ($BASE)"
  if curl -sf -m 75 "$BASE/health" > /dev/null; then
    echo "    responder is up"
  else
    echo "    WARNING: responder unreachable — error reports will be dropped"
  fi
else
  echo "==> WARNING: RESPONDER_WEBHOOK_URL not set in .env — no incident will be created"
fi

echo "==> Merging PR #$PR — the 'bad deploy' ships to production"
gh pr merge "$PR" --repo "$REPO" --merge

echo "==> Pulling the bad commit into this checkout"
git checkout main
git pull origin main

echo "==> Logging the deploy"
pnpm deploy:log || true

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t > /dev/null 2>&1; then
  echo "==> mini-shop already running — watch mode reloads the new code"
  sleep 6
else
  echo "==> Starting mini-shop (logs: $ROOT/mini-shop.log)"
  nohup pnpm start:dev > mini-shop.log 2>&1 &
fi

printf "    waiting for http://localhost:%s/health " "$PORT"
UP=""
for _ in $(seq 1 45); do
  if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    UP=1
    break
  fi
  printf "."
  sleep 2
done
echo
if [ -z "$UP" ]; then
  echo "app did not come up — check mini-shop.log (is docker compose up?)"
  exit 1
fi
echo "    app is up"

echo "==> Driving traffic — the broken endpoint will start erroring (Ctrl-C to stop)"
exec pnpm traffic
