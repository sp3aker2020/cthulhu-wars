import { CombatEngine } from './combat.js';

export function applyAction(gameState, action, rng = Math.random) {
  // We don't clone the entire gameState object here if it's an instance of GameState class.
  // Instead, the engine operates on the GameState instance and applies the action to it.
  // To keep it "pure" from the caller's perspective, the caller should clone the state before passing it in if needed.
  
  if (!action || !action.type) {
    throw new Error('Invalid action');
  }

  const { type, playerIndex, payload } = action;

  // Most actions require it to be the player's turn, unless it's a reaction/assignment
  const isCurrentPlayer = gameState.state.currentPlayerIndex === playerIndex;

  switch (type) {
    case 'START_GAME':
      break;

    case 'SELECT_FIRST_PLAYER':
      if (gameState.state.phase !== 'DETERMINE_FIRST_PLAYER') throw new Error('Wrong phase');
      gameState.state.firstPlayerIndex = payload.targetPlayerIndex;
      gameState.state.currentPlayerIndex = payload.targetPlayerIndex;
      gameState.addLogEntry(`Player ${payload.targetPlayerIndex} was chosen as First Player`, null);
      break;

    case 'CHOOSE_DIRECTION':
      if (gameState.state.phase !== 'DETERMINE_FIRST_PLAYER') throw new Error('Wrong phase');
      gameState.state.turnDirection = payload.direction; // 1 (clockwise) or -1 (counter)
      gameState.addLogEntry(`Play direction is ${payload.direction === 1 ? 'Clockwise' : 'Counter-Clockwise'}`, null);
      gameState.setPhase('DOOM');
      _enterDoomPhase(gameState);
      break;

    case 'PERFORM_RITUAL':
      if (gameState.state.phase !== 'DOOM') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      if (gameState.getPlayer(playerIndex).hasPerformedRitual) throw new Error('Already performed ritual this round');
      
      const cost = gameState.getRitualCost();
      if (gameState.getPlayer(playerIndex).power < cost) throw new Error('Not enough power');
      
      gameState.modifyPower(playerIndex, -cost);
      gameState.advanceRitualTrack();
      
      const ritualGates = gameState.getControlledGates(playerIndex);
      gameState.modifyDoom(playerIndex, ritualGates.length);
      
      const pData = gameState.getPlayer(playerIndex);
      if (pData.greatOldOneAwakened) {
        gameState.addElderSign(playerIndex);
        if (pData.factionId === 'yellow_sign' && pData.hasturAwakened) {
          gameState.addElderSign(playerIndex);
        }
      }
      
      gameState.getPlayer(playerIndex).hasPerformedRitual = true;
      gameState.addLogEntry(`Player ${playerIndex} performed Ritual of Annihilation`, null);
      
      _advanceDoomTurn(gameState);
      break;

    case 'SKIP_RITUAL':
      if (gameState.state.phase !== 'DOOM') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      gameState.getPlayer(playerIndex).hasPerformedRitual = true;
      gameState.addLogEntry(`Player ${playerIndex} skips Ritual`, null);
      _advanceDoomTurn(gameState);
      break;



    case 'MOVE':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      const moveCost = payload.unitIds.length;
      if (gameState.getPlayer(playerIndex).power < moveCost) throw new Error('Not enough power');
      
      gameState.modifyPower(playerIndex, -moveCost);
      gameState.moveUnits(playerIndex, payload.unitIds, payload.fromRegion, payload.toRegion);
      
      _checkGateAbandonment(gameState, playerIndex, payload.fromRegion);
      gameState.advanceTurn();
      break;

    case 'BATTLE':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      if (gameState.getPlayer(playerIndex).power < 1) throw new Error('Not enough power');
      gameState.modifyPower(playerIndex, -1);
      
      gameState.state.combat = {
        attacker: playerIndex,
        defender: payload.defenderId,
        region: payload.region,
        step: 'ROLL_DICE',
        results: null
      };
      
      _resolveDiceRolls(gameState, rng);
      break;

    case 'ASSIGN_KILLS':
      if (!gameState.state.combat || gameState.state.combat.step !== 'ASSIGN_KILLS') throw new Error('Not in kill assignment phase');
      
      const { combat } = gameState.state;
      if (playerIndex === combat.attacker) {
        _applyKills(gameState, playerIndex, combat.region, payload.unitIds);
        combat.attackerKillsAssigned = true;
      } else if (playerIndex === combat.defender) {
        _applyKills(gameState, playerIndex, combat.region, payload.unitIds);
        combat.defenderKillsAssigned = true;
      } else {
        throw new Error('Not a participant in this combat');
      }

      if (combat.attackerKillsAssigned && combat.defenderKillsAssigned) {
        combat.step = 'ASSIGN_PAINS';
        _checkPains(gameState);
      }
      break;

    case 'ASSIGN_PAINS':
      if (!gameState.state.combat || gameState.state.combat.step !== 'ASSIGN_PAINS') throw new Error('Not in pain assignment phase');
      
      const pCombat = gameState.state.combat;
      if (playerIndex === pCombat.attacker) {
        _applyPains(gameState, playerIndex, pCombat.region, payload.retreats);
        pCombat.attackerPainsAssigned = true;
      } else if (playerIndex === pCombat.defender) {
        _applyPains(gameState, playerIndex, pCombat.region, payload.retreats);
        pCombat.defenderPainsAssigned = true;
      }
      
      if (pCombat.attackerPainsAssigned && pCombat.defenderPainsAssigned) {
        gameState.state.combat = null;
        gameState.advanceTurn();
      }
      break;

    case 'BUILD_GATE':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      if (gameState.getPlayer(playerIndex).power < 3) throw new Error('Not enough power');
      gameState.modifyPower(playerIndex, -3);
      gameState.buildGate(playerIndex, payload.region);
      gameState.advanceTurn();
      break;

    case 'RECRUIT':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      if (gameState.getPlayer(playerIndex).power < 1) throw new Error('Not enough power');
      gameState.modifyPower(playerIndex, -1);
      gameState.placeUnit(playerIndex, 'cultist', payload.region);
      gameState.advanceTurn();
      break;

    case 'SUMMON':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      if (gameState.getPlayer(playerIndex).power < payload.cost) throw new Error('Not enough power');
      gameState.modifyPower(playerIndex, -payload.cost);
      gameState.placeUnit(playerIndex, payload.unitType, payload.region);
      gameState.advanceTurn();
      break;

    case 'AWAKEN':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      if (gameState.getPlayer(playerIndex).power < payload.cost) throw new Error('Not enough power');
      gameState.modifyPower(playerIndex, -payload.cost);
      gameState.placeUnit(playerIndex, payload.unitType, payload.region);
      gameState.awakenGreatOldOne(playerIndex, payload.unitType);
      gameState.advanceTurn();
      break;

    case 'CAPTURE':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      if (gameState.getPlayer(playerIndex).power < 1) throw new Error('Not enough power');
      gameState.modifyPower(playerIndex, -1);
      
      gameState.captureCultist(playerIndex, payload.targetPlayerIndex, payload.region, payload.unitId);
      _checkGateAbandonment(gameState, payload.targetPlayerIndex, payload.region);
      
      gameState.advanceTurn();
      break;

    case 'PASS':
      if (gameState.state.phase !== 'ACTION') throw new Error('Wrong phase');
      if (!isCurrentPlayer) throw new Error('Not your turn');
      
      gameState.setPlayerPassed(playerIndex);
      gameState.advanceTurn();
      break;

    default:
      throw new Error(`Unknown action type: ${type}`);
  }

  _checkPhaseTransitions(gameState);

  return gameState;
}

