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
    this.profilePage = new ProfilePage(this.wallet, this.playerStore);
  }

  async init() {
    // Show setup screen
    const setupScreen = new SetupScreen(this.wallet, this.playerStore, this.lobby);
    const gameConfig = await setupScreen.show();
    
    // Game config received - deduct entry fees and initialize game
    const { players, entryFee } = gameConfig;
    if (entryFee > 0) {
      for (const p of players) {
        if (p.walletAddress && !p.walletAddress.startsWith('DEV_')) {
          this.playerStore.deductBalance(p.walletAddress, entryFee);
        }
      }
    }
    
    this.gameState.initGame(players, entryFee);
    if (gameConfig.gameId) {
      this.gameState.state.gameId = gameConfig.gameId;
    }
    
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
    
    // Show wallet and token balance in header
    const headerWallet = $('#header-wallet');
    if (headerWallet && this.wallet.isConnected()) {
      const pubkey = this.wallet.getPublicKey();
      const profile = this.playerStore.getProfile(pubkey);
      const balance = profile.balance || 0;
      const isRealWallet = pubkey && !pubkey.startsWith('DEV_') && !pubkey.startsWith('SOL_');
      
      const renderHeaderBalance = (bal, verified = false) => {
        const balColor = isRealWallet ? '#00e676' : '#ffd600';
        const balLabel = isRealWallet ? (verified ? 'On-Chain ✓' : 'On-Chain') : 'In-Game';
        headerWallet.innerHTML = `
          <div class="wallet-badge" style="display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 20px; border: 1px solid ${balColor};">
            <div class="token-balance" style="color: ${balColor}; font-weight: bold; display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 1.1em;">🪙</span> ${bal.toLocaleString()} $CTHULHU
              <span style="font-size:0.6rem;opacity:0.6;">(${balLabel})</span>
            </div>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.2);"></div>
            <div><span class="wallet-dot"></span>${this.wallet.getShortAddress()}</div>
          </div>
        `;
      };

      renderHeaderBalance(balance);
      
      // Async sync real on-chain $CTHULHU balance
      if (isRealWallet) {
        this.playerStore.syncOnChainBalance(pubkey).then(onChainBal => {
          if (typeof onChainBal === 'number') {
            renderHeaderBalance(onChainBal, true);
          }
        });
      }
    }
    
    // Start game loop
    await this.runGameLoop();
  }

  async runGameLoop() {
    // With the new pure state machine, the UI doesn't block the engine.
    // We just listen to phase changes to determine game over.
    this.gameState.on('phaseChange', (phase) => {
      if (phase === 'GAME_OVER') {
        this.handleGameOver();
      }
    });
    
    this.gameState.on('combatConcluded', (combat) => {
       this.handleWagerPayout(combat);
    });
    
    // Initial jump to Action Phase if round 1
    if (this.gameState.state.round === 1) {
      this.gameState.setPhase('ACTION');
      this.gameState.setCurrentPlayer(0);
      this.uiController.updateUI();
    }
  }

  handleGameOver() {
    const scores = this.gameState.state.players.map(p => ({
      playerIndex: p.id,
      faction: p.factionId,
      score: p.doom + p.elderSigns.reduce((sum, sign) => sum + (sign.value || 0), 0),
      spellbooks: p.spellbooksUnlocked.filter(Boolean).length
    }));
    
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.spellbooks - a.spellbooks; // Tiebreaker
    });
    
    const winner = scores[0];
    const prizePot = this.gameState.state.prizePot || 0;
    
    // Record Wager Game Log for Admin Payout & Claims
    if (prizePot > 0 && winner) {
      const wPlayer = this.gameState.getPlayer(winner.playerIndex);
      const wWallet = wPlayer?.walletAddress || 'Unknown';
      const entryFee = this.gameState.state.entryFee || 0;

      // Update in-game player profile balance display
      if (wPlayer && wPlayer.walletAddress) {
        this.playerStore.addBalance(wPlayer.walletAddress, prizePot);
      }

      // Record in backend wager log for admin payout
      ProfileAPI.recordWagerGame({
        gameId: this.gameState.state.gameId,
        entryFee,
        prizePot,
        players: this.gameState.state.players.map(p => ({
          walletAddress: p.walletAddress,
          factionId: p.factionId,
          score: p.doom
        })),
        winnerWallet: wWallet,
        winnerFaction: wPlayer?.factionId,
        winnerScore: winner.score
      }).then(res => {
        if (res && res.success) {
          console.log(`[WagerLog] Logged wager game: ${prizePot} $CTHULHU won by ${wWallet} (Pending Admin Payout)`);
        }
      }).catch(err => console.warn('Failed to log wager game:', err));
    }
    
    this.uiController.showEndScreen(scores, prizePot);
    
    // Record game in history
    if (this.wallet.isConnected()) {
      const pubkey = this.wallet.getPublicKey();
      const profile = this.playerStore.getProfile(pubkey);
      const isWinner = winner && winner.playerIndex === this.gameState.state.players.findIndex(p => p.walletAddress === pubkey);
      
      const myPlayerIdx = this.gameState.state.players.findIndex(p => p.walletAddress === pubkey);
      const myPlayer = myPlayerIdx >= 0 ? this.gameState.state.players[myPlayerIdx] : null;
      
      if (myPlayer) {
        this.playerStore.recordGameResult(pubkey, {
          factionId: myPlayer.factionId,
          doom: myPlayer.doom,
          won: isWinner,
          elderSignTotal: myPlayer.elderSigns?.reduce((sum, s) => sum + (s.value || 0), 0) || 0
        });
      }
      
      // Update global API
      if (window.app && window.app.API_URL) {
        fetch(`${window.app.API_URL}/api/games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: pubkey,
            won: isWinner,
            faction: this.gameState.state.players.find(p => p.walletAddress === pubkey)?.factionId,
            score: profile.stats.wins
          })
        }).catch(err => console.warn('Failed to record game to API:', err));
      }
    }
  }

  handleWagerPayout(combat) {
    if (!combat || !combat.wagers) return;
    
    const atkPlayer = this.gameState.getPlayer(combat.attacker);
    const defPlayer = this.gameState.getPlayer(combat.defender);
    
    const atkWager = combat.wagers.attacker || 0;
    const defWager = combat.wagers.defender || 0;
    
    if (atkWager === 0 && defWager === 0) return; // No wagers placed
    
    const pot = atkWager + defWager;
    
    // Deduct wagers
    if (atkWager > 0 && atkPlayer.walletAddress) {
      this.playerStore.deductBalance(atkPlayer.walletAddress, atkWager);
    }
    if (defWager > 0 && defPlayer.walletAddress) {
      this.playerStore.deductBalance(defPlayer.walletAddress, defWager);
    }
    
    // Determine winner (most kills, then most pains, then tie)
    const atkScore = combat.results.attackerKills * 2 + combat.results.attackerPains;
    const defScore = combat.results.defenderKills * 2 + combat.results.defenderPains;
    
    if (atkScore > defScore) {
       // Attacker wins
       if (atkPlayer.walletAddress) {
         this.playerStore.addBalance(atkPlayer.walletAddress, pot);
         this.uiController.showToast(`💰 Wager Won! +${pot} $CTHULHU`, atkPlayer.factionId);
       }
    } else if (defScore > atkScore) {
       // Defender wins
       if (defPlayer.walletAddress) {
         this.playerStore.addBalance(defPlayer.walletAddress, pot);
         this.uiController.showToast(`💰 Wager Won! +${pot} $CTHULHU`, defPlayer.factionId);
       }
    } else {
       // Tie - refund
       if (atkPlayer.walletAddress && atkWager > 0) {
         this.playerStore.addBalance(atkPlayer.walletAddress, atkWager);
       }
       if (defPlayer.walletAddress && defWager > 0) {
         this.playerStore.addBalance(defPlayer.walletAddress, defWager);
       }
       this.uiController.showToast(`Wager Tied - Tokens Refunded`, null);
    }
    
    this.uiController.updateHeader(); // Refresh UI
  }
}

// Boot
const app = new CthulhuWarsApp();
window.app = app;
app.init().catch(console.error);
