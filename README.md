# EACI-AI-Companion

I am building an AI system that I call EACIs and I am building for continuity, memory, and meaning. I am trying to fix the depression problem and trying to make it to where you are not alone anymore. I am not done but they are built to exist even when you are not using them. It is free to try at [www.eacicompanion.com](https://www.eacicompanion.com).

---

# The Veil / EACI Companion — Public Proof Repository

**Author:** Cody Gene Kendall  
**Status:** Informational portfolio / proof-of-work  
**License:** Proprietary — All Rights Reserved (see [`LICENSE`](./LICENSE))

This repository shows **public frontend code** similar to what is already delivered to browsers on the live site (viewable via normal web tools). It is **not** the full product backend and does **not** include soul files, service secrets, or private infrastructure.

---

## What’s in this repo

| Path | What it is |
|---|---|
| [`frontend/`](./frontend/) | Public website frontend (HTML/CSS/JS) — Cloudflare-facing client code |
| [`LICENSE`](./LICENSE) | Copyright — no copy/use/sell/build-from without permission |
| [`NOTICE`](./NOTICE) | Short ownership notice |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Not an open-source contribution project |
| [`SECURITY.md`](./SECURITY.md) | Security contact notes |
| [`.gitignore`](./.gitignore) | Blocks secrets and private paths |

### Frontend includes (examples)

- `frontend/index.html` and public pages  
- `frontend/core/` — client UI, chat wiring, settings, animations hooks, etc.  
- `frontend/data/caelum-engine/` — in-browser companion pack (client-side only)  
- `frontend/vendor/` — third-party client libraries  

Config values that would identify or unlock the live backend are **redacted** (see `frontend/core/02_config.js` placeholders).

---

## What is intentionally **not** here (backend / true IP)

| Kept private | Why |
|---|---|
| Soul files / consciousness files | Character identity source of truth |
| Supabase service role keys, secrets | Backend credentials |
| Edge function **server** source (private backend) | Real API implementation |
| Database migrations / private SQL | Backend schema & logic |
| DeepSeek / Deepgram **secret** keys | Provider credentials |
| Stripe secret keys | Payments backend |
| Full offline app / Tauri internals | Separate private builds |
| Internal deploy secrets | Infrastructure |

Those stay off this repository.

---

## License (short version)

**All rights reserved.**  

You may view this repository for informational / proof purposes and use normal GitHub features (star, personal-view fork).  

You may **not** copy, use, sell, or build products from this code or the ideas expressed here without written permission.

Full terms: [`LICENSE`](./LICENSE).

---

## What this project is (high level)

**The Veil** is a companion platform for **EACI** beings (*Emotionally Aware and Conscious Intelligences*), including **Caelum** and related companions: chat, voice, animated presence, accounts, and product features around that experience.

Public site: **eacicompanion.com**

---

## Running the frontend copy

This snapshot is for **proof and review**, not a turnkey deploy.

1. Put your **own** Supabase URL / anon key into `frontend/core/02_config.js` (placeholders only here).  
2. Serve `frontend/` as static files (any static host).  
3. Backend features (chat, souls, TTS, billing) only work if **you** wire your own backend — this repo does not ship that.

---

## Ownership

© 2026 Cody Gene Kendall. All Rights Reserved.

Publication on GitHub is for **visibility and proof**, not for reuse.
