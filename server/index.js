import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getProfiles, getMatches, getWagers, closeDB } from './db.js';
import { getVaultPublicKey, verifyDeposit, sendPrizeToWinner } from './vault.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================
// Health Check
// ============================================================
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// GET /api/profile/:walletAddress
// Fetch a player profile. Creates one if it doesn't exist.
// ============================================================
app.get('/api/profile/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const profiles = await getProfiles();

    let profile = await profiles.findOne({ _id: walletAddress });

    if (!profile) {
      const shortAddr = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
      profile = {
        _id: walletAddress,
        walletAddress,
        displayName: shortAddr,
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
        createdAt: new Date(),
        lastPlayed: null
      };
      await profiles.insertOne(profile);
    }

    res.json(profile);
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================================
// PUT /api/profile/:walletAddress
// Update display name.
// ============================================================
app.put('/api/profile/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'displayName is required' });
    }

    const profiles = await getProfiles();

    // Ensure profile exists
    const exists = await profiles.findOne({ _id: walletAddress });
    if (!exists) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    await profiles.updateOne(
      { _id: walletAddress },
      { $set: { displayName: displayName.trim().slice(0, 32) } }
    );

    const updated = await profiles.findOne({ _id: walletAddress });
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================================
// POST /api/profile/:walletAddress/game
// Record a game result. Increments stats + saves match record.
// ============================================================
app.post('/api/profile/:walletAddress/game', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { factionId, doomScore, elderSigns, won, opponentFactions, playerCount, roundsPlayed } = req.body;

    if (!factionId || doomScore === undefined || won === undefined) {
      return res.status(400).json({ error: 'factionId, doomScore, and won are required' });
    }

    const profiles = await getProfiles();
    const matches = await getMatches();

    // Ensure profile exists
    let profile = await profiles.findOne({ _id: walletAddress });
    if (!profile) {
      // Auto-create
      const shortAddr = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
      profile = {
        _id: walletAddress,
        walletAddress,
        displayName: shortAddr,
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
        createdAt: new Date(),
        lastPlayed: null
      };
      await profiles.insertOne(profile);
    }

    // Update aggregate stats
    const totalDoom = (doomScore || 0) + (elderSigns || 0);
    const factionKey = `factionStats.${factionId}`;

    const updateOps = {
      $inc: {
        gamesPlayed: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        totalDoomScored: totalDoom,
        [`${factionKey}.played`]: 1,
        [`${factionKey}.wins`]: won ? 1 : 0
      },
      $set: {
        lastPlayed: new Date()
      }
    };

    // Update highest doom if beaten
    if (doomScore > (profile.highestDoom || 0)) {
      updateOps.$set.highestDoom = doomScore;
    }

    await profiles.updateOne({ _id: walletAddress }, updateOps);

    // Recalculate favorite faction
    const updatedProfile = await profiles.findOne({ _id: walletAddress });
    let maxPlays = -1;
    let fav = null;
    for (const [fac, data] of Object.entries(updatedProfile.factionStats || {})) {
      if (data.played > maxPlays) {
        maxPlays = data.played;
        fav = fac;
      }
    }
    await profiles.updateOne({ _id: walletAddress }, { $set: { favoriteFaction: fav } });

    // Save match record
    const matchRecord = {
      walletAddress,
      factionId,
      doomScore: doomScore || 0,
      elderSigns: elderSigns || 0,
      won: !!won,
      opponentFactions: opponentFactions || [],
      playerCount: playerCount || 2,
      roundsPlayed: roundsPlayed || 0,
      playedAt: new Date()
    };
    await matches.insertOne(matchRecord);

    res.json({ success: true, profile: await profiles.findOne({ _id: walletAddress }) });
  } catch (err) {
    console.error('POST /api/profile/game error:', err);
    res.status(500).json({ error: 'Failed to record game' });
  }
});

// ============================================================
// GET /api/profile/:walletAddress/history
// Get recent match history for a player.
// ============================================================
app.get('/api/profile/:walletAddress/history', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const matches = await getMatches();

    const history = await matches
      .find({ walletAddress })
      .sort({ playedAt: -1 })
      .limit(limit)
      .toArray();

    res.json(history);
  } catch (err) {
    console.error('GET /api/profile/history error:', err);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

// ============================================================
// GET /api/leaderboard
// Top players ranked by wins. Shows display name + wallet.
// ============================================================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const profiles = await getProfiles();

    const leaderboard = await profiles
      .find({ gamesPlayed: { $gt: 0 } })
      .sort({ wins: -1, gamesPlayed: 1 })
      .limit(limit)
      .project({
        _id: 1,
        walletAddress: 1,
        displayName: 1,
        gamesPlayed: 1,
        wins: 1,
        losses: 1,
        highestDoom: 1,
        favoriteFaction: 1
      })
      .toArray();

    res.json(leaderboard);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================================
// GET /api/token-balance/:walletAddress
// Fetches on-chain $CTHULHU token balance via Solana RPC.
// Server-side proxy to avoid browser CORS/rate-limit issues.
// ============================================================
const CTHULHU_TOKEN_MINT = 'ANohyVuF1cPGAVUNaX4wbuXV5ySPiUVwyaS1p3aDpump';
const SOLANA_RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana'
];

