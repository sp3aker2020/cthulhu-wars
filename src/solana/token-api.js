export const CTHULHU_TOKEN_MINT = 'ANohyVuF1cPGAVUNaX4wbuXV5ySPiUVwyaS1p3aDpump';

// Use our own backend API as primary (no CORS issues), fall back to direct RPC
const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://cthulhu-wars-api.onrender.com' : 'http://localhost:3001');

/**
 * Fetches real on-chain $CTHULHU token balance.
 * Primary: calls our server-side proxy (no CORS/rate-limit issues).
 * Fallback: direct browser-to-RPC calls.
 * @param {string} walletAddress 
 * @returns {Promise<number|null>} Balance in UI amount, or null if unresolvable / synthetic
 */
export async function getOnChainTokenBalance(walletAddress) {
  if (!walletAddress || walletAddress.startsWith('DEV_')) {
    return null;
  }

  if (walletAddress.startsWith('SOL_')) {
    return null;
  }

  // 1. Try our own backend proxy first (most reliable)
  try {
    console.log(`[TokenAPI] Fetching balance via server proxy for ${walletAddress.slice(0,6)}...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${API_BASE}/api/token-balance/${encodeURIComponent(walletAddress)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (typeof data.balance === 'number') {
        console.log(`[TokenAPI] ✓ Server proxy returned: ${data.balance.toLocaleString()} $CTHULHU (via ${data.source})`);
        return data.balance;
      }
      console.warn('[TokenAPI] Server proxy returned null balance:', data.error || 'unknown');
    }
  } catch (err) {
    console.warn('[TokenAPI] Server proxy failed:', err.message || err);
  }

  // 2. Fallback: direct browser-to-RPC
  console.log('[TokenAPI] Falling back to direct RPC...');
  const rpcEndpoints = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.g.alchemy.com/v2/demo'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { mint: CTHULHU_TOKEN_MINT },
            { encoding: 'jsonParsed', commitment: 'confirmed' }
          ]
        })
      });

      clearTimeout(timeout);

      if (!response.ok) continue;

      const data = await response.json();

      if (data.error) continue;

      if (data?.result?.value) {
        if (data.result.value.length === 0) return 0;

        let totalBalance = 0;
        for (const account of data.result.value) {
          const tokenAmount = account?.account?.data?.parsed?.info?.tokenAmount;
          if (tokenAmount && typeof tokenAmount.uiAmount === 'number') {
            totalBalance += tokenAmount.uiAmount;
          }
        }

        console.log(`[TokenAPI] ✓ Direct RPC returned: ${totalBalance.toLocaleString()} $CTHULHU`);
        return totalBalance;
      }
    } catch (err) {
      console.warn(`[TokenAPI] Direct RPC ${endpoint} failed:`, err.message || err);
    }
  }

  console.warn('[TokenAPI] All methods failed — returning null');
  return null;
}

/**
 * Builds and sends an SPL Token transfer transaction from the user's wallet to the vault.
 * @param {object} provider - Solana wallet provider (Phantom, Solflare, etc.)
 * @param {string} userWalletAddress - Sender's public key string
 * @param {string} vaultAddress - Receiver's public key string
 * @param {number} amount - Amount in $CTHULHU UI units
 * @returns {Promise<string>} Transaction signature
 */
export async function executeWagerTransfer(provider, userWalletAddress, vaultAddress, amount) {
  if (!provider || !provider.signAndSendTransaction) {
    throw new Error('Wallet provider does not support signing transactions');
  }

  const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
  const { 
    getAssociatedTokenAddress, 
    createAssociatedTokenAccountInstruction, 
    createTransferInstruction, 
    TOKEN_2022_PROGRAM_ID, 
    TOKEN_PROGRAM_ID 
  } = await import('@solana/spl-token');

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const mintPubkey = new PublicKey(CTHULHU_TOKEN_MINT);
  const userPubkey = new PublicKey(userWalletAddress);
  const vaultPubkey = new PublicKey(vaultAddress);

  // Pump.fun tokens use Token-2022
  let programId = TOKEN_2022_PROGRAM_ID;

  // Derive Associated Token Addresses
  const userAta = await getAssociatedTokenAddress(mintPubkey, userPubkey, false, programId);
  const vaultAta = await getAssociatedTokenAddress(mintPubkey, vaultPubkey, false, programId);

  const tx = new Transaction();

  // Check if vault ATA exists on-chain; if not, add instruction to create it
  const vaultAtaInfo = await connection.getAccountInfo(vaultAta);
  if (!vaultAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        userPubkey,
        vaultAta,
        vaultPubkey,
        mintPubkey,
        programId
      )
    );
  }

  // Amount with 6 decimals for $CTHULHU
  const rawAmount = BigInt(Math.floor(amount * 1e6));

  tx.add(
    createTransferInstruction(
      userAta,
      vaultAta,
      userPubkey,
      rawAmount,
      [],
      programId
    )
  );

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = userPubkey;

  console.log(`[TokenAPI] Requesting signature to transfer ${amount} $CTHULHU to vault (${vaultAddress})...`);
  const response = await provider.signAndSendTransaction(tx);
  const signature = response.signature || response;
  
  console.log(`[TokenAPI] Transaction sent! Signature: ${signature}`);
  return typeof signature === 'string' ? signature : signature.toString('hex');
}
