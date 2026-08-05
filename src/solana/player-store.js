import { getOnChainTokenBalance } from './token-api.js';

/**
 * Local storage backed player store.
 */
export class PlayerStore {
  constructor() {
    this._profiles = {};
    this._load();
  }

  /**
   * Loads profiles from local storage.
   * @private
   */
  _load() {
    try {
      this._profiles = JSON.parse(localStorage.getItem('cw_players') || '{}');
    } catch {
      this._profiles = {};
    }
  }

  /**
   * Saves profiles to local storage.
   * @private
   */
  _save() {
    localStorage.setItem('cw_players', JSON.stringify(this._profiles));
  }

  /**
   * Syncs real on-chain $CTHULHU token balance for a wallet address.
   * @param {string} addr 
   * @returns {Promise<number>} On-chain balance, or 0 if unresolvable
   */
  async syncOnChainBalance(addr) {
    if (!addr) return 0;
    const profile = this.getProfile(addr);
    const isRealWallet = addr && !addr.startsWith('DEV_') && !addr.startsWith('SOL_');

    const onChainBal = await getOnChainTokenBalance(addr);
    if (typeof onChainBal === 'number') {
      console.log(`[PlayerStore] On-chain balance synced for ${addr.slice(0,6)}...: ${onChainBal}`);
      profile.balance = onChainBal;
      profile._balanceVerified = true;
      this._save();
      return onChainBal;
    }

    // RPC failed — for real wallets, don't trust stale cached balance
    if (isRealWallet) {
      console.warn(`[PlayerStore] RPC sync failed for ${addr.slice(0,6)}..., cached balance: ${profile.balance}`);
      profile._balanceVerified = false;
      this._save();
    }
    return profile.balance || 0;
  }

  /**
   * Gets a profile, creating it if it doesn't exist.
   * @param {string} addr 
   * @returns {object}
   */
  getProfile(addr) {
    if (!this._profiles[addr]) {
      return this.createProfile(addr);
    }
    return this._profiles[addr];
  }

  /**
   * Creates a new profile.
   * @param {string} addr 
   * @returns {object}
   */
  createProfile(addr) {
    const isRealWallet = addr && !addr.startsWith('DEV_') && !addr.startsWith('SOL_');
    const shortAddr = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    const newProfile = {
      walletAddress: addr,
      displayName: shortAddr,
      balance: isRealWallet ? 0 : 1000, // Real wallets default to 0 on-chain tokens
      inventory: {
        unlockedDice: ['default'],
        activeDice: 'default'
      },
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        totalDoomScored: 0,
        highestDoom: 0,
        favoriteFaction: null,
        factionStats: {
          cthulhu: { played: 0, wins: 0 },
          crawling_chaos: { played: 0, wins: 0 },
          yellow_sign: { played: 0, wins: 0 },
          black_goat: { played: 0, wins: 0 }
        },
        lastPlayed: null
      },
      createdAt: Date.now()
    };
    this._profiles[addr] = newProfile;
    this._save();
    return newProfile;
  }

  /**
   * Updates an existing profile.
   * @param {string} addr 
   * @param {object} updates 
   */
  updateProfile(addr, updates) {
    if (!this._profiles[addr]) {
      this.createProfile(addr);
    }
    this._profiles[addr] = {
      ...this._profiles[addr],
      ...updates
    };
    this._save();
  }

  /**
   * Records a game result for a player.
   * @param {string} addr 
   * @param {object} result
   * @param {string} result.factionId
   * @param {number} result.doom
   * @param {boolean} result.won
   * @param {number} result.elderSignTotal
   */
  recordGameResult(addr, { factionId, doom, won, elderSignTotal }) {
    const profile = this.getProfile(addr);
    const stats = profile.stats;
    
    stats.gamesPlayed += 1;
    if (won) {
      stats.wins += 1;
    } else {
      stats.losses += 1;
    }
    
    stats.totalDoomScored += doom + (elderSignTotal || 0);
    if (doom > stats.highestDoom) {
      stats.highestDoom = doom;
    }
    
    if (!stats.factionStats[factionId]) {
      stats.factionStats[factionId] = { played: 0, wins: 0 };
    }
    
    stats.factionStats[factionId].played += 1;
    if (won) {
      stats.factionStats[factionId].wins += 1;
    }
    
    // Calculate favorite faction
    let maxPlays = -1;
    let fav = null;
    for (const [fac, data] of Object.entries(stats.factionStats)) {
      if (data.played > maxPlays) {
        maxPlays = data.played;
        fav = fac;
      }
    }
    stats.favoriteFaction = fav;
    stats.lastPlayed = Date.now();
    
    this._save();
  }

  /**
   * Gets the leaderboard sorted by wins descending.
   * @returns {Array}
   */
  getLeaderboard() {
    return Object.values(this._profiles).sort((a, b) => b.stats.wins - a.stats.wins);
  }

  /**
   * Sets the display name for a profile.
   * @param {string} addr 
   * @param {string} name 
   */
  setDisplayName(addr, name) {
    const profile = this.getProfile(addr);
    profile.displayName = name;
    this._save();
  }

  /**
   * Adds tokens to balance.
   * @param {string} addr 
   * @param {number} amount 
   */
  addBalance(addr, amount) {
    const profile = this.getProfile(addr);
    if (typeof profile.balance !== 'number') profile.balance = 0;
    profile.balance += amount;
    this._save();
  }

  /**
   * Deducts tokens from balance.
   * @param {string} addr 
   * @param {number} amount 
   * @returns {boolean} True if successful, false if insufficient funds
   */
  deductBalance(addr, amount) {
    const profile = this.getProfile(addr);
    if (typeof profile.balance !== 'number') profile.balance = 0;
    if (profile.balance >= amount) {
      profile.balance -= amount;
      this._save();
      return true;
    }
    return false;
  }
}
