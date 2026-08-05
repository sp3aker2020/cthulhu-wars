import { $, createElement, show, hide } from '../utils/dom.js';
import { FACTIONS } from '../game/constants.js';
import * as ProfileAPI from '../db/profile-api.js';

const FACTION_COLORS = {
  cthulhu: '#4caf50',
  crawling_chaos: '#7c4dff',
  yellow_sign: '#ffd600',
  black_goat: '#d50000'
};

const FACTION_NAMES = {
  cthulhu: 'Great Cthulhu',
  crawling_chaos: 'Crawling Chaos',
  yellow_sign: 'Yellow Sign',
  black_goat: 'Black Goat'
};

/**
 * Full-screen profile page overlay.
 */
export class ProfilePage {
  constructor(walletManager, playerStore) {
    this.wallet = walletManager;
    this.store = playerStore;
    this._profile = null;
    this._history = [];
    this._leaderboard = [];
    this._activeTab = 'stats'; // 'stats' | 'history' | 'leaderboard'
  }

  /**
   * Open the profile page overlay.
   */
  async show() {
    const container = $('#profile-page');
    if (!container) return;

    container.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div><p>Loading profile...</p></div>';
    container.style.display = 'block';

    // Fetch data in parallel
    const walletAddr = this.wallet.getPublicKey();
    const [profile, history, leaderboard] = await Promise.all([
      ProfileAPI.getProfile(walletAddr),
      ProfileAPI.getMatchHistory(walletAddr),
      ProfileAPI.getLeaderboard()
    ]);

    this._profile = profile;
    this._history = history || [];
    this._leaderboard = leaderboard || [];

    this.render();
  }

  /**
   * Close the profile page.
   */
  close() {
    const container = $('#profile-page');
    if (container) {
      hide(container);
      container.innerHTML = '';
    }
  }

  /**
   * Render the full profile page.
   */
  render() {
    const container = $('#profile-page');
    if (!container) return;
    container.innerHTML = '';

    const page = createElement('div', { class: 'profile-wrapper' });

    // ─── Header ───
    page.appendChild(this._renderHeader());

    // ─── Tab Nav ───
    page.appendChild(this._renderTabs());

    // ─── Tab Content ───
    if (this._activeTab === 'stats') {
      page.appendChild(this._renderStats());
      page.appendChild(this._renderFactionBreakdown());
    } else if (this._activeTab === 'history') {
      page.appendChild(this._renderMatchHistory());
    } else if (this._activeTab === 'leaderboard') {
      page.appendChild(this._renderLeaderboard());
    }

    container.appendChild(page);
  }

