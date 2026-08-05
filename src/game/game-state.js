import EventEmitter from '../utils/events.js';
import { GAME_CONFIG, FACTIONS, MAP_REGIONS } from './constants.js';

/**
 * Central game state manager for Cthulhu Wars.
 */
export class GameState extends EventEmitter {
  constructor() {
    super();
    this.state = {
      round: 0,
      phase: 'SETUP',
      firstPlayerIndex: 0,
      turnDirection: 1,
      currentPlayerIndex: 0,
      ritualTrackPosition: 0,
      elderSignPool: [],
      gameLog: [],
      players: [],
      map: {}
    };
    this._nextUnitId = 1;
  }

  /**
   * Deep clones an object using JSON parse/stringify.
   * @param {any} obj 
   * @returns {any}
   */
  _clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Initializes the game state.
   * @param {Array<{walletAddress: string, factionId: string}>} playerConfigs 
   * @param {number} entryFee
   */
  initGame(playerConfigs = [], entryFee = 0) {
    this.state.elderSignPool = this._shuffle([...GAME_CONFIG.ELDER_SIGN_POOL]);
    this.state.players = playerConfigs.map((config, index) => {
      const faction = FACTIONS[config.factionId];
      const player = {
        id: index,
        walletAddress: config.walletAddress,
        factionId: config.factionId,
        power: GAME_CONFIG.STARTING_POWER || 8,
        doom: 0,
        elderSigns: [],
        hasPassed: false,
        hasPerformedRitual: false,
        spellbooksUnlocked: Array(6).fill(false),
        capturedCultists: [],
        units: {},
        pool: {},
        greatOldOneAwakened: false,
        hasturAwakened: false
      };

      // Set up unit pool
      if (faction && faction.units) {
        for (const [unitType, unitInfo] of Object.entries(faction.units)) {
          player.pool[unitType] = unitInfo.maxPool;
        }
      }

      // Place starting cultists
      player.units[faction.startRegion] = [];
      const startingCultistsCount = GAME_CONFIG.STARTING_CULTISTS || 6;
      for (let i = 0; i < startingCultistsCount; i++) {
        player.units[faction.startRegion].push({
          unitType: 'cultist',
          id: `u${this._nextUnitId++}`
        });
      }
      player.pool['cultist'] = Math.max(0, (player.pool['cultist'] || 6) - startingCultistsCount);

      return player;
    });

    // Initialize map
    this.state.map = {};
    for (const regionId of Object.keys(MAP_REGIONS)) {
      this.state.map[regionId] = { gate: null };
    }

    // Place starting gates
    this.state.players.forEach(player => {
      const faction = FACTIONS[player.factionId];
      if (faction && faction.startRegion) {
        this.state.map[faction.startRegion].gate = { owner: player.id };
      }
    });

    this.state.phase = 'GATHER_POWER';
    this.state.round = 1;
    this.state.currentPlayerIndex = this.state.firstPlayerIndex;
    this.state.entryFee = entryFee;
    this.state.prizePot = entryFee * this.state.players.length;
    
    this.emit('gameInitialized', this.getState());
  }

  // --- Getters ---

  getState() {
    return this._clone(this.state);
  }

  getCurrentPlayer() {
    return this._clone(this.state.players[this.state.currentPlayerIndex]);
  }

  getPlayer(idx) {
    return this._clone(this.state.players[idx]);
  }

  getPlayerByFaction(factionId) {
    const player = this.state.players.find(p => p.factionId === factionId);
    return player ? this._clone(player) : null;
  }

  getRegionState(regionId) {
    const regionUnits = {};
    this.state.players.forEach((p, idx) => {
      if (p.units[regionId] && p.units[regionId].length > 0) {
        regionUnits[idx] = this._clone(p.units[regionId]);
      }
    });
    return {
      gate: this.state.map[regionId]?.gate ? this._clone(this.state.map[regionId].gate) : null,
      units: regionUnits
    };
  }

  getUnitsInRegion(regionId, playerIndex) {
    const player = this.state.players[playerIndex];
    return player && player.units[regionId] ? this._clone(player.units[regionId]) : [];
  }

  getAllPlayerUnitsOnMap(playerIndex) {
    const player = this.state.players[playerIndex];
    if (!player) return {};
    const result = {};
    for (const [regionId, units] of Object.entries(player.units)) {
      if (units.length > 0) {
        result[regionId] = this._clone(units);
      }
    }
    return result;
  }

  getControlledGates(playerIndex) {
    return Object.keys(this.state.map).filter(
      regionId => this.state.map[regionId].gate?.owner === playerIndex
    );
  }

  getAbandonedGates() {
    return Object.keys(this.state.map).filter(
      regionId => this.state.map[regionId].gate?.owner === 'abandoned'
    );
  }

