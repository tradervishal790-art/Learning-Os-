# Pre-warm the shared cache

`scripts/warm-cache.mjs` fills the shared Firestore cache (`shared_topic_pools`) with popular
topics and Shorts interests before users ask. Edit the lists in `scripts/warm-topics.json`.

## Run

```
node scripts/warm-cache.mjs --selftest   # offline checks
node scripts/warm-cache.mjs --dry-run    # list jobs + estimated quota, no network
node scripts/warm-cache.mjs              # real run
```

## Needs (one of)
- Firebase **Anonymous sign-in** enabled (Console -> Authentication -> Sign-in method), or
- a dedicated account: set `WARM_EMAIL` and `WARM_PASSWORD`.

No Firestore rule change and no service-account file: it writes with a normal signed-in token,
the same way the app does.

## Quota
Each fetch costs about 101 YouTube units. `WARM_BUDGET_UNITS` (default 6000, about 59 fetches)
caps one run, so users keep the rest of the 10,000 daily units. Entries newer than 25 days are
skipped, so a long list simply fills over several days and then refreshes monthly.

## Schedule
`.github/workflows/warm-cache.yml` runs it daily and can be started by hand from the Actions tab.
Optional repository secrets: `APP_URL`, `WARM_EMAIL`, `WARM_PASSWORD`.