  // ================================================================
  // Header
  // ================================================================
  _renderHeader() {
    const p = this._profile || {};
    const walletAddr = this.wallet.getPublicKey() || '';
    const shortAddr = `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`;
    const memberSince = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

    const header = createElement('div', { class: 'profile-header glass' });

    // Back button
    const backBtn = createElement('button', {
      class: 'profile-back-btn',
      click: () => this.close()
    }, ['← Back']);
    header.appendChild(backBtn);

    // Identity
    const identity = createElement('div', { class: 'profile-identity' });

    // Avatar circle with first letter of display name
    const displayName = p.displayName || shortAddr;
    const avatarLetter = displayName.charAt(0).toUpperCase();
    const factionColor = FACTION_COLORS[p.favoriteFaction] || '#448aff';
    const avatar = createElement('div', {
      class: 'profile-avatar',
      style: `background: ${factionColor}; box-shadow: 0 0 20px ${factionColor}40`
    }, [avatarLetter]);
    identity.appendChild(avatar);

    // Name + wallet + edit
    const nameSection = createElement('div', { class: 'profile-name-section' });

    const nameRow = createElement('div', { class: 'profile-name-row' });
    const nameEl = createElement('h2', { class: 'profile-display-name' }, [displayName]);
    nameRow.appendChild(nameEl);

    // Edit name button
    const editBtn = createElement('button', {
      class: 'profile-edit-btn',
      click: () => this._showEditNameModal()
    }, ['✏️']);
    nameRow.appendChild(editBtn);
    nameSection.appendChild(nameRow);

    // Wallet address (always visible)
    const walletEl = createElement('div', { class: 'profile-wallet-addr mono' }, [walletAddr]);
    nameSection.appendChild(walletEl);

    // Link Phantom button if currently using Privy synthetic address or want to switch
    const isPrivyUser = walletAddr.startsWith('SOL_');
    const linkPhantomBtn = createElement('button', {
      class: 'btn',
      style: `margin-top:8px;padding:4px 12px;font-size:0.8rem;background:linear-gradient(135deg,#ab9ff2,#7a6be6);color:white;border:none;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;`,
      click: async () => {
        try {
          const provider = window.phantom?.solana || window.solana;
          if (!provider) {
            alert('Phantom wallet extension not detected. Please install Phantom from phantom.app!');
            return;
          }
          linkPhantomBtn.textContent = 'Connecting...';
          const resp = await provider.connect();
          const phantomKey = resp.publicKey.toString();
          
          // Link balance and stats from Privy user to Phantom address
          if (this.store) {
            const currentProfile = this.store.getProfile(walletAddr);
            const phantomProfile = this.store.getProfile(phantomKey);
            phantomProfile.balance = (phantomProfile.balance || 0) + (currentProfile.balance || 0);
            this.store.saveProfiles();
          }

          await this.wallet.connect('phantom');
          this.show(); // Refresh profile screen
        } catch (err) {
          console.error('Phantom connection error:', err);
          linkPhantomBtn.textContent = '👻 Link Phantom Wallet';
        }
      }
    }, ['👻 ' + (isPrivyUser ? 'Link Phantom Wallet' : 'Switch to Phantom')]);
    nameSection.appendChild(linkPhantomBtn);

    // Member since
    const sinceEl = createElement('div', { class: 'profile-since', style: 'margin-top:4px' }, [`Member since ${memberSince}`]);
    nameSection.appendChild(sinceEl);

    identity.appendChild(nameSection);
    header.appendChild(identity);

    return header;
  }

  // ================================================================
  // Tab Navigation
  // ================================================================
  _renderTabs() {
    const nav = createElement('div', { class: 'profile-tabs' });

    const tabs = [
      { id: 'stats', label: '📊 Stats' },
      { id: 'history', label: '📜 Match History' },
      { id: 'leaderboard', label: '🏆 Leaderboard' }
    ];

    for (const tab of tabs) {
      const btn = createElement('button', {
        class: `profile-tab ${this._activeTab === tab.id ? 'active' : ''}`,
        click: () => {
          this._activeTab = tab.id;
          this.render();
        }
      }, [tab.label]);
      nav.appendChild(btn);
    }

    return nav;
  }

  // ================================================================
  // Stats Cards
  // ================================================================
  _renderStats() {
    const p = this._profile || {};
    const winRate = p.gamesPlayed > 0 ? ((p.wins / p.gamesPlayed) * 100).toFixed(1) : '0.0';

    const grid = createElement('div', { class: 'profile-stats-grid' });

    const cards = [
      { label: 'Games Played', value: p.gamesPlayed || 0, color: '#448aff', icon: '🎲' },
      { label: 'Wins', value: p.wins || 0, color: '#00c853', icon: '🏆' },
      { label: 'Losses', value: p.losses || 0, color: '#ff1744', icon: '💀' },
      { label: 'Win Rate', value: `${winRate}%`, color: '#ffd600', icon: '📈' },
      { label: 'Total Doom', value: p.totalDoomScored || 0, color: '#880e4f', icon: '🔮' },
      { label: 'Highest Doom', value: p.highestDoom || 0, color: '#e040fb', icon: '⭐' }
    ];

    for (const card of cards) {
      const el = createElement('div', {
        class: 'profile-stat-card glass',
        style: `border-color: ${card.color}30`
      });

      el.appendChild(createElement('div', { class: 'stat-icon' }, [card.icon]));
      el.appendChild(createElement('div', {
        class: 'stat-value mono',
        style: `color: ${card.color}`
      }, [String(card.value)]));
      el.appendChild(createElement('div', { class: 'stat-label' }, [card.label]));

      grid.appendChild(el);
    }

    return grid;
  }

