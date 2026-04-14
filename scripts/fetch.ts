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
  created_at: string;
  fetched_at: string;
};

type AlgoraResponse = {
  result: {
    data: {
      bounties: Array<{
        id: string;
        amountInUSD: number;
        org: {
          name: string;
          handle: string;
          githubHandle: string | null;
          memberCount: number;
        };
        task: {
          url: string | null;
          title: string | null;
          repoOwner: string | null;
        } | null;
        createdAt: string;
      }>;
    };
  };
};

function determineTier(bounty: any): Tier {
  const orgHandle = bounty.org.handle?.toLowerCase();
  const githubHandle = bounty.org.githubHandle?.toLowerCase();
  const repoOwner = bounty.task?.repoOwner?.toLowerCase();
  
  if (!orgHandle || !repoOwner) {
    return "unknown";
  }
  
  // Official: org handle matches repo owner
  if (orgHandle === repoOwner || githubHandle === repoOwner) {
    return "official";
  }
  
  // Third party org: has multiple members
  if (bounty.org.memberCount > 1) {
    return "third_party_org";
  }
  
  // Individual: single member
  return "individual";
}

async function fetchBounties(): Promise<Bounty[]> {
  const response = await fetch(ENDPOINT);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data: AlgoraResponse = await response.json();
  const fetchedAt = new Date().toISOString();
  
  return data.result.data.bounties.map((bounty) => ({
    id: bounty.id,
    amount_usd: bounty.amountInUSD,
    org: bounty.org.name,
    org_handle: bounty.org.handle,
    org_github_handle: bounty.org.githubHandle,
    org_member_count: bounty.org.memberCount,
    task_url: bounty.task?.url || null,
    task_title: bounty.task?.title || null,
    task_repo_owner: bounty.task?.repoOwner || null,
    tier: determineTier(bounty),
    created_at: bounty.createdAt,
    fetched_at: fetchedAt,
  }));
}

function loadExistingBounties(): Bounty[] {
  const path = resolve("data/bounties.json");
  if (!existsSync(path)) {
    return [];
  }
  
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content);
}

function findNewBounties(existing: Bounty[], current: Bounty[]): Bounty[] {
  const existingIds = new Set(existing.map(b => b.id));
  return current.filter(bounty => !existingIds.has(bounty.id));
}

async function main() {
  try {
    console.log("Fetching bounties from Algora...");
    const currentBounties = await fetchBounties();
    console.log(`Fetched ${currentBounties.length} bounties`);
    
    const existingBounties = loadExistingBounties();
    console.log(`Loaded ${existingBounties.length} existing bounties`);
    
    const newBounties = findNewBounties(existingBounties, currentBounties);
    console.log(`Found ${newBounties.length} new bounties`);
    
    // Save current bounties
    writeFileSync(
      resolve("data/bounties.json"),
      JSON.stringify(currentBounties, null, 2)
    );
    
    // Save new bounties for workflow to process
    writeFileSync(
      resolve("data/new-bounties.json"),
      JSON.stringify(newBounties, null, 2)
    );
    
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
