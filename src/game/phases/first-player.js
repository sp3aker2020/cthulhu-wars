import { FACTIONS } from '../constants.js';

export async function runFirstPlayer(gameState, uiController) {
  await uiController.showPhaseBanner('First Player');
  gameState.setPhase('FIRST_PLAYER');
  
  // Find highest power player
  const players = gameState.state.players;
  let maxPower = -1;
  let candidates = [];
  players.forEach((p, i) => { 
    if (p.power > maxPower) { 
      maxPower = p.power; 
      candidates = [i]; 
    } else if (p.power === maxPower) { 
      candidates.push(i); 
    } 
  });
  
  let firstPlayer;
  if (candidates.length === 1) {
    firstPlayer = candidates[0];
  } else {
    // Tie: current first player chooses among tied players
    firstPlayer = await uiController.promptChoosePlayer(candidates, `Choose First Player (tied at ${maxPower} Power)`);
  }
  
  // Choose direction
  const direction = await uiController.promptChooseDirection();
  
  gameState.setFirstPlayer(firstPlayer, direction);
  gameState.setCurrentPlayer(firstPlayer);
  gameState.addLogEntry(`${FACTIONS[players[firstPlayer].factionId].name} is First Player (${direction})`, players[firstPlayer].factionId);
  uiController.updateUI();
}
