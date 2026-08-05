import { GameState } from './game/game-state.js';
import { MapRenderer } from './game/map-renderer.js';
import { MapRenderer3D } from './game/map-renderer-3d.js';
import { CombatEngine } from './game/combat.js';
import { DiceRenderer } from './game/dice-renderer.js';
import { UIController } from './ui/ui-controller.js';
import { SetupScreen } from './ui/setup-screen.js';
import { ProfilePage } from './ui/profile-page.js';
import { WalletManager } from './solana/wallet.js';
import { PlayerStore } from './solana/player-store.js';
import { LobbyManager } from './solana/lobby.js';
import * as ProfileAPI from './db/profile-api.js';
import { runGatherPower } from './game/phases/gather-power.js';
import { runFirstPlayer } from './game/phases/first-player.js';
import { runActionPhase } from './game/phases/action-phase.js';
import { runDoomPhase } from './game/phases/doom-phase.js';
import { $ } from './utils/dom.js';

class CthulhuWarsApp {
  constructor() {
    this.wallet = new WalletManager();
    this.playerStore = new PlayerStore();
    this.lobby = new LobbyManager(4);
    this.gameState = new GameState();
    this.mapRenderer = null;
    this.combatEngine = null;
    this.diceRenderer = null;
    this.uiController = null;
    this.is3DMode = false;
    this.profilePage = new ProfilePage(this.wallet);
  }

  async init() {
    // Show setup screen
    const setupScreen = new SetupScreen(this.wallet, this.playerStore, this.lobby);
    const gameConfig = await setupScreen.show();
    
    // Game config received - initialize game
    this.gameState.initGame(gameConfig);
    
    // Show game UI
    $('#setup-screen').style.display = 'none';
    $('#game-ui').style.display = '';
    
    // Initialize map (default 2D)
    const mapContainer = $('#map-container');
    this.mapRenderer = new MapRenderer(mapContainer, this.gameState);
    this.mapRenderer.init();
    
    // Initialize combat
    this.combatEngine = new CombatEngine(this.gameState);
    this.diceRenderer = new DiceRenderer();
    
    // Initialize UI
    this.uiController = new UIController(this.gameState, this.mapRenderer);
    this.uiController.init();
    this.uiController.updateUI();
    
    // Wire 3D / 2D Map Mode Toggle
    const mapModeBtn = $('#map-mode-btn');
    if (mapModeBtn) {
      mapModeBtn.addEventListener('click', () => {
        this.is3DMode = !this.is3DMode;
        
        // Preserve active callbacks
        const activeCallback = this.mapRenderer.clickCallback;
        this.mapRenderer.destroy();
        
        if (this.is3DMode) {
          mapModeBtn.textContent = '🗺️ 2D Tactical';
          this.mapRenderer = new MapRenderer3D(mapContainer, this.gameState);
        } else {
          mapModeBtn.textContent = '🎥 3D Tabletop';
          this.mapRenderer = new MapRenderer(mapContainer, this.gameState);
        }
        
        this.mapRenderer.init();
        if (activeCallback) {
          this.mapRenderer.onRegionClick(activeCallback);
        }
        this.uiController.mapRenderer = this.mapRenderer;
        this.uiController.updateUI();
      });
    }
    
    // Show wallet in header
    const headerWallet = $('#header-wallet');
    if (headerWallet && this.wallet.isConnected()) {
      headerWallet.innerHTML = `<div class="wallet-badge"><span class="wallet-dot"></span>${this.wallet.getShortAddress()}</div>`;
    }
    
    // Start game loop
    await this.runGameLoop();
  }

  async runGameLoop() {
    let gameOver = false;
    
    while (!gameOver) {
      // Phase 1: Gather Power (skip on round 1)
      if (this.gameState.state.round > 1) {
        await runGatherPower(this.gameState, this.uiController);
      }
      
      // Phase 2: First Player (skip on round 1 - first player is player 0)
      if (this.gameState.state.round > 1) {
        await runFirstPlayer(this.gameState, this.uiController);
      } else {
        this.gameState.setPhase('ACTION');
        this.gameState.setCurrentPlayer(0);
      }
      
      // Phase 3: Action Phase
      await runActionPhase(this.gameState, this.uiController);
      
      // Phase 4: Doom Phase
      gameOver = await runDoomPhase(this.gameState, this.uiController);
      
      if (!gameOver) {
        this.gameState.advanceRound();
      }
    }
    
    // Game Over
    const results = this.gameState.getFinalScores();
    this.uiController.showEndScreen(results);
    
    // Record stats for each player
    for (const result of results) {
      const player = this.gameState.getPlayer(result.playerIndex);
      if (player.walletAddress && !player.walletAddress.startsWith('DEV')) {
        // Local storage fallback
        this.playerStore.recordGameResult(player.walletAddress, {
          factionId: result.factionId,
          doom: result.finalDoom,
          won: result.winner,
          elderSignTotal: result.elderSignTotal,
        });

        // Record to MongoDB API
        const opponentFactions = results
          .filter(r => r.playerIndex !== result.playerIndex)
          .map(r => r.factionId);

        ProfileAPI.recordGame(player.walletAddress, {
          factionId: result.factionId,
          doomScore: result.finalDoom,
          elderSigns: result.elderSignTotal || 0,
          won: result.winner,
          opponentFactions,
          playerCount: results.length,
          roundsPlayed: this.gameState.state.round
        }).catch(err => console.warn('Failed to record game to API:', err));
      }
    }
  }
}

// Boot
const app = new CthulhuWarsApp();
app.init().catch(console.error);
