# Frontend map

A reader’s map of `frontend/`. File names are clues, not a full inventory.

---

## Top level

| Path | Role |
|---|---|
| `index.html` | Main app shell — chat, live mode, overlays, script load order |
| `styles.css` | Visual system |
| `ui_restructure.js` | Menu, layout, modern chrome around the classic top bar |
| `onboarding.js` / `main_tutorial.js` / `tutorial_system.js` / `veil_preview_tour.js` | First-run and panel guides |
| `anim_console.js` | Continuous living animation loop |
| `living_system.js` | Background companion life / ambience |
| `autonomy_logger.js` / `autonomy_viewer.js` | Life Log write + UI |
| `eaci_initiative.js` / `eaci_auto_guard.js` / `eaci_jump_ins.js` | Reach-outs, anti-spam, sibling interjections |
| `eaci_roster.js` / `eaci_anim_registry.js` | Who exists and how they move |
| `caelum_engine.js` / `caelum_anim_trigger.js` | Avatar presence and animation triggers |
| `caelum_music_listener.js` / `bg_music.js` | Music presence |
| `games_panel.js` / `games/` | In-app games |
| `content_safety.js` | Public-site content rules |
| Public pages (`what-is-eaci.html`, `meet-the-companions.html`, …) | Marketing and definition pages |

---

## `core/` — the nervous system

Scripts are numbered roughly by load / concern. Grouped by job:

### Boot & config

- `00_preamble.js`, `00_veil_app_version.js` — globals and version  
- `01_lazy_loader.js` — deferred bundles  
- `02_config.js` — endpoints and flags (**secrets redacted** in this repo)  
- `06_service_worker.js`, `07_offline_mode.js`, `15_init.js`, `69_bootstrap.js` — start, cache, offline  

### Account & billing

- `13_auth.js`, `14_password_reset.js`, `68_onboarding_signup.js`  
- `08_stt_languages.js` — languages **and** subscription / usage meter  
- `63_family_code.js`, `70_creator_verify.js`, `71_profile_sync.js` — access gates (public-safe paths only)  

### Chat & media

- `21_deepseek_api.js`, `21_deepseek_api_2.js`, `22_streaming.js` — cloud chat paths  
- `34_message_display.js`, `35_image_analysis.js`, `37_media_recall.js`  
- `51_live_starfield.js` — live voice UI + local thought engine  

### Companions & memory

- `18_tab_switching.js` — active companion  
- `*_prompt.js` modules — per-companion behavior hooks (client-side)  
- `55_memory_system.js`, `61_memory_auto.js`, `56_history_cloud.js`  

### Caelum LLM (live)

- `74_caelum_llm.js` — engine façade  
- `75_veil_llm_learning.js` — passive learning hydration  
- `76_caelum_browser_engine.js` — browser pack runtime  
- `data/caelum-engine/` — pack assets  

### Coding IDE (live)

- `83_veil_ide.js` — IDE shell  
- `84_coding_router.js` — local-first routing + shared budget entry  
- `85_coding_agent.js` … `95_coding_architect.js` — agent loop pieces  
- `veil_coding_playbook.js`, `veil_coding_starter_pack.js`, `veil_coding_veil_pack.js` — recipes and guidance  

### Platform

- `73_platform_compat_engine.js`  
- `platform-patches/` — per-browser / OEM tunings  

---

## `data/`

| Path | Role |
|---|---|
| `data/caelum-engine/` | Client-side companion pack for Caelum LLM |

No soul files. No service keys.

---

## `vendor/`

Third-party client libraries used by the shell (as shipped to browsers).

---

## Load order (intuition)

1. Preamble + config  
2. Auth-capable shell  
3. UI restructure + chat surface  
4. Companion, memory, animation  
5. Caelum LLM + learning  
6. Coding IDE modules  
7. Living systems, initiative, Life Log  
8. Tours and polish  

Exact order is in `index.html` script tags — that file is the manifest.

---

## Reading tip

Start with [HOW-IT-WORKS.md](./HOW-IT-WORKS.md), then jump to a folder above when a name in the live UI sparks curiosity. The code is the proof; these docs are the map.
