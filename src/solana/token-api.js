export const CTHULHU_TOKEN_MINT = 'ANohyVuF1cPGAVUNaX4wbuXV5ySPiUVwyaS1p3aDpump';

/**
 * Fetches real on-chain $CTHULHU token balance from Solana mainnet RPC.
 * @param {string} walletAddress 
 * @returns {Promise<number|null>} Balance in UI amount, or null if unresolvable / synthetic
 */
export async function getOnChainTokenBalance(walletAddress) {
  if (!walletAddress || walletAddress.startsWith('DEV_') || walletAddress.startsWith('SOL_')) {
    return null;
  }

  const rpcEndpoints = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { mint: CTHULHU_TOKEN_MINT },
            { encoding: 'jsonParsed' }
          ]
        })
      });

      const data = await response.json();
      if (data && data.result && Array.isArray(data.result.value)) {
        if (data.result.value.length === 0) {
          return 0; // Account holds 0 tokens of this CA
        }

        const tokenAccount = data.result.value[0];
        const tokenAmount = tokenAccount?.account?.data?.parsed?.info?.tokenAmount;
        if (tokenAmount && typeof tokenAmount.uiAmount === 'number') {
          return tokenAmount.uiAmount;
        }
      }
    } catch (err) {
      console.warn(`RPC endpoint ${endpoint} failed for token balance fetch:`, err);
    }
  }

  return null;
}
