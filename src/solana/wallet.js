import EventEmitter from '../utils/events.js';

/**
 * Manages wallet connections for Solana.
 */
export class WalletManager extends EventEmitter {
  constructor() {
    super();
    this._provider = null;
    this._publicKey = null;
    this._walletId = null;
    this._walletName = null;
  }

  /**
   * Returns available wallets and their detection status.
   * @returns {Array<{id: string, name: string, icon: string, detected: boolean}>}
   */
  getAvailableWallets() {
    return [
      { id: 'phantom', name: 'Phantom', icon: '👻', detected: !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom) },
      { id: 'solflare', name: 'Solflare', icon: '☀️', detected: !!window.solflare?.isSolflare },
      { id: 'backpack', name: 'Backpack', icon: '🎒', detected: !!window.backpack },
    ];
  }

  /**
   * Gets the provider object based on the wallet ID.
   * @param {string} walletId 
   * @returns {object|null}
   * @private
   */
  _getProvider(walletId) {
    switch (walletId) {
      case 'phantom':
        return window.phantom?.solana || window.solana;
      case 'solflare':
        return window.solflare;
      case 'backpack':
        return window.backpack;
      default:
        return null;
    }
  }

  /**
   * Connects to the specified wallet.
   * @param {string} walletId 
   */
  async connect(walletId) {
    try {
      const provider = this._getProvider(walletId);
      if (!provider) {
        throw new Error(`Wallet ${walletId} not found.`);
      }

      let resp;
      if (walletId === 'backpack') {
        await provider.connect();
        resp = { publicKey: provider.publicKey };
      } else {
        resp = await provider.connect();
      }

      this._provider = provider;
      this._publicKey = resp.publicKey.toString();
      this._walletId = walletId;
      this._walletName = this.getAvailableWallets().find(w => w.id === walletId)?.name || 'Unknown';
      
      localStorage.setItem('cw_lastWallet', walletId);
      
      provider.on('disconnect', () => {
        this._handleDisconnect();
      });

      provider.on('accountChanged', (publicKey) => {
        if (publicKey) {
          this._publicKey = publicKey.toString();
          this.emit('accountChanged', this._publicKey);
        } else {
          this._handleDisconnect();
        }
      });

      this.emit('connected', this._publicKey);
    } catch (err) {
      console.error('Wallet connection error:', err);
      throw err;
    }
  }

  /**
   * Internal disconnect handler
   * @private
   */
  _handleDisconnect() {
    this._provider = null;
    this._publicKey = null;
    this._walletId = null;
    this._walletName = null;
    localStorage.removeItem('cw_lastWallet');
    this.emit('disconnected');
  }

  /**
   * Disconnects the wallet.
   */
  async disconnect() {
    if (this._provider) {
      try {
        await this._provider.disconnect();
      } catch (err) {
        console.error('Disconnect error:', err);
      }
    }
    this._handleDisconnect();
  }

  /**
   * Signs a message.
   * @param {string} message 
   * @returns {Promise<Uint8Array>}
   */
  async signMessage(message) {
    if (!this._provider) throw new Error('Not connected');
    const encodedMessage = new TextEncoder().encode(message);
    
    if (this._walletId === 'phantom' || this._walletId === 'solflare') {
      const signedMessage = await this._provider.signMessage(encodedMessage, 'utf8');
      return signedMessage.signature;
    } else if (this._walletId === 'backpack') {
      return await this._provider.signMessage(encodedMessage);
    }
    throw new Error('Message signing not supported for this wallet');
  }

  /**
   * @returns {boolean}
   */
  isConnected() {
    return !!this._publicKey;
  }

  /**
   * @returns {string|null}
   */
  getPublicKey() {
    return this._publicKey;
  }

  /**
   * @returns {string|null}
   */
  getWalletName() {
    return this._walletName;
  }

  /**
   * @returns {string|null}
   */
  getShortAddress() {
    if (!this._publicKey) return null;
    return `${this._publicKey.slice(0, 4)}...${this._publicKey.slice(-4)}`;
  }

  /**
   * Tries to reconnect from stored local state.
   */
  async tryReconnect() {
    const lastWallet = localStorage.getItem('cw_lastWallet');
    if (lastWallet) {
      try {
        const provider = this._getProvider(lastWallet);
        if (provider) {
           let resp;
           if (lastWallet === 'backpack') {
             await provider.connect();
             resp = { publicKey: provider.publicKey };
           } else {
             resp = await provider.connect({ onlyIfTrusted: true });
           }
           
           this._provider = provider;
           this._publicKey = resp.publicKey.toString();
           this._walletId = lastWallet;
           this._walletName = this.getAvailableWallets().find(w => w.id === lastWallet)?.name || 'Unknown';
           
           provider.on('disconnect', () => this._handleDisconnect());
           provider.on('accountChanged', (publicKey) => {
             if (publicKey) {
               this._publicKey = publicKey.toString();
               this.emit('accountChanged', this._publicKey);
             } else {
               this._handleDisconnect();
             }
           });
           
           this.emit('connected', this._publicKey);
        }
      } catch (err) {
        console.warn('Auto-reconnect failed', err);
        localStorage.removeItem('cw_lastWallet');
      }
    }
  }
}
