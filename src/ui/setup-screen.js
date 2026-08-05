import { $, createElement, show, hide } from '../utils/dom.js';
import { FACTIONS, MAP_REGIONS } from '../game/constants.js';
import { GameState } from '../game/game-state.js';
import { MapRenderer } from '../game/map-renderer.js';
import { ProfilePage } from './profile-page.js';
import * as ProfileAPI from '../db/profile-api.js';
import { executeWagerTransfer } from '../solana/token-api.js';

export class SetupScreen {
  constructor(walletManager, playerStore, lobbyManager) {
    this.wallet = walletManager;
    this.store = playerStore;
    this.lobby = lobbyManager;
    this.profilePage = new ProfilePage(walletManager, playerStore);
    this._startResolver = null;
    this._currentStep = 'wallet';  // 'wallet' | 'lobby'
    this._activeNavTab = 'lobby'; // 'lobby' | 'map' | 'logs' | 'profile'
    this._logsSubTab = 'wagers';  // 'wagers' | 'leaderboard'
    this._selectedRegionId = null;
    this._previewMapRenderer = null;
    this._wagerLogsData = [];
    this._leaderboardData = [];
  }

  async show() {
    const screen = $('#setup-screen');
    if (!screen) return null;
    show(screen);
    
    // Try auto-reconnect
    await this.wallet.tryReconnect();
    
    this.render();
    
    // Listen for wallet events
    this.wallet.on('connected', async () => {
      this._currentStep = 'lobby';
      this._autoPopulateLobby();
      this.render();
      const pubkey = this.wallet.getPublicKey();
      if (pubkey) {
        await this.store.syncOnChainBalance(pubkey);
        this.render();
      }
    });
    this.wallet.on('disconnected', () => {
      this._currentStep = 'wallet';
      this.lobby.reset();
      this.render();
    });
    
    // Listen for lobby events  
    this.lobby.on('slotUpdated', () => this.render());
    this.lobby.on('factionSelected', () => this.render());
    this.lobby.on('readyChanged', () => this.render());
    this.lobby.on('playerCountChanged', () => {
      this._autoPopulateLobby();
      this.render();
    });
    
    return new Promise(resolve => { this._startResolver = resolve; });
  }

  _autoPopulateLobby() {
    const mainAddr = this.wallet.getPublicKey() || 'DEV_Player_1';
    const mainName = this.store.getProfile(mainAddr).displayName || 'Player 1';
    const defaultFactions = ['cthulhu', 'crawling_chaos', 'yellow_sign', 'black_goat'];
    const count = this.lobby._playerCount;

    for (let i = 0; i < count; i++) {
      const addr = i === 0 ? mainAddr : `${mainAddr}_P${i + 1}`;
      const name = i === 0 ? mainName : `Player ${i + 1}`;
      this.lobby.joinSlot(i, addr, name);
      if (!this.lobby._slots[i].factionId) {
        this.lobby.selectFaction(i, defaultFactions[i % defaultFactions.length]);
      }
      this.lobby.setReady(i, true);
    }
  }

  render() {
    const screen = $('#setup-screen');
    if (!screen) return;
    
    if (this.wallet.isConnected() && this._currentStep === 'wallet') {
      this._currentStep = 'lobby';
      this._autoPopulateLobby();
    }
    
    screen.innerHTML = '';

    // 1. Top Header Navigation Bar
    screen.appendChild(this._renderHeader());

    // 2. Landing Main Content Container
    const content = createElement('div', { class: 'landing-content' });

    if (this._activeNavTab === 'lobby') {
      content.appendChild(this._renderLobbyTab());
    } else if (this._activeNavTab === 'map') {
      content.appendChild(this._renderMapPreviewTab());
    } else if (this._activeNavTab === 'logs') {
      content.appendChild(this._renderLogsTab());
    } else if (this._activeNavTab === 'profile') {
      content.appendChild(this._renderProfileTab());
    }

    screen.appendChild(content);

    // 3. Post-render initializations
    if (this._activeNavTab === 'map') {
      setTimeout(() => this._initMapPreview(), 50);
    } else if (this._activeNavTab === 'profile') {
      const pContainer = $('#landing-profile-container');
      if (pContainer) {
        this.profilePage.showInContainer(pContainer);
      }
    }
  }