  isRegionAdjacent(a, b) {
    const adj = MAP_REGIONS[a]?.adj || MAP_REGIONS[a]?.adjacent || [];
    return adj.includes(b);
  }

  getAdjacentRegions(regionId) {
    return MAP_REGIONS[regionId]?.adj || MAP_REGIONS[regionId]?.adjacent || [];
  }

  getRitualCost() {
    return GAME_CONFIG.RITUAL_STARTING_COST + this.state.ritualTrackPosition;
  }

  getTotalSpellbooksUnlocked() {
    return this.state.players.reduce((sum, p) => sum + p.spellbooksUnlocked.filter(Boolean).length, 0);
  }

  getPlayerSpellbookCount(pi) {
    return this.state.players[pi]?.spellbooksUnlocked.filter(Boolean).length || 0;
  }

  hasAllSpellbooks(pi) {
    const player = this.state.players[pi];
    return player && player.spellbooksUnlocked.every(Boolean);
  }

  // --- Action Legality ---

  canMove(pi) {
    const player = this.state.players[pi];
    if (!player || player.power < 1) return false;
    return Object.values(player.units).some(units => units.length > 0);
  }

  canBattle(pi) {
    const player = this.state.players[pi];
    if (!player || player.power < 1) return false;
    
    // Check if player has units with combat in region with enemies
    return Object.keys(player.units).some(regionId => {
      const myUnits = player.units[regionId];
      if (!myUnits || myUnits.length === 0) return false;
      
      const hasCombatUnit = myUnits.some(u => {
        const unitDef = FACTIONS[player.factionId]?.units?.[u.unitType];
        return unitDef && unitDef.combat > 0;
      });
      if (!hasCombatUnit) return false;

      // Are there enemies?
      const otherPlayersPresent = this.state.players.some(p => p.id !== pi && p.units[regionId] && p.units[regionId].length > 0);
      return otherPlayersPresent;
    });
  }

  canBuildGate(pi) {
    const player = this.state.players[pi];
    if (!player || player.power < 3) return false;

    // Has cultist in gateless region
    return Object.entries(player.units).some(([regionId, units]) => {
      const hasCultist = units.some(u => u.unitType === 'cultist');
      const gateless = !this.state.map[regionId].gate;
      return hasCultist && gateless;
    });
  }

  canRecruit(pi) {
    const player = this.state.players[pi];
    if (!player || player.power < 1) return false;
    if ((player.pool['cultist'] || 0) <= 0) return false;
    return Object.values(player.units).some(units => units.length > 0); // has units on map
  }

  canSummon(pi) {
    const player = this.state.players[pi];
    if (!player) return false;
    const controlsGate = this.getControlledGates(pi).length > 0;
    if (!controlsGate) return false;

    let minCost = Infinity;
    let hasMonster = false;
    for (const [unitType, count] of Object.entries(player.pool)) {
      if (unitType !== 'cultist' && unitType !== 'goo' && count > 0) {
        const cost = FACTIONS[player.factionId]?.units?.[unitType]?.cost || Infinity;
        if (cost < minCost) minCost = cost;
        hasMonster = true;
      }
    }
    return hasMonster && player.power >= minCost;
  }

  canAwaken(pi) {
    const player = this.state.players[pi];
    if (!player || player.greatOldOneAwakened) return false;
    // Faction specific requirements not fully detailed here, but generally:
    const gooDef = FACTIONS[player.factionId]?.units?.['goo'];
    if (!gooDef) return false;
    return player.power >= (gooDef.cost || 8); 
  }

  canCapture(pi) {
    const player = this.state.players[pi];
    if (!player || player.power < 1) return false;

    return Object.entries(player.units).some(([regionId, units]) => {
      const hasMonsterOrGoo = units.some(u => u.unitType !== 'cultist');
      if (!hasMonsterOrGoo) return false;

      // Unprotected enemy cultist?
      return this.state.players.some(enemy => {
        if (enemy.id === pi) return false;
        const enemyUnits = enemy.units[regionId] || [];
        const hasEnemyCultist = enemyUnits.some(u => u.unitType === 'cultist');
        const hasEnemyProtector = enemyUnits.some(u => u.unitType !== 'cultist');
        return hasEnemyCultist && !hasEnemyProtector;
      });
    });
  }

  canRitual(pi) {
    const player = this.state.players[pi];
    return player && this.state.phase === 'DOOM' && player.power >= this.getRitualCost() && !player.hasPerformedRitual;
  }

  canPass(pi) {
    const player = this.state.players[pi];
    return player && this.state.phase === 'ACTION' && !player.hasPassed;
  }

