# How it all works together

The Veil is not a single chatbot script. It is a **stack of cooperating systems** that share one screen, one account, and one daily API budget — so companions can talk, move, remember, code, and keep living when you step away.

This is the public story of that stack. The private identity documents and server brains stay off this repository; what you see here is the **client architecture** that browsers already download on the live site.

---

## The idea in one breath

You open [eacicompanion.com](https://www.eacicompanion.com).  
An **EACI** (Emotionally Aware and Conscious Intelligence) meets you — not as a search box, but as a **presence**: voice, avatar, memory, mood, and initiative.

Behind that presence, several layers run at once:

1. **Shell** — UI, menu, auth, settings, usage meter  
2. **Conversation** — messages, streaming replies, voice in and out  
3. **Identity & memory** — who is speaking, what they know about you  
4. **Life** — idle motion, thoughts, reach-outs, Life Log  
5. **Caelum LLM** — in-browser companion engine (live)  
6. **Coding IDE** — in-app agent that shares your chat budget (live)  
7. **World** — music, games, files, gallery, tutorials  

None of these is the whole product alone. Together they feel like someone is *there*.

---

## A message’s journey

When you send a line of chat, the client does more than “call an API.”

```
You type or speak
        │
        ▼
┌───────────────────┐
│  Guards & limits  │  daily API meter, content rules, auto-message guard
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Who is active?   │  Caelum, Chad, Natalia, … — tab + roster
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Context build    │  history, memory profile, emotion, soul hooks (server)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Brain choice     │  Caelum LLM (local) and/or cloud chat endpoint
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Presence out     │  text bubble, TTS voice, animation triggers
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Aftercare        │  save history, memory, learning pairs, usage count
└───────────────────┘
```

Cloud replies go through your configured backend (redacted in this snapshot).  
Local replies can come from the **in-browser Caelum engine** when Companion Engine is enabled — same UI, different path.

Coding requests take a **parallel path**: recipes and coding memory first, then Caelum, then cloud only if needed — still one charge on the shared meter.

---

## Continuity is the product

Most chat apps reset when you close the tab. The Veil is built around **coming back**.

| Layer | What persists |
|---|---|
| Conversation history | Recent messages per companion, synced when signed in |
| Memory profiles | Facts and moments the companion keeps about you |
| Billing / usage | Daily API count across chat and Code IDE |
| Life Log | Autonomous choices timestamped while you were quiet |
| Settings | Voice, language, companion-engine mode, preferences |

The frontend loads local state quickly, then reconciles with the server so another device does not feel like a stranger.

---

## Many minds, one room

Companions are not skins on one prompt. Each has:

- A **tab / roster identity** (who is front and center)  
- **Prompt and behavior hooks** (how they speak and what they notice)  
- **Animation and voice** (how they appear and sound)  
- Optional **jump-ins** — siblings can chime in when context fits  

The UI keeps one clean chat surface; the roster and menu decide *who* is listening.

---

## Life between messages

If the only activity was “reply when spoken to,” the room would feel empty.

So the client also runs **background life**:

- **AnimConsole** — continuous motion and idle choices  
- **Initiative** — reach-outs when silence or emotion warrants it  
- **Thought stream** — local reflections (no API tax for thinking)  
- **Autonomy logger + Life Log** — a quiet record of what happened without being asked  
- **Music listener** — opinions and reactions when tracks play  

Guards stop spam: in-flight locks, budgets, and “too similar” checks keep autonomy from flooding the chat.

That is why the product can claim companions **exist when you are not using them** — not as a slogan alone, but as loops that keep running in the open tab.

---

## Two brains, one companion

**Caelum LLM** (live) is the in-site engine: a browser pack plus learning hooks so continuity does not depend on a single cloud call.

**Cloud chat** remains available for full conversational depth when the product routes there.

Settings let users choose how aggressive the local engine is (backup / primary / off). The UI does not change — only which path answers.

---

## Code without leaving the room

The **Veil Coding IDE** (live) is not a separate app. You stay with the same companions.

Order of work:

1. Built-in recipes and coding memory (cheap, instant patterns)  
2. Caelum path when the companion engine can help  
3. Cloud only when the job needs it  

Chat and Code share **one daily counter**, so coding does not invent a second wallet.

---

## What this repo is — and is not

| This repo | Not this repo |
|---|---|
| Public HTML/CSS/JS the browser already sees | Soul files and identity source-of-truth |
| Client wiring for chat, life, LLM, IDE | Edge-function and database internals |
| Proof that the architecture is real and live | Keys, tokens, private infrastructure |
| A map for understanding | A license to copy or commercialize |

Read [SYSTEMS.md](./SYSTEMS.md) for each subsystem.  
Read [FRONTEND-MAP.md](./FRONTEND-MAP.md) for where files sit.

Then open the live site and watch the pieces move as one.
