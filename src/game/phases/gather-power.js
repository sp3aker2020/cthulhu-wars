import { FACTIONS, GAME_CONFIG } from '../constants.js';

export async function runGatherPower(gameState, uiController) {
  await uiController.showPhaseBanner('Gather Power');
  gameState.setPhase('GATHER_POWER');
  
  const playerCount = gameState.state.players.length;
  
  for (let i = 0; i < playerCount; i++) {
    const player = gameState.getPlayer(i);
    const faction = FACTIONS[player.factionId];
    
    // 1. Count cultists on map
    const allUnits = gameState.getAllPlayerUnitsOnMap(i);
    let cultistCount = 0;
    for (const units of Object.values(allUnits)) {
      cultistCount += units.filter(u => u.unitType === 'cultist').length;
    }
    
    // 2. Count controlled gates (2 power each)
    const controlledGates = gameState.getControlledGates(i);
    
    // 3. Count abandoned gates (1 power each, all players get this)
    const abandonedGates = gameState.getAbandonedGates();
    
    // 4. Return captured cultists
    const returnedCount = gameState.returnCapturedCultists(i);
    
    // Calculate total
    let totalPower = cultistCount * GAME_CONFIG.POWER_PER_CULTIST
                   + controlledGates.length * GAME_CONFIG.POWER_PER_GATE
                   + abandonedGates.length * GAME_CONFIG.POWER_PER_ABANDONED_GATE
                   + returnedCount;
    
    // Set power (replaces, not adds)
    gameState.state.players[i].power = totalPower;
    gameState.emit('powerChange', { playerIndex: i, power: totalPower });
    gameState.addLogEntry(`${faction.name} gathers ${totalPower} Power`, player.factionId);
  }
  
  // Half-power catch-up rule
  const maxPower = Math.max(...gameState.state.players.map(p => p.power));
  const halfMax = Math.ceil(maxPower / 2);
  for (let i = 0; i < playerCount; i++) {
    if (gameState.state.players[i].power < halfMax) {
      gameState.state.players[i].power = halfMax;
      gameState.emit('powerChange', { playerIndex: i, power: halfMax });
      gameState.addLogEntry(`${FACTIONS[gameState.state.players[i].factionId].name} power raised to ${halfMax} (catch-up)`, gameState.state.players[i].factionId);
    }
  }
  
  uiController.updateUI();
}
