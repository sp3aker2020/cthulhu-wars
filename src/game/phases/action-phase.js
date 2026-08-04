import { FACTIONS, GAME_CONFIG, MAP_REGIONS } from '../constants.js';
import { CombatEngine } from '../combat.js';

export async function runActionPhase(gameState, uiController) {
  await uiController.showPhaseBanner('Action Phase');
  gameState.setPhase('ACTION');
  gameState.resetPassedFlags();
  
  // The main loop: keep going until all players pass
  while (!gameState.allPlayersPassed()) {
    const currentPlayer = gameState.getCurrentPlayer();
    const pi = gameState.state.currentPlayerIndex;
    
    if (currentPlayer.hasPassed) {
      gameState.advanceTurn();
      continue;
    }
    
    // Auto-pass if 0 power
    if (currentPlayer.power <= 0) {
      gameState.setPlayerPassed(pi);
      gameState.addLogEntry(`${FACTIONS[currentPlayer.factionId].name} passes (no Power)`, currentPlayer.factionId);
      gameState.advanceTurn();
      uiController.updateUI();
      continue;
    }
    
    uiController.updateUI();
    
    // Wait for player to choose an action
    const availableActions = gameState.getAvailableActions(pi);
    const chosenAction = await uiController.promptActionSelection(pi, availableActions);
    
    // Execute the chosen action
    switch (chosenAction) {
      case 'move': await executeMove(gameState, uiController, pi); break;
      case 'battle': await executeBattle(gameState, uiController, pi); break;
      case 'build_gate':
      case 'buildGate': await executeBuildGate(gameState, uiController, pi); break;
      case 'recruit': await executeRecruit(gameState, uiController, pi); break;
      case 'summon': await executeSummon(gameState, uiController, pi); break;
      case 'awaken': await executeAwaken(gameState, uiController, pi); break;
      case 'capture': await executeCapture(gameState, uiController, pi); break;
      case 'pass': 
        gameState.setPlayerPassed(pi); 
        gameState.addLogEntry(`${FACTIONS[currentPlayer.factionId].name} passes`, currentPlayer.factionId); 
        break;
    }
    
    uiController.updateUI();
    gameState.advanceTurn();
  }
  
  gameState.addLogEntry('All players have passed. Action Phase ends.', null);
}

export async function executeMove(gameState, uiController, pi) {
  const allUnits = gameState.getAllPlayerUnitsOnMap(pi);
  const regionsWithUnits = Object.keys(allUnits);
  if (regionsWithUnits.length === 0) return;

  const fromRegion = await uiController.promptRegionSelection(regionsWithUnits, 'Select region to move FROM');
  if (!fromRegion) return;

  const units = allUnits[fromRegion];
  const selectedUnits = await uiController.promptUnitSelection(units, 'Select units to move', units.length);
  if (!selectedUnits || selectedUnits.length === 0) return;

  const cost = selectedUnits.length * GAME_CONFIG.MOVE_COST_PER_UNIT;
  if (gameState.getPlayer(pi).power < cost) {
    uiController.showToast('Not enough Power!', null);
    return;
  }

  const adjacent = gameState.getAdjacentRegions(fromRegion);
  const toRegion = await uiController.promptRegionSelection(adjacent, 'Select destination');
  if (!toRegion) return;

  gameState.modifyPower(pi, -cost);
  gameState.moveUnits(pi, selectedUnits.map(u => u.id), fromRegion, toRegion);
  
  // Check gate abandonment
  const regionGate = gameState.state.map[fromRegion]?.gate;
  if (regionGate && regionGate.owner === pi) {
    const remainingCultists = gameState.getUnitsInRegion(fromRegion, pi).filter(u => u.unitType === 'cultist');
    if (remainingCultists.length === 0) {
      gameState.abandonGate(fromRegion);
      gameState.addLogEntry(`Gate in ${MAP_REGIONS[fromRegion].name} abandoned`, gameState.getPlayer(pi).factionId);
    }
  }
  gameState.addLogEntry(`Moved ${selectedUnits.length} unit(s) from ${MAP_REGIONS[fromRegion].name} to ${MAP_REGIONS[toRegion].name}`, gameState.getPlayer(pi).factionId);
}

