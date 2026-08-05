import { $, $$, createElement, show, hide, addClass, removeClass } from '../utils/dom.js';
import { FACTIONS, MAP_REGIONS, UNIT_ICONS, PHASE_NAMES, GAME_CONFIG } from '../game/constants.js';
import { applyAction } from '../game/engine.js';
import { CombatEngine } from '../game/combat.js';
import { RefereeClient } from '../solana/referee-client.js';

export class UIController {
  constructor(gameState, mapRenderer) {
    this.gameState = gameState;
    this.mapRenderer = mapRenderer;
    this._actionResolver = null;
    this._regionResolver = null;
    this._toastTimeout = null;
    this.refereeClient = new RefereeClient();
    this._refereeInitialized = false;
  }

  init() {
    this.gameState.on('phaseChange', () => { this.updateHeader(); this.checkPhaseLoops(); });
    this.gameState.on('turnChange', () => { this.updateHeader(); this.checkPhaseLoops(); });
    this.gameState.on('powerChange', () => this.updateFactionPanel());
    this.gameState.on('doomChange', () => this.updateFactionPanel());
    this.gameState.on('unitPlaced', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('unitsMoved', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('unitKilled', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('unitRemoved', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('gateBuilt', () => this.mapRenderer.updateAllRegions());
    this.gameState.on('gateAbandoned', () => this.mapRenderer.updateAllRegions());
    this.gameState.on('spellbookUnlocked', () => this.updateFactionPanel());
    this.gameState.on('logEntry', (data) => this.addLogEntry(data));
    this.gameState.on('gooAwakened', () => this.updateFactionPanel());

    const rulebookBtn = $('#rulebook-btn');
    if (rulebookBtn) {
      rulebookBtn.addEventListener('click', () => this.showRulebookModal());
    }
    
    // Auto-start phase loops
    setTimeout(() => this.checkPhaseLoops(), 100);
  }

  // ========== HEADER ==========
  updateHeader() {
    const state = this.gameState.state;
    const player = this.gameState.getCurrentPlayer();
    const faction = player ? FACTIONS[player.factionId] : null;
    const roundEl = $('#round-counter');
    const phaseEl = $('#phase-indicator');
    const playerEl = $('#current-player');
    if (roundEl) roundEl.textContent = `Round ${state.round}`;
    if (phaseEl) phaseEl.textContent = PHASE_NAMES[state.phase] || state.phase;
    if (playerEl && faction) {
      playerEl.innerHTML = `<span class="player-dot" style="background:${faction.color};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"></span> ${faction.name}`;
    }

    // Refresh wallet balance if available
    const headerWallet = $('#header-wallet');
    if (headerWallet && window.app && window.app.wallet.isConnected()) {
      const pubkey = window.app.wallet.getPublicKey();
      const profile = window.app.playerStore.getProfile(pubkey);
      const balance = profile.balance || 0;
      headerWallet.innerHTML = `
        <div class="wallet-badge" style="display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 20px; border: 1px solid #00e676;">
          <div class="token-balance" style="color: #00e676; font-weight: bold; display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 1.1em;">🪙</span> ${balance}
          </div>
          <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.2);"></div>
          <div><span class="wallet-dot"></span>${window.app.wallet.getShortAddress()}</div>
        </div>
      `;
    }
  }

  // ========== FACTION PANEL ==========
  updateFactionPanel() {
    const pi = this.gameState.state.currentPlayerIndex;
    const player = this.gameState.getPlayer(pi);
    if (!player) return;
    const faction = FACTIONS[player.factionId];

    this._renderPlayerTabs(pi);

    const powerFill = $('#power-fill');
    const powerValue = $('#power-value');
    if (powerFill) powerFill.style.width = `${Math.min(100, (player.power / 30) * 100)}%`;
    if (powerFill) powerFill.style.background = `linear-gradient(90deg, ${faction.colorDark}, ${faction.color})`;
    if (powerValue) powerValue.textContent = player.power;

    const doomFill = $('#doom-fill');
    const doomValue = $('#doom-value');
    if (doomFill) doomFill.style.width = `${Math.min(100, (player.doom / GAME_CONFIG.DOOM_VICTORY_THRESHOLD) * 100)}%`;
    if (doomValue) doomValue.textContent = player.doom;

    this._renderUnitRoster(player, faction);
    this._renderSpellbooks(player, faction);
  }

  _renderPlayerTabs(activeIndex) {
    const container = $('#player-tabs');
    if (!container) return;
    container.innerHTML = '';
    this.gameState.state.players.forEach((p, i) => {
      const faction = FACTIONS[p.factionId];
      const tab = createElement('button', {
        class: `player-tab ${i === activeIndex ? 'active' : ''}`,
        style: i === activeIndex ? `border-bottom-color: ${faction.color}; color: ${faction.color}` : '',
        click: () => this._showPlayerInfo(i)
      }, [faction.name.split(' ')[0]]);
      container.appendChild(tab);
    });
  }

  _showPlayerInfo(playerIndex) {
    const player = this.gameState.getPlayer(playerIndex);
    const faction = FACTIONS[player.factionId];
    this._renderPlayerTabs(playerIndex);
    const powerFill = $('#power-fill');
    const powerValue = $('#power-value');
    if (powerFill) { powerFill.style.width = `${Math.min(100, (player.power / 30) * 100)}%`; powerFill.style.background = `linear-gradient(90deg, ${faction.colorDark}, ${faction.color})`; }
    if (powerValue) powerValue.textContent = player.power;
    const doomFill = $('#doom-fill');
    const doomValue = $('#doom-value');
    if (doomFill) doomFill.style.width = `${Math.min(100, (player.doom / GAME_CONFIG.DOOM_VICTORY_THRESHOLD) * 100)}%`;
    if (doomValue) doomValue.textContent = player.doom;
    this._renderUnitRoster(player, faction);
    this._renderSpellbooks(player, faction);
  }

  _renderUnitRoster(player, faction) {
    const container = $('#unit-roster');
    if (!container) return;
    container.innerHTML = '';
    
    const onMap = {};
    for (const units of Object.values(player.units)) {
      for (const u of units) {
        onMap[u.unitType] = (onMap[u.unitType] || 0) + 1;
      }
    }
    
    const allUnitTypes = Object.keys(faction.units || {});
    for (const unitKey of allUnitTypes) {
      const unitDef = faction.units[unitKey];
      const mapCount = onMap[unitKey] || 0;
      const poolCount = player.pool[unitKey] || 0;
      const maxCount = unitDef.count || unitDef.maxPool || 6;
      const card = createElement('div', { class: 'unit-card' }, [
        createElement('div', { class: 'unit-icon' }, [UNIT_ICONS[unitKey] || '?']),
        createElement('div', { class: 'unit-name' }, [unitDef.name]),
        createElement('div', { class: 'unit-count mono' }, [`${mapCount}/${maxCount}`]),
      ]);
      container.appendChild(card);
    }
    
    const goos = faction.greatOldOne ? [faction.greatOldOne] : (faction.greatOldOnes ? Object.values(faction.greatOldOnes) : []);
    goos.forEach(goo => {
      const isAwakened = goo.id === 'hastur' ? player.hasturAwakened : player.greatOldOneAwakened;
      const gooCard = createElement('div', { class: `unit-card ${isAwakened ? 'awakened' : ''}` }, [
        createElement('div', { class: 'unit-icon' }, [UNIT_ICONS[goo.id] || '🐙']),
        createElement('div', { class: 'unit-name' }, [goo.name]),
        createElement('div', { class: 'unit-count mono' }, [isAwakened ? 'ON MAP' : 'SLEEPING']),
      ]);
      if (isAwakened) gooCard.style.borderColor = faction.color;
      container.appendChild(gooCard);
    });
  }

  _renderSpellbooks(player, faction) {
    const container = $('#spellbook-list');
    if (!container) return;
    container.innerHTML = '';
    const spellbookList = Array.isArray(faction.spellbooks) ? faction.spellbooks : Object.values(faction.spellbooks || {});
    
    spellbookList.forEach((sb, i) => {
      const unlocked = player.spellbooksUnlocked[i];
      const item = createElement('div', { class: `spellbook-item ${unlocked ? 'unlocked' : 'locked'}` }, [
        createElement('span', { class: 'spellbook-icon' }, [unlocked ? '🔓' : '🔒']),
        createElement('div', {}, [
          createElement('div', { class: 'spellbook-name' }, [sb.name]),
          createElement('div', { class: 'spellbook-condition', style: 'font-size:0.7rem;opacity:0.6' }, [sb.unlock || sb.unlockCondition]),
        ]),
      ]);
      if (unlocked) item.style.borderLeftColor = faction.color;
      container.appendChild(item);
    });
  }

  // ========== ACTION BAR ==========
  updateActionBar(playerIndex, availableActions) {
    const bar = $('#action-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const actions = [
      { id: 'move', icon: '🚶', label: 'Move', cost: '1/unit' },
      { id: 'battle', icon: '⚔️', label: 'Battle', cost: '1' },
      { id: 'build_gate', altId: 'buildGate', icon: '🏗️', label: 'Gate', cost: '3' },
      { id: 'recruit', icon: '👤', label: 'Recruit', cost: '1' },
      { id: 'summon', icon: '👹', label: 'Summon', cost: 'var' },
      { id: 'awaken', icon: '🐙', label: 'Awaken', cost: 'var' },
      { id: 'capture', icon: '🔗', label: 'Capture', cost: '1' },
      { id: 'pass', icon: '⏭️', label: 'Pass', cost: '0' },
    ];
    for (const action of actions) {
      const available = availableActions.includes(action.id) || (action.altId && availableActions.includes(action.altId));
      const btn = createElement('button', {
        class: `action-btn ${action.id === 'pass' ? 'pass-btn' : ''} ${!available ? 'disabled' : ''}`,
        disabled: !available,
        click: () => { 
          if (this._actionResolver) { 
            this._actionResolver(action.id); 
            this._actionResolver = null; 
          } 
        },
      }, [
        createElement('span', { class: 'action-icon' }, [action.icon]),
        createElement('span', { class: 'action-label' }, [action.label]),
        createElement('span', { class: 'action-cost mono' }, [action.cost]),
      ]);
      bar.appendChild(btn);
    }
  }

  // ========== PROMPT METHODS ==========
  
  async checkPhaseLoops() {
    if (this._phaseLoopRunning) return;
    this._phaseLoopRunning = true;
    
    try {
      const state = this.gameState.state;
      const pi = state.currentPlayerIndex;
      const player = this.gameState.getCurrentPlayer();
      
      if (state.phase === 'DETERMINE_FIRST_PLAYER') {
        const p0 = this.gameState.getPlayer(0);
        const p1 = this.gameState.getPlayer(1);
        const p2 = this.gameState.getPlayer(2);
        const p3 = this.gameState.getPlayer(3);
        const players = [p0, p1, p2, p3].filter(Boolean);
        const maxPower = Math.max(...players.map(p => p.power));
        const candidates = players.filter(p => p.power === maxPower).map(p => p.id);
        
        let firstPlayer = candidates[0];
        if (candidates.length > 1) {
          firstPlayer = await this.promptChoosePlayer(candidates, `Choose First Player (tied at ${maxPower} Power)`);
        }
        applyAction(this.gameState, { type: 'SELECT_FIRST_PLAYER', playerIndex: pi, payload: { targetPlayerIndex: firstPlayer } });
        
        const direction = await this.promptChooseDirection();
        applyAction(this.gameState, { type: 'CHOOSE_DIRECTION', playerIndex: firstPlayer, payload: { direction } });
        
      } else if (state.phase === 'DOOM') {
        if (this.gameState.canRitual(pi)) {
          const doRitual = await this.promptConfirmation(`${FACTIONS[player.factionId].name}: Perform Ritual of Annihilation? (Cost: ${this.gameState.getRitualCost()} Power)`);
          if (doRitual) {
            applyAction(this.gameState, { type: 'PERFORM_RITUAL', playerIndex: pi });
          } else {
            applyAction(this.gameState, { type: 'SKIP_RITUAL', playerIndex: pi });
          }
        } else {
          applyAction(this.gameState, { type: 'SKIP_RITUAL', playerIndex: pi });
        }
        
      } else if (state.phase === 'ACTION') {
        if (state.combat) {
           await this.handleCombatFlow();
        } else if (player && !player.hasPassed) {
          const availableActions = this.gameState.getAvailableActions(pi);
          const chosenAction = await this.promptActionSelection(pi, availableActions);
          if (chosenAction) {
            let actionObj = await this.buildAction(chosenAction, pi);
            if (actionObj) {
              applyAction(this.gameState, actionObj);
            }
          }
        } else if (player && player.hasPassed) {
           // Skip if passed
           applyAction(this.gameState, { type: 'PASS', playerIndex: pi });
        }
      }
    } finally {
      this._phaseLoopRunning = false;
      // Re-check in case phase changed synchronously
      setTimeout(() => this.checkPhaseLoops(), 100);
    }
  }
  
  async handleCombatFlow() {
    const combat = this.gameState.state.combat;
    const pi = this.gameState.state.currentPlayerIndex;
    
    // We need a CombatEngine for logic
    const combatEngine = new CombatEngine(this.gameState);
    
    if (combat.step === 'WAGER_PHASE') {
       // Only prompt human players. For now, assume current player is human
       const wagers = combat.wagers;
       if (combat.attacker === pi && !combat.attackerWagered) {
          const wager = await this.promptWager(pi, `Attacker: Place your wager in $CTHULHU`);
          if (wager !== null) {
            applyAction(this.gameState, { type: 'SUBMIT_WAGER', playerIndex: pi, payload: { amount: wager } });
          }
       } else if (combat.defender === pi && !combat.defenderWagered) {
          const wager = await this.promptWager(pi, `Defender: Place your wager in $CTHULHU`);
          if (wager !== null) {
            applyAction(this.gameState, { type: 'SUBMIT_WAGER', playerIndex: pi, payload: { amount: wager } });
          }
       }
    } else if (combat.step === 'WAITING_FOR_REFEREE') {
      if (combat.attacker === pi) {
         if (!this._refereeInitialized) {
            this.showToast('Initializing On-Chain Referee...', null);
            await this.refereeClient.initializeEphemeralWallet();
            this._refereeInitialized = true;
         }

         this.showToast('Waiting for Solana On-Chain Referee...', null);
         try {
            const gameId = this.gameState.state.id || 'local-game';
            const combatId = `${combat.region}-${Date.now()}`;
            
            const atkDice = combatEngine.calculateCombatDice(combat.attacker, combat.region);
            const defDice = combatEngine.calculateCombatDice(combat.defender, combat.region);
            
            // We just ask the referee for all the dice needed (attacker + defender combined)
            const totalDice = atkDice + defDice;
            
            const rollsBuffer = await this.refereeClient.rollDice(gameId, combatId, totalDice);
            const allRolls = Array.from(rollsBuffer);
            
            const attackerRolls = allRolls.slice(0, atkDice);
            const defenderRolls = allRolls.slice(atkDice);
            
            applyAction(this.gameState, { 
              type: 'RECEIVE_ROLLS', 
              playerIndex: pi, 
              payload: { attackerRolls, defenderRolls } 
            });
         } catch (err) {
            console.error('Referee failed, falling back to local rolls:', err);
            // Fallback: pass empty to let engine generate locally if Solana fails
            applyAction(this.gameState, { 
              type: 'RECEIVE_ROLLS', 
              playerIndex: pi, 
              payload: { attackerRolls: null, defenderRolls: null } 
            });
         }
      }
    } else if (combat.step === 'ASSIGN_KILLS') {
       if (!combat.attackerKillsAssigned && combat.attacker === pi) {
           const killCount = Math.min(combat.results.defenderKills, this.gameState.getUnitsInRegion(combat.region, pi).length);
           const units = this.gameState.getUnitsInRegion(combat.region, pi);
           const killed = await this.promptUnitSelection(units, `Attacker: select ${killCount} unit(s) to kill`, killCount);
           if (killed) {
              applyAction(this.gameState, { type: 'ASSIGN_KILLS', playerIndex: pi, payload: { unitIds: killed.map(u => u.id) } });
           }
       } else if (!combat.defenderKillsAssigned && combat.defender === pi) {
           const killCount = Math.min(combat.results.attackerKills, this.gameState.getUnitsInRegion(combat.region, pi).length);
           const units = this.gameState.getUnitsInRegion(combat.region, pi);
           const killed = await this.promptUnitSelection(units, `Defender: select ${killCount} unit(s) to kill`, killCount);
           if (killed) {
              applyAction(this.gameState, { type: 'ASSIGN_KILLS', playerIndex: pi, payload: { unitIds: killed.map(u => u.id) } });
           }
       }
    } else if (combat.step === 'ASSIGN_PAINS') {
       if (!combat.attackerPainsAssigned && combat.attacker === pi) {
           const retreatOpts = combatEngine.getPainRetreatOptions(pi, combat.region, combat.defender);
           const retreats = [];
           for (const opt of retreatOpts) {
              if (opt.mustDie) continue; // Will be handled by engine
              const dest = await this.promptRegionSelection(opt.validDestinations, `Select retreat destination for ${opt.unitType}`);
              if (dest) retreats.push({ unitId: opt.unitId, toRegion: dest });
           }
           applyAction(this.gameState, { type: 'ASSIGN_PAINS', playerIndex: pi, payload: { retreats } });
       } else if (!combat.defenderPainsAssigned && combat.defender === pi) {
           const retreatOpts = combatEngine.getPainRetreatOptions(pi, combat.region, combat.attacker);
           const retreats = [];
           for (const opt of retreatOpts) {
              if (opt.mustDie) continue; // Will be handled by engine
              const dest = await this.promptRegionSelection(opt.validDestinations, `Select retreat destination for ${opt.unitType}`);
              if (dest) retreats.push({ unitId: opt.unitId, toRegion: dest });
           }
           applyAction(this.gameState, { type: 'ASSIGN_PAINS', playerIndex: pi, payload: { retreats } });
       }
    }
  }

  async buildAction(actionId, pi) {
    if (actionId === 'pass') return { type: 'PASS', playerIndex: pi };
    
    if (actionId === 'move') {
      const allUnits = this.gameState.getAllPlayerUnitsOnMap(pi);
      const regionsWithUnits = Object.keys(allUnits);
      if (regionsWithUnits.length === 0) return null;

      const fromRegion = await this.promptRegionSelection(regionsWithUnits, 'Select region to move FROM');
      if (!fromRegion) return null;

      const units = allUnits[fromRegion];
      const selectedUnits = await this.promptUnitSelection(units, 'Select units to move', units.length);
      if (!selectedUnits || selectedUnits.length === 0) return null;

      const cost = selectedUnits.length * GAME_CONFIG.MOVE_COST_PER_UNIT;
      if (this.gameState.getPlayer(pi).power < cost) {
        this.showToast('Not enough Power!', null);
        return null;
      }

      const adjacent = this.gameState.getAdjacentRegions(fromRegion);
      const toRegion = await this.promptRegionSelection(adjacent, 'Select destination');
      if (!toRegion) return null;

      return { type: 'MOVE', playerIndex: pi, payload: { unitIds: selectedUnits.map(u => u.id), fromRegion, toRegion } };
    }
    
    if (actionId === 'battle') {
      const combatEngine = new CombatEngine(this.gameState);
      const battleRegions = combatEngine.getBattleRegions(pi);
      if (battleRegions.length === 0) return null;
      
      const region = await this.promptRegionSelection(battleRegions, 'Select region for Battle');
      if (!region) return null;
      
      const enemies = this.gameState.state.players
        .filter(p => p.id !== pi && this.gameState.getUnitsInRegion(region, p.id).length > 0)
        .map(p => p.id);

      let defenderId;
      if (enemies.length === 1) defenderId = enemies[0];
      else defenderId = await this.promptChoosePlayer(enemies, 'Choose defender');
      if (defenderId === undefined || defenderId === null) return null;
      
      return { type: 'BATTLE', playerIndex: pi, payload: { defenderId, region } };
    }
    
    if (actionId === 'buildGate' || actionId === 'build_gate') {
      const playerUnits = this.gameState.getAllPlayerUnitsOnMap(pi);
      const validRegions = Object.keys(playerUnits).filter(regionId => {
        const hasCultist = playerUnits[regionId].some(u => u.unitType === 'cultist');
        const gateless = !this.gameState.state.map[regionId]?.gate;
        return hasCultist && gateless;
      });

      if (validRegions.length === 0) return null;
      const region = await this.promptRegionSelection(validRegions, 'Select region to build Gate');
      if (!region) return null;
      return { type: 'BUILD_GATE', playerIndex: pi, payload: { region } };
    }
    
    if (actionId === 'recruit') {
      const playerUnits = this.gameState.getAllPlayerUnitsOnMap(pi);
      const validRegions = Object.keys(playerUnits);
      if (validRegions.length === 0) return null;

      const region = await this.promptRegionSelection(validRegions, 'Select region to recruit Cultist');
      if (!region) return null;
      return { type: 'RECRUIT', playerIndex: pi, payload: { region } };
    }
    
    if (actionId === 'summon') {
      const validRegions = this.gameState.getControlledGates(pi);
      if (validRegions.length === 0) return null;

      const region = await this.promptRegionSelection(validRegions, 'Select Gate to summon at');
      if (!region) return null;
      
      const player = this.gameState.getPlayer(pi);
      const faction = FACTIONS[player.factionId];
      const monsterChoices = [];

      for (const [unitType, count] of Object.entries(player.pool)) {
        if (unitType !== 'cultist' && unitType !== 'goo' && count > 0) {
          const uDef = faction?.units?.[unitType];
          if (uDef) {
            monsterChoices.push({ id: unitType, unitType, name: uDef.name, cost: uDef.cost });
          }
        }
      }

      if (monsterChoices.length === 0) return null;
      
      const monsterSelection = await this.promptUnitSelection(monsterChoices, 'Select monster to summon', 1);
      if (!monsterSelection || monsterSelection.length === 0) return null;
      return { type: 'SUMMON', playerIndex: pi, payload: { region, unitType: monsterSelection[0].unitType, cost: monsterSelection[0].cost } };
    }
    
    if (actionId === 'awaken') {
      const validRegions = this.gameState.getControlledGates(pi);
      if (validRegions.length === 0) return null;

      const player = this.gameState.getPlayer(pi);
      const faction = FACTIONS[player.factionId];
      const gooDef = faction?.greatOldOne || faction?.greatOldOnes?.[Object.keys(faction?.greatOldOnes || {})[0]];
      if (!gooDef) return null;

      const region = await this.promptRegionSelection(validRegions, `Select Gate to awaken ${gooDef.name}`);
      if (!region) return null;
      
      const cost = gooDef.awakenCost || 10;
      return { type: 'AWAKEN', playerIndex: pi, payload: { region, unitType: gooDef.id, cost } };
    }
    
    if (actionId === 'capture') {
      const playerUnits = this.gameState.getAllPlayerUnitsOnMap(pi);
      const validRegions = Object.keys(playerUnits).filter(regionId => {
        const hasMonsterOrGoo = playerUnits[regionId].some(u => u.unitType !== 'cultist');
        if (!hasMonsterOrGoo) return false;

        return this.gameState.state.players.some(enemy => {
          if (enemy.id === pi) return false;
          const enemyUnits = this.gameState.getUnitsInRegion(regionId, enemy.id);
          const hasEnemyCultist = enemyUnits.some(u => u.unitType === 'cultist');
          const hasEnemyProtector = enemyUnits.some(u => u.unitType !== 'cultist');
          return hasEnemyCultist && !hasEnemyProtector;
        });
      });

      if (validRegions.length === 0) return null;
      const region = await this.promptRegionSelection(validRegions, 'Select region to capture Cultist');
      if (!region) return null;
      
      const enemyCandidates = this.gameState.state.players
        .filter(enemy => {
          if (enemy.id === pi) return false;
          const enemyUnits = this.gameState.getUnitsInRegion(region, enemy.id);
          return enemyUnits.some(u => u.unitType === 'cultist') && !enemyUnits.some(u => u.unitType !== 'cultist');
        })
        .map(e => e.id);

      let targetPlayerIndex;
      if (enemyCandidates.length === 1) targetPlayerIndex = enemyCandidates[0];
      else targetPlayerIndex = await this.promptChoosePlayer(enemyCandidates, 'Choose enemy to capture from');
      if (targetPlayerIndex === undefined || targetPlayerIndex === null) return null;
      
      const victimUnits = this.gameState.getUnitsInRegion(region, targetPlayerIndex);
      const victimCultist = victimUnits.find(u => u.unitType === 'cultist');
      if (!victimCultist) return null;

      return { type: 'CAPTURE', playerIndex: pi, payload: { region, targetPlayerIndex, unitId: victimCultist.id } };
    }

    return null;
  }
  
  async promptActionSelection(playerIndex, availableActions) {
    this.updateActionBar(playerIndex, availableActions);
    return new Promise(resolve => { this._actionResolver = resolve; });
  }

  async promptRegionSelection(validRegionIds, message) {
    this.showToast(`👉 ${message} (Click a highlighted green region)`, null);
    this.mapRenderer.clearHighlights();
    this.mapRenderer.highlightRegions(validRegionIds, 'valid-target');
    
    return new Promise(resolve => {
      let escHandler = null;
      
      const handler = (regionId) => {
        if (validRegionIds.includes(regionId)) {
          this.mapRenderer.clearHighlights();
          this.mapRenderer.offRegionClick(handler);
          if (escHandler) document.removeEventListener('keydown', escHandler);
          resolve(regionId);
        } else {
          this.showToast(`⚠️ Invalid selection! Please click a highlighted green region.`, null);
        }
      };
      
      escHandler = (e) => {
        if (e.key === 'Escape') {
          this.mapRenderer.clearHighlights();
          this.mapRenderer.offRegionClick(handler);
          document.removeEventListener('keydown', escHandler);
          resolve(null);
        }
      };
      
      document.addEventListener('keydown', escHandler);
      this.mapRenderer.onRegionClick(handler);
    });
  }

  async promptUnitSelection(units, message, maxSelect) {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(units); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, [message]));
      
      const selected = new Set();
      const unitButtons = [];
      
      for (const unit of units) {
        const uType = unit.unitType || unit.type || 'unit';
        const btn = createElement('button', {
          class: 'unit-select-btn',
          click: () => {
            if (selected.has(unit.id)) {
              selected.delete(unit.id);
              removeClass(btn, 'selected');
            } else if (selected.size < maxSelect) {
              selected.add(unit.id);
              addClass(btn, 'selected');
            }
            confirmBtn.disabled = selected.size === 0;
          }
        }, [
          createElement('span', { class: 'unit-icon' }, [UNIT_ICONS[uType] || '?']),
          createElement('span', {}, [(unit.name || uType).replace(/_/g, ' ')]),
        ]);
        unitButtons.push(btn);
        container.appendChild(btn);
      }
      
      const selectAllBtn = createElement('button', { class: 'btn', click: () => {
        units.forEach(u => selected.add(u.id));
        unitButtons.forEach(b => addClass(b, 'selected'));
        confirmBtn.disabled = false;
      }}, ['Select All']);
      
      const confirmBtn = createElement('button', { class: 'btn start-btn', disabled: true, click: () => {
        removeClass(modal, 'active');
        resolve(units.filter(u => selected.has(u.id)));
      }}, ['Confirm']);
      
      const cancelBtn = createElement('button', { class: 'btn', click: () => {
        removeClass(modal, 'active');
        resolve(null);
      }}, ['Cancel']);
      
      const btnRow = createElement('div', { style: 'display:flex;gap:8px;margin-top:16px;justify-content:center' }, [selectAllBtn, confirmBtn, cancelBtn]);
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  async promptConfirmation(message) {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(true); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, [message]));
      const btnRow = createElement('div', { style: 'display:flex;gap:12px;margin-top:20px;justify-content:center' });
      btnRow.appendChild(createElement('button', { class: 'btn start-btn', click: () => { removeClass(modal, 'active'); resolve(true); } }, ['Yes']));
      btnRow.appendChild(createElement('button', { class: 'btn', click: () => { removeClass(modal, 'active'); resolve(false); } }, ['No']));
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  async promptChooseDirection() {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(1); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, ['Choose Turn Direction']));
      const btnRow = createElement('div', { style: 'display:flex;gap:12px;margin-top:20px;justify-content:center' });
      btnRow.appendChild(createElement('button', { class: 'btn start-btn', click: () => { removeClass(modal, 'active'); resolve(1); } }, ['↻ Clockwise']));
      btnRow.appendChild(createElement('button', { class: 'btn', click: () => { removeClass(modal, 'active'); resolve(-1); } }, ['↺ Counter-Clockwise']));
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  async promptChoosePlayer(playerIndices, message) {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(playerIndices[0]); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, [message]));
      const btnRow = createElement('div', { style: 'display:flex;gap:12px;margin-top:20px;justify-content:center;flex-wrap:wrap' });
      for (const pi of playerIndices) {
        const p = this.gameState.getPlayer(pi);
        const f = FACTIONS[p.factionId];
        btnRow.appendChild(createElement('button', { 
          class: 'btn', 
          style: `border-color:${f.color};color:${f.color}`,
          click: () => { removeClass(modal, 'active'); resolve(pi); } 
        }, [f.name]));
      }
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  async promptWager(playerIndex, message) {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(0); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      
      const p = this.gameState.getPlayer(playerIndex);
      const f = FACTIONS[p.factionId];
      
      // Get balance if available
      let balance = 0;
      if (p.walletAddress && window.app && window.app.playerStore) {
        balance = window.app.playerStore.getProfile(p.walletAddress)?.balance || 0;
      }
      
      const container = createElement('div', { class: 'selection-container glass', style: `border-top: 4px solid ${f.color}` });
      container.appendChild(createElement('h3', { style: `color: ${f.color}` }, [message]));
      
      container.appendChild(createElement('div', { style: 'margin: 10px 0; font-size: 0.9rem; opacity: 0.8;' }, [
        `Your Balance: `,
        createElement('strong', { style: 'color: #00e676;' }, [`🪙 ${balance} $CTHULHU`])
      ]));
      
      const wagerAmounts = [0, 50, 100, 250, 500, 'ALL'];
      const btnRow = createElement('div', { style: 'display:flex;gap:12px;margin-top:20px;justify-content:center;flex-wrap:wrap' });
      
      for (const amt of wagerAmounts) {
        const amount = amt === 'ALL' ? balance : amt;
        const btn = createElement('button', { 
          class: 'btn', 
          disabled: amount > balance,
          click: () => { removeClass(modal, 'active'); resolve(amount); } 
        }, [amt === 0 ? 'No Wager' : `🪙 ${amt}`]);
        
        if (amount > balance) {
          btn.style.opacity = '0.3';
        }
        btnRow.appendChild(btn);
      }
      
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  // ========== PHASE BANNER ==========
  async showPhaseBanner(phaseName) {
    const banner = $('#phase-banner');
    if (!banner) return;
    banner.textContent = phaseName;
    show(banner);
    banner.style.animation = 'none';
    banner.offsetHeight;
    banner.style.animation = 'fade-in 0.3s ease-out';
    await new Promise(r => setTimeout(r, 1200));
    banner.style.animation = 'fade-out 0.4s ease-in forwards';
    await new Promise(r => setTimeout(r, 400));
    hide(banner);
  }

  // ========== TOAST ==========
  showToast(message, factionId) {
    const existing = $('.toast');
    if (existing) existing.remove();
    const faction = factionId ? FACTIONS[factionId] : null;
    const toast = createElement('div', { class: 'toast' }, [message]);
    if (faction) toast.style.borderLeftColor = faction.color;
    document.body.appendChild(toast);
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      addClass(toast, 'fading');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ========== GAME LOG ==========
  addLogEntry(data) {
    const log = $('#game-log');
    if (!log) return;
    const entryMsg = typeof data === 'string' ? data : data.msg;
    const factionId = typeof data === 'string' ? null : data.factionId;
    const faction = factionId ? FACTIONS[factionId] : null;
    const entry = createElement('div', { class: 'log-entry' });
    if (faction) {
      entry.innerHTML = `<span class="log-faction" style="color:${faction.color}">${faction.name}:</span> ${entryMsg}`;
    } else {
      entry.textContent = entryMsg;
    }
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  
  
  async showCombatModal(battleResult) {
    const modal = $('#combat-modal');
    if (!modal) return;
    addClass(modal, 'active');
    
    const attackerFaction = FACTIONS[this.gameState.getPlayer(battleResult.attacker.playerIndex).factionId];
    const defenderFaction = FACTIONS[this.gameState.getPlayer(battleResult.defender.playerIndex).factionId];
    const region = MAP_REGIONS[battleResult.regionId];
    
    const renderDie = (r) => {
      const type = r === 6 ? 'kill' : r >= 4 ? 'pain' : 'miss';
      const label = r === 6 ? 'KILL' : r >= 4 ? 'PAIN' : 'MISS';
      return `<div class="die ${type}"><span>${r}</span><span class="die-label">${label}</span></div>`;
    };

    modal.innerHTML = `
      <div class="combat-container glass">
        <div style="text-align:center;margin-bottom:12px">
          <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.15);color:#10b981;padding:4px 12px;border-radius:20px;border:1px solid rgba(16,185,129,0.4);font-size:0.8rem;font-weight:600">
            🛡️ Solana On-Chain Referee Verified
          </div>
        </div>
        <div class="combat-header">⚔️ Battle in ${region ? region.name : battleResult.regionId} ⚔️</div>
        <div class="combat-sides">
          <div class="combat-side attacker" style="border-top:3px solid ${attackerFaction.color}">
            <h4 style="color:${attackerFaction.color}">${attackerFaction.name} (Attacker)</h4>
            <div class="combat-units">${battleResult.attacker.units.map(u => UNIT_ICONS[u.unitType] || '👤').join(' ')}</div>
            <div class="combat-dice-count mono">${battleResult.attacker.dice} dice</div>
            <div id="attacker-dice" class="dice-area" style="display:flex;gap:6px;justify-content:center;margin-top:8px">
              ${battleResult.attacker.rolls.map(r => renderDie(r)).join('')}
            </div>
          </div>
          <div class="vs-divider" style="display:flex;align-items:center;font-size:1.8rem;opacity:0.3">VS</div>
          <div class="combat-side defender" style="border-top:3px solid ${defenderFaction.color}">
            <h4 style="color:${defenderFaction.color}">${defenderFaction.name} (Defender)</h4>
            <div class="combat-units">${battleResult.defender.units.map(u => UNIT_ICONS[u.unitType] || '👤').join(' ')}</div>
            <div class="combat-dice-count mono">${battleResult.defender.dice} dice</div>
            <div id="defender-dice" class="dice-area" style="display:flex;gap:6px;justify-content:center;margin-top:8px">
              ${battleResult.defender.rolls.map(r => renderDie(r)).join('')}
            </div>
          </div>
        </div>
        <div id="combat-results" class="combat-results" style="margin-top:16px;text-align:center">
          <div><span style="color:${attackerFaction.color}">${attackerFaction.name}</span> inflicts: <strong>${battleResult.attackerKills} Kills</strong>, <strong>${battleResult.attackerPains} Pains</strong></div>
          <div><span style="color:${defenderFaction.color}">${defenderFaction.name}</span> inflicts: <strong>${battleResult.defenderKills} Kills</strong>, <strong>${battleResult.defenderPains} Pains</strong></div>
        </div>
        <div style="text-align:center;margin-top:16px">
          <button id="combat-continue" class="btn start-btn" style="background:#10b981;color:#000;font-weight:bold;padding:10px 24px;border:none">Apply On-Chain Results</button>
        </div>
      </div>
    `;
    
    const continueBtn = document.getElementById('combat-continue');
    await new Promise(resolve => { continueBtn.onclick = () => { removeClass(modal, 'active'); resolve(); }; });
  }

  // ========== END SCREEN ==========
  showEndScreen(results, prizePot = 0) {
    const screen = $('#end-screen');
    if (!screen) return;
    addClass(screen, 'active');
    
    const winner = results[0]; // Assuming results are sorted winner-first by main.js
    const winnerFaction = winner ? FACTIONS[winner.factionId] : null;
    
    let scoresHTML = results.map((r, i) => {
      const f = FACTIONS[r.factionId];
      const isWinner = i === 0;
      return `<div class="score-row ${isWinner ? 'winner' : ''}" style="${isWinner ? `background:${f.color}15` : ''}">
        <span style="color:${f.color}">${isWinner ? '👑 ' : ''}${f.name}</span>
        <span class="mono">Doom: ${r.score} | Books: ${r.spellbooks}/6</span>
      </div>`;
    }).join('');
    
    let prizeHTML = '';
    if (prizePot > 0 && winnerFaction) {
      prizeHTML = `
        <div style="background: rgba(0,230,118,0.15); border: 1px solid #00e676; padding: 15px; border-radius: 10px; margin: 15px 0; text-align: center;">
          <h3 style="color: #00e676; margin: 0 0 5px 0;">🏆 ${winnerFaction.name} Wins the Prize Pot!</h3>
          <div style="color: #00e676; font-size: 1.8rem; font-weight: bold; text-shadow: 0 0 10px rgba(0,230,118,0.5)">🪙 +${prizePot} $CTHULHU</div>
          <div style="color: #ffab00; font-size: 0.85rem; margin-top: 6px;">⏳ Recorded in Wager Logs for Admin Payout / Claim</div>
        </div>
      `;
    }
    
    screen.innerHTML = `
      <div class="end-container glass" style="${winnerFaction ? `border: 2px solid ${winnerFaction.color}; box-shadow: 0 0 30px ${winnerFaction.color}40` : ''}">
        <div class="winner-title" style="color:${winnerFaction?.color || '#fff'}">
          ${winnerFaction ? `${UNIT_ICONS[winnerFaction.greatOldOne?.id || 'great_cthulhu'] || '🏆'} ${winnerFaction.name} Wins! ${UNIT_ICONS[winnerFaction.greatOldOne?.id || 'great_cthulhu'] || '🏆'}` : 'No Winner!'}
        </div>
        ${prizeHTML}
        <div class="final-scores">
          ${scoresHTML}
        </div>
        <button class="btn play-again-btn start-btn" style="margin-top:20px;width:100%" onclick="location.reload()">Play Again</button>
      </div>
    `;
  }

  // ========== RULEBOOK MODAL ==========
  showRulebookModal() {
    const modal = $('#rulebook-modal');
    if (!modal) return;
    addClass(modal, 'active');
    modal.style.display = 'grid';
    modal.innerHTML = `
      <div class="rulebook-container glass">
        <div class="rulebook-header">
          <h2>📜 Cthulhu Wars — Rules & Strategy Guide</h2>
          <button class="rulebook-close" id="close-rulebook">&times;</button>
        </div>
        <div class="rulebook-body">
          <section class="rule-section">
            <h3>🏆 Objective & Winning</h3>
            <p>To win Cthulhu Wars, you must reach <strong>30 Doom Points</strong> AND unlock <strong>ALL 6 Spellbooks</strong>. If you reach 30 Doom without 6 spellbooks, you cannot win until your 6th spellbook is unlocked.</p>
          </section>
          <section class="rule-section">
            <h3>⚡ Turn Phases</h3>
            <ul>
              <li><strong>1. Gather Power:</strong> Gain Power for Cultists (1), Gates (2), Abandoned Gates (1). Half-Power Catch-up rule applies.</li>
              <li><strong>2. First Player:</strong> Player with highest Power chooses turn direction.</li>
              <li><strong>3. Action Phase:</strong> Take turns spending Power to perform 1 Action at a time until all pass.</li>
              <li><strong>4. Doom Phase:</strong> Score +1 Doom per Gate, perform Ritual of Annihilation, draw Elder Signs.</li>
            </ul>
          </section>
          <section class="rule-section">
            <h3>🎮 Actions & Costs</h3>
            <ul>
              <li><strong>MOVE (1 Power / unit):</strong> Move units from a region to an adjacent region.</li>
              <li><strong>BUILD GATE (3 Power):</strong> Build an Eldritch Gate where you have a Cultist & no gate.</li>
              <li><strong>RECRUIT (1 Power):</strong> Recruit a Cultist at any controlled Gate.</li>
              <li><strong>SUMMON (1-3 Power):</strong> Summon Monsters at a controlled Gate.</li>
              <li><strong>AWAKEN (10 Power):</strong> Awaken your Great Old One (Cthulhu, Nyarlathotep, Hastur, Shub).</li>
              <li><strong>CAPTURE (1 Power):</strong> Capture an undefended enemy Cultist in a region where you have a Monster/GOO.</li>
              <li><strong>BATTLE (1 Power):</strong> Roll combat dice against enemies in the same territory.</li>
              <li><strong>PASS (0 Power):</strong> Pass turn for the rest of the Action Phase.</li>
            </ul>
          </section>
        </div>
      </div>
    `;
    const closeBtn = $('#close-rulebook');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
        removeClass(modal, 'active');
      };
    }
  }

  // ========== FULL UI REFRESH ==========
  updateUI() {
    this.updateHeader();
    this.updateFactionPanel();
    this.mapRenderer.updateAllRegions();
  }
}