  // ================================================================
  // Top Header Navigation Bar
  // ================================================================
  _renderHeader() {
    const header = createElement('header', { class: 'landing-header' });

    // Brand / Logo
    const brand = createElement('div', {
      class: 'landing-brand',
      click: () => {
        this._activeNavTab = 'lobby';
        this.render();
      }
    }, [
      createElement('span', { class: 'landing-logo-icon' }, ['🦑']),
      createElement('div', {}, [
        createElement('h1', { class: 'landing-title' }, ['CTHULHU WARS']),
        createElement('div', { style: 'font-size:0.65rem;color:#94a3b8;letter-spacing:2px;' }, ['THE STARS ARE RIGHT'])
      ])
    ]);
    header.appendChild(brand);

    // Navigation Tabs
    const tabs = [
      { id: 'lobby', label: '🎮 Game Lobby' },
      { id: 'map', label: '🗺️ Map Preview' },
      { id: 'logs', label: '📜 Game & Wager Logs' },
      { id: 'profile', label: '👤 My Profile' }
    ];

    const nav = createElement('nav', { class: 'landing-nav-tabs' });
    for (const t of tabs) {
      const active = this._activeNavTab === t.id;
      const btn = createElement('button', {
        class: `landing-nav-btn ${active ? 'active' : ''}`,
        click: () => {
          this._activeNavTab = t.id;
          this.render();
        }
      }, [t.label]);
      nav.appendChild(btn);
    }
    header.appendChild(nav);

    // Right side: Wallet status / Connect button
    const pubkey = this.wallet.getPublicKey();
    if (pubkey) {
      const profile = this.store.getProfile(pubkey);
      const bal = profile ? (profile.balance || 0) : 0;
      const isRealWallet = pubkey && !pubkey.startsWith('DEV_') && !pubkey.startsWith('SOL_');
      const isVerified = profile?._balanceVerified === true;
      const balLabel = isRealWallet ? (isVerified ? 'On-Chain ✓' : 'On-Chain ⏳') : 'In-Game';
      const balColor = isRealWallet ? '#00e676' : '#ffd600';

      const walletBadge = createElement('div', {
        class: 'wallet-badge glass',
        style: 'display:flex;align-items:center;gap:10px;padding:6px 14px;border-radius:20px;'
      }, [
        createElement('span', { style: `color:${balColor};font-weight:bold;font-size:0.9rem;` }, [`🪙 ${bal.toLocaleString()} $CTHULHU`]),
        createElement('span', { style: `font-size:0.65rem;color:${balColor};opacity:0.8;` }, [`(${balLabel})`]),
        createElement('span', { style: 'opacity:0.3;' }, ['|']),
        createElement('span', { class: 'wallet-dot' }),
        createElement('span', { class: 'mono', style: 'font-size:0.85rem;' }, [this.wallet.getShortAddress()]),
        createElement('span', {
          class: 'disconnect-btn',
          style: 'font-size:0.75rem;cursor:pointer;color:#ff5252;margin-left:4px;',
          click: () => this.wallet.disconnect()
        }, ['Disconnect'])
      ]);
      header.appendChild(walletBadge);
    } else {
      const connectBtn = createElement('button', {
        class: 'btn',
        style: 'background:linear-gradient(135deg,#00e676,#00a844);color:#000;font-weight:bold;padding:8px 18px;border-radius:20px;font-size:0.88rem;',
        click: () => {
          this._activeNavTab = 'lobby';
          this.render();
        }
      }, ['⚡ Connect Wallet']);
      header.appendChild(connectBtn);
    }

    return header;
  }