app.get('/api/token-balance/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress || walletAddress.startsWith('DEV_') || walletAddress.startsWith('SOL_')) {
      return res.json({ balance: null, source: 'synthetic' });
    }

    for (const endpoint of SOLANA_RPC_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const rpcRes = await fetch(endpoint, {
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

        if (!rpcRes.ok) continue;

        const data = await rpcRes.json();

        if (data.error) {
          console.warn(`RPC error from ${endpoint}:`, data.error);
          continue;
        }

        if (data?.result?.value) {
          if (data.result.value.length === 0) {
            return res.json({ balance: 0, source: endpoint });
          }

          let totalBalance = 0;
          for (const account of data.result.value) {
            const tokenAmount = account?.account?.data?.parsed?.info?.tokenAmount;
            if (tokenAmount && typeof tokenAmount.uiAmount === 'number') {
              totalBalance += tokenAmount.uiAmount;
            }
          }

          console.log(`[TokenBalance] ${walletAddress.slice(0,8)}... = ${totalBalance} $CTHULHU (via ${endpoint})`);
          return res.json({ balance: totalBalance, source: endpoint });
        }
      } catch (err) {
        console.warn(`RPC ${endpoint} failed:`, err.message);
      }
    }

    res.json({ balance: null, error: 'All RPC endpoints failed' });
  } catch (err) {
    console.error('GET /api/token-balance error:', err);
    res.status(500).json({ error: 'Failed to fetch token balance' });
  }
});

// ============================================================
// GET /api/vault-address
// Returns the public key of the server-managed escrow vault.
// ============================================================
app.get('/api/vault-address', (_req, res) => {
  const vaultPubkey = getVaultPublicKey();
  res.json({ vaultPublicKey: vaultPubkey });
});

// ============================================================
// POST /api/wager/verify-deposit
// Verifies a player's token transfer tx on-chain.
// ============================================================
app.post('/api/wager/verify-deposit', async (req, res) => {
  try {
    const { txSignature, walletAddress, amount } = req.body;
    if (!txSignature || !walletAddress || !amount) {
      return res.status(400).json({ error: 'txSignature, walletAddress, and amount are required' });
    }

    const result = await verifyDeposit(txSignature, amount, walletAddress);
    res.json(result);
  } catch (err) {
    console.error('POST /api/wager/verify-deposit error:', err);
    res.status(500).json({ success: false, error: 'Failed to verify deposit' });
  }
});

// ============================================================
// POST /api/wager/payout
// Transports winner's prize pot from vault.
// ============================================================
app.post('/api/wager/payout', async (req, res) => {
  try {
    const { winnerAddress, prizePot } = req.body;
    if (!winnerAddress || prizePot === undefined) {
      return res.status(400).json({ error: 'winnerAddress and prizePot are required' });
    }

    const result = await sendPrizeToWinner(winnerAddress, prizePot);
    res.json(result);
  } catch (err) {
    console.error('POST /api/wager/payout error:', err);
    res.status(500).json({ success: false, error: 'Failed to execute payout' });
  }
});

// ============================================================
// POST /api/wager/record-game
// Logs a completed wagered match with winner, prize pot, & players.
// Status defaults to 'pending_admin_payout'.
// ============================================================
app.post('/api/wager/record-game', async (req, res) => {
  try {
    const { entryFee, prizePot, players, winnerWallet, winnerFaction, winnerScore } = req.body;
    if (!prizePot || !winnerWallet) {
      return res.status(400).json({ error: 'prizePot and winnerWallet are required' });
    }

    const wagers = await getWagers();
    const wagerRecord = {
      entryFee: entryFee || 0,
      prizePot: prizePot || 0,
      players: players || [],
      winnerWallet,
      winnerFaction: winnerFaction || null,
      winnerScore: winnerScore || 0,
      status: 'pending_admin_payout', // Admins manually approve & payout
      completedAt: new Date()
    };

    const result = await wagers.insertOne(wagerRecord);
    console.log(`[Wager] Recorded wager game win for ${winnerWallet} (Prize Pot: ${prizePot} $CTHULHU)`);
    res.json({ success: true, id: result.insertedId, record: wagerRecord });
  } catch (err) {
    console.error('POST /api/wager/record-game error:', err);
    res.status(500).json({ error: 'Failed to record wager game' });
  }
});

// ============================================================
// GET /api/wagers
// Returns full log of all wagered games played.
// Supports filtering by wallet query (?wallet=...).
// ============================================================
app.get('/api/wagers', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { wallet } = req.query;
    const wagers = await getWagers();

    const query = {};
    if (wallet) {
      query.$or = [
        { winnerWallet: wallet },
        { 'players.walletAddress': wallet }
      ];
    }

    const list = await wagers
      .find(query)
      .sort({ completedAt: -1 })
      .limit(limit)
      .toArray();

    res.json(list);
  } catch (err) {
    console.error('GET /api/wagers error:', err);
    res.status(500).json({ error: 'Failed to fetch wagers list' });
  }
});

// ============================================================
// POST /api/rpc-proxy
// Generic Solana JSON-RPC proxy to avoid browser CORS/403 errors.
// ============================================================
app.post('/api/rpc-proxy', async (req, res) => {
  const rpcEndpoints = [
    process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com',
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      const rpcRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      if (rpcRes.ok) {
        const data = await rpcRes.json();
        return res.json(data);
      }
    } catch (err) {
      console.warn(`RPC Proxy endpoint ${endpoint} failed:`, err.message);
    }
  }

  res.status(502).json({ error: 'All Solana RPC proxy endpoints failed' });
});

// ============================================================
// Graceful Shutdown
// ============================================================
process.on('SIGINT', async () => {
  await closeDB();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeDB();
  process.exit(0);
});

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, () => {
  console.log(`Cthulhu Wars API running on port ${PORT}`);
});
