# EACI Companion API

Machine-readable companion API documentation for **The Veil** (`https://www.eacicompanion.com/`).

## Discovery

| Document | URL |
|----------|-----|
| API catalog (RFC 9727) | `/.well-known/api-catalog` |
| OpenAPI 3.1 | `/docs/api/openapi.json` |
| OAuth protected resource (RFC 9728) | `/.well-known/oauth-protected-resource` |
| OpenID Provider metadata | `/.well-known/openid-configuration` |
| Agent auth | `/auth.md` |
| LLM site summary | `/llms.txt` |

## Authentication

Protected Veil APIs use **Supabase Auth** JWTs.

1. Discover metadata: `/.well-known/oauth-protected-resource`
2. Authorization server: `https://lntyddrwrztpuotyavlp.supabase.co/auth/v1`
3. Obtain access token via OAuth 2.0 authorization code + PKCE (web app flow) or refresh token
4. Send requests with:
   - `Authorization: Bearer <access_token>`
   - `apikey: <supabase_anon_key>` (public client key)

Guest trial chat is browser-only; there is no unauthenticated public chat REST API.

## Veil Edge APIs (Supabase Functions)

Base: `https://lntyddrwrztpuotyavlp.supabase.co/functions/v1`

| Function | Method | Purpose |
|----------|--------|---------|
| `/chat` | POST | Companion chat completion |
| `/soul` | GET | Soul / identity payloads (authenticated) |
| `/tts` | POST | Text-to-speech audio |
| `/stt` | POST | Speech-to-text |
| `/web-search` | POST | Web search tool |
| `/verify` | POST | Age / identity verification |
| `/canvas` | POST | Collaborative canvas |

Request bodies are JSON. See OpenAPI for schemas.

## Caelum LLM API (optional custom engine)

Base: `https://llm.eacicompanion.com`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness |
| `/status` | GET | Engine status |
| `/chat` | POST | Direct LLM chat (when enabled in user settings) |

The public chat website uses the Supabase `/chat` function by default; the LLM service is an optional backend brain.

## Rate limits

Free tier: limited daily API calls per account (see in-app usage meter). Paid tiers increase limits.

## WebMCP (browser)

When loaded in a supporting browser, The Veil registers WebMCP tools for navigation and chat actions. See `core/77_agent_webmcp.js`.

## Contact

codykendall43@gmail.com · https://www.eacicompanion.com/terms.html
