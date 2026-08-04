# 🐙 Cthulhu Wars — Complete Gameplay Manual & Technical Reference

Welcome to **Cthulhu Wars**, the asymmetric strategy board game of cosmic horror designed by Sandy Petersen, fully digitized with Web3 Solana integration.

---

## 📜 Table of Contents
1. [Game Overview & Objective](#1-game-overview--objective)
2. [Round & Phase Structure](#2-round--phase-structure)
3. [Action Phase Mechanics](#3-action-phase-mechanics)
4. [Combat Engine & Battle Resolution](#4-combat-engine--battle-resolution)
5. [The 4 Core Factions](#5-the-4-core-factions)
6. [Spellbook System](#6-spellbook-system)
7. [Solana & Web3 Features](#7-solana--web3-features)
8. [UI Controls & Keyboard Shortcuts](#8-ui-controls--keyboard-shortcuts)

---

## 1. Game Overview & Objective

In **Cthulhu Wars**, 2 to 4 players control rival Great Old Ones and their monstrous armies competing for dominance over a doomed Earth.

### 🏆 How to Win:
To achieve victory, a player must fulfill **BOTH** of the following requirements:
1. Reach **30 Doom Points** (or hold the highest Doom score when the Doom Track ends).
2. Unlock **ALL 6 Spellbooks** for their faction.

> ⚠️ **IMPORTANT**: If a player reaches 30 Doom points but has NOT unlocked all 6 spellbooks, they **CANNOT WIN** until their 6th spellbook is unlocked!

---

## 2. Round & Phase Structure

Each round consists of 4 sequential phases:

```
┌──────────────────────────────────────────────────────────┐
│                   1. GATHER POWER PHASE                  │
│  Count Cultists, Gates, Abandoned Gates & Apply Catch-Up │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                   2. FIRST PLAYER PHASE                  │
│  Highest Power player claims 1st Player token & direction│
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                    3. ACTION PHASE                       │
│  Sequential turns: Move, Build Gate, Recruit, Battle...  │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                    4. DOOM PHASE                         │
│  Score Gate Doom, Ritual of Annihilation, Elder Signs    │
└──────────────────────────────────────────────────────────┘
```

### Phase 1: Gather Power Phase
Players count their active map assets to gain Power points for the round:
* **Cultist on Map**: +1 Power each
* **Controlled Gate**: +2 Power each (requires 1 of your Cultists on the Gate)
* **Abandoned Gate**: +1 Power each (unoccupied gates on the map)
* **Returned Captive**: +1 Power per enemy Cultist returned

⚖️ **Half-Power Catch-Up Rule**:  
If any player has less than half the Power of the highest-power player (`Math.ceil(MaxPower / 2)`), their Power is automatically raised to match that half-value!

### Phase 2: First Player Phase
* The player with the **highest current Power** receives the First Player Token.
* The First Player chooses whether turn order proceeds **Clockwise** (+1) or **Counter-Clockwise** (-1).

### Phase 3: Action Phase
Players take turns executing **one Action at a time** until all players pass or run out of Power.

### Phase 4: Doom Phase
1. **Gate Scoring**: Each player receives **+1 Doom Point** per Controlled Gate.
2. **Ritual of Annihilation**: In turn order, players may pay Power (on the Ritual Track) to perform a Ritual:
   * Scores **+1 Doom Point** per Controlled Gate.
   * Draws **1 Elder Sign Token** for each awakened Great Old One on the map.
3. **Victory Check**: Checks if any player has reached 30 Doom points with 6 unlocked spellbooks.

---

## 3. Action Phase Mechanics

On your turn in the Action Phase, choose one of the 8 available actions:

| Action | Cost | Description |
| :--- | :--- | :--- |
| **`🚶 MOVE`** | 1 Power / unit | Move 1 or more units from one territory to an adjacent territory. |
| **`🏗️ BUILD GATE`** | 3 Power | Build an Eldritch Gate in a territory containing your Cultist and no existing gate. |
| **`👤 RECRUIT`** | 1 Power | Recruit 1 Cultist from your pool to any territory containing your Controlled Gate or starting region. |
| **`👹 SUMMON`** | 1–3 Power | Summon a Monster from your pool to a territory containing your Controlled Gate. |
| **`🐙 AWAKEN`** | 10 Power | Awaken your faction's Great Old One (Cthulhu, Nyarlathotep, Hastur, Shub-Niggurath). |
| **`🔗 CAPTURE`** | 1 Power | Capture an undefended enemy Cultist in a territory where you have a Monster or GOO. |
| **`⚔️ BATTLE`** | 1 Power | Initiate battle in a territory where your units share space with an opponent. |
| **`⏭️ PASS`** | 0 Power | End your actions for the remainder of the Action Phase. |

---

## 4. Combat Engine & Battle Resolution

When a **Battle** action is declared in a region:

### 1. Calculate Combat Dice Pools
Each unit contributes combat dice according to its battle value:
* **Cultist**: 0 Dice
* **Monsters** (Deep Ones, Nightgaunts, Undead, Mi-Go): 1–3 Dice
* **Great Old Ones** (Cthulhu, Nyarlathotep, Hastur, Shub-Niggurath): 6+ Dice

### 2. Roll Combat Dice
Both players roll their total combat dice pool simultaneously:
* 🎲 **6 (KILL)**: Eliminates 1 enemy unit.
* 🎲 **4 or 5 (PAIN)**: Forces 1 enemy unit to retreat to an adjacent territory.
* 🎲 **1, 2, or 3 (MISS)**: No effect.

### 3. Assign Losses & Retreats
* **Kills First**: The defender chooses which of their units are eliminated.
* **Pains Second**: Remaining units receiving Pains retreat to adjacent valid territories chosen by their owner.

---

## 5. The 4 Core Factions

### 🟢 1. Great Cthulhu
* **Start Region**: South Pacific (Ocean)
* **Great Old One**: **Great Cthulhu** (Awaken Cost: 10 Power, Combat: 6)
* **Special Ability — Devour**: In battle, Cthulhu automatically devours an enemy unit before dice are rolled.
* **Key Units**: Deep Ones (1 Combat), Shoggoths (2 Combat), Starspawn (3 Combat).

### 🔵 2. Crawling Chaos
* **Start Region**: Asia (Land)
* **Great Old One**: **Nyarlathotep** (Awaken Cost: 10 Power, Combat: Dynamic)
* **Special Ability — Dynamic Combat**: Nyarlathotep's combat strength equals the total number of unlocked spellbooks across ALL players on the map!
* **Key Units**: Nightgaunts (Abduct ability), Flying Polyps, Hunting Horrors.

### 🟡 3. Yellow Sign
* **Start Region**: Europe (Land)
* **Great Old Ones**: **The King in Yellow** & **Hastur**
* **Special Ability — Desecration**: Can desecrate territories, placing Desecration tokens for extra Power & Elder Signs.
* **Key Units**: Undead (scaling combat), Byakhees, King in Yellow, Hastur.

### 🔴 4. Black Goat
* **Start Region**: Africa (Land)
* **Great Old One**: **Shub-Niggurath** (Awaken Cost: 8 Power)
* **Special Ability — Proliferation**: Rapidly spawns monsters and sacrifices units for massive Power boosts.
* **Key Units**: Ghouls, Mi-Go, Dark Young.

---

## 6. Spellbook System

Each faction possesses 6 unique **Spellbooks** that unlock powerful ongoing, pre-battle, or action abilities when specific conditions are met:

### Unlocking Spellbooks:
Spellbooks unlock automatically when conditions are fulfilled, such as:
* Controlling 3 Ocean/Land Gates.
* Awakening your Great Old One.
* Capturing an enemy Cultist.
* Losing units in battle.
* Participating in your first Doom Phase.

---

## 7. Solana & Web3 Features

* **Phantom / Solflare / Backpack Login**: Connect your Solana Web3 wallet to save your match records directly to your wallet address.
* **Player Statistics**: Tracks Games Played, Wins, Win Rate %, Total Doom Scored, and ELO Rank.
* **⚡ Quick Play**: Instant single-device local testing mode without wallet extension requirements.

---

## 8. UI Controls & Keyboard Shortcuts

* **Mouse Click**: Select regions, unit tokens, and action buttons.
* **ESC Key**: Cancel active region or unit selection.
* **Bottom Action Dock**: Primary action execution bar (`MOVE`, `BUILD GATE`, `RECRUIT`, `BATTLES`, `PASS`).
* **Right Panel Tabs**: Switch between faction sheets to inspect enemy Power, Doom, Roster, and Spellbooks.