  // ================================================================
  // Faction Breakdown
  // ================================================================
  _renderFactionBreakdown() {
    const p = this._profile || {};
    const factionStats = p.factionStats || {};

    const section = createElement('div', { class: 'profile-section' });
    section.appendChild(createElement('h3', { class: 'profile-section-title' }, ['Faction Breakdown']));

    const grid = createElement('div', { class: 'faction-breakdown-grid' });

    for (const [factionId, stats] of Object.entries(factionStats)) {
      const color = FACTION_COLORS[factionId] || '#888';
      const name = FACTION_NAMES[factionId] || factionId;
      const wr = stats.played > 0 ? ((stats.wins / stats.played) * 100).toFixed(0) : '0';

      const card = createElement('div', {
        class: 'faction-stat-card glass',
        style: `border-left: 3px solid ${color}`
      });

      card.appendChild(createElement('div', {
        class: 'faction-stat-name',
        style: `color: ${color}`
      }, [name]));

      const row = createElement('div', { class: 'faction-stat-row' });
      row.appendChild(createElement('span', { class: 'mono' }, [`${stats.played || 0} played`]));
      row.appendChild(createElement('span', { class: 'mono' }, [`${stats.wins || 0} W`]));
      row.appendChild(createElement('span', {
        class: 'mono',
        style: `color: ${color}`
      }, [`${wr}% WR`]));
      card.appendChild(row);

      // Win rate bar
      const bar = createElement('div', { class: 'faction-wr-bar' });
      const fill = createElement('div', {
        class: 'faction-wr-fill',
        style: `width: ${wr}%; background: ${color}`
      });
      bar.appendChild(fill);
      card.appendChild(bar);

      grid.appendChild(card);
    }

    section.appendChild(grid);
    return section;
  }