  // ================================================================
  // Tab 1: Game Lobby Tab
  // ================================================================
  _renderLobbyTab() {
    const wrapper = createElement('div');

    // Hero Banner
    const hero = createElement('div', { class: 'landing-hero' }, [
      createElement('h2', {}, ['THE STARS ARE RIGHT']),
      createElement('p', {}, ['DOMINATE EARTH IN ASYMMETRIC COSMIC WARFARE WITH SOLANA TOKEN WAGERS']),
      createElement('div', { class: 'landing-badges' }, [
        createElement('span', { class: 'landing-badge-item' }, ['🦑 4 Asymmetric Factions']),
        createElement('span', { class: 'landing-badge-item' }, ['🪙 On-Chain Escrow Vault']),
        createElement('span', { class: 'landing-badge-item' }, ['📜 Verified Wager Claims']),
        createElement('span', { class: 'landing-badge-item' }, ['🗺️ 2D & 3D Earth Maps'])
      ])
    ]);
    wrapper.appendChild(hero);

    // 2-Column Grid: Wallet Connect / Status (Left) & Lobby Setup (Right)
    const grid = createElement('div', { class: 'landing-grid' });

    // Left Column
    const leftCol = createElement('div');
    if (!this.wallet.isConnected()) {
      leftCol.appendChild(this._renderWalletConnectBox());
    } else {
      leftCol.appendChild(this._renderConnectedWalletBox());
    }
    grid.appendChild(leftCol);

    // Right Column: Match Setup Lobby
    const rightCol = createElement('div');
    rightCol.appendChild(this._renderLobbyConfigBox());
    grid.appendChild(rightCol);

    wrapper.appendChild(grid);
    return wrapper;
  }

  _renderWalletConnectBox() {
    const section = createElement('div', { class: 'wallet-section glass', style: 'width:100%;min-width:0;' });
    section.appendChild(createElement('h3', { style: 'margin-bottom:16px;text-align:center;font-family:"Cinzel",serif;color:#00e676;' }, ['Connect Wallet to Play']));

    const wallets = this.wallet.getAvailableWallets();
    for (const w of wallets) {
      const isPrivy = w.id === 'privy_twitter';
      const isPhantom = w.id === 'phantom';
      const btnStyle = isPrivy 
        ? 'background:linear-gradient(135deg, #6366f1, #4f46e5);color:white;font-weight:bold;margin-bottom:12px;box-shadow:0 0 24px rgba(99,102,241,0.5);display:flex;align-items:center;padding:12px 16px;'
        : isPhantom
        ? 'background:linear-gradient(135deg, #ab9ff2, #7a6be6);color:white;font-weight:bold;margin-bottom:12px;box-shadow:0 0 20px rgba(171,159,242,0.4);display:flex;align-items:center;padding:12px 16px;'
        : 'margin-bottom:8px;display:flex;align-items:center;padding:10px 16px;';

      const btn = createElement('button', {
        class: `wallet-btn ${w.id}`,
        style: btnStyle,
        click: async () => {
          try {
            await this.wallet.connect(w.id);
          } catch (err) {
            btn.textContent = err.message || 'Connection failed';
            setTimeout(() => this.render(), 2000);
          }
        }
      }, [
        createElement('span', { class: 'wallet-icon', style: 'font-size:1.4rem;margin-right:10px;' }, [w.icon]),
        createElement('span', { class: 'wallet-name', style: 'flex-grow:1;text-align:left;font-size:1rem;' }, [w.name]),
        ...(!isPrivy ? [createElement('span', { class: 'wallet-status', style: 'font-size:0.8rem;opacity:0.8;' }, [w.detected ? 'Detected' : 'Not installed'])] : []),
      ]);
      section.appendChild(btn);
    }

    // Dev mode: quick play
    const devBtn = createElement('button', {
      class: 'wallet-btn start-btn',
      style: 'margin-top:20px;background:rgba(255,255,255,0.06);color:#888;border:1px solid rgba(255,255,255,0.1);justify-content:center',
      click: () => {
        this.wallet._publicKey = 'DEV_' + Math.random().toString(36).substring(2, 8);
        this.wallet._walletName = 'Quick Play';
        this.wallet.emit('connected', { walletId: 'dev', publicKey: this.wallet._publicKey });
      }
    }, [
      createElement('span', { class: 'wallet-icon' }, ['⚡']),
      createElement('span', { class: 'wallet-name', style: 'text-align:center' }, ['Quick Play (Local Game)']),
    ]);
    section.appendChild(devBtn);

    return section;
  }

