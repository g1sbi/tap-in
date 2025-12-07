# Refactoring Request: Dice Rush → Tap In (Multi-Game Platform)

## Context

This repo currently hosts "Dice Rush", a 2-player betting dice game. We're refactoring it into **"Tap In"** — a party game platform containing multiple mini-games playable by 2-8 players in a shared room.

There's also an `/edge` folder in the root that contains a separate game (Edge) which was its own repo — it needs to be integrated into this new structure.

**⚠️ IMPORTANT: Proceed step-by-step. Do NOT attempt to do everything at once. Complete each phase before moving to the next. Ask for confirmation before proceeding to the next phase.**

---

## Phase 1: Project Rename & Folder Restructure

### 1.1 Rename the app

- Change app name from "Dice Rush" to **"Tap In"** in:
  - `app.json`
  - `constants/app-info.ts`
  - Any hardcoded references in components

### 1.2 Create modular game folder structure

Restructure to support multiple games:

```
├── games/
│   ├── _shared/           # Shared game utilities (timers, overlays, common UI)
│   ├── dice-rush/
│   │   ├── components/    # Move current /components/game/* here
│   │   ├── lib/           # Move game-specific logic (game-logic.ts, game-state.ts, etc.)
│   │   ├── screens/       # Game-specific screens if needed
│   │   └── index.ts       # Game manifest/config export
│   └── edge/
│       ├── components/
│       ├── lib/
│       └── index.ts
```

### 1.3 Clean up `/edge` from root

- Move `/edge` contents into `games/edge/`
- Remove any duplicate dependencies or configs
- Preserve Edge's core game logic and components

**STOP after Phase 1. Show me the new folder structure and confirm before proceeding.**

---

## Phase 2: Unified Room Management System

### 2.1 Abstract room management

Both Dice Rush and Edge currently have their own room/joining systems. Create a unified system:

- Create `lib/room/` folder:

```
  lib/room/
  ├── room-manager.ts      # Unified room creation/joining logic
  ├── room-types.ts        # TypeScript interfaces for room state
  ├── room-context.tsx     # React context for room state
  └── supabase-rooms.ts    # Supabase table interactions
```

### 2.2 Room infrastructure requirements

Design the system to support:

- **2-8 players per room**
- 6-digit room codes
- Player states: `waiting`, `ready`, `in-game`, `disconnected`
- Room states: `lobby`, `game-active`, `game-ended`, `closed`
- Host designation (first player to create)
- Game selection storage (which game(s) will be played)

### 2.3 Supabase schema suggestion

Propose a unified Supabase table structure that can handle:

- Room metadata (code, host, status, selected games)
- Players in room (with ready status)
- Real-time subscriptions for player join/leave/ready events

**Note:** The actual Supabase migration will be done manually. Just provide the schema design and the client-side code.

**⚠️ DO NOT modify Dice Rush or Edge to use this system yet. Just build the infrastructure. Game-specific adaptations (especially extending Dice Rush from 2 to 8 players) will be handled in a future phase.**

**STOP after Phase 2. Show me the room system architecture and get confirmation.**

---

## Phase 3: New Home Screen

### 3.1 Home screen layout

Replace current home with a new "Tap In" landing screen containing:

1. **App title** — "Tap In" with stylized typography
2. **Animated background** — Reference `components/home/background*.tsx` for existing patterns. Keep it visually engaging but performant.
3. **Four main UI elements:**
   - `Create Room` button → navigates to lobby as host
   - Text input field for 6-digit room code
   - `Join Room` button → validates code and joins existing room
   - `Choose Game` button → opens game selection modal/screen (for solo practice or specific game lobby)

### 3.2 Button styling

**Look at the existing button implementations in the codebase** (check `components/home/`, `components/ui/`, and any button usage in Dice Rush and Edge). Maintain visual consistency with established patterns.

### 3.3 Navigation flow

```
Home → Create Room → Lobby (as host, waiting for players)
Home → Join Room (with code) → Lobby (as guest)
Home → Choose Game → Game Selection → Create/Join for that specific game
```

**STOP after Phase 3. Demo the home screen before proceeding.**

---

## Phase 4: Lobby Screen Refactor

### 4.1 Universal lobby

Create a lobby that works for any game:

- Shows all connected players (2-8)
- Host can select which game(s) to play
- Ready-up system
- Host starts game when all ready
- Real-time player list updates via Supabase subscriptions

### 4.2 Keep game-specific logic separate

The lobby should import game configs from `games/[game-name]/index.ts` to know:

- Min/max players supported
- Game display name and icon
- Any pre-game settings

---

## Phase 5: Future Tasks (DO NOT DO NOW)

These are noted for context but should NOT be addressed in this refactor:

- [ ] Extend Dice Rush from 2-player to 2-8 player support
- [ ] Adapt Edge to use unified room system
- [ ] Implement game queue/playlist system
- [ ] Add game-specific settings in lobby

---

## Summary of Approach

1. **Rename first** — minimal changes, just branding
2. **Restructure folders** — organize for modularity
3. **Build room infrastructure** — unified system, not yet connected
4. **New home screen** — fresh entry point
5. **Lobby refactor** — universal lobby using new room system
6. **Leave games untouched** — Dice Rush and Edge keep working as-is until dedicated adaptation phase

**Key principle:** Each game lives in its own folder under `games/`. Shared infrastructure lives in `lib/`. Games export a manifest that the platform consumes. This allows adding new games without touching core platform code.

---

## Questions Before Starting

Before you begin, confirm:

1. Is there a `package.json` in `/edge` with separate dependencies?
2. Are there any other hardcoded "Dice Rush" references I should know about?
3. Should I preserve the current tab-based navigation or move to stack navigation?
