import EventEmitter from '../utils/events.js';

/**
 * Manages lobby state for Cthulhu Wars setup.
 */
export class LobbyManager extends EventEmitter {
  constructor(maxPlayers = 4) {
    super();
    this._maxPlayers = maxPlayers;
    this._playerCount = 2;
    this._slots = Array.from({ length: maxPlayers }, () => ({ 
      walletAddress: null, 
      displayName: null, 
      factionId: null, 
      ready: false 
    }));
  }

  setPlayerCount(count) {
    if (count < 2 || count > this._maxPlayers) {
      throw new Error(`Player count must be between 2 and ${this._maxPlayers}`);
    }
    this._playerCount = count;
    
    // Auto populate/clear slots to match count
    for (let i = count; i < this._maxPlayers; i++) {
      this.leaveSlot(i);
    }
    this.emit('playerCountChanged', this._playerCount);
  }

  joinSlot(idx, addr, name) {
    if (idx < 0 || idx >= this._playerCount) {
      throw new Error('Invalid slot index');
    }

    this._slots[idx].walletAddress = addr;
    this._slots[idx].displayName = name || `Player ${idx + 1}`;
    this._slots[idx].ready = true;
    this.emit('slotUpdated', idx, this._slots[idx]);
  }

  leaveSlot(idx) {
    if (idx < 0 || idx >= this._maxPlayers) return;
    this._slots[idx] = { walletAddress: null, displayName: null, factionId: null, ready: false };
    this.emit('slotUpdated', idx, this._slots[idx]);
  }

  selectFaction(idx, factionId) {
    if (idx < 0 || idx >= this._playerCount) throw new Error('Invalid slot');
    if (!this._slots[idx].walletAddress) throw new Error('Slot is empty');

    // Ensure no duplicates
    for (let i = 0; i < this._playerCount; i++) {
      if (i !== idx && this._slots[i].factionId === factionId) {
        this._slots[i].factionId = null; // deselect from previous owner
        this.emit('slotUpdated', i, this._slots[i]);
      }
    }

    this._slots[idx].factionId = factionId;
    this.emit('factionSelected', idx, factionId);
    this.emit('slotUpdated', idx, this._slots[idx]);
  }

  setReady(idx, ready) {
    if (idx < 0 || idx >= this._playerCount) throw new Error('Invalid slot');
    if (!this._slots[idx].walletAddress) throw new Error('Slot is empty');
    this._slots[idx].ready = ready;
    this.emit('readyChanged', idx, ready);
    this.emit('slotUpdated', idx, this._slots[idx]);
  }

  getAvailableFactions() {
    const defaultFactions = ['cthulhu', 'crawling_chaos', 'yellow_sign', 'black_goat'];
    const taken = this._slots.slice(0, this._playerCount).map(s => s.factionId).filter(Boolean);
    return defaultFactions.filter(f => !taken.includes(f));
  }

  isAllReady() {
    for (let i = 0; i < this._playerCount; i++) {
      const s = this._slots[i];
      if (!s.walletAddress || !s.factionId || !s.ready) {
        return false;
      }
    }
    return true;
  }

  getGameConfig() {
    return this._slots.slice(0, this._playerCount).map((slot, i) => ({
      walletAddress: slot.walletAddress || `Player_${i + 1}`,
      factionId: slot.factionId
    }));
  }

  reset() {
    this._slots = Array.from({ length: this._maxPlayers }, () => ({
      walletAddress: null,
      displayName: null,
      factionId: null,
      ready: false
    }));
  }

  getState() {
    return {
      playerCount: this._playerCount,
      slots: [...this._slots]
    };
  }
}
