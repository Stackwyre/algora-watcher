# algora-watcher

Daily snapshot of open bounties on [Algora](https://algora.io/bounties).

- Source: `console.algora.io/api/trpc/bounty.list` (public tRPC endpoint, no auth)
- Schedule: every day at 09:00 JST (00:00 UTC) via GitHub Actions
- New bounties are posted as comments to issue [#1](../../issues/1)
- Full history is kept in [`data/bounties.json`](./data/bounties.json)

## Manual run

```
gh workflow run "Algora Bounty Watch" -f memo="manual check"
```

## Local

```
npm install
npm run fetch
```