  // ================================================================
  // Match History
  // ================================================================
  _renderMatchHistory() {
    const section = createElement('div', { class: 'profile-section' });
    section.appendChild(createElement('h3', { class: 'profile-section-title' }, ['Recent Matches']));

    if (!this._history || this._history.length === 0) {
      section.appendChild(createElement('p', { class: 'profile-empty' }, ['No matches recorded yet. Play a game to see your history here!']));
      return section;
    }

    const table = createElement('div', { class: 'match-history-table' });

    // Header row
    const headerRow = createElement('div', { class: 'match-row match-header' });
    ['Date', 'Faction', 'Doom', 'Result', 'Players'].forEach(h => {
      headerRow.appendChild(createElement('div', { class: 'match-cell' }, [h]));
    });
    table.appendChild(headerRow);

    // Match rows
    for (const match of this._history) {
      const date = new Date(match.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const factionName = FACTION_NAMES[match.factionId] || match.factionId;
      const factionColor = FACTION_COLORS[match.factionId] || '#888';
      const totalDoom = (match.doomScore || 0) + (match.elderSigns || 0);

      const row = createElement('div', {
        class: `match-row ${match.won ? 'match-win' : 'match-loss'}`
      });

      row.appendChild(createElement('div', { class: 'match-cell mono' }, [date]));
      row.appendChild(createElement('div', {
        class: 'match-cell',
        style: `color: ${factionColor}`
      }, [factionName]));
      row.appendChild(createElement('div', { class: 'match-cell mono' }, [String(totalDoom)]));
      row.appendChild(createElement('div', {
        class: `match-cell match-result-badge ${match.won ? 'win' : 'loss'}`
      }, [match.won ? 'W' : 'L']));
      row.appendChild(createElement('div', { class: 'match-cell mono' }, [`${match.playerCount || '—'}p`]));

      table.appendChild(row);
    }

    section.appendChild(table);
    return section;
  }

  // ================================================================
  // Leaderboard
  // ================================================================
  _renderLeaderboard() {
    const section = createElement('div', { class: 'profile-section' });
    section.appendChild(createElement('h3', { class: 'profile-section-title' }, ['Global Leaderboard']));

    if (!this._leaderboard || this._leaderboard.length === 0) {
      section.appendChild(createElement('p', { class: 'profile-empty' }, ['No players on the leaderboard yet. Be the first!']));
      return section;
    }

    const table = createElement('div', { class: 'leaderboard-table' });

    // Header
    const headerRow = createElement('div', { class: 'lb-row lb-header' });
    ['#', 'Player', 'Wallet', 'W', 'L', 'Games', 'Best Doom'].forEach(h => {
      headerRow.appendChild(createElement('div', { class: 'lb-cell' }, [h]));
    });
    table.appendChild(headerRow);

    // Player rows
    const myWallet = this.wallet.getPublicKey();
    this._leaderboard.forEach((player, idx) => {
      const isMe = player._id === myWallet || player.walletAddress === myWallet;
      const shortWallet = player.walletAddress
        ? `${player.walletAddress.slice(0, 4)}...${player.walletAddress.slice(-4)}`
        : '—';
      const rank = idx + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;

      const row = createElement('div', {
        class: `lb-row ${isMe ? 'lb-me' : ''}`
      });

      row.appendChild(createElement('div', { class: 'lb-cell lb-rank' }, [medal]));
      row.appendChild(createElement('div', { class: 'lb-cell lb-name' }, [player.displayName || shortWallet]));
      row.appendChild(createElement('div', { class: 'lb-cell lb-wallet mono' }, [shortWallet]));
      row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#00c853' }, [String(player.wins || 0)]));
      row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#ff1744' }, [String(player.losses || 0)]));
      row.appendChild(createElement('div', { class: 'lb-cell mono' }, [String(player.gamesPlayed || 0)]));
      row.appendChild(createElement('div', { class: 'lb-cell mono', style: 'color:#e040fb' }, [String(player.highestDoom || 0)]));

      table.appendChild(row);
    });

    section.appendChild(table);
    return section;
  }

  // ================================================================
  // Edit Name Modal
  // ================================================================
  _showEditNameModal() {
    const container = $('#profile-page');
    if (!container) return;

    const overlay = createElement('div', { class: 'profile-modal-overlay' });
    const modal = createElement('div', { class: 'profile-modal glass' });

    modal.appendChild(createElement('h3', {}, ['Set Display Name']));

    const input = createElement('input', {
      type: 'text',
      class: 'profile-name-input',
      placeholder: 'Enter your name (max 32 chars)',
      value: this._profile?.displayName || '',
      maxlength: '32'
    });
    modal.appendChild(input);

    const btnRow = createElement('div', { class: 'profile-modal-btns' });

    const cancelBtn = createElement('button', {
      class: 'btn',
      click: () => overlay.remove()
    }, ['Cancel']);
    btnRow.appendChild(cancelBtn);

    const saveBtn = createElement('button', {
      class: 'btn start-btn',
      style: 'background:linear-gradient(135deg,#448aff,#1565c0);color:white',
      click: async () => {
        const name = input.value.trim();
        if (name.length > 0) {
          saveBtn.textContent = 'Saving...';
          saveBtn.disabled = true;
          const result = await ProfileAPI.updateDisplayName(this.wallet.getPublicKey(), name);
          if (result) {
            this._profile = result;
          }
          overlay.remove();
          this.render();
        }
      }
    }, ['Save']);
    btnRow.appendChild(saveBtn);

    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    container.appendChild(overlay);

    // Focus input
    setTimeout(() => input.focus(), 100);
  }
}