  _renderConnectedWalletBox() {
    const pubkey = this.wallet.getPublicKey();
    const profile = this.store.getProfile(pubkey);
    const box = createElement('div', { class: 'glass', style: 'padding:24px;border-radius:14px;border:1px solid rgba(0,230,118,0.3);' });

    box.appendChild(createElement('h3', { style: 'color:#00e676;margin-bottom:12px;font-family:"Cinzel",serif;' }, ['Connected Wallet']));

    const infoRow = createElement('div', { style: 'margin-bottom:16px;background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;' }, [
      createElement('div', { style: 'font-size:0.8rem;opacity:0.6;margin-bottom:4px;' }, ['Public Address']),
      createElement('div', { class: 'mono', style: 'color:#448aff;font-size:0.9rem;word-break:break-all;' }, [pubkey]),
    ]);
    box.appendChild(infoRow);

    const statsRow = createElement('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;' }, [
      createElement('div', { style: 'background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;' }, [
        createElement('div', { style: 'font-size:0.75rem;opacity:0.6;' }, ['Games Played']),
        createElement('div', { style: 'font-size:1.3rem;font-weight:bold;color:#fff;' }, [`${profile.stats.gamesPlayed}`])
      ]),
      createElement('div', { style: 'background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;text-align:center;' }, [
        createElement('div', { style: 'font-size:0.75rem;opacity:0.6;' }, ['Victories']),
        createElement('div', { style: 'font-size:1.3rem;font-weight:bold;color:#00e676;' }, [`${profile.stats.wins}`])
      ])
    ]);
    box.appendChild(statsRow);

    const viewProfileBtn = createElement('button', {
      class: 'btn',
      style: 'width:100%;background:rgba(68,138,255,0.15);color:#448aff;border:1px solid rgba(68,138,255,0.4);padding:10px;',
      click: () => {
        this._activeNavTab = 'profile';
        this.render();
      }
    }, ['👤 View Full Profile & Wallet Details']);
    box.appendChild(viewProfileBtn);

