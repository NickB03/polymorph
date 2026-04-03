# Grafana LLM Observability Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Grafana dashboard layer alongside the existing Phoenix instance to provide quick-reference visuals for managing the LLM environment.

**Architecture:** Phoenix already collects all OpenTelemetry traces. Phase 1 enables Phoenix's built-in Prometheus metrics endpoint and deploys Grafana + Prometheus on Railway to visualize them. Phase 2 adds Tempo + a secured OTel Collector ingress to fan traces into Grafana for trace search and span-level inspection. All services deploy into the existing `polymorph` Railway project for private networking access.

**Tech Stack:** Grafana, Prometheus, Tempo, OpenTelemetry Collector, Railway, Docker

---

## File Structure

### Phase 1 — Metrics Dashboards

| File                                                        | Responsibility                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| `services/prometheus/Dockerfile`                            | Prometheus image with custom scrape config baked in             |
| `services/prometheus/prometheus.yml`                        | Scrape targets: self + Phoenix metrics endpoint                 |
| `services/grafana/Dockerfile`                               | Grafana image with provisioned datasources + dashboards         |
| `services/grafana/provisioning/datasources/datasources.yml` | Auto-configure Prometheus datasource                            |
| `services/grafana/provisioning/dashboards/dashboards.yml`   | Dashboard provider pointing at `/var/lib/grafana/dashboards/`   |
| `services/grafana/dashboards/phoenix-overview.json`         | Pre-built dashboard: span ingestion, latency, errors, resources |
| `docs/operations/DEPLOYMENT.md`                             | Updated with Grafana stack section                              |
| `docs/getting-started/ENVIRONMENT.md`                       | Updated with Grafana env vars                                   |

### Phase 2 — Trace Fan-Out (Optional)

| File                                                        | Responsibility                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `services/tempo/Dockerfile`                                 | Tempo image with custom receiver + storage config          |
| `services/tempo/tempo.yml`                                  | OTLP receiver on 4318, local storage with 14-day retention |
| `services/otel-collector/Dockerfile`                        | OTel Collector image with fan-out config                   |
| `services/otel-collector/otel-collector-config.yml`         | Receives OTLP, exports to Phoenix + Tempo                  |
| `services/grafana/provisioning/datasources/datasources.yml` | Updated: add Tempo datasource                              |
| `instrumentation.ts`                                        | No code change needed — just env var update                |

---

## Phase 1: Phoenix Metrics + Grafana Dashboards

Phase 1 delivers Grafana dashboards showing Phoenix operational health: span ingestion rate, request latency, queue depth, errors, memory, CPU, and database disk usage. These metrics come from Phoenix's built-in Prometheus exporter — no changes to the app's trace pipeline.

```
Prometheus --scrape :9090--> Phoenix (PHOENIX_ENABLE_PROMETHEUS=true)
Grafana --query--> Prometheus
User --browser HTTPS--> Grafana (public Railway domain)
```

### Task 1: Enable Prometheus Metrics on Phoenix

**Files:**

- Modify: Railway Phoenix service env vars (dashboard or CLI)

- [ ] **Step 1: Set the environment variable on Phoenix**

```bash
railway variable set PHOENIX_ENABLE_PROMETHEUS=true -s phoenix
```

This tells Phoenix to start `prometheus_client.start_http_server(9090)` alongside its main HTTP server on 6006. The metrics endpoint serves on all interfaces (IPv4+IPv6) and is only reachable via Railway private networking (port 9090 is not the public-facing port).

- [ ] **Step 2: Restart Phoenix to pick up the new variable**

```bash
railway restart -s phoenix
```

- [ ] **Step 3: Verify Phoenix logs show Prometheus is active**

```bash
railway logs -s phoenix --since 5m
```

Expected: Phoenix starts normally. Look for no errors related to port 9090 binding.

- [ ] **Step 4: Commit (nothing to commit yet — env var only)**

No file changes in this task. Move on.

---

### Task 2: Create Prometheus Service Config

**Files:**

- Create: `services/prometheus/Dockerfile`
- Create: `services/prometheus/prometheus.yml`

- [ ] **Step 1: Create Prometheus scrape config**

Create `services/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'phoenix'
    scheme: http
    scrape_interval: 15s
    metrics_path: /metrics
    static_configs:
      - targets: ['phoenix.railway.internal:9090']
```

Key details:

- Phoenix Prometheus runs on port 9090 (hardcoded in `phoenix/server/prometheus.py`), separate from Phoenix's main port 6006.
- Railway private networking: `phoenix.railway.internal:9090` resolves within the same project. No TLS needed internally.
- The `/metrics` path is the default `prometheus_client` endpoint.

- [ ] **Step 2: Create Prometheus Dockerfile**

Create `services/prometheus/Dockerfile`:

```dockerfile
FROM prom/prometheus:v3.11.0
COPY prometheus.yml /etc/prometheus/prometheus.yml
```

- [ ] **Step 3: Verify files are valid**

```bash
docker run --rm -v $(pwd)/services/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus:v3.11.0 --config.file=/etc/prometheus/prometheus.yml --web.listen-address=:9090 &
sleep 3
curl -s http://localhost:9090/-/healthy
# Expected: "Prometheus Server is Healthy."
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add services/prometheus/Dockerfile services/prometheus/prometheus.yml
git commit -m "feat(monitoring): add Prometheus service config for Phoenix metrics scraping"
```

---

### Task 3: Create Grafana Service with Provisioned Dashboard

**Files:**

- Create: `services/grafana/Dockerfile`
- Create: `services/grafana/provisioning/datasources/datasources.yml`
- Create: `services/grafana/provisioning/dashboards/dashboards.yml`
- Create: `services/grafana/dashboards/phoenix-overview.json`

- [ ] **Step 1: Create Grafana datasource provisioning**

Create `services/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1
prune: false

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    orgId: 1
    uid: grafana_prometheus
    url: ${PROMETHEUS_INTERNAL_URL}
    isDefault: true
    editable: true
```

The `${PROMETHEUS_INTERNAL_URL}` is resolved from Grafana's environment at startup. It will be set as a Railway service variable pointing to `http://prometheus.railway.internal:9090`.

- [ ] **Step 2: Create Grafana dashboard provider**

