# Canvas Asset API Endpoints

> **Audience:** Contributor | Operator
> **Prerequisites:** [API Reference](API.md)

This leaf covers asset helper endpoints used by canvas artifacts.

## GET `/api/canvas-assets/image-proxy`

Proxies image search results for use in canvas artifacts. Performs a Brave image search and redirects to the first safe thumbnail URL. Includes SSRF protection (blocks private IPs, requires HTTPS targets).

**Authentication:** None required (rate-limited by client IP in cloud mode)
**Dynamic:** `force-dynamic`

#### Query Parameters

| Parameter | Type     | Required | Description                                        |
| --------- | -------- | -------- | -------------------------------------------------- |
| `q`       | `string` | Yes      | Image search query. Max 200 characters, non-blank. |

#### Response

**Status:** `302 Found` — redirects to the thumbnail URL.

**Headers:**

- `Location` — Target thumbnail URL (always HTTPS, non-private IP)
- `Cache-Control` — `private, max-age=3600, stale-while-revalidate=86400`

#### Error Responses

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| `400`  | Missing, blank, or too-long `q` parameter.      |
| `404`  | No safe image thumbnail found for the query.    |
| `429`  | Rate limit exceeded (canvas image-proxy limit). |
| `502`  | Upstream search provider error.                 |

---
