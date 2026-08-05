export const CTHULHU_TOKEN_MINT = 'ANohyVuF1cPGAVUNaX4wbuXV5ySPiUVwyaS1p3aDpump';

/**
 * Fetches real on-chain $CTHULHU token balance from Solana mainnet RPC endpoints.
 * Queries using the mint filter which covers both SPL Token and Token-2022 programs.
 * @param {string} walletAddress 
 * @returns {Promise<number|null>} Balance in UI amount, or null if unresolvable / synthetic
 */
export async function getOnChainTokenBalance(walletAddress) {
  if (!walletAddress || walletAddress.startsWith('DEV_')) {
    return null;
  }

  // Handle synthetic SOL_ addresses if user logged in via Privy social without Phantom
  if (walletAddress.startsWith('SOL_')) {
    return null;
  }

  const rpcEndpoints = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.g.alchemy.com/v2/demo'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`[TokenAPI] Fetching $CTHULHU balance from ${endpoint} for ${walletAddress.slice(0,6)}...`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

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

      if (!response.ok) {
        console.warn(`[TokenAPI] RPC ${endpoint} returned HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.error) {
        console.warn(`[TokenAPI] RPC error from ${endpoint}:`, data.error);
        continue;
      }

      if (data && data.result && Array.isArray(data.result.value)) {
        if (data.result.value.length === 0) {
          console.log(`[TokenAPI] No token account found for this wallet — balance is 0`);
          return 0;
        }

        // Sum all matching token accounts (covers both SPL Token & Token-2022)
        let totalBalance = 0;
        for (const account of data.result.value) {
          const tokenAmount = account?.account?.data?.parsed?.info?.tokenAmount;
          if (tokenAmount && typeof tokenAmount.uiAmount === 'number') {
            totalBalance += tokenAmount.uiAmount;
          }
        }

        console.log(`[TokenAPI] ✓ On-chain balance: ${totalBalance.toLocaleString()} $CTHULHU`);
        return totalBalance;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[TokenAPI] RPC ${endpoint} timed out after 12s`);
      } else {
        console.warn(`[TokenAPI] RPC ${endpoint} failed:`, err.message || err);
      }
    }
  }

  console.warn('[TokenAPI] All RPC endpoints failed — returning null');
  return null;
}