Create `services/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: 'Phoenix'
    type: file
    disableDeletion: false
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

- [ ] **Step 3: Create the Phoenix Overview dashboard**

Create `services/grafana/dashboards/phoenix-overview.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "links": [],
  "panels": [
    {
      "title": "Span Ingestion Rate",
      "description": "Spans inserted per second into Phoenix storage",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "id": 1,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "rate(phoenix_bulk_loader_span_insertion_time_seconds_count[5m])",
          "legendFormat": "spans/sec",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "fillOpacity": 20,
            "lineWidth": 2,
            "pointSize": 5,
            "showPoints": "auto"
          },
          "unit": "ops"
        },
        "overrides": []
      }
    },
    {
      "title": "Span Queue Depth",
      "description": "Spans waiting in the processing queue. Sustained high values indicate Phoenix cannot keep up with ingestion.",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "id": 2,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "phoenix_span_queue_size",
          "legendFormat": "queue size",
          "refId": "A"
        },
        {
          "expr": "rate(phoenix_span_queue_rejections_total[5m])",
          "legendFormat": "rejections/sec",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "fillOpacity": 10,
            "lineWidth": 2
          }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "rejections/sec" },
            "properties": [
              { "id": "custom.drawStyle", "value": "bars" },
              {
                "id": "color",
                "value": { "fixedColor": "red", "mode": "fixed" }
              }
            ]
          }
        ]
      }
    },
    {
      "title": "Avg Span Insertion Time",
      "description": "Average time to insert a batch of spans into storage",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "id": 3,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "rate(phoenix_bulk_loader_span_insertion_time_seconds_sum[5m]) / rate(phoenix_bulk_loader_span_insertion_time_seconds_count[5m])",
          "legendFormat": "avg insertion time",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": { "fixedColor": "blue", "mode": "fixed" },
          "custom": {
            "drawStyle": "line",
            "fillOpacity": 15,
            "lineWidth": 2
          },
          "unit": "s"
        },
        "overrides": []
      }
    },
    {
      "title": "HTTP Request Latency (avg)",
      "description": "Average Phoenix API request processing time from starlette metrics. Note: Python prometheus_client.Summary only exposes _sum and _count (no quantiles — unlike Go). For true p50/p90, Phoenix would need to switch to a Histogram type.",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "id": 4,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "rate(starlette_requests_processing_time_seconds_summary_sum[5m]) / rate(starlette_requests_processing_time_seconds_summary_count[5m])",
          "legendFormat": "avg {{method}} {{path}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "fillOpacity": 10,
            "lineWidth": 2
          },
          "unit": "s"
        },
        "overrides": []
      }
    },
    {
      "title": "Error Rate",
      "description": "Phoenix exceptions + span ingestion errors per second",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
      "id": 5,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "rate(starlette_exceptions_total[5m])",
          "legendFormat": "HTTP exceptions ({{exception_type}})",
          "refId": "A"
        },
        {
          "expr": "rate(phoenix_bulk_loader_span_exceptions_total[5m])",
          "legendFormat": "span ingestion errors",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": { "fixedColor": "red", "mode": "fixed" },
          "custom": {
            "drawStyle": "bars",
            "fillOpacity": 50,
            "lineWidth": 1
          },
          "unit": "ops"
        },
        "overrides": []
      }
    },
    {
      "title": "Memory Usage",
      "description": "Phoenix process memory (virtual + swap)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 },
      "id": 6,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "memory_usage_bytes{type=\"virtual\"}",
          "legendFormat": "virtual",
          "refId": "A"
        },
        {
          "expr": "memory_usage_bytes{type=\"swap\"}",
          "legendFormat": "swap",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": { "mode": "palette-classic" },
          "custom": {
            "drawStyle": "line",
            "fillOpacity": 20,
            "lineWidth": 2
          },
          "unit": "bytes"
        },
        "overrides": []
      }
    },
    {
      "title": "CPU Usage",
      "description": "Phoenix process CPU utilization percentage",
      "type": "gauge",
      "gridPos": { "h": 8, "w": 6, "x": 0, "y": 24 },
      "id": 7,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "cpu_usage_percent",
          "legendFormat": "CPU %",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 60 },
              { "color": "red", "value": 85 }
            ]
          },
          "max": 100,
          "min": 0,
          "unit": "percent"
        },
        "overrides": []
      }
    },
    {
      "title": "DB Disk Usage",
      "description": "Phoenix SQLite database disk consumption (absolute + ratio of capacity)",
      "type": "stat",
      "gridPos": { "h": 8, "w": 6, "x": 6, "y": 24 },
      "id": 8,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "database_disk_usage_bytes",
          "legendFormat": "disk used",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 5368709120 },
              { "color": "red", "value": 8589934592 }
            ]
          },
          "unit": "bytes"
        },
        "overrides": []
      }
    },
    {
      "title": "DB Disk Usage Ratio",
      "description": "Ratio of disk used to allocated capacity (0.0–1.0). Above 0.8 is a warning — Phoenix may block insertions.",
      "type": "gauge",
      "gridPos": { "h": 8, "w": 6, "x": 12, "y": 24 },
      "id": 9,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "database_disk_usage_ratio",
          "legendFormat": "disk ratio",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 0.7 },
              { "color": "red", "value": 0.85 }
            ]
          },
          "max": 1,
          "min": 0,
          "unit": "percentunit"
        },
        "overrides": []
      }
    },
    {
      "title": "Insertions Blocked",
      "description": "1 = Phoenix has stopped accepting new spans due to disk pressure. Investigate immediately.",
      "type": "stat",
      "gridPos": { "h": 8, "w": 6, "x": 18, "y": 24 },
      "id": 10,
      "datasource": { "type": "prometheus", "uid": "grafana_prometheus" },
      "targets": [
        {
          "expr": "database_insertions_blocked",
          "legendFormat": "blocked",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "red", "value": 1 }
            ]
          },
          "mappings": [
            { "options": { "0": { "text": "OK" } }, "type": "value" },
            { "options": { "1": { "text": "BLOCKED" } }, "type": "value" }
          ]
        },
        "overrides": []
      }
    }
  ],
  "schemaVersion": 40,
  "tags": ["phoenix", "llm", "observability"],
  "templating": { "list": [] },
  "time": { "from": "now-6h", "to": "now" },
  "timepicker": {},
  "timezone": "browser",
  "title": "Phoenix LLM Observability",
  "uid": "phoenix-llm-overview",
  "version": 1,
  "refresh": "30s"
}
```

- [ ] **Step 4: Create Grafana Dockerfile**

Create `services/grafana/Dockerfile`:

```dockerfile
FROM grafana/grafana-oss:12.4.2

# Bake in provisioning config and dashboards
COPY provisioning/ /etc/grafana/provisioning/
COPY dashboards/ /var/lib/grafana/dashboards/

