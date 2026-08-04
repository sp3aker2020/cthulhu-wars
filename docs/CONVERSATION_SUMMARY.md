# Cthulhu Wars Web Project — Conversation & Architecture Record

## Overview
This document records the full history, requirements, architecture, and specifications of the Cthulhu Wars Web implementation built during this session.

- **Conversation ID**: `ee293687-6686-4f0b-9ca2-a77840ac63b8`
- **Project Directory**: `/home/speaker20/Documents/GitHub/cthulhu-wars`
- **Full JSONL Transcript**: `[docs/transcript.jsonl](file:///home/speaker20/Documents/GitHub/cthulhu-wars/docs/transcript.jsonl)`
- **Implementation Plan**: `[docs/implementation_plan.md](file:///home/speaker20/Documents/GitHub/cthulhu-wars/docs/implementation_plan.md)`
- **Task List**: `[docs/task.md](file:///home/speaker20/Documents/GitHub/cthulhu-wars/docs/task.md)`

---

## 1. Initial User Request & Requirements
The user requested a digital web-based version of the board game **Cthulhu Wars** (originally designed by Sandy Petersen), referencing the popular Steam Tabletop Simulator (TTS) mod.

### Specified Requirements:
1. **Visuals**: High-quality dark Lovecraftian UI aesthetic with modern styling (glassmorphism, vibrant faction color accents, smooth micro-animations).
2. **Players**: 2–4 players (local hot-seat MVP with multi-player setup).
3. **Platform**: Web application, desktop-first UI layout.
4. **Solana Integration**:
   - Solana wallet login support (**Phantom**, **Solflare**, **Backpack**).
   - Player stat tracking (games played, wins, losses, total doom scored, faction win-rates) stored locally by wallet address.
   - **⚡ Quick Play (Local Game)** option for instant testing without browser wallet extensions.
5. **Future Roadmap**: Designed for eventual WebSocket real-time multiplayer and on-chain Solana program state/leaderboard integration.

---

## 2. Research & Game Specification
Deep rules research was conducted on the core Cthulhu Wars mechanics:

### Round Structure:
1. **Gather Power Phase**: Cultists (1) + Controlled Gates (2) + Abandoned Gates (1) + Returned Captives (1). Half-power catch-up rule applied.
2. **First Player Phase**: Highest power player receives token, breaks ties, selects turn direction (clockwise / counter-clockwise).
3. **Action Phase**: Sequential 1-action turns (Move, Battle, Build Gate, Recruit, Summon, Awaken GOO, Capture Cultist, Pass).
4. **Doom Phase**: Auto-scores 1 Doom per controlled gate. Ritual of Annihilation offers with Elder Sign token draws. Game end check (30+ Doom or Instant Death).

### Core Factions (4 Included):
- **Great Cthulhu** (Green `#00c853`): Starts in South Pacific. Units: Cultist, Deep One, Shoggoth, Starspawn, Great Cthulhu (Combat 6, Devour ability).
- **Crawling Chaos** (Blue `#448aff`): Starts in Asia. Units: Cultist, Nightgaunt, Flying Polyp, Hunting Horror, Nyarlathotep (Combat = Total unlocked spellbooks across all players).
- **Yellow Sign** (Yellow `#ffd600`): Starts in Europe. Units: Cultist, Undead (scaling combat), Byakhee, King in Yellow (Combat 0), Hastur (Combat = Ritual cost).
- **Black Goat** (Red `#ff1744`): Starts in Africa. Units: Cultist, Ghoul, Mi-Go, Dark Young, Shub-Niggurath (Combat = Gates + Cultists).

### Map Topology:
13 standard regions (7 Land: North America, South America, Europe, Africa, Asia, Australia, Antarctica; 6 Ocean: North Pacific, South Pacific, North Atlantic, South Atlantic, Indian Ocean, Arctic Ocean) with cylindrical East-West wrapping.

---

## 3. Technical Architecture & File Structure

Built with **Vite + Vanilla JavaScript (ES modules) + SVG + Vanilla CSS**.

```
cthulhu-wars/
├── index.html                  # Main HTML shell
├── package.json                # Dependencies & Vite config
├── docs/                       # Project documentation & logs
│   ├── CONVERSATION_SUMMARY.md # This document
│   ├── implementation_plan.md  # Detailed implementation plan
│   ├── task.md                 # Task list
│   └── transcript.jsonl        # Raw full JSONL transcript log
├── src/
│   ├── main.js                 # App bootstrapper & main game loop
│   ├── css/
│   │   ├── main.css            # Custom properties, reset, grid layout
│   │   ├── map.css             # SVG map styling & region highlighting
│   │   ├── ui.css              # Glassmorphism panels, modals, action bar
│   │   ├── wallet.css          # Solana wallet badge & buttons
│   │   └── animations.css      # Keyframes (pulse, tumble, slide)
│   ├── solana/
│   │   ├── wallet.js           # Phantom/Solflare/Backpack connection manager
│   │   ├── player-store.js     # Player profiles & stats in localStorage
│   │   └── lobby.js            # Lobby manager for 2-4 player setup
│   ├── game/
│   │   ├── constants.js        # Factions, map topology, unit rosters, config
│   │   ├── game-state.js       # Central event-driven GameState manager
│   │   ├── combat.js           # CombatEngine (dice, devour, hits, retreats)
│   │   ├── map-renderer.js     # Interactive SVG world map renderer
│   │   ├── dice-renderer.js    # Visual 3D-ish dice tumble animations
│   │   └── phases/
│   │       ├── gather-power.js # Phase 1 runner
│   │       ├── first-player.js # Phase 2 runner
│   │       ├── action-phase.js # Phase 3 action loop & handlers
│   │       └── doom-phase.js   # Phase 4 doom & ritual runner
│   ├── ui/
│   │   ├── ui-controller.js    # Master UI coordinator & prompt system
│   │   └── setup-screen.js     # Title, wallet connect & hot-seat lobby screen
│   └── utils/
│       ├── dom.js              # DOM helpers (createElement, show, hide, addClass)
│       ├── events.js           # EventEmitter implementation
│       └── random.js           # Dice rolling & Fisher-Yates shuffle
```

---

## 4. How to Run the App
To start the local development server:
```bash
cd /home/speaker20/Documents/GitHub/cthulhu-wars
npm run dev
```
Then navigate to **`http://localhost:5173/`** in your browser.
