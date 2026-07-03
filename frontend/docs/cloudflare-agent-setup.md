# Cloudflare setup — Agent Readiness (DNS-AID + Markdown)

Two scanner checks need **Cloudflare dashboard** changes in addition to the static site files.

---

## 1. Markdown for Agents (`Accept: text/markdown`)

The site includes `agent-home.md` and a Worker (`_worker.js`) / middleware (`functions/_middleware.js`) that returns it when agents send `Accept: text/markdown`.

### Option A — Cloudflare zone feature (easiest)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select zone **eacicompanion.com**
3. Go to **AI Crawl Control** (or **Scrape Shield** → Markdown for Agents on some plans)
4. Turn **Markdown for Agents** **ON**
5. Purge cache: **Caching** → **Configuration** → **Purge Everything**

Requires Pro, Business, or Enterprise. Converts HTML → markdown at the edge with `x-markdown-tokens`.

### Option B — Pages Worker (code in this repo)

1. Upload/deploy the full `the-veil-main-v14/` folder (must include `_worker.js`)
2. **Workers & Pages** → your Pages project → **Settings** → **Functions**
3. Set **Advanced Mode** → **ON** (uses `_worker.js`; ignores `functions/` when on)
4. Redeploy, then purge cache

### Option C — Pages Functions (no Advanced Mode)

1. Deploy with `functions/_middleware.js` included (use `wrangler pages deploy .`)
2. Keep **Advanced Mode** **OFF**
3. Purge cache

### Verify

```bash
curl.exe -sI -H "Accept: text/markdown" https://www.eacicompanion.com/
```

Expect: `Content-Type: text/markdown` and `x-markdown-tokens`.

Re-scan: `POST https://isitagentready.com/api/scan` with `{"url":"https://www.eacicompanion.com"}`.

---

## 2. DNS-AID + DNSSEC

Records at `_index._agents.eacicompanion.com` are already published (HTTPS/SVCB with `alpn=h2,h3`). The scanner fails because **DNSSEC is not validated** (`AD` flag is false).

### Step 1 — Enable DNSSEC in Cloudflare

1. Dashboard → **eacicompanion.com** → **DNS** → **DNSSEC**
2. Click **Enable DNSSEC**
3. Copy the **DS record** Cloudflare shows (Key tag, Algorithm, Digest type, Digest)

### Step 2 — Add DS record at your registrar

Where you registered `eacicompanion.com` (not Cloudflare unless DNS-only):

1. Open domain DNSSEC / DS records
2. Add the DS values from Cloudflare exactly
3. Save and wait for propagation (up to 24–48 hours, often minutes)

### Step 3 — Confirm DNSSEC

```bash
curl.exe -s "https://cloudflare-dns.com/dns-query?name=eacicompanion.com&type=DNSKEY" -H "accept: application/dns-json"
```

Look for `"Answer"` entries with `"type":48` and `"AD":true` on subsequent HTTPS queries.

```bash
curl.exe -s "https://cloudflare-dns.com/dns-query?name=_index._agents.eacicompanion.com&type=HTTPS" -H "accept: application/dns-json"
```

### DNS-AID records (reference)

| Name | Type | Purpose |
|------|------|---------|
| `_index._agents` | HTTPS (SVCB ServiceMode `1`) | Agent index entry point |
| `_index._agents` | Params | `alpn=h2,h3`, `ipv4hint` / `ipv6hint`, optional `well-known` |

Example bind-style (Cloudflare HTTPS record UI uses the same fields):

```
_index._agents.eacicompanion.com. 300 IN HTTPS 1 . (
    alpn="h2,h3"
    ipv4hint=104.21.32.172,172.67.153.39
    ipv6hint=2606:4700:3032::6815:20ac,2606:4700:3032::ac43:9927
)
```

Point `well-known` or HTTP discovery at:

- `https://www.eacicompanion.com/.well-known/agent-skills/index.json`
- `https://www.eacicompanion.com/.well-known/api-catalog`

### Verify

Re-run https://isitagentready.com/ — `checks.dnsAid` should pass once `AD` is true.

---

## Deploy checklist

- [ ] Upload `the-veil-main-v14/` (include `_worker.js` or `functions/`)
- [ ] Enable Advanced Mode **or** Markdown for Agents **or** Functions middleware
- [ ] Enable DNSSEC + DS at registrar
- [ ] Purge Cloudflare cache
- [ ] `curl` markdown test passes
- [ ] isitagentready.com scan passes both checks