    return box;
  }

  _renderLobbyConfigBox() {
    const section = createElement('div', { class: 'lobby-section glass', style: 'width:100%;min-width:0;padding:24px;' });
    section.appendChild(createElement('h3', { style: 'color:#448aff;margin-bottom:16px;font-family:"Cinzel",serif;text-align:center;' }, ['Match Lobby & Wager Setup']));
    
    // Player count selector
    const countRow = createElement('div', { class: 'player-count-selector', style: 'display:flex;gap:8px;margin-bottom:20px;justify-content:center' });
    for (let n = 2; n <= 4; n++) {
      const active = this.lobby._playerCount === n;
      const btn = createElement('button', {
        class: `btn ${active ? 'active' : ''}`,
        style: active ? 'background:#448aff;color:white;border-color:#448aff;font-weight:bold;' : '',
        click: () => this.lobby.setPlayerCount(n)
      }, [`${n} Players`]);
      countRow.appendChild(btn);
    }
    section.appendChild(countRow);
    
    // Slots
    const state = this.lobby.getState();
    for (let i = 0; i < state.playerCount; i++) {
      const slot = state.slots[i];
      const slotEl = createElement('div', { class: 'lobby-slot' });
      
      slotEl.appendChild(createElement('span', { class: 'slot-number mono' }, [`P${i + 1}`]));
      
      let slotBalHTML = '';
      if (slot.walletAddress) {
        const p = this.store.getProfile(slot.walletAddress);
        const bal = p ? (p.balance || 0) : 0;
        slotBalHTML = ` <span style="color:#00e676;font-weight:bold;font-size:0.85rem;margin-left:6px;">(🪙 ${bal.toLocaleString()})</span>`;
      }
      const nameEl = createElement('span', { class: 'slot-address' });
      nameEl.innerHTML = `${slot.displayName || `Player ${i + 1}`}${slotBalHTML}`;
      slotEl.appendChild(nameEl);
      
      // Faction dropdown
      const select = createElement('select', { 
        class: 'faction-select', 
        change: (e) => {
          this.lobby.selectFaction(i, e.target.value);
        }
      });
      
      for (const [fId, fDef] of Object.entries(FACTIONS)) {
        const opt = createElement('option', { value: fId }, [fDef.name]);
        if (slot.factionId === fId) opt.selected = true;
        select.appendChild(opt);
      }
      slotEl.appendChild(select);
      
      // Ready toggle
      const readyBtn = createElement('button', {
        class: `btn ${slot.ready ? 'ready' : ''}`,
        style: slot.ready ? 'background:#00c853;color:white;border-color:#00c853' : '',
        click: () => this.lobby.setReady(i, !slot.ready)
      }, [slot.ready ? '✅ Ready' : 'Ready?']);
      slotEl.appendChild(readyBtn);

      section.appendChild(slotEl);
    }
    
    // Entry Fee Selector
    const feeRow = createElement('div', { style: 'margin-top:20px;text-align:center;padding:16px;background:rgba(0,0,0,0.4);border-radius:12px;border:1px solid rgba(0,230,118,0.3)' });
    feeRow.appendChild(createElement('h4', { style: 'color:#00e676;margin-bottom:6px;font-family:"Cinzel",serif' }, ['Game Wager / Entry Fee']));
    feeRow.appendChild(createElement('div', { style: 'font-size:0.8rem;opacity:0.7;margin-bottom:12px' }, ['Select a wager amount for the winner-takes-all pot, or select No Wager to play for free.']));
    
    const feeOptions = [0, 100, 500, 1000];
    const feeBtnRow = createElement('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap' });
    
    for (const fee of feeOptions) {
      const active = this.lobby._entryFee === fee;
      const btn = createElement('button', {
        class: `btn ${active ? 'active' : ''}`,
        style: active ? 'background:#00e676;color:#000;border-color:#00e676;font-weight:bold' : 'color:#00e676;border-color:#00e676',
        click: () => {
          this.lobby.setEntryFee(fee);
          this.render();
        }
      }, [fee === 0 ? '🚫 No Wager' : `🪙 ${fee}`]);
      feeBtnRow.appendChild(btn);
    }
    feeRow.appendChild(feeBtnRow);
    
    if (this.lobby._entryFee > 0) {
      const totalPot = this.lobby._entryFee * this.lobby._playerCount;
      feeRow.appendChild(createElement('div', { style: 'margin-top:12px;font-size:1.2rem;font-weight:bold;color:#ffab00' }, [
        `🏆 Total Prize Pot: 🪙 ${totalPot} $CTHULHU`
      ]));
    } else {
      feeRow.appendChild(createElement('div', { style: 'margin-top:10px;font-size:0.9rem;color:#888' }, [
        '🎮 Casual Match — Playing for fun & stats (No $CTHULHU wagered)'
      ]));
    }
    section.appendChild(feeRow);
    
    // Start button
    const canStart = this.lobby.isAllReady();
    
    // Check if main player has enough balance
    let hasFunds = true;
    if (this.lobby._entryFee > 0 && this.wallet.isConnected()) {
      const profile = this.store.getProfile(this.wallet.getPublicKey());
      if ((profile.balance || 0) < this.lobby._entryFee) {
        hasFunds = false;
      }
    }
    
    const startBtn = createElement('button', {
      class: 'btn start-btn',
      style: `margin-top:20px;width:100%;font-size:1.2rem;padding:16px;${(!canStart || !hasFunds) ? 'opacity:0.3;cursor:not-allowed' : ''}`,
      disabled: !canStart || !hasFunds,
      click: async () => {
        if (!canStart || !hasFunds || !this._startResolver) return;

        const fee = this.lobby._entryFee;
        const pubkey = this.wallet.getPublicKey();
        const isRealWallet = pubkey && !pubkey.startsWith('DEV_') && !pubkey.startsWith('SOL_');

        const gameConfig = this.lobby.getGameConfig();
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        gameConfig.gameId = gameId;

        // If there's an entry fee, record wager start immediately
        if (fee > 0) {
          const totalPot = fee * this.lobby._playerCount;
          const playersList = gameConfig.players.map(p => ({
            walletAddress: p.walletAddress,
            factionId: p.factionId
          }));

          let txSig = null;
          if (isRealWallet && this.wallet._provider) {
            try {
              startBtn.disabled = true;
              startBtn.textContent = '⏳ Fetching Escrow Vault Address...';

              const vaultAddr = await ProfileAPI.getVaultAddress();
              if (!vaultAddr) {
                alert('Unable to retrieve escrow vault address from server. Please try again.');
                startBtn.disabled = false;
                startBtn.textContent = '⚔️ START GAME ⚔️';
                return;
              }

              startBtn.textContent = `👻 Approve Wager Transfer of ${fee} $CTHULHU in Phantom...`;
              txSig = await executeWagerTransfer(this.wallet._provider, pubkey, vaultAddr, fee);

              startBtn.textContent = '🔍 Verifying Deposit On-Chain...';
              const verification = await ProfileAPI.verifyWagerDeposit(txSig, pubkey, fee);

              if (!verification || !verification.success) {
                alert(`Wager deposit verification failed: ${verification?.message || 'Transaction could not be confirmed on-chain'}`);
                startBtn.disabled = false;
                startBtn.textContent = '⚔️ START GAME ⚔️';
                return;
              }

              console.log('✓ Wager deposit successfully verified on-chain!');
            } catch (err) {
              console.error('Wager deposit error:', err);
              alert(`Wager transaction cancelled or failed: ${err.message || err}`);
              startBtn.disabled = false;
              startBtn.textContent = '⚔️ START GAME ⚔️';
              return;
            }
          }

          // Record wager match start in backend DB immediately so it shows in game logs/profile
          try {
            await ProfileAPI.recordWagerStart({
              gameId,
              entryFee: fee,
              prizePot: totalPot,
              players: playersList,
              txSignature: txSig
            });
            console.log(`[WagerStart] Recorded wager game ${gameId} with status 'in_progress'`);
          } catch (err) {
            console.warn('Failed to record wager start:', err);
          }
        }

        hide($('#setup-screen'));
        this._startResolver(gameConfig);
        this._startResolver = null;
      }
    }, [!hasFunds ? '⚠️ Insufficient Funds' : '⚔️ START GAME ⚔️']);
    
    if (!hasFunds) {
      startBtn.style.background = '#d32f2f';
      startBtn.style.color = '#fff';
    }
    
    section.appendChild(startBtn);
    return section;
  }

  // ================================================================
  // Tab 2: World Map Preview Tab
  // ================================================================
  _renderMapPreviewTab() {
    const wrapper = createElement('div');

    wrapper.appendChild(createElement('h2', { style: 'font-family:"Cinzel Decorative",cursive;color:#00e676;margin-bottom:8px;' }, ['🗺️ World Map Preview & Regional Intel']));
    wrapper.appendChild(createElement('p', { style: 'color:#94a3b8;font-family:"Cinzel",serif;margin-bottom:20px;' }, ['Click any region on the tactical map to inspect its territory features, gate slots, ocean routes, and starting faction lore.']));

    const mapGrid = createElement('div', { class: 'map-preview-wrapper' });

    // Map container
    const mapContainer = createElement('div', { id: 'landing-map-container' });
    mapGrid.appendChild(mapContainer);

    // Inspector card
    const inspector = createElement('div', { id: 'region-inspector', class: 'region-inspector-card' });
    this._renderRegionInspectorCard(inspector);
    mapGrid.appendChild(inspector);

    wrapper.appendChild(mapGrid);
    return wrapper;
  }

  _initMapPreview() {
    const container = $('#landing-map-container');
    if (!container) return;

    // Create a preview game state with all 4 factions
    const previewState = new GameState();
    previewState.initGame([
      { walletAddress: 'P1_Cthulhu', factionId: 'cthulhu' },
      { walletAddress: 'P2_Chaos', factionId: 'crawling_chaos' },
      { walletAddress: 'P3_Yellow', factionId: 'yellow_sign' },
      { walletAddress: 'P4_Goat', factionId: 'black_goat' }
    ]);

    this._previewMapRenderer = new MapRenderer(container, previewState);
    this._previewMapRenderer.init();

    this._previewMapRenderer.onRegionClick((regionId) => {
      this._selectedRegionId = regionId;
      const inspector = $('#region-inspector');
      if (inspector) {
        this._renderRegionInspectorCard(inspector);
      }
    });
  }

  _renderRegionInspectorCard(card) {
    card.innerHTML = '';

    if (!this._selectedRegionId || !MAP_REGIONS[this._selectedRegionId]) {
      card.appendChild(createElement('h3', { style: 'color:#448aff;margin-bottom:8px;font-family:"Cinzel",serif;' }, ['📍 Region Inspector']));
      card.appendChild(createElement('p', { style: 'font-size:0.9rem;color:#94a3b8;line-height:1.6;' }, [
        'Select any region on the map to view detailed strategy data including adjacent sea routes, Ritual Gate slots, and starting faction positions.'
      ]));
      card.appendChild(createElement('div', { style: 'margin-top:auto;padding:12px;background:rgba(0,230,118,0.06);border-radius:8px;border:1px dashed rgba(0,230,118,0.2);text-align:center;font-size:0.8rem;color:#00e676;' }, [
        '💡 Tip: Controlling Ritual Gates generates Doom and Power during the Doom Phase!'
      ]));
      return;
    }

    const reg = MAP_REGIONS[this._selectedRegionId];
    card.appendChild(createElement('h3', { style: 'color:#00e676;margin-bottom:4px;font-family:"Cinzel",serif;' }, [reg.name || this._selectedRegionId]));
    card.appendChild(createElement('div', { style: 'font-size:0.8rem;color:#448aff;font-weight:bold;margin-bottom:12px;' }, [`Type: ${reg.isOcean ? '🌊 Ocean Region' : '🏔️ Land Territory'}`]));

    const details = createElement('div', { style: 'font-size:0.85rem;display:flex;flex-direction:column;gap:8px;' }, [
      createElement('div', {}, [
        createElement('strong', { style: 'color:#aaa;' }, ['Adjacent Regions: ']),
        createElement('span', { style: 'color:#fff;' }, [(reg.adj || []).map(a => MAP_REGIONS[a]?.name || a).join(', ')])
      ]),
      createElement('div', {}, [
        createElement('strong', { style: 'color:#aaa;' }, ['Ritual Gate Capacity: ']),
        createElement('span', { style: 'color:#ffd600;font-weight:bold;' }, ['1 Gate Slot'])
      ])
    ]);
    card.appendChild(details);

    // Lore notes based on region
    let lore = 'A vital region contested by cosmic horrors in their struggle for planetary dominance.';
    if (reg.isOcean) {
      lore = 'Deep nautical waters where Great Cthulhu and the Deep Ones submerge their forces beyond standard land barriers.';
    } else if (this._selectedRegionId.includes('north_america') || this._selectedRegionId.includes('south_america')) {
      lore = 'Ancient ritual grounds rich in ley lines, ideal for constructing Doom Gates.';
    }

    card.appendChild(createElement('div', { style: 'margin-top:12px;font-size:0.8rem;color:#94a3b8;font-style:italic;line-height:1.5;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;' }, [lore]));
  }

  // ================================================================
  // Tab 3: Game Logs & Leaderboard Tab
  // ================================================================
  _renderLogsTab() {
    const wrapper = createElement('div');

    wrapper.appendChild(createElement('h2', { style: 'font-family:"Cinzel Decorative",cursive;color:#00e676;margin-bottom:8px;' }, ['📜 Game Logs & Global Leaderboard']));
    wrapper.appendChild(createElement('p', { style: 'color:#94a3b8;font-family:"Cinzel",serif;margin-bottom:20px;' }, ['Browse recent $CTHULHU wagered matches, winner prize pots, payout statuses, and global player rankings.']));

    // Subtabs
    const subtabs = createElement('div', { style: 'display:flex;gap:10px;margin-bottom:20px;' });
    
    const btnWagers = createElement('button', {
      class: `btn ${this._logsSubTab === 'wagers' ? 'active' : ''}`,
      style: this._logsSubTab === 'wagers' ? 'background:#00e676;color:#000;font-weight:bold;' : '',
      click: () => {
        this._logsSubTab = 'wagers';
        this.render();
      }
    }, ['💰 Wagered Matches & Payouts']);

    const btnLb = createElement('button', {
      class: `btn ${this._logsSubTab === 'leaderboard' ? 'active' : ''}`,
      style: this._logsSubTab === 'leaderboard' ? 'background:#448aff;color:#fff;font-weight:bold;' : '',
      click: () => {
        this._logsSubTab = 'leaderboard';
        this.render();
      }
    }, ['🏆 Global Leaderboard']);

    subtabs.appendChild(btnWagers);
    subtabs.appendChild(btnLb);
    wrapper.appendChild(subtabs);

    const logContent = createElement('div', { class: 'glass', style: 'padding:20px;border-radius:14px;' });
    
    if (this._logsSubTab === 'wagers') {
      logContent.appendChild(this._renderWagersList());
    } else {
      logContent.appendChild(this._renderLeaderboardTable());
    }

    wrapper.appendChild(logContent);
    return wrapper;
  }

  _renderWagersList() {
    const container = createElement('div');
    container.innerHTML = '<div style="color:#888;font-size:0.9rem;">Loading wager logs...</div>';

    ProfileAPI.getWagerLogs().then(logs => {
      container.innerHTML = '';
      if (!logs || logs.length === 0) {
        container.appendChild(createElement('p', { style: 'color:#888;text-align:center;padding:20px;' }, ['No wagered matches recorded yet. Start a match with a $CTHULHU entry fee!']));
        return;
      }

      const table = createElement('div', { class: 'leaderboard-table' });
      const headerRow = createElement('div', { class: 'lb-row lb-header', style: 'grid-template-columns: 100px 1fr 140px 120px 150px;' });
      ['Date', 'Winner Wallet', 'Faction', 'Prize Pot', 'Status'].forEach(h => {
        headerRow.appendChild(createElement('div', { class: 'lb-cell' }, [h]));
      });
      table.appendChild(headerRow);

      for (const w of logs) {
        const rawDate = w.completedAt || w.createdAt;
        const date = rawDate ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const winner = w.winnerWallet ? `${w.winnerWallet.slice(0, 6)}...${w.winnerWallet.slice(-4)}` : (w.status === 'in_progress' ? '⚔️ In Match' : '—');
        const faction = w.winnerFaction || '—';
        
        let statusText = '⏳ Pending Admin Payout';
        let statusColor = '#ffab00';
        if (w.status === 'paid') {
          statusText = '✅ Paid';
          statusColor = '#00c853';
        } else if (w.status === 'in_progress') {
          statusText = '⚔️ In Progress';
          statusColor = '#448aff';
        }

        const row = createElement('div', { class: 'lb-row', style: 'grid-template-columns: 100px 1fr 140px 120px 150px;' });
        row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'font-size:0.75rem;' }, [date]));
        row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#00e676;' }, [winner]));
        row.appendChild(createElement('div', { class: 'lb-cell' }, [faction]));
        row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#00e676;font-weight:bold;' }, [`🪙 ${w.prizePot || 0}`]));
        row.appendChild(createElement('div', { class: 'lb-cell mono', style: `color:${statusColor};font-size:0.8rem;` }, [statusText]));

        table.appendChild(row);
      }

      container.appendChild(table);
    }).catch(err => {
      container.innerHTML = `<div style="color:#ff5252;">Failed to load wager logs: ${err.message || err}</div>`;
    });

    return container;
  }

  _renderLeaderboardTable() {
    const container = createElement('div');
    container.innerHTML = '<div style="color:#888;font-size:0.9rem;">Loading leaderboard...</div>';

    ProfileAPI.getLeaderboard().then(lb => {
      container.innerHTML = '';
      if (!lb || lb.length === 0) {
        container.appendChild(createElement('p', { style: 'color:#888;text-align:center;padding:20px;' }, ['No leaderboard data available yet.']));
        return;
      }

      const table = createElement('div', { class: 'leaderboard-table' });
      const headerRow = createElement('div', { class: 'lb-row lb-header', style: 'grid-template-columns: 50px 1fr 100px 100px 100px;' });
      ['#', 'Player / Wallet', 'Games', 'Wins', 'Win Rate'].forEach(h => {
        headerRow.appendChild(createElement('div', { class: 'lb-cell' }, [h]));
      });
      table.appendChild(headerRow);

      lb.forEach((entry, idx) => {
        const rank = idx + 1;
        const name = entry.displayName || (entry.walletAddress ? `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}` : `Player ${rank}`);
        const games = entry.stats?.gamesPlayed || 0;
        const wins = entry.stats?.wins || 0;
        const winRate = games > 0 ? `${Math.round((wins / games) * 100)}%` : '0%';

        const row = createElement('div', { class: 'lb-row', style: 'grid-template-columns: 50px 1fr 100px 100px 100px;' });
        row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#ffd600;font-weight:bold;' }, [`#${rank}`]));
        row.appendChild(createElement('div', { class: 'lb-cell' }, [name]));
        row.appendChild(createElement('div', { class: 'lb-cell mono' }, [`${games}`]));
        row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#00e676;' }, [`${wins}`]));
        row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#448aff;' }, [winRate]));

        table.appendChild(row);
      });

      container.appendChild(table);
    }).catch(err => {
      container.innerHTML = `<div style="color:#ff5252;">Failed to load leaderboard: ${err.message || err}</div>`;
    });

    return container;
  }

  // ================================================================
  // Tab 4: Profile Tab
  // ================================================================
  _renderProfileTab() {
    const wrapper = createElement('div');
    const container = createElement('div', { id: 'landing-profile-container' });
    wrapper.appendChild(container);
    return wrapper;
  }

  hide() {
    hide($('#setup-screen'));
  }
}