  getAvailableActions(pi) {
    const actions = [];
    if (this.canMove(pi)) actions.push('move');
    if (this.canBattle(pi)) actions.push('battle');
    if (this.canBuildGate(pi)) actions.push('buildGate');
    if (this.canRecruit(pi)) actions.push('recruit');
    if (this.canSummon(pi)) actions.push('summon');
    if (this.canAwaken(pi)) actions.push('awaken');
    if (this.canCapture(pi)) actions.push('capture');
    if (this.canRitual(pi)) actions.push('ritual');
    if (this.canPass(pi)) actions.push('pass');
    return actions;
  }

  // --- State Mutations ---

  setPhase(phase) {
    this.state.phase = phase;
    this.emit('phaseChange', phase);
  }

  advanceRound() {
    this.state.round++;
    this.emit('roundChange', this.state.round);
  }

  setFirstPlayer(idx, direction = 1) {
    this.state.firstPlayerIndex = idx;
    this.state.turnDirection = direction;
    this.emit('firstPlayerChange', { index: idx, direction });
  }

  setCurrentPlayer(idx) {
    this.state.currentPlayerIndex = idx;
    this.emit('turnChange', idx);
  }

  modifyPower(pi, amount) {
    const player = this.state.players[pi];
    if (!player) return;
    player.power = Math.max(0, player.power + amount);
    this.emit('powerChange', { playerIndex: pi, power: player.power, delta: amount });
  }

  modifyDoom(pi, amount) {
    const player = this.state.players[pi];
    if (!player) return;
    player.doom += amount;
    this.emit('doomChange', { playerIndex: pi, doom: player.doom, delta: amount });
  }

  addElderSign(pi) {
    const player = this.state.players[pi];
    if (!player || this.state.elderSignPool.length === 0) return;
    const sign = this.state.elderSignPool.pop();
    player.elderSigns.push(sign);
    this.emit('elderSignGained', { playerIndex: pi, sign });
  }

  moveUnits(pi, unitIds, fromRegion, toRegion) {
    const player = this.state.players[pi];
    if (!player || !player.units[fromRegion]) return;
    
    if (!player.units[toRegion]) player.units[toRegion] = [];
    
    const unitsToMove = player.units[fromRegion].filter(u => unitIds.includes(u.id));
    player.units[fromRegion] = player.units[fromRegion].filter(u => !unitIds.includes(u.id));
    player.units[toRegion].push(...unitsToMove);
    
    this.emit('unitsMoved', { playerIndex: pi, unitIds, fromRegion, toRegion });
  }

  placeUnit(pi, unitType, regionId) {
    const player = this.state.players[pi];
    if (!player || player.pool[unitType] <= 0) return;
    
    player.pool[unitType]--;
    if (!player.units[regionId]) player.units[regionId] = [];
    
    const newUnit = { unitType, id: `u${this._nextUnitId++}` };
    player.units[regionId].push(newUnit);
    
    this.emit('unitPlaced', { playerIndex: pi, unitType, regionId, unitId: newUnit.id });
  }

  removeUnit(pi, unitId, regionId) {
    const player = this.state.players[pi];
    if (!player || !player.units[regionId]) return;
    
    const idx = player.units[regionId].findIndex(u => u.id === unitId);
    if (idx !== -1) {
      const unit = player.units[regionId][idx];
      player.units[regionId].splice(idx, 1);
      player.pool[unit.unitType] = (player.pool[unit.unitType] || 0) + 1;
      this.emit('unitRemoved', { playerIndex: pi, unitId, regionId });
    }
  }

  killUnit(pi, unitId, regionId) {
    const player = this.state.players[pi];
    if (!player || !player.units[regionId]) return;
    
    const idx = player.units[regionId].findIndex(u => u.id === unitId);
    if (idx !== -1) {
      const unit = player.units[regionId][idx];
      player.units[regionId].splice(idx, 1);
      player.pool[unit.unitType] = (player.pool[unit.unitType] || 0) + 1;
      this.emit('unitKilled', { playerIndex: pi, unitId, regionId });
    }
  }

  buildGate(pi, regionId) {
    if (this.state.map[regionId]) {
      this.state.map[regionId].gate = { owner: pi };
      this.emit('gateBuilt', { playerIndex: pi, regionId });
    }
  }

  setGateOwner(regionId, ownerIdx) {
    if (this.state.map[regionId] && this.state.map[regionId].gate) {
      this.state.map[regionId].gate.owner = ownerIdx;
    }
  }

  abandonGate(regionId) {
    if (this.state.map[regionId] && this.state.map[regionId].gate) {
      this.state.map[regionId].gate.owner = 'abandoned';
      this.emit('gateAbandoned', { regionId });
    }
  }

