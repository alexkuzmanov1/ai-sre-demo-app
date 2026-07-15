#!/usr/bin/env bash
#
# demo.sh — the single entry point for break / fix / revert / status so the
# human and the AI SRE drive byte-for-byte identical git + deploy behavior.
#
# Scenarios are a fixed, closed set. Every mutating subcommand logs a deploy so
# deploys.json stays the single timeline errors are correlated against.
#
set -euo pipefail

SCENARIOS="null-check order-number redis-config"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

print_usage() {
  echo "usage: demo.sh <break|fix|revert|status> [scenario]" >&2
  echo "valid scenarios: null-check, order-number, redis-config" >&2
}

is_valid_scenario() {
  local candidate="$1"
  local s
  for s in $SCENARIOS; do
    if [ "$candidate" = "$s" ]; then
      return 0
    fi
  done
  return 1
}

require_scenario() {
  local candidate="${1:-}"
  if [ -z "$candidate" ] || ! is_valid_scenario "$candidate"; then
    print_usage
    exit 1
  fi
}

branch_exists() {
  git show-ref --verify --quiet "refs/heads/$1"
}

log_deploy() {
  ( cd "$ROOT_DIR" && pnpm deploy:log )
}

cmd_break() {
  # Introduce a bug. Validate BEFORE touching git.
  require_scenario "${1:-}"
  local scenario="$1"
  cd "$ROOT_DIR"

  if ! branch_exists "break/$scenario"; then
    echo "error: branch break/$scenario does not exist — create it first." >&2
    exit 1
  fi

  git checkout main
  git merge --no-ff "break/$scenario" -m "Merge branch 'break/$scenario' into main"
  log_deploy
  echo "[demo] broke main with break/$scenario"
}

cmd_fix() {
  # Apply the AI SRE's remediation from fix/<scenario> (already committed onto
  # a branch cut from the live broken main, so this merges cleanly).
  require_scenario "${1:-}"
  local scenario="$1"
  cd "$ROOT_DIR"

  if ! branch_exists "fix/$scenario"; then
    echo "no fix branch — the agent hasn't proposed a patch yet, or run \`demo.sh revert\` to roll back." >&2
    exit 1
  fi

  git checkout main
  git merge --no-ff "fix/$scenario" -m "fix($scenario): apply incident remediation"
  log_deploy
  echo "[demo] healed main with fix/$scenario"
}

cmd_revert() {
  # Human escape hatch. Undo the most recent commit on main. Depends on no
  # branch existing, so it is the reliable fallback.
  cd "$ROOT_DIR"
  git checkout main
  if git rev-parse -q --verify 'HEAD^2' >/dev/null 2>&1; then
    git revert -m 1 --no-edit HEAD
  else
    git revert --no-edit HEAD
  fi
  log_deploy
  echo "[demo] reverted the last commit on main"
}

cmd_status() {
  cd "$ROOT_DIR"
  # Read-only and must survive the fresh, no-commit repo state (unborn HEAD),
  # so every git read is guarded and never aborts under `set -e`.
  local branch
  branch="$(git symbolic-ref --short -q HEAD 2>/dev/null \
    || git rev-parse --abbrev-ref HEAD 2>/dev/null \
    || echo '(unknown)')"
  echo "branch: $branch"
  echo "--- last 3 commits ---"
  git log --oneline -3 2>/dev/null || echo "(no commits yet)"
  echo "--- deploys.json (tail) ---"
  if [ -f deploys.json ]; then
    tail -n 5 deploys.json
  else
    echo "(no deploys.json yet)"
  fi
  echo "--- active scenario ---"
  local last_break
  last_break="$(git log --merges --oneline -50 2>/dev/null \
    | grep -oE "break/(null-check|order-number|redis-config)" \
    | head -n1 || true)"
  if [ -n "$last_break" ]; then
    echo "${last_break#break/}"
  else
    echo "healthy"
  fi
}

main() {
  local subcommand="${1:-}"
  case "$subcommand" in
    break)
      shift || true
      cmd_break "${1:-}"
      ;;
    fix)
      shift || true
      cmd_fix "${1:-}"
      ;;
    revert)
      cmd_revert
      ;;
    status)
      cmd_status
      ;;
    *)
      print_usage
      exit 1
      ;;
  esac
}

main "$@"
