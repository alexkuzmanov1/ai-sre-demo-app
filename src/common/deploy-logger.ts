import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface DeployEntry {
  sha: string;
  timestamp: string;
}

// On Vercel the deployment bundle is read-only; /tmp is the only writable path.
const DEPLOYS_FILE = process.env.VERCEL
  ? join(tmpdir(), 'deploys.json')
  : join(process.cwd(), 'deploys.json');

function currentSha(): string {
  try {
    return execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    // Fresh repo with no commits yet, or git unavailable — never crash.
    return 'unknown';
  }
}

function readEntries(): DeployEntry[] {
  if (!existsSync(DEPLOYS_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(DEPLOYS_FILE, 'utf8'));
    return Array.isArray(parsed) ? (parsed as DeployEntry[]) : [];
  } catch {
    // Corrupt file — start fresh rather than crash.
    return [];
  }
}

/**
 * Appends { sha, timestamp } to deploys.json (creating it if missing) and
 * returns the entry. deploys.json is the single deploy timeline the AI
 * responder correlates error events against. One entry per line so it stays
 * valid JSON *and* tails cleanly for `demo.sh status`.
 */
export function logDeploy(): DeployEntry {
  const entry: DeployEntry = {
    sha: currentSha(),
    timestamp: new Date().toISOString(),
  };
  const entries = readEntries();
  entries.push(entry);
  const body =
    '[\n' + entries.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n]\n';
  writeFileSync(DEPLOYS_FILE, body);
  return entry;
}