# Grafana serves on port 3000 by default
EXPOSE 3000
```

- [ ] **Step 5: Verify Grafana config locally**

```bash
docker build -t grafana-test services/grafana/
docker run --rm -e PROMETHEUS_INTERNAL_URL=http://localhost:9090 -p 3000:3000 grafana-test &
sleep 5
curl -s http://localhost:3000/api/health
# Expected: {"commit":"...","database":"ok","version":"12.4.2"}
curl -s -u admin:admin http://localhost:3000/api/datasources
# Expected: JSON array containing Prometheus datasource
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add services/grafana/
git commit -m "feat(monitoring): add Grafana service with Phoenix dashboard and Prometheus datasource"
```

---

### Task 4: Deploy Prometheus to Railway

**Files:**

- No file changes — Railway deployment via CLI/dashboard

**Prerequisites:** Task 1 (Phoenix Prometheus enabled), Task 2 (Prometheus config committed)

- [ ] **Step 1: Create the Prometheus service in the polymorph Railway project**

In the Railway dashboard (`railway open`):

1. Click **"+ New"** → **"Service"** → **"From Repo"**
2. Select the `polymorph` repository (the repo containing this branch/PR)
3. Set **Root Directory** to `services/prometheus`
4. Name the service `prometheus`

- [ ] **Step 2: Configure Prometheus service settings**

In the Railway dashboard, configure the `prometheus` service:

- **Root directory:** `services/prometheus`
- **Build command:** (Docker auto-detected from Dockerfile)
- **Port routing:** Set `PORT=9090` on the service, or explicitly set the service/domain target port to `9090` in Railway
- **Volume:** Create a Railway volume, mount at `/prometheus` (Prometheus default data dir)
- **No public domain needed** — Prometheus is only accessed by Grafana internally

- [ ] **Step 3: Deploy and verify**

```bash
railway logs -s prometheus --since 5m
```

Expected: Prometheus starts normally with no repeated scrape or config errors.

If the Phoenix target shows as DOWN, verify:

1. Phoenix was restarted after `PHOENIX_ENABLE_PROMETHEUS=true` was set (Task 1)
2. Both services are in the same Railway project and environment

- [ ] **Step 4: Verify Phoenix metrics are being collected**

Use a behavior-based check instead of relying on a specific log string:

1. Open the Prometheus UI from the service in Railway, or temporarily access it from within the project network
2. Verify the Phoenix target is **UP** in `/targets`
3. Query `up{job="phoenix"}` and confirm it returns `1`

---

### Task 5: Deploy Grafana to Railway

**Files:**

- No file changes — Railway deployment via CLI/dashboard

**Prerequisites:** Task 3 (Grafana config committed), Task 4 (Prometheus running)

- [ ] **Step 1: Create the Grafana service in Railway**

In the Railway dashboard:

1. Click **"+ New"** → **"Service"** → **"From Repo"**
2. Select the `polymorph` repository (the repo containing this branch/PR)
3. Set **Root Directory** to `services/grafana`
4. Name the service `grafana`

- [ ] **Step 2: Configure Grafana service settings**

Set these environment variables on the `grafana` service:

```bash
railway variable set PROMETHEUS_INTERNAL_URL=http://prometheus.railway.internal:9090 -s grafana
railway variable set GF_SECURITY_ADMIN_USER=admin -s grafana
railway variable set GF_SECURITY_ADMIN_PASSWORD=<choose-a-strong-password> -s grafana
```

Additional Railway config:

- **Port routing:** Set `PORT=3000` on the service, or explicitly set the public domain target port to `3000`
- **Volume:** Create a Railway volume, mount at `/var/lib/grafana` (Grafana data dir — retains dashboards, users, and settings across deploys)
- **Public domain:** **Yes** — generate a Railway public domain (e.g., `grafana-production-xxxx.up.railway.app`). This is how you access Grafana in a browser.

- [ ] **Step 3: Deploy and verify Grafana starts**

```bash
railway logs -s grafana --since 5m
```

Expected: Grafana starts on port 3000 with no provisioning errors. Confirm in the UI that the Prometheus datasource exists and the `Phoenix LLM Observability` dashboard is present.

- [ ] **Step 4: Access Grafana and verify the dashboard**

1. Open the Grafana public URL in a browser (find it in Railway dashboard or `railway status -s grafana`)
2. Log in with the admin credentials set in Step 2
3. Navigate to **Dashboards → Phoenix → Phoenix LLM Observability**
4. Verify panels are loading data (may take 1–2 minutes for the first scrape cycle)

Expected panels showing data:

- **Span Ingestion Rate:** Non-zero if traces are flowing from Vercel
- **Span Queue Depth:** Should be near 0 under normal load
- **Memory Usage:** Shows Phoenix process memory
- **CPU Usage:** Shows Phoenix CPU gauge
- **DB Disk Usage:** Shows SQLite database size

---

### Task 6: Verify Phase 1 End-to-End

**Files:**

- No changes

**Prerequisites:** All previous tasks complete

- [ ] **Step 1: Trigger traces from the app**

Open the Polymorph app and run a search query. This generates traces that flow through the full pipeline:

```
App (Vercel) --OTLP--> Phoenix --metrics scrape--> Prometheus --query--> Grafana
```

- [ ] **Step 2: Verify in Phoenix**

Open `https://phoenix-production-c6b5.up.railway.app` and confirm the trace appears in the `polymorph` project.

