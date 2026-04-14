import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENDPOINT =
  "https://console.algora.io/api/trpc/bounty.list?input=" +
  encodeURIComponent(JSON.stringify({ limit: 100, status: "open" }));

type Tier = "official" | "third_party_org" | "individual" | "unknown";

type Bounty = {
  id: string;
  amount_usd: number;
  org: string;
  org_handle: string;
  org_github_handle: string | null;
  org_member_count: number;
  task_url: string | null;
  task_title: string | null;
  task_repo_owner: string | null;
  tier: Tier;
  created_at: string | null;
  fetched_at: string;
};

function extractRepoOwner(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+)\//i);
  return m ? m[1].toLowerCase() : null;
}

function classify(
  repoOwner: string | null,
  ghHandle: string | null,
  memberCount: number,
): Tier {
  if (!repoOwner || !ghHandle) return "unknown";
  if (repoOwner === ghHandle.toLowerCase()) return "official";
  if (memberCount > 0) return "third_party_org";
  return "individual";
}

async function main() {
  const res = await fetch(ENDPOINT, {
    headers: { "user-agent": "algora-watcher (+https://github.com/yasumorishima/algora-watcher)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as any;
  const items = raw?.[0]?.result?.data?.json?.items ?? [];

  const now = new Date().toISOString();
  const bounties: Bounty[] = items.map((b: any) => {
    const task_url = b.task?.url ?? null;
    const repo_owner = extractRepoOwner(task_url);
    const gh_handle = b.org?.github_handle ?? null;
    const members = Array.isArray(b.org?.members) ? b.org.members.length : 0;
    return {
      id: b.id,
      amount_usd: (b.reward?.amount ?? 0) / 100,
      org: b.org?.display_name ?? b.org?.handle ?? "?",
      org_handle: b.org?.handle ?? "?",
      org_github_handle: gh_handle,
      org_member_count: members,
      task_url,
      task_title: b.task?.title ?? null,
      task_repo_owner: repo_owner,
      tier: classify(repo_owner, gh_handle, members),
      created_at: b.created_at ?? null,
      fetched_at: now,
    };
  });

  const outPath = resolve("data/bounties.json");
  const prev: Bounty[] = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf-8"))
    : [];
  const prevIds = new Set(prev.map((b) => b.id));
  const newOnes = bounties.filter((b) => !prevIds.has(b.id));

  const merged = [
    ...bounties,
    ...prev.filter((b) => !bounties.some((c) => c.id === b.id)),
  ].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  writeFileSync(outPath, JSON.stringify(merged, null, 2) + "\n");
  writeFileSync(
    resolve("data/new-bounties.json"),
    JSON.stringify(newOnes, null, 2) + "\n",
  );

  console.log(`fetched=${bounties.length} new=${newOnes.length} total=${merged.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