function _enterDoomPhase(gameState) {
  const players = gameState.state.players;
  for (let i = 0; i < players.length; i++) {
    const gates = gameState.getControlledGates(i);
    if (gates.length > 0) {
      gameState.modifyDoom(i, gates.length);
      gameState.addLogEntry(`Player ${i} scores ${gates.length} Doom from Gates`, players[i].factionId);
    }
  }
}

function _advanceDoomTurn(gameState) {
  gameState.advanceTurn();
  if (gameState.state.currentPlayerIndex === gameState.state.firstPlayerIndex) {
    const endCheck = gameState.checkGameEnd();
    if (endCheck.gameOver) {
      gameState.setPhase('GAME_OVER');
      gameState.addLogEntry(`GAME OVER: ${endCheck.reason}`, null);
    } else {
      gameState.setPhase('ACTION');
      gameState.resetPassedFlags();
    }
  }
}

function _checkGateAbandonment(gameState, playerIndex, region) {
  const regionGate = gameState.state.map[region]?.gate;
  if (regionGate && regionGate.owner === playerIndex) {
    const remainingCultists = gameState.getUnitsInRegion(region, playerIndex).filter(u => u.unitType === 'cultist');
    if (remainingCultists.length === 0) {
      gameState.abandonGate(region);
      gameState.addLogEntry(`Gate in ${region} abandoned`, gameState.getPlayer(playerIndex).factionId);
    }
  }
}

function _resolveDiceRolls(gameState, rng) {
  const { combat } = gameState.state;
  
  const combatEngine = new CombatEngine(gameState);
  const battleResult = combatEngine.resolveBattle(combat.attacker, combat.defender, combat.region, rng);
  
  combat.results = {
    attackerKills: battleResult.attackerKills,
    attackerPains: battleResult.attackerPains,
    defenderKills: battleResult.defenderKills,
    defenderPains: battleResult.defenderPains,
    devourTarget: battleResult.devourTarget,
    attackerRolls: battleResult.attacker.rolls,
    defenderRolls: battleResult.defender.rolls
  };
  
  combat.attackerKillsAssigned = (combat.results.defenderKills === 0);
  combat.defenderKillsAssigned = (combat.results.attackerKills === 0);
  
  if (combat.attackerKillsAssigned && combat.defenderKillsAssigned) {
    combat.step = 'ASSIGN_PAINS';
    _checkPains(gameState);
  } else {
    combat.step = 'ASSIGN_KILLS';
  }
}

function _applyKills(gameState, playerIndex, region, unitIds) {
  for (const uid of unitIds) {
    gameState.killUnit(playerIndex, uid, region);
  }
}

function _checkPains(gameState) {
  const { combat } = gameState.state;
  combat.attackerPainsAssigned = (combat.results.defenderPains === 0);
  combat.defenderPainsAssigned = (combat.results.attackerPains === 0);
  
  if (combat.attackerPainsAssigned && combat.defenderPainsAssigned) {
    gameState.state.combat = null;
    gameState.advanceTurn();
  }
}

function _applyPains(gameState, playerIndex, region, retreats) {
  for (const r of retreats) {
    gameState.moveUnits(playerIndex, [r.unitId], region, r.toRegion);
  }
}

function _checkPhaseTransitions(gameState) {
  if (gameState.state.phase === 'ACTION' && gameState.allPlayersPassed()) {
    gameState.setPhase('GATHER_POWER');
    _gatherPower(gameState);
  }
}

function _gatherPower(gameState) {
  gameState.state.players.forEach(p => {
    let power = 0;
    Object.values(p.units).forEach(regionUnits => {
      power += regionUnits.filter(u => u.unitType === 'cultist').length;
    });
    const gates = gameState.getControlledGates(p.id).length;
    power += gates * 2;
    p.power = power;
  });
  
  gameState.setPhase('DETERMINE_FIRST_PLAYER');
}