- [ ] **Step 3: Verify in Grafana**

Open the Grafana dashboard. After 15–30 seconds (one Prometheus scrape interval), verify:

- **Span Ingestion Rate** shows a spike corresponding to the search query
- **HTTP Request Latency (avg)** shows the average OTLP ingest request time
- No new errors in the **Error Rate** panel

- [ ] **Step 4: Commit (nothing to commit — verification only)**

Phase 1 is complete. You now have Grafana dashboards showing Phoenix operational health.

---

## Phase 2: Secured OTel Collector + Tempo (Trace Data in Grafana)

Phase 2 adds raw trace data to Grafana via Tempo. A secured OpenTelemetry Collector sits between the Vercel app and the backends, fanning traces to both Phoenix (existing) and Tempo (new). This enables trace search and span-level drill-down in Grafana — not just aggregated metrics.

> **Security gate:** Do not expose `otel-collector` on a Railway public domain without receiver-side authentication or a trusted proxy in front of it. An unauthenticated public OTLP ingest endpoint can be abused to inject arbitrary spans into Phoenix and Tempo.

```
Vercel --OTLP/HTTPS--> OTel Collector (public Railway domain)
                           |
                           ├──> Phoenix (existing, unchanged)
                           └──> Tempo (new, Grafana backend)
                                  |
                           Grafana --query--> Tempo + Prometheus
```

### Task 7: Create Tempo Service Config

**Files:**

- Create: `services/tempo/Dockerfile`
- Create: `services/tempo/tempo.yml`

- [ ] **Step 1: Create Tempo config**

Create `services/tempo/tempo.yml`:

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: '0.0.0.0:4318'
        grpc:
          endpoint: '0.0.0.0:4317'

storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
    wal:
      path: /var/tempo/wal

compactor:
  compaction:
    block_retention: 336h

# metrics_generator is intentionally disabled in this plan.
# This phase delivers trace search + waterfall inspection only.
# Service maps / RED metrics require a follow-up phase that enables
# metrics_generator, configures remote_write to Prometheus, and wires
# serviceMap.datasourceUid in Grafana.
# metrics_generator:
#   registry:
#     external_labels:
#       source: tempo
#   storage:
#     path: /var/tempo/generator/wal
#     remote_write:
#       - url: http://prometheus.railway.internal:9090/api/v1/write
```

Key details:

- `http_listen_port: 3200` — Grafana queries Tempo here
- OTLP HTTP receiver on `4318`, gRPC on `4317` — the OTel Collector sends traces here
- `block_retention: 336h` = 14 days of trace retention
- Local storage uses Railway volume for persistence. This is acceptable for a single-instance, low-cost deployment; move to object storage if the trace volume or durability requirements increase.

- [ ] **Step 2: Create Tempo Dockerfile**

Create `services/tempo/Dockerfile`:

```dockerfile
FROM grafana/tempo:2.10.3
COPY tempo.yml /etc/tempo/tempo.yml
CMD ["-config.file=/etc/tempo/tempo.yml"]
```

- [ ] **Step 3: Commit**

```bash
git add services/tempo/
git commit -m "feat(monitoring): add Tempo service config for trace storage"
```

---

### Task 8: Create OTel Collector Service Config

**Files:**

- Create: `services/otel-collector/Dockerfile`
- Create: `services/otel-collector/otel-collector-config.yml`

- [ ] **Step 1: Create OTel Collector fan-out config**

Create `services/otel-collector/otel-collector-config.yml`:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: '0.0.0.0:4318'

processors:
  batch:
    send_batch_size: 1024
    send_batch_max_size: 2048
    timeout: 5s

exporters:
  otlphttp/phoenix:
    endpoint: 'http://phoenix.railway.internal:6006'
    headers:
      authorization: 'Bearer ${env:PHOENIX_API_KEY}'
    tls:
      insecure: true

  otlphttp/tempo:
    endpoint: 'http://tempo.railway.internal:4318'
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/phoenix, otlphttp/tempo]
```

