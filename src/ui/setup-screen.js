import { $, createElement, show, hide, addClass, removeClass } from '../utils/dom.js';
import { FACTIONS } from '../game/constants.js';
import { ProfilePage } from './profile-page.js';

export class SetupScreen {
  constructor(walletManager, playerStore, lobbyManager) {
    this.wallet = walletManager;
    this.store = playerStore;
    this.lobby = lobbyManager;
    this.profilePage = new ProfilePage(walletManager, playerStore);
    this._startResolver = null;
    this._currentStep = 'wallet';  // 'wallet' | 'lobby'
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
    
    // Title
    screen.appendChild(createElement('h1', { class: 'game-title' }, ['CTHULHU WARS']));
    screen.appendChild(createElement('div', { class: 'game-subtitle' }, ['THE STARS ARE RIGHT']));
    
    if (this._currentStep === 'wallet') {
      this._renderWalletSection(screen);
    } else {
      this._renderWalletBadge(screen);
      this._renderLobbySection(screen);
    }
  }

  _renderWalletSection(screen) {
    const section = createElement('div', { class: 'wallet-section glass' });
    section.appendChild(createElement('h3', { style: 'margin-bottom:16px;text-align:center' }, ['Connect Wallet to Play']));
    
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
    
    screen.appendChild(section);
  }

  _renderWalletBadge(screen) {
    const pubkey = this.wallet.getPublicKey();
    const profile = pubkey ? this.store.getProfile(pubkey) : null;
    const bal = profile ? (profile.balance || 0) : 0;

    const badge = createElement('div', { class: 'wallet-badge glass', style: 'display:flex;align-items:center;gap:12px;' }, [
      createElement('span', { class: 'token-balance', style: 'color:#00e676;font-weight:bold;' }, [`🪙 ${bal.toLocaleString()} $CTHULHU`]),
      createElement('span', { style: 'opacity:0.3;' }, ['|']),
      createElement('span', { class: 'wallet-dot' }),
      createElement('span', {}, [this.wallet.getShortAddress() || 'Connected']),
      createElement('span', { class: 'disconnect-btn', click: () => this.wallet.disconnect() }, ['Disconnect']),
    ]);
    screen.appendChild(badge);
  }

  _renderLobbySection(screen) {
    const section = createElement('div', { class: 'lobby-section glass' });
    
    // Player count selector
    const countRow = createElement('div', { class: 'player-count-selector', style: 'display:flex;gap:8px;margin-bottom:20px;justify-content:center' });
    for (let n = 2; n <= 4; n++) {
      const active = this.lobby._playerCount === n;
      const btn = createElement('button', {
        class: `btn ${active ? 'active' : ''}`,
        style: active ? 'background:#448aff;color:white;border-color:#448aff' : '',
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
      slotEl.appendChild(createElement('span', { class: 'slot-address' }, [slot.displayName || `Player ${i + 1}`]));
      
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
    
    // Player stats + Profile button
    if (this.wallet.isConnected()) {
      const profile = this.store.getProfile(this.wallet.getPublicKey());
      const profileRow = createElement('div', { style: 'margin-top:16px;display:flex;align-items:center;justify-content:center;gap:16px' });

      const stats = createElement('span', { style: 'opacity:0.6;font-size:0.85rem' }, [
        `${profile.stats.gamesPlayed} games played | ${profile.stats.wins} wins`
      ]);
      profileRow.appendChild(stats);

      const profileBtn = createElement('button', {
        class: 'btn',
        style: 'background:rgba(68,138,255,0.15);color:#448aff;border-color:#448aff40;padding:6px 16px;font-size:0.85rem;cursor:pointer',
        click: () => this.profilePage.show()
      }, ['👤 Profile']);
      profileRow.appendChild(profileBtn);

      section.appendChild(profileRow);
    }
    
    // Entry Fee Selector
    const feeRow = createElement('div', { style: 'margin-top:20px;text-align:center;padding:16px;background:rgba(0,0,0,0.4);border-radius:12px;border:1px solid rgba(0,230,118,0.3)' });
    feeRow.appendChild(createElement('h4', { style: 'color:#00e676;margin-bottom:12px;font-family:"Cinzel",serif' }, ['Game Entry Fee']));
    
    const feeOptions = [0, 100, 500, 1000];
    const feeBtnRow = createElement('div', { style: 'display:flex;gap:8px;justify-content:center' });
    
    for (const fee of feeOptions) {
      const active = this.lobby._entryFee === fee;
      const btn = createElement('button', {
        class: `btn ${active ? 'active' : ''}`,
        style: active ? 'background:#00e676;color:#000;border-color:#00e676;font-weight:bold' : 'color:#00e676;border-color:#00e676',
        click: () => {
          this.lobby.setEntryFee(fee);
          this.render();
        }
      }, [fee === 0 ? 'Free' : `🪙 ${fee}`]);
      feeBtnRow.appendChild(btn);
    }
    feeRow.appendChild(feeBtnRow);
    
    if (this.lobby._entryFee > 0) {
      const totalPot = this.lobby._entryFee * this.lobby._playerCount;
      feeRow.appendChild(createElement('div', { style: 'margin-top:12px;font-size:1.2rem;font-weight:bold;color:#ffab00' }, [
        `🏆 Prize Pot: 🪙 ${totalPot} $CTHULHU`
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
      click: () => {
        if (canStart && hasFunds && this._startResolver) {
          hide($('#setup-screen'));
          this._startResolver(this.lobby.getGameConfig());
          this._startResolver = null;
        }
      }
    }, [!hasFunds ? '⚠️ Insufficient Funds' : '⚔️ START GAME ⚔️']);
    
    if (!hasFunds) {
      startBtn.style.background = '#d32f2f';
      startBtn.style.color = '#fff';
    }
    
    section.appendChild(startBtn);
    
    screen.appendChild(section);
  }

  hide() {
    hide($('#setup-screen'));
  }
}