export async function executeBattle(gameState, uiController, pi) {
  const combatEngine = new CombatEngine(gameState);
  const battleRegions = combatEngine.getBattleRegions(pi);
  if (battleRegions.length === 0) return;
  
  const region = await uiController.promptRegionSelection(battleRegions, 'Select region for Battle');
  if (!region) return;
  
  const enemies = gameState.state.players
    .filter(p => p.id !== pi && gameState.getUnitsInRegion(region, p.id).length > 0)
    .map(p => p.id);

  let defenderPi;
  if (enemies.length === 1) {
    defenderPi = enemies[0];
  } else {
    defenderPi = await uiController.promptChoosePlayer(enemies, 'Choose defender');
  }
  if (defenderPi === undefined || defenderPi === null) return;
  
  const cost = GAME_CONFIG.BATTLE_COST;
  if (gameState.getPlayer(pi).power < cost) {
    uiController.showToast('Not enough Power!', null);
    return;
  }
  
  gameState.modifyPower(pi, -cost);
  
  const battleResult = combatEngine.resolveBattle(pi, defenderPi, region);
  
  await uiController.showCombatModal(battleResult);
  
  // Handle kills inflicted by attacker onto defender
  if (battleResult.attackerKills > 0) {
    const units = gameState.getUnitsInRegion(region, defenderPi);
    if (units.length > 0) {
      const killCount = Math.min(battleResult.attackerKills, units.length);
      const killed = await uiController.promptUnitSelection(units, `Defender: select ${killCount} unit(s) to kill`, killCount);
      if (killed && killed.length > 0) {
        combatEngine.applyKills(defenderPi, region, killed.map(u => u.id));
      }
    }
  }

  // Handle kills inflicted by defender onto attacker
  if (battleResult.defenderKills > 0) {
    const units = gameState.getUnitsInRegion(region, pi);
    if (units.length > 0) {
      const killCount = Math.min(battleResult.defenderKills, units.length);
      const killed = await uiController.promptUnitSelection(units, `Attacker: select ${killCount} unit(s) to kill`, killCount);
      if (killed && killed.length > 0) {
        combatEngine.applyKills(pi, region, killed.map(u => u.id));
      }
    }
  }
  
  // Handle pains (retreats)
  if (battleResult.attackerPains > 0) {
    const retreatOpts = combatEngine.getPainRetreatOptions(defenderPi, region, pi);
    for (const opt of retreatOpts) {
      if (opt.mustDie) {
        gameState.killUnit(defenderPi, opt.unitId, region);
      } else if (opt.validDestinations.length > 0) {
        const dest = await uiController.promptRegionSelection(opt.validDestinations, `Select retreat destination for ${opt.unitType}`);
        if (dest) {
          combatEngine.applyPainRetreat(defenderPi, opt.unitId, region, dest);
        }
      }
    }
  }

  if (battleResult.defenderPains > 0) {
    const retreatOpts = combatEngine.getPainRetreatOptions(pi, region, defenderPi);
    for (const opt of retreatOpts) {
      if (opt.mustDie) {
        gameState.killUnit(pi, opt.unitId, region);
      } else if (opt.validDestinations.length > 0) {
        const dest = await uiController.promptRegionSelection(opt.validDestinations, `Select retreat destination for ${opt.unitType}`);
        if (dest) {
          combatEngine.applyPainRetreat(pi, opt.unitId, region, dest);
        }
      }
    }
  }
  
  combatEngine.checkGateAbandonment(region);
  
  gameState.addLogEntry(`${FACTIONS[gameState.getPlayer(pi).factionId].name} battled ${FACTIONS[gameState.getPlayer(defenderPi).factionId].name} in ${MAP_REGIONS[region].name}`, gameState.getPlayer(pi).factionId);
}

export async function executeBuildGate(gameState, uiController, pi) {
  const playerUnits = gameState.getAllPlayerUnitsOnMap(pi);
  const validRegions = Object.keys(playerUnits).filter(regionId => {
    const hasCultist = playerUnits[regionId].some(u => u.unitType === 'cultist');
    const gateless = !gameState.state.map[regionId]?.gate;
    return hasCultist && gateless;
  });

  if (validRegions.length === 0) return;
  const region = await uiController.promptRegionSelection(validRegions, 'Select region to build Gate');
  if (!region) return;
  
  const cost = GAME_CONFIG.GATE_BUILD_COST;
  if (gameState.getPlayer(pi).power < cost) {
    uiController.showToast('Not enough Power!', null);
    return;
  }
  
  gameState.modifyPower(pi, -cost);
  gameState.buildGate(pi, region);
  gameState.addLogEntry(`Built Gate in ${MAP_REGIONS[region].name}`, gameState.getPlayer(pi).factionId);
}

export async function executeRecruit(gameState, uiController, pi) {
  const playerUnits = gameState.getAllPlayerUnitsOnMap(pi);
  const validRegions = Object.keys(playerUnits);
  if (validRegions.length === 0) return;

  const region = await uiController.promptRegionSelection(validRegions, 'Select region to recruit Cultist');
  if (!region) return;
  
  const cost = GAME_CONFIG.RECRUIT_COST;
  if (gameState.getPlayer(pi).power < cost) {
    uiController.showToast('Not enough Power!', null);
    return;
  }
  
  gameState.modifyPower(pi, -cost);
  gameState.placeUnit(pi, 'cultist', region);
  gameState.addLogEntry(`Recruited Cultist in ${MAP_REGIONS[region].name}`, gameState.getPlayer(pi).factionId);
}