Key details:

- The Collector receives OTLP HTTP on port 4318 (standard OTLP port).
- `otlphttp` exporters auto-append `/v1/traces` to the endpoint URL.
- Phoenix export includes the Bearer token from `PHOENIX_API_KEY` env var (resolved at runtime via `${env:PHOENIX_API_KEY}`).
- `tls.insecure: true` is correct for Railway private networking (no TLS between internal services).
- The Collector does NOT need `PHOENIX_API_KEY` for the Tempo export — Tempo has no auth by default on Railway.
- This config does **not** authenticate inbound OTLP traffic. Secure ingress before exposing it publicly.

- [ ] **Step 2: Create OTel Collector Dockerfile**

Create `services/otel-collector/Dockerfile`:

```dockerfile
FROM otel/opentelemetry-collector-contrib:0.149.0
COPY otel-collector-config.yml /etc/otelcol-contrib/config.yaml
CMD ["--config=/etc/otelcol-contrib/config.yaml"]
```

We use `otel/opentelemetry-collector-contrib` rather than the base `otel/opentelemetry-collector` for future extensibility (processors, receivers). Note: the `otlphttp` exporter ships in the core distribution — contrib is not required for it specifically.

- [ ] **Step 3: Commit**

```bash
git add services/otel-collector/
git commit -m "feat(monitoring): add OTel Collector service with Phoenix + Tempo fan-out"
```

---

### Task 9: Deploy Tempo and OTel Collector to Railway

**Files:**

- No file changes — Railway deployment

**Prerequisites:** Tasks 7–8 committed and pushed

- [ ] **Step 1: Deploy Tempo**

In the Railway dashboard:

1. **"+ New"** → **"Service"** → **"From Repo"** → root dir `services/tempo`
2. Name: `tempo`
3. **Volume:** Mount at `/var/tempo` (trace storage + WAL)
4. **No public domain** — Tempo is only accessed by Grafana and the OTel Collector internally

- [ ] **Step 2: Deploy OTel Collector**

In the Railway dashboard:

1. **"+ New"** → **"Service"** → **"From Repo"** → root dir `services/otel-collector`
2. Name: `otel-collector`
3. Secure ingress **before** generating a public domain. Choose one:
   - Configure an OTel Collector authenticator/extension that validates inbound credentials
   - Place a trusted reverse proxy or gateway in front of the Collector and restrict direct public access

4. Set env var:

```bash
railway variable set PHOENIX_API_KEY=<same-key-as-vercel> -s otel-collector
```

5. **Port routing:** Set `PORT=4318` on the service, or explicitly set the public domain target port to `4318`
6. **Public domain:** **Yes, but only after Step 3 is complete** — generate a Railway public domain for the secured ingress endpoint. The Vercel app will send traces here over HTTPS.
7. **No volume needed** — the Collector is stateless.

- [ ] **Step 3: Verify both services are healthy**

```bash
railway logs -s tempo --since 5m
railway logs -s otel-collector --since 5m
```

Expected:

- Tempo: starts normally, listening on 3200 + 4318 + 4317
- OTel Collector: starts normally, receives authenticated traffic, and shows no exporter errors

---

### Task 10: Update Vercel Trace Pipeline to Use Collector

**Files:**

- Modify: Vercel environment variables (dashboard)

**Prerequisites:** Task 9 (Collector deployed with public domain)

- [ ] **Step 1: Get the OTel Collector's public URL**

From the Railway dashboard or:

```bash
railway status -s otel-collector
```

The public domain will be something like `otel-collector-production-xxxx.up.railway.app`.

- [ ] **Step 2: Update Vercel environment variables**

In the Vercel dashboard (Settings → Environment Variables → Production):

| Variable                     | Old Value                                        | New Value                                 |
| ---------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `PHOENIX_COLLECTOR_ENDPOINT` | `https://phoenix-production-c6b5.up.railway.app` | `https://<secured-otel-collector-domain>` |

