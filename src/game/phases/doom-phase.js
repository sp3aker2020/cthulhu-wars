import { FACTIONS } from '../constants.js';

export async function runDoomPhase(gameState, uiController) {
  await uiController.showPhaseBanner('Doom Phase');
  gameState.setPhase('DOOM');
  
  const players = gameState.state.players;
  const firstPlayer = gameState.state.firstPlayerIndex;
  const count = players.length;
  
  // 1. Auto-score doom for controlled gates
  for (let i = 0; i < count; i++) {
    const gates = gameState.getControlledGates(i);
    if (gates.length > 0) {
      gameState.modifyDoom(i, gates.length);
      gameState.addLogEntry(`${FACTIONS[players[i].factionId].name} scores ${gates.length} Doom from Gates`, players[i].factionId);
    }
  }
  
  uiController.updateUI();
  
  // 2. Ritual of Annihilation offers (in player order from first player)
  for (let turn = 0; turn < count; turn++) {
    const pi = (firstPlayer + turn) % count;  // simplified, doesn't account for direction
    const player = gameState.getPlayer(pi);
    
    if (gameState.canRitual(pi)) {
      const doRitual = await uiController.promptConfirmation(`${FACTIONS[player.factionId].name}: Perform Ritual of Annihilation? (Cost: ${gameState.getRitualCost()} Power)`);
      if (doRitual) {
        const cost = gameState.getRitualCost();
        gameState.modifyPower(pi, -cost);
        gameState.advanceRitualTrack();
        
        // Score doom for gates
        const gates = gameState.getControlledGates(pi);
        gameState.modifyDoom(pi, gates.length);
        
        // Elder signs for GOOs in play
        if (player.greatOldOneAwakened) {
          gameState.addElderSign(pi);
          if (player.factionId === 'yellow_sign' && player.hasturAwakened) {
            gameState.addElderSign(pi);  // Second GOO
          }
        }
        
        player.hasPerformedRitual = true;
        gameState.addLogEntry(`${FACTIONS[player.factionId].name} performs Ritual of Annihilation!`, player.factionId);
      }
    }
    uiController.updateUI();
  }
  
  // 3. Check game end
  const endCheck = gameState.checkGameEnd();
  if (endCheck.gameOver) {
    gameState.setPhase('GAME_OVER');
    gameState.addLogEntry(`GAME OVER: ${endCheck.reason}`, null);
    return true; // signals game over
  }
  
  return false;
}