export async function executeSummon(gameState, uiController, pi) {
  const validRegions = gameState.getControlledGates(pi);
  if (validRegions.length === 0) return;

  const region = await uiController.promptRegionSelection(validRegions, 'Select Gate to summon at');
  if (!region) return;
  
  const player = gameState.getPlayer(pi);
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

  if (monsterChoices.length === 0) return;
  
  const monsterSelection = await uiController.promptUnitSelection(monsterChoices, 'Select monster to summon', 1);
  if (!monsterSelection || monsterSelection.length === 0) return;
  
  const selectedMonster = monsterSelection[0];
  const cost = selectedMonster.cost;
  
  if (player.power < cost) {
    uiController.showToast('Not enough Power!', null);
    return;
  }
  
  gameState.modifyPower(pi, -cost);
  gameState.placeUnit(pi, selectedMonster.unitType, region);
  gameState.addLogEntry(`Summoned ${selectedMonster.name} in ${MAP_REGIONS[region].name}`, player.factionId);
}

export async function executeAwaken(gameState, uiController, pi) {
  const validRegions = gameState.getControlledGates(pi);
  if (validRegions.length === 0) return;

  const player = gameState.getPlayer(pi);
  const faction = FACTIONS[player.factionId];
  const gooDef = faction?.greatOldOne || faction?.greatOldOnes?.[Object.keys(faction?.greatOldOnes || {})[0]];
  if (!gooDef) return;

  const region = await uiController.promptRegionSelection(validRegions, `Select Gate to awaken ${gooDef.name}`);
  if (!region) return;

  const cost = gooDef.awakenCost || 10;
  if (player.power < cost) {
    uiController.showToast('Not enough Power!', null);
    return;
  }

  gameState.modifyPower(pi, -cost);
  gameState.placeUnit(pi, gooDef.id, region);
  gameState.awakenGreatOldOne(pi, gooDef.id);
  gameState.addLogEntry(`Awakened ${gooDef.name} in ${MAP_REGIONS[region].name}!`, player.factionId);
}

export async function executeCapture(gameState, uiController, pi) {
  const playerUnits = gameState.getAllPlayerUnitsOnMap(pi);
  const validRegions = Object.keys(playerUnits).filter(regionId => {
    const hasMonsterOrGoo = playerUnits[regionId].some(u => u.unitType !== 'cultist');
    if (!hasMonsterOrGoo) return false;

    return gameState.state.players.some(enemy => {
      if (enemy.id === pi) return false;
      const enemyUnits = gameState.getUnitsInRegion(regionId, enemy.id);
      const hasEnemyCultist = enemyUnits.some(u => u.unitType === 'cultist');
      const hasEnemyProtector = enemyUnits.some(u => u.unitType !== 'cultist');
      return hasEnemyCultist && !hasEnemyProtector;
    });
  });

  if (validRegions.length === 0) return;
  const region = await uiController.promptRegionSelection(validRegions, 'Select region to capture Cultist');
  if (!region) return;
  
  const enemyCandidates = gameState.state.players
    .filter(enemy => {
      if (enemy.id === pi) return false;
      const enemyUnits = gameState.getUnitsInRegion(region, enemy.id);
      return enemyUnits.some(u => u.unitType === 'cultist') && !enemyUnits.some(u => u.unitType !== 'cultist');
    })
    .map(e => e.id);

  let targetPi;
  if (enemyCandidates.length === 1) {
    targetPi = enemyCandidates[0];
  } else {
    targetPi = await uiController.promptChoosePlayer(enemyCandidates, 'Choose enemy to capture from');
  }
  if (targetPi === undefined || targetPi === null) return;
  
  const victimUnits = gameState.getUnitsInRegion(region, targetPi);
  const victimCultist = victimUnits.find(u => u.unitType === 'cultist');
  if (!victimCultist) return;

  const cost = GAME_CONFIG.CAPTURE_COST;
  if (gameState.getPlayer(pi).power < cost) {
    uiController.showToast('Not enough Power!', null);
    return;
  }
  
  gameState.modifyPower(pi, -cost);
  gameState.captureCultist(pi, targetPi, region, victimCultist.id);
  
  // Check gate abandonment
  const regionGate = gameState.state.map[region]?.gate;
  if (regionGate && regionGate.owner === targetPi) {
    const remainingCultists = gameState.getUnitsInRegion(region, targetPi).filter(u => u.unitType === 'cultist');
    if (remainingCultists.length === 0) {
      gameState.abandonGate(region);
      gameState.addLogEntry(`Gate in ${MAP_REGIONS[region].name} abandoned`, gameState.getPlayer(targetPi).factionId);
    }
  }
  
  gameState.addLogEntry(`Captured Cultist in ${MAP_REGIONS[region].name}`, gameState.getPlayer(pi).factionId);
}
