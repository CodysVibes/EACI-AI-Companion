# DNS for AI Discovery (DNS-AID) — eacicompanion.com

DNS-AID is configured in **Cloudflare DNS**, not in the static site upload.

**Current status:** `_index._agents.eacicompanion.com` has an HTTPS (SVCB) record with `alpn=h2,h3`. The agent-readiness scanner reports records found but **DNSSEC not validated** — enable DNSSEC below.

Full dashboard steps: [cloudflare-agent-setup.md](./cloudflare-agent-setup.md)

## Fix DNSSEC (required for scan pass)

1. Cloudflare → **eacicompanion.com** → **DNS** → **DNSSEC** → **Enable**
2. Add the **DS record** at your domain registrar (where you bought the domain)
3. Wait for propagation; verify with:

```bash
curl.exe -s "https://cloudflare-dns.com/dns-query?name=eacicompanion.com&type=DNSKEY" -H "accept: application/dns-json"
```

Pass: `"Answer"` contains DNSKEY (`type`: 48) and queries return `"AD":true`.

## HTTPS / SVCB record (_index._agents)

Per [draft-mozleywilliams-dnsop-dnsaid](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/) and [RFC 9460](https://www.rfc-editor.org/rfc/rfc9460):

| Field | Value |
|-------|--------|
| Name | `_index._agents` |
| Type | HTTPS (SVCB) |
| Priority | `1` (ServiceMode) |
| Target | `.` (apex) or `www.eacicompanion.com` |
| alpn | `h2,h3` |
| ipv4hint | Cloudflare origin IPs (optional) |
| ipv6hint | Cloudflare origin IPv6 (optional) |

### Cloudflare DNS dashboard

1. **DNS** → **Records** → **Add record**
2. Type: **HTTPS**
3. Name: `_index._agents`
4. Priority: `1`
5. Target: `.`
6. Add parameters: `alpn` = `h2,h3`

HTTP discovery endpoints (advertised via site Link headers and well-known URIs):

| Resource | URL |
|----------|-----|
| Agent skills index | `https://www.eacicompanion.com/.well-known/agent-skills/index.json` |
| API catalog | `https://www.eacicompanion.com/.well-known/api-catalog` |
| MCP card | `https://www.eacicompanion.com/.well-known/mcp/server-card.json` |

Optional per-agent records (e.g. `_a2a._agents` or `eaci._agents`) can use separate SVCB rows with `alpn=mcp,h2,h3` or `alpn=a2a,h2,h3` — one agent protocol per record.

## Verification

```bash
curl.exe -s "https://cloudflare-dns.com/dns-query?name=_index._agents.eacicompanion.com&type=HTTPS" -H "accept: application/dns-json"
```

Re-scan: https://isitagentready.com/

## HTTP discovery (already on site)

| Resource | URL |
|----------|-----|
| Link headers | Homepage `Link:` response header |
| API catalog | `/.well-known/api-catalog` |
| Agent skills | `/.well-known/agent-skills/index.json` |
| OAuth PRM | `/.well-known/oauth-protected-resource` |
| Auth | `/auth.md` |