  captureCultist(captorIdx, victimIdx, regionId, unitId) {
    const victim = this.state.players[victimIdx];
    const captor = this.state.players[captorIdx];
    if (!victim || !captor || !victim.units[regionId]) return;

    const idx = victim.units[regionId].findIndex(u => u.id === unitId && u.unitType === 'cultist');
    if (idx !== -1) {
      const unit = victim.units[regionId].splice(idx, 1)[0];
      captor.capturedCultists.push({ victimIdx, unitType: unit.unitType });
      this.emit('cultistCaptured', { captorIdx, victimIdx, regionId, unitId });
    }
  }

  returnCapturedCultists(pi) {
    const player = this.state.players[pi];
    if (!player) return 0;
    
    let count = 0;
    const returnedByVictim = {};

    player.capturedCultists.forEach(c => {
      const victim = this.state.players[c.victimIdx];
      if (victim) {
        victim.pool[c.unitType] = (victim.pool[c.unitType] || 0) + 1;
        returnedByVictim[c.victimIdx] = (returnedByVictim[c.victimIdx] || 0) + 1;
        count++;
      }
    });

    player.capturedCultists = [];

    for (const [vIdx, vCount] of Object.entries(returnedByVictim)) {
      this.emit('cultistsReturned', { captorIdx: pi, victimIdx: parseInt(vIdx), count: vCount });
    }
    
    return count;
  }

  unlockSpellbook(pi, sbIdx) {
    const player = this.state.players[pi];
    if (player && sbIdx >= 0 && sbIdx < 6 && !player.spellbooksUnlocked[sbIdx]) {
      player.spellbooksUnlocked[sbIdx] = true;
      this.emit('spellbookUnlocked', { playerIndex: pi, spellbookIndex: sbIdx });
    }
  }

  setPlayerPassed(pi) {
    const player = this.state.players[pi];
    if (player && !player.hasPassed) {
      player.hasPassed = true;
      this.emit('playerPassed', pi);
    }
  }

  resetPassedFlags() {
    this.state.players.forEach(p => {
      p.hasPassed = false;
      p.hasPerformedRitual = false;
    });
  }

  advanceRitualTrack() {
    this.state.ritualTrackPosition++;
    this.emit('ritualAdvanced', this.state.ritualTrackPosition);
  }

  awakenGreatOldOne(pi, gooId) {
    const player = this.state.players[pi];
    if (!player) return;
    
    if (gooId === 'hastur') {
      player.hasturAwakened = true;
    } else {
      player.greatOldOneAwakened = true;
    }
    
    this.emit('gooAwakened', { playerIndex: pi, gooId });
  }

  addLogEntry(msg, factionId) {
    const entry = { msg, factionId, timestamp: Date.now() };
    this.state.gameLog.push(entry);
    this.emit('logEntry', entry);
  }

  checkGameEnd() {
    const doomWinner = this.state.players.find(p => p.doom >= 30);
    if (doomWinner) {
      return { gameOver: true, reason: 'doom_30' };
    }
    return { gameOver: false };
  }

  getFinalScores() {
    const scores = this.state.players.map(p => {
      const elderSignTotal = p.elderSigns.reduce((sum, s) => sum + s, 0);
      return {
        playerIndex: p.id,
        factionId: p.factionId,
        visibleDoom: p.doom,
        elderSignTotal,
        finalDoom: p.doom + elderSignTotal,
        eligible: p.spellbooksUnlocked.every(Boolean)
      };
    });

    scores.sort((a, b) => b.finalDoom - a.finalDoom);
    
    // Find highest eligible
    let maxEligibleDoom = -1;
    for (const s of scores) {
      if (s.eligible && s.finalDoom > maxEligibleDoom) {
        maxEligibleDoom = s.finalDoom;
      }
    }

    scores.forEach(s => {
      s.winner = s.eligible && s.finalDoom === maxEligibleDoom;
    });

    return scores;
  }

  // --- Turn Management ---

  getNextPlayerIndex() {
    let nextIdx = this.state.currentPlayerIndex;
    let checked = 0;
    while (checked < this.state.players.length) {
      nextIdx = (nextIdx + this.state.turnDirection + this.state.players.length) % this.state.players.length;
      if (!this.state.players[nextIdx].hasPassed) {
        return nextIdx;
      }
      checked++;
    }
    return -1;
  }

  allPlayersPassed() {
    return this.state.players.every(p => p.hasPassed);
  }

  advanceTurn() {
    const nextIdx = this.getNextPlayerIndex();
    if (nextIdx !== -1) {
      this.setCurrentPlayer(nextIdx);
    } else {
      // End of action phase logic would go here
    }
  }

  /**
   * Helper to shuffle an array
   * @param {Array} array 
   * @returns {Array}
   */
  _shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  }
}
