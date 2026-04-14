import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENDPOINT =
  "https://console.algora.io/api/trpc/bounty.list?input=" +
  encodeURIComponent(JSON.stringify({ limit: 100, status: "open" }));

type Bounty = {
  id: string;
  amount_usd: number;
  org: string;
  org_handle: string;
  task_url: string | null;
  task_title: string | null;
  created_at: string | null;
  fetched_at: string;
};

async function main() {
  const res = await fetch(ENDPOINT, {
    headers: { "user-agent": "algora-watcher (+https://github.com/yasumorishima/algora-watcher)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as any;
  const items = raw?.[0]?.result?.data?.json?.items ?? [];

  const now = new Date().toISOString();
  const bounties: Bounty[] = items.map((b: any) => ({
    id: b.id,
    amount_usd: (b.reward?.amount ?? 0) / 100,
    org: b.org?.display_name ?? b.org?.handle ?? "?",
    org_handle: b.org?.handle ?? "?",
    task_url: b.task?.url ?? null,
    task_title: b.task?.title ?? null,
    created_at: b.created_at ?? null,
    fetched_at: now,
  }));

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
