---
name: auth-registration
description: How AI agents and developers authenticate with EACI Companion APIs via Supabase OAuth and browser guest trial.
---

# EACI Companion — Agent Authentication

## Protected resource

`https://www.eacicompanion.com/`

Metadata: `/.well-known/oauth-protected-resource`

## Authorization server

Issuer: `https://lntyddrwrztpuotyavlp.supabase.co/auth/v1`

Use standard OAuth 2.0 authorization code + PKCE. Mirror discovery:

- `https://www.eacicompanion.com/.well-known/openid-configuration`
- `https://www.eacicompanion.com/.well-known/oauth-authorization-server`

## Registration methods

### Anonymous (browser guest)

Open the site and use guest chat. No REST API for unauthenticated server agents.

### Verified email (full account)

Human or agent-driven signup at `https://www.eacicompanion.com/` → obtain JWT → call edge functions with `Authorization: Bearer` + `apikey` headers.

## Required headers (API)

```
Authorization: Bearer <supabase_access_token>
apikey: <supabase_anon_key>
Content-Type: application/json
```

Full details: `https://www.eacicompanion.com/auth.md`
