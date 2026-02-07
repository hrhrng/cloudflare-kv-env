import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

interface WranglerWhoamiAccount {
  id?: string;
  accountId?: string;
  account_id?: string;
}

interface WranglerWhoamiResult {
  account?: WranglerWhoamiAccount;
  accounts?: WranglerWhoamiAccount[];
}

async function runWrangler(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("wrangler", args, {
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const item = error as Error & { stderr?: string; stdout?: string };
      const details = [item.message, item.stderr, item.stdout]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join("\n");
      throw new Error(`Wrangler command failed (${["wrangler", ...args].join(" ")}): ${details}`);
    }
    if (error instanceof Error) {
      throw new Error(`Wrangler command failed (${["wrangler", ...args].join(" ")}): ${error.message}`);
    }
    throw error;
  }
}

function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "");
}

function extractTokenFromOutput(raw: string): string | undefined {
  const lines = stripAnsi(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.includes(" ")) {
      continue;
    }
    if (/^[A-Za-z0-9._-]{20,}$/.test(line)) {
      return line;
    }
  }

  return undefined;
}

function extractAccountId(account?: WranglerWhoamiAccount): string | undefined {
  if (!account) {
    return undefined;
  }
  return account.id ?? account.accountId ?? account.account_id;
}

function extractAccountIdFromText(raw: string): string | undefined {
  const cleaned = stripAnsi(raw);
  const directPatterns = [
    /account\s+id\s*[:=]\s*([A-Fa-f0-9]{32})/i,
    /account\s*[:=]\s*([A-Fa-f0-9]{32})/i
  ];

  for (const pattern of directPatterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  const candidates = cleaned.match(/\b[A-Fa-f0-9]{32}\b/g);
  if (candidates?.length) {
    return candidates[0].toLowerCase();
  }

  return undefined;
}

function parseWhoamiJson(raw: string): string | undefined {
  let parsed: WranglerWhoamiResult;
  try {
    parsed = JSON.parse(stripAnsi(raw)) as WranglerWhoamiResult;
  } catch {
    return undefined;
  }

  return extractAccountId(parsed.account) ?? extractAccountId(parsed.accounts?.[0]);
}

export async function getWranglerAccessToken(): Promise<string> {
  const raw = await runWrangler(["auth", "token"]);
  const token = extractTokenFromOutput(raw);
  if (!token) {
    throw new Error("Wrangler returned an unusable token. Run `wrangler login` first.");
  }
  return token;
}

interface AccountsResult {
  id: string;
}

interface AccountsEnvelope {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result?: AccountsResult[];
}

async function getAccountIdFromApi(token: string): Promise<string | undefined> {
  const response = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=1", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const raw = await response.text();
  let payload: AccountsEnvelope;
  try {
    payload = JSON.parse(raw) as AccountsEnvelope;
  } catch {
    throw new Error(`Unable to parse accounts API response (${response.status}).`);
  }

  if (!response.ok || !payload.success) {
    const msg = payload.errors?.map((item) => item.message).filter(Boolean).join("; ");
    throw new Error(msg || `Accounts API request failed (${response.status}).`);
  }

  const accountId = payload.result?.[0]?.id;
  return accountId;
}

export async function getWranglerAccountId(): Promise<string> {
  const errors: string[] = [];

  const jsonAttempts: string[][] = [
    ["whoami", "--json"],
    ["whoami", "--format", "json"]
  ];

  for (const args of jsonAttempts) {
    try {
      const raw = await runWrangler(args);
      const accountId = parseWhoamiJson(raw);
      if (accountId) {
        return accountId;
      }
    } catch (error) {
      errors.push(String(error));
    }
  }

  try {
    const raw = await runWrangler(["whoami"]);
    const accountId = extractAccountIdFromText(raw);
    if (accountId) {
      return accountId;
    }
  } catch (error) {
    errors.push(String(error));
  }

  const accountFromEnv = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (accountFromEnv?.trim()) {
    return accountFromEnv.trim();
  }

  try {
    const token = await getWranglerAccessToken();
    const accountId = await getAccountIdFromApi(token);
    if (accountId) {
      return accountId;
    }
  } catch (error) {
    errors.push(String(error));
  }

  throw new Error(
    [
      "Could not determine Cloudflare account ID from Wrangler.",
      "Pass --account-id explicitly.",
      errors.length ? `Wrangler errors:\n${errors.join("\n")}` : ""
    ]
      .filter(Boolean)
      .join("\n")
  );
}