All other variables (`ENABLE_TRACING`, `PHOENIX_PROJECT_NAME`, `PHOENIX_API_KEY`) remain unchanged.

**Important:** The app's `instrumentation.ts` reads `PHOENIX_COLLECTOR_ENDPOINT` (line 16–17) and appends `/v1/traces` (line 41). The OTel Collector listens on `/v1/traces` at port 4318 — this path is compatible. No code changes needed.

**Important:** The HTTPS enforcement check in `instrumentation.ts` (line 19) will pass because Railway public domains are always HTTPS.

**Important:** Point `PHOENIX_COLLECTOR_ENDPOINT` at the **secured** Collector ingress URL created in Task 9, not at an unauthenticated raw Collector port.

**Note — auth header passthrough:** The app unconditionally sends `Authorization: Bearer ${PHOENIX_API_KEY}` to whatever `PHOENIX_COLLECTOR_ENDPOINT` points to (line 42–44). After this change, that Bearer token goes to the OTel Collector ingress instead of Phoenix. Make sure the ingress layer either validates or strips it intentionally; do not assume an unauthenticated Collector should be internet-reachable just because the header is present.

- [ ] **Step 3: Trigger a redeploy on Vercel**

Changing the env var in Vercel triggers a redeploy automatically. If it doesn't:

```bash
vercel --prod
```

- [ ] **Step 4: Verify traces flow through the new pipeline**

1. Run a search query in the app
2. Check Phoenix — trace should appear (routed through Collector → Phoenix)
3. Check OTel Collector logs:

```bash
railway logs -s otel-collector --since 5m
```

Expected: logs show batches being exported to both `phoenix` and `tempo` exporters.

---

### Task 11: Update Grafana with Tempo Datasource

**Files:**

- Modify: `services/grafana/provisioning/datasources/datasources.yml`

- [ ] **Step 1: Add Tempo datasource to Grafana provisioning**

Update `services/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1
prune: false

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    orgId: 1
    uid: grafana_prometheus
    url: ${PROMETHEUS_INTERNAL_URL}
    isDefault: true
    editable: true

  - name: Tempo
    type: tempo
    access: proxy
    orgId: 1
    uid: grafana_tempo
    url: ${TEMPO_INTERNAL_URL}
    isDefault: false
    editable: true
    jsonData:
      tracesToMetrics:
        datasourceUid: grafana_prometheus
      nodeGraph:
        enabled: true
      search:
        hide: false
```

The `jsonData` enables:

- **Trace-to-metrics correlation** — click a trace to see related Prometheus metrics
- **Node graph rendering** — enables Grafana's node graph view for supported trace explorations
- **Search** — trace search in the Grafana Explore view

This does **not** enable Grafana service maps. Service maps require a separate follow-up phase that turns on Tempo `metrics_generator`, remote write into Prometheus, and `serviceMap.datasourceUid` in the Tempo datasource config.

- [ ] **Step 2: Set the Tempo internal URL on the Grafana Railway service**

```bash
railway variable set TEMPO_INTERNAL_URL=http://tempo.railway.internal:3200 -s grafana
```

- [ ] **Step 3: Redeploy Grafana to pick up new datasource**

```bash
railway redeploy -s grafana
```

- [ ] **Step 4: Verify Tempo datasource in Grafana**

1. Open Grafana → **Explore** → select **Tempo** datasource
2. Search for recent traces (e.g., service name `polymorph`)
3. Click a trace to see the span waterfall — same data as Phoenix, now in Grafana

- [ ] **Step 5: Commit**

```bash
git add services/grafana/provisioning/datasources/datasources.yml
git commit -m "feat(monitoring): add Tempo datasource to Grafana for trace exploration"
```

---

## Phase 3: Documentation

### Task 12: Update Deployment and Environment Docs

**Files:**

- Modify: `docs/operations/DEPLOYMENT.md`
- Modify: `docs/getting-started/ENVIRONMENT.md`

- [ ] **Step 1: Add Grafana stack section to DEPLOYMENT.md**

After the existing "Observability (Phoenix on Railway)" section in `docs/operations/DEPLOYMENT.md`, add:

```markdown
### Grafana Monitoring Stack

The Grafana stack provides visual dashboards for Phoenix operational health and trace exploration.

#### Architecture
```

