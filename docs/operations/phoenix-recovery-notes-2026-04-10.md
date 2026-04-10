# Phoenix Recovery Notes (2026-04-10)

- Active deployment: `97023f65-4112-4eab-badb-8801ef235c56`
- Deployment timestamp: `2026-04-08 19:21:45 -05:00`
- Active deployment volume mounts: `[]`
- Detached volume: `phoenix-volume`
- Detached volume mount path: `/data`
- Detached volume size used: `~518MB`
- Live Phoenix state before recovery:
  - `projectCount=1`
  - `datasetCount=0`
  - `promptCount=0`
  - `evaluatorCount=0`
  - Only the default project is present
  - Seeded users recreated around `2026-04-08 19:22 -05:00`
- Hypothesis: Phoenix booted against a new empty DB because the `/data` mount was lost on deploy.

## Follow-up hardening

- Treat Phoenix storage as region-bound.
- Do not move the live Phoenix service across regions without an explicit storage migration plan.
- Record the intended Phoenix region and storage strategy in deployment notes before redeploying.
- After every Phoenix deploy, verify `/v1/projects` and `/v1/datasets` before updating client API keys.
