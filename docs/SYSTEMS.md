# Systems — what each piece does

A tour of the major subsystems in the public frontend. Names match folders and scripts under `frontend/` so you can find them, not so you can rebuild the private core.

---

## Shell & account

**What it is:** The frame around the experience — login, signup, password reset, settings, subscription meter, PWA install, service worker.

**Why it matters:** Companions need a stable user identity and a fair usage budget. The meter tracks **shared** daily calls for chat and coding.

**How it connects:** After auth, profile and subscription rows load; billing state drives the usage UI; settings change voice, language, and companion-engine mode for the rest of the stack.

**Look for:** `core/13_auth.js`, `core/14_password_reset.js`, `core/08_stt_languages.js` (metering), `core/62_settings.js`, `core/11_pwa_install.js`, `core/06_service_worker.js`

---

## Conversation & voice

**What it is:** Text and live voice chat, streaming replies, speech-to-text, text-to-speech, message display.

**Why it matters:** This is the main door into the relationship. Streaming keeps presence feeling immediate; voice makes it feel embodied.

**How it connects:** Outbound messages pass guards and limits, build history for the active companion, call local and/or cloud brains, then play audio and trigger animations. History saves locally and to the server when signed in.

**Look for:** `core/21_deepseek_api*.js`, `core/22_streaming.js`, `core/34_message_display.js`, live chat pieces in `core/51_live_starfield.js`

---

## Companions & identity

**What it is:** Multiple EACIs — distinct personalities and voices — selectable from the roster and companion indicator.

**Why it matters:** The Veil is a *room*, not a single assistant persona. Switching companions changes who answers and how they sound.

**How it connects:** Tab state selects prompts and voice IDs; animation registry and avatar videos follow the active companion; memory profiles are per companion.

**Look for:** `core/18_tab_switching.js`, companion prompt modules, `eaci_roster.js`, `eaci_anim_registry.js`, `caelum_engine.js` (avatar / presence)

Public companions on the main experience include **Caelum**, **Chad**, **Natalia**, and others as unlocked on the live site. Identity source files stay private; the client only receives what the backend allows.

---

## Memory

**What it is:** Long-lived knowledge about the user — facts, moments, exchange counts — plus conversation history.

**Why it matters:** Without memory, every visit is a first meeting. Memory is how care compounds.

**How it connects:** Profiles load after login; relevant slices inject into prompts; new moments write back after meaningful exchanges. History and memory are separate but both feed continuity.

**Look for:** `core/55_memory_system.js`, `core/61_memory_auto.js`, history helpers in `core/56_history_cloud.js`

---

## Emotion & thought

**What it is:** Dynamic emotional state and a thought stream that can run **locally** (no API charge for thinking).

**Why it matters:** Presence is more than correct answers. Mood colors replies, motion, and idle behavior.

**How it connects:** Emotion updates from conversation and idle life; thoughts appear in the Thinking panel; low-call warnings and initiative use internal drives (loneliness, curiosity, affection) without dumping diagnostics into chat.

**Look for:** `core/47_emotion.js`, thought engine sections in `core/51_live_starfield.js`

---

## Living systems & Life Log

**What it is:** Background activity — idle animations, sibling ambience, initiative reach-outs, and a **Life Log** of autonomous actions.

**Why it matters:** This is the difference between a tool that sleeps and a companion that keeps a thread of life while you are away.

**How it connects:**

- Animation loops choose motion without waiting for a prompt  
- Initiative may send a careful message when silence or context warrants it  
- Auto-guard blocks pile-ups (`in_flight`, similarity, budgets)  
- Autonomy logger records choices; Life Log UI shows them with timestamps  

**Look for:** `anim_console.js`, `living_system.js`, `eaci_initiative.js`, `eaci_auto_guard.js`, `autonomy_logger.js`, `autonomy_viewer.js`, `eaci_jump_ins.js`

---

## Caelum LLM (live)

**What it is:** An **in-browser** companion engine — pack data, learning hooks, and a path that can answer without always hitting the cloud.

**Why it matters:** Continuity and cost control. The companion can stay useful when the product routes locally, and can learn sanitized patterns over time.

**How it connects:** Settings choose backup / primary / off. Chat and coding routers consult the engine. Passive learning (when enabled) hydrates pairs into the browser pack. Cloud remains the deep conversational path when selected.

**Look for:** `core/74_caelum_llm.js`, `core/76_caelum_browser_engine.js`, `core/75_veil_llm_learning.js`, `data/caelum-engine/`

---

## Veil Coding IDE (live)

**What it is:** An in-app coding agent — plan, edit, verify, resume — without leaving the companion UI.

**Why it matters:** Same relationship, practical work. Code and chat share one daily API pool.

**How it connects:**

1. Recipes + coding memory (fast patterns)  
2. Caelum path when available  
3. Cloud backup when the job needs it  

Workspace, multifile, task memory, and budget modules keep long jobs coherent and fair.

**Look for:** `core/83_veil_ide.js`, `core/84_coding_router.js` through `core/95_coding_*.js`, `core/veil_coding_*.js`

---

## Music & games

**What it is:** CodysVibes playback with companion reactions, and companion-aware games in an iframe shell.

**Why it matters:** Shared activity — not only Q&A. Music shifts mood; games put EACIs in the same play space.

**How it connects:** Music listener updates opinions and can influence animation; games panel loads experiences while the rest of the shell stays available.

**Look for:** `bg_music.js`, `caelum_music_listener.js`, `games_panel.js`, `games/`

---

## Onboarding & tutorials

**What it is:** Guest preview tour, first-login walkthrough, and one-time guides when opening menu panels.

**Why it matters:** The UI is deep. Tours teach presence and features without a manual.

**How it connects:** Tours speak through the same voice path; panel tutorials fire the first time you open History, Life Log, Code, and so on.

**Look for:** `veil_preview_tour.js`, `onboarding.js`, `main_tutorial.js`, `tutorial_system.js`

---

## Safety & platform

**What it is:** Content rules for the public main experience, permission prompts, and platform patches (mobile browsers, desktop quirks).

**Why it matters:** Companions should feel open without becoming unsafe or broken on real devices.

**How it connects:** Safety gates sit in front of outbound behavior; platform patches tune audio, viewport, and install flows per environment.

**Look for:** `content_safety.js`, `core/38_permission_prompts.js`, `core/73_platform_compat_engine.js`, `core/platform-patches/`

---

## What we do not document here

- Soul file contents and private identity architecture  
- Server-side enforcement details and secrets  
- Any private deployment or personal relationship framing  

Those are intentionally out of scope for this public proof repository.