Vercel (polymorph) --OTLP/HTTPS--> Railway (otel-collector:4318)
|
├──> Phoenix (:6006) [trace storage + UI]
└──> Tempo (:4318) [trace storage for Grafana Explore]

Railway (prometheus) --scrape :9090--> Phoenix (Prometheus metrics)
Railway (grafana) --query--> Prometheus + Tempo

```

#### Services

| Service | Image | Port(s) | Public | Volume Mount |
|---------|-------|---------|--------|-------------|
| `prometheus` | `prom/prometheus:v3.11.0` | 9090 | No | `/prometheus` |
| `tempo` | `grafana/tempo:2.10.3` | 3200, 4318 | No | `/var/tempo` |
| `grafana` | `grafana/grafana-oss:12.4.2` | 3000 | Yes | `/var/lib/grafana` |
| `otel-collector` | `otel/opentelemetry-collector-contrib:0.149.0` | 4318 | Yes | None |

#### Grafana access

- **URL:** `https://grafana-production-xxxx.up.railway.app` (check Railway dashboard for exact domain)
- **Default credentials:** Set via `GF_SECURITY_ADMIN_USER` and `GF_SECURITY_ADMIN_PASSWORD` env vars on the Grafana service

#### Key dashboards

- **Phoenix LLM Observability** — span ingestion rate, queue depth, latency, errors, memory, CPU, DB disk usage
- **Tempo Explore** — trace search and waterfall drill-down

#### OTel Collector env vars

| Variable | Value | Service |
|----------|-------|---------|
| `PHOENIX_API_KEY` | Same Phoenix API key as Vercel | `otel-collector` |

> **Security note:** The `otel-collector` public endpoint must be protected by receiver auth or a trusted proxy before Vercel is repointed to it.
```

- [ ] **Step 2: Add Grafana env vars to ENVIRONMENT.md**

After the "Tracing (Arize Phoenix)" section in `docs/getting-started/ENVIRONMENT.md`, add:

```markdown
### Grafana Monitoring Stack

The Grafana monitoring services are Railway-only (no app-side env vars needed). These are configured on the Railway services directly:

| Variable                     | Service          | Purpose                                |
| ---------------------------- | ---------------- | -------------------------------------- |
| `PHOENIX_ENABLE_PROMETHEUS`  | `phoenix`        | Enable Prometheus metrics on port 9090 |
| `PROMETHEUS_INTERNAL_URL`    | `grafana`        | Prometheus private URL for datasource  |
| `TEMPO_INTERNAL_URL`         | `grafana`        | Tempo private URL for datasource       |
| `GF_SECURITY_ADMIN_USER`     | `grafana`        | Grafana admin username                 |
| `GF_SECURITY_ADMIN_PASSWORD` | `grafana`        | Grafana admin password                 |
| `PHOENIX_API_KEY`            | `otel-collector` | Bearer token for Phoenix OTLP export   |

> **Note:** When the secured OTel Collector ingress is deployed (Phase 2), the Vercel `PHOENIX_COLLECTOR_ENDPOINT` changes from the Phoenix public URL to the secured Collector URL. No other app-side env vars change.
```

- [ ] **Step 3: Commit**

```bash
git add docs/operations/DEPLOYMENT.md docs/getting-started/ENVIRONMENT.md
git commit -m "docs: add Grafana monitoring stack to deployment and environment references"
```

---

### Task 13: Final End-to-End Verification

**Files:**

- No changes

- [ ] **Step 1: Verify the full pipeline**

Run a search query in the Polymorph app and confirm data appears in all systems:

| System                       | What to Check                        | How                                                                    |
| ---------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| **Phoenix**                  | Trace appears in `polymorph` project | Open Phoenix UI                                                        |
| **Prometheus**               | Phoenix metrics are current          | Grafana → Explore → Prometheus → `up{job="phoenix"}` should return `1` |
| **Grafana dashboard**        | Panels show data                     | Dashboards → Phoenix → Phoenix LLM Observability                       |
| **Tempo** (Phase 2)          | Trace searchable                     | Grafana → Explore → Tempo → search `polymorph`                         |
| **OTel Collector** (Phase 2) | Batches exported                     | `railway logs -s otel-collector --since 5m`                            |

- [ ] **Step 2: Verify no regressions**

Confirm the app still works correctly:

- Search queries complete normally
- Traces appear in Phoenix (the primary observability tool is unchanged)
- No new errors in Vercel logs

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
bun lint
bun typecheck
```

Fix any issues, then commit.
