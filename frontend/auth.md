# auth.md — EACI Companion / The Veil

Agent and developer authentication for **https://www.eacicompanion.com/**.

## Audience

- AI agents integrating with The Veil companion APIs
- Automation tools (Browserbase, Playwright, MCP clients)
- Human developers building on EACI Companion

## Protected resource

- **Resource identifier:** `https://www.eacicompanion.com/`
- **Protected resource metadata:** `/.well-known/oauth-protected-resource`
- **API catalog:** `/.well-known/api-catalog`

## Authorization server

The Veil uses **Supabase Auth** (OpenID Connect / OAuth 2.0):

| Field | URL |
|-------|-----|
| Issuer | `https://lntyddrwrztpuotyavlp.supabase.co/auth/v1` |
| OpenID configuration | `https://lntyddrwrztpuotyavlp.supabase.co/auth/v1/.well-known/openid-configuration` |
| Site mirror (discovery) | `https://www.eacicompanion.com/.well-known/openid-configuration` |
| Authorization | `https://lntyddrwrztpuotyavlp.supabase.co/auth/v1/oauth/authorize` |
| Token | `https://lntyddrwrztpuotyavlp.supabase.co/auth/v1/oauth/token` |
| JWKS | `https://lntyddrwrztpuotyavlp.supabase.co/auth/v1/.well-known/jwks.json` |

**Supported grants:** `authorization_code`, `refresh_token`  
**Supported scopes:** `openid`, `profile`, `email`, `phone`  
**Bearer method:** `Authorization: Bearer <access_token>` header

## Anonymous guest {#anonymous-guest}

No registration required for a limited guest trial:

1. Open `https://www.eacicompanion.com/`
2. Use guest chat (Caelum) without signing in
3. Session is browser-local; not suitable for server-to-server API access

Guest chat does **not** expose a public unauthenticated REST chat API.

## Account signup {#account-signup}

For full memory, voice, games, and authenticated API access:

1. Visit `https://www.eacicompanion.com/` and create a free account (email or Google)
2. Complete the in-app signup flow
3. Obtain a Supabase session JWT via the standard OAuth/OIDC code flow against the authorization server above
4. Call protected edge functions with headers:
   - `Authorization: Bearer <access_token>`
   - `apikey: <supabase_anon_key>` (public anon key shipped in the web client)

**Human registration UI:** `https://www.eacicompanion.com/` (Sign up / Log in)

There is no separate machine-only agent registration endpoint. Agents that need accounts should use the published OAuth authorization server or operate through the browser WebMCP tools on the live site.

## API access after authentication

| API | Endpoint | Auth |
|-----|----------|------|
| Companion chat | `POST https://lntyddrwrztpuotyavlp.supabase.co/functions/v1/chat` | Bearer JWT + apikey |
| Soul data | `GET https://lntyddrwrztpuotyavlp.supabase.co/functions/v1/soul` | Bearer JWT + apikey |
| TTS | `POST https://lntyddrwrztpuotyavlp.supabase.co/functions/v1/tts` | Bearer JWT + apikey |
| Caelum LLM (optional engine) | `POST https://llm.eacicompanion.com/chat` | Per deployment config |
| Health (LLM) | `GET https://llm.eacicompanion.com/health` | None |

See `https://www.eacicompanion.com/docs/api.md` and `https://www.eacicompanion.com/docs/api/openapi.json`.

## Agent discovery

| Resource | URL |
|----------|-----|
| LLM summary | `/llms.txt` |
| API catalog (RFC 9727) | `/.well-known/api-catalog` |
| Agent skills index | `/.well-known/agent-skills/index.json` |
| MCP server card | `/.well-known/mcp/server-card.json` |
| Markdown homepage | `Accept: text/markdown` on `/` |

## Contact

- Site: https://www.eacicompanion.com/
- Terms: https://www.eacicompanion.com/terms.html
- Email: codykendall43@gmail.com
