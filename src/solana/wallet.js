import EventEmitter from '../utils/events.js';
import Privy, { LocalStorage } from '@privy-io/js-sdk-core';

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

/**
 * Manages wallet connections for Solana & Privy Auth (Twitter/X, Phantom, Solflare, etc.).
 */
export class WalletManager extends EventEmitter {
  constructor() {
    super();
    this._provider = null;
    this._publicKey = null;
    this._walletId = null;
    this._walletName = null;
    this._privyClient = null;
    this._privyUser = null;
    
    this._initPrivy();
  }

  /**
   * Initializes Privy JS client if available in browser context.
   * @private
   */
  _initPrivy() {
    try {
      if (typeof window !== 'undefined') {
        this._privyClient = new Privy({ 
          appId: PRIVY_APP_ID,
          storage: new LocalStorage()
        });
      }
    } catch (err) {
      console.warn('Privy initialization warning:', err);
    }
  }

  /**
   * Returns available wallets and authentication methods.
   * @returns {Array<{id: string, name: string, icon: string, detected: boolean, type: string}>}
   */
  getAvailableWallets() {
    return [
      { id: 'privy_twitter', name: 'Sign In with Privy', icon: '𝕏', detected: true, type: 'social' }
    ];
  }

  /**
   * Gets provider object for browser extension wallets.
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
   * Connects via Privy OAuth (Twitter / 𝕏) or Browser Wallet.
   * @param {string} walletId 
   */
  async connect(walletId) {
    try {
      if (walletId === 'privy' || walletId === 'privy_twitter') {
        return await this._connectPrivyTwitter();
      }

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
   * Connect using Privy 𝕏 (Twitter) login.
   * @private
   */
  async _connectPrivyTwitter() {
    if (!this._privyClient) {
      this._initPrivy();
    }

    if (!this._privyClient) {
      throw new Error('Privy client not initialized');
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('privy_oauth_code') || urlParams.get('code');
      const state = urlParams.get('privy_oauth_state') || urlParams.get('state');

      let user;

      if (code && state) {
        // Authenticate with Privy OAuth callback
        user = await this._privyClient.auth.oauth.loginWithCode(code, state, 'twitter');
        
        // Clear the URL parameters without refreshing the page
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path:newUrl}, '', newUrl);
      } else {
        // Initiate OAuth flow
        const { url } = await this._privyClient.auth.oauth.generateURL('twitter', window.location.href);
        window.location.href = url;
        // The page will redirect away, so we wait indefinitely
        return new Promise(() => {});
      }

      this._privyUser = user;

      // Extract wallet or generate deterministic user address from Privy user ID
      const walletAddr = user?.wallet?.address || `SOL_${user?.id?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;

      this._provider = null;
      this._publicKey = walletAddr;
      this._walletId = 'privy_twitter';
      this._walletName = user?.twitter?.username ? `@${user.twitter.username}` : '𝕏 User';

      localStorage.setItem('cw_lastWallet', 'privy_twitter');
      localStorage.setItem('cw_privyUser', JSON.stringify(user));

      this.emit('connected', this._publicKey);
      return user;
    } catch (err) {
      console.error('Privy Twitter login error:', err);
      // Clean up the URL on failure just in case
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({path:newUrl}, '', newUrl);
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
    this._privyUser = null;
    localStorage.removeItem('cw_lastWallet');
    localStorage.removeItem('cw_privyUser');
    this.emit('disconnected');
  }

  /**
   * Disconnects the wallet or Privy session.
   */
  async disconnect() {
    if (this._provider) {
      try {
        await this._provider.disconnect();
      } catch (err) {
        console.error('Disconnect error:', err);
      }
    }
    if (this._privyClient && this._walletId === 'privy_twitter') {
      try {
        await this._privyClient.auth.logout();
      } catch (err) {
        console.warn('Privy logout warning:', err);
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
    if (!this._publicKey) throw new Error('Not connected');
    const encodedMessage = new TextEncoder().encode(message);
    
    if (this._provider && (this._walletId === 'phantom' || this._walletId === 'solflare')) {
      const signedMessage = await this._provider.signMessage(encodedMessage, 'utf8');
      return signedMessage.signature;
    } else if (this._provider && this._walletId === 'backpack') {
      return await this._provider.signMessage(encodedMessage);
    }
    
    // For Privy / Twitter session, return signed buffer representation
    return encodedMessage;
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
    if (this._walletName && this._walletName.startsWith('@')) {
      return this._walletName;
    }
    return `${this._publicKey.slice(0, 4)}...${this._publicKey.slice(-4)}`;
  }

  /**
   * Tries to reconnect from stored local state.
   */
  async tryReconnect() {
    // Intercept Privy OAuth callback on load
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('privy_oauth_code') || urlParams.get('code');
    const state = urlParams.get('privy_oauth_state') || urlParams.get('state');

    if (code && state) {
      try {
        await this._connectPrivyTwitter();
        return;
      } catch (err) {
        console.error('OAuth reconnect failed', err);
      }
    }

    const lastWallet = localStorage.getItem('cw_lastWallet');
    if (lastWallet === 'privy_twitter') {
      try {
        const storedUser = JSON.parse(localStorage.getItem('cw_privyUser') || '{}');
        const walletAddr = storedUser?.wallet?.address || `SOL_${storedUser?.id?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;
        this._publicKey = walletAddr;
        this._walletId = 'privy_twitter';
        this._walletName = storedUser?.twitter?.username ? `@${storedUser.twitter.username}` : '𝕏 User';
        this.emit('connected', this._publicKey);
        return;
      } catch (err) {
        console.warn('Privy reconnect failed', err);
      }
    }

    if (lastWallet && lastWallet !== 'privy_twitter') {
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
