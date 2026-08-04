# Cthulhu Wars — Implementation Tasks

## Project Setup
- [ ] Initialize Vite project with vanilla JS
- [ ] Create directory structure
- [ ] Set up index.html shell
- [ ] Configure vite.config.js

## Design System (CSS)
- [ ] main.css — Variables, reset, layout, typography
- [ ] map.css — SVG map styles, region highlighting
- [ ] ui.css — Panels, modals, faction sheets, action bar
- [ ] wallet.css — Wallet connect UI
- [ ] animations.css — Keyframes & transitions

## Game Data
- [ ] constants.js — Factions, units, GOOs, spellbooks, map regions, adjacency graph

## Solana Integration
- [ ] wallet.js — Wallet detection, connect, disconnect, sign
- [ ] player-store.js — Player profiles & stats (localStorage)
- [ ] lobby.js — Game room creation, player slots, faction select

## Game Engine
- [ ] game-state.js — Central state machine, event emitter
- [ ] phases/gather-power.js — Power calculation
- [ ] phases/first-player.js — First player determination
- [ ] phases/action-phase.js — Action loop, turn management
- [ ] phases/doom-phase.js — Doom scoring, ritual, game end
- [ ] actions/move.js
- [ ] actions/battle.js
- [ ] actions/build-gate.js
- [ ] actions/recruit.js
- [ ] actions/summon.js
- [ ] actions/awaken.js
- [ ] actions/capture.js
- [ ] actions/ritual.js
- [ ] combat.js — Dice rolling, kill/pain resolution

## Map & Rendering
- [ ] map-renderer.js — SVG map creation & interaction
- [ ] dice-renderer.js — Visual dice animation

## UI Components
- [ ] ui-controller.js — Master coordinator
- [ ] setup-screen.js — Wallet login + lobby
- [ ] faction-panel.js — Right sidebar
- [ ] action-bar.js — Bottom action buttons
- [ ] combat-modal.js — Battle resolution UI
- [ ] phase-banner.js — Phase transition overlay
- [ ] game-log.js — Event log
- [ ] end-screen.js — Final scores & winner

## Utilities
- [ ] events.js — Event emitter class
- [ ] dom.js — DOM helpers
- [ ] random.js — Dice, shuffles

## Integration & Polish
- [ ] main.js — Entry point, wire everything together
- [ ] Generate faction artwork
- [ ] Full playthrough test
