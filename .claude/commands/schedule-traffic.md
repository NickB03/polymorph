# schedule-traffic

Start a daily traffic simulation loop. Runs `/simulate-traffic` every 24 hours for the duration of this session.

---

Invoke the `/loop` skill configured to run `/simulate-traffic` every 24 hours:

```
/loop 24h /simulate-traffic
```

This keeps the eval pipeline fed with fresh traffic as long as the Claude Code session stays active.

For fully unattended daily automation (no active session required), set up the Railway cron described in `scripts/simulate-traffic.ts --help`.
