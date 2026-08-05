import { rollDice, interpretDice } from '../utils/random.js';
import { FACTIONS, GAME_CONFIG, MAP_REGIONS } from './constants.js';

export class CombatEngine {
  constructor(gameState) {
    this.gameState = gameState;
  }

  getBattleRegions(playerIndex) {
    const validRegions = [];
    const player = this.gameState.getPlayer(playerIndex);
    if (!player) return validRegions;
    
    for (const regionId of Object.keys(MAP_REGIONS)) {
      const myUnits = this.gameState.getUnitsInRegion(regionId, playerIndex);
      const otherUnitsExist = this.gameState.state.players.some(
        p => p.id !== playerIndex && (this.gameState.getUnitsInRegion(regionId, p.id).length > 0)
      );

      if (myUnits.length > 0 && otherUnitsExist) {
        const myCombatUnits = this.getUnitsWithCombat(playerIndex, regionId);
        if (myCombatUnits.length > 0) {
          validRegions.push(regionId);
        }
      }
    }
    return validRegions;
  }

  getUnitsWithCombat(playerIndex, regionId) {
    const player = this.gameState.getPlayer(playerIndex);
    if (!player) return [];
    
    const myUnits = this.gameState.getUnitsInRegion(regionId, playerIndex);
    if (!myUnits || myUnits.length === 0) return [];

    const combatUnits = [];
    const factionData = FACTIONS[player.factionId];

    // Faction specific tracking
    const undeadCount = myUnits.filter(u => u.unitType === 'undead').length;

    myUnits.forEach(unit => {
      let combat = 0;
      const unitData = factionData?.units?.[unit.unitType];
      
      if (unitData && typeof unitData.combat === 'number') {
        combat = unitData.combat;
      }

      // Special Rules
      if (player.factionId === 'cthulhu' && (unit.unitType === 'great_cthulhu' || unit.unitType === 'goo')) {
        combat = 6;
      }
      
      if (player.factionId === 'crawling_chaos' && (unit.unitType === 'nyarlathotep' || unit.unitType === 'goo')) {
        combat = this.gameState.getTotalSpellbooksUnlocked();
      }

      if (player.factionId === 'yellow_sign' && (unit.unitType === 'hastur' || unit.unitType === 'goo')) {
        combat = GAME_CONFIG.RITUAL_STARTING_COST + this.gameState.state.ritualTrackPosition;
      }

      if (player.factionId === 'black_goat' && (unit.unitType === 'shub_niggurath' || unit.unitType === 'goo')) {
        const controlledGates = this.gameState.getControlledGates(playerIndex).length;
        let cultists = 0;
        for (const rId of Object.keys(MAP_REGIONS)) {
          cultists += this.gameState.getUnitsInRegion(rId, playerIndex).filter(u => u.unitType === 'cultist').length;
        }
        combat = controlledGates + cultists;
      }
      
      if (player.factionId === 'yellow_sign' && unit.unitType === 'undead') {
        if (undeadCount === 1) combat = 0;
        else if (undeadCount === 2) combat = 1;
        else if (undeadCount >= 3) combat = 2;
      }

      if (player.factionId === 'black_goat' && unit.unitType === 'cultist' && player.spellbooksUnlocked[1]) { // Frenzy
        combat = 1;
      }

      if (combat > 0) {
        combatUnits.push({ ...unit, combatValue: combat });
      }
    });

    return combatUnits;
  }

  calculateCombatDice(playerIndex, regionId) {
    const units = this.getUnitsWithCombat(playerIndex, regionId);
    return units.reduce((total, unit) => total + unit.combatValue, 0);
  }

  resolveBattle(attackerIndex, defenderIndex, regionId, rng = Math.random) {
    const attacker = this.gameState.getPlayer(attackerIndex);
    const defender = this.gameState.getPlayer(defenderIndex);
    
    let devourTarget = null;
    const atkUnits = this.getUnitsWithCombat(attackerIndex, regionId);
    const defUnitsAll = this.gameState.getUnitsInRegion(regionId, defenderIndex);

    // Devour
    if (attacker.factionId === 'cthulhu' && atkUnits.some(u => u.unitType === 'great_cthulhu' || u.unitType === 'goo') && defUnitsAll.length > 0) {
      devourTarget = defUnitsAll[Math.floor(rng() * defUnitsAll.length)];
      this.gameState.killUnit(defenderIndex, devourTarget.id, regionId);
    }
    
    const atkDice = this.calculateCombatDice(attackerIndex, regionId);
    const defDice = this.calculateCombatDice(defenderIndex, regionId);

    const atkRolls = rollDice(atkDice, rng);
    const defRolls = rollDice(defDice, rng);

    const atkResults = interpretDice(atkRolls);
    const defResults = interpretDice(defRolls);

    return {
      regionId,
      attacker: {
        playerIndex: attackerIndex,
        units: atkUnits,
        dice: atkDice,
        rolls: atkRolls,
        kills: atkResults.kills,
        pains: atkResults.pains
      },
      defender: {
        playerIndex: defenderIndex,
        units: this.getUnitsWithCombat(defenderIndex, regionId),
        dice: defDice,
        rolls: defRolls,
        kills: defResults.kills,
        pains: defResults.pains
      },
      attackerKills: atkResults.kills,
      attackerPains: atkResults.pains,
      defenderKills: defResults.kills,
      defenderPains: defResults.pains,
      devourTarget: devourTarget ? { unitType: devourTarget.unitType, unitId: devourTarget.id } : null
    };
  }

  getKillAssignmentOptions(playerIndex, regionId) {
    return this.gameState.getUnitsInRegion(regionId, playerIndex);
  }

  getPainRetreatOptions(playerIndex, regionId, opponentIndex) {
    const myUnits = this.gameState.getUnitsInRegion(regionId, playerIndex);
    const adjacentIds = this.gameState.getAdjacentRegions(regionId);
    
    // Retreat destination cannot contain opponent's units
    const validDestinations = adjacentIds.filter(adjId => {
      const oppUnits = this.gameState.getUnitsInRegion(adjId, opponentIndex);
      return oppUnits.length === 0;
    });

    return myUnits.map(unit => ({
      unitId: unit.id,
      unitType: unit.unitType,
      validDestinations,
      mustDie: validDestinations.length === 0
    }));
  }

  applyKills(playerIndex, regionId, unitIdsToKill) {
    unitIdsToKill.forEach(unitId => {
      this.gameState.killUnit(playerIndex, unitId, regionId);
    });
    this.checkGateAbandonment(regionId);
  }

  applyPainRetreat(playerIndex, unitId, fromRegion, toRegion) {
    this.gameState.moveUnits(playerIndex, [unitId], fromRegion, toRegion);
    this.checkGateAbandonment(fromRegion);
  }

  checkGateAbandonment(regionId) {
    const regionState = this.gameState.getRegionState(regionId);
    if (regionState.gate && typeof regionState.gate.owner === 'number') {
      const ownerIndex = regionState.gate.owner;
      const ownerCultists = this.gameState.getUnitsInRegion(regionId, ownerIndex).filter(u => u.unitType === 'cultist');
      if (ownerCultists.length === 0) {
        this.gameState.abandonGate(regionId);
      }
    }
  }
}
