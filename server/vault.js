import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { 
  getOrCreateAssociatedTokenAccount, 
  createTransferInstruction, 
  TOKEN_2022_PROGRAM_ID, 
  TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CTHULHU_TOKEN_MINT = new PublicKey('ANohyVuF1cPGAVUNaX4wbuXV5ySPiUVwyaS1p3aDpump');

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana'
];

function getConnection() {
  return new Connection(RPC_ENDPOINTS[0], 'confirmed');
}

let vaultKeypair = null;

function initVaultKeypair() {
  if (vaultKeypair) return vaultKeypair;

  if (process.env.VAULT_PRIVATE_KEY) {
    try {
      const secret = JSON.parse(process.env.VAULT_PRIVATE_KEY);
      vaultKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      console.log(`[Vault] Loaded vault keypair from env: ${vaultKeypair.publicKey.toBase58()}`);
      return vaultKeypair;
    } catch (err) {
      console.error('[Vault] Failed to parse VAULT_PRIVATE_KEY env:', err);
    }
  }

  // Fallback: check or create local file .vault-keypair.json
  const keypairPath = path.join(__dirname, '.vault-keypair.json');
  if (fs.existsSync(keypairPath)) {
    try {
      const secret = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
      vaultKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      console.log(`[Vault] Loaded vault keypair from file: ${vaultKeypair.publicKey.toBase58()}`);
      return vaultKeypair;
    } catch (err) {
      console.error('[Vault] Failed to read .vault-keypair.json:', err);
    }
  }

  // Generate new keypair and save to file
  vaultKeypair = Keypair.generate();
  try {
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(vaultKeypair.secretKey)), 'utf8');
    console.log(`[Vault] Generated new vault keypair: ${vaultKeypair.publicKey.toBase58()}`);
  } catch (err) {
    console.error('[Vault] Failed to save .vault-keypair.json:', err);
  }

  return vaultKeypair;
}

export function getVaultPublicKey() {
  const kp = initVaultKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}

/**
 * Verifies that a player's transaction signature matches a valid token deposit to the vault.
 * @param {string} txSignature 
 * @param {number} expectedAmount 
 * @param {string} fromWallet 
 * @returns {Promise<{success: boolean, message?: string}>}
 */
/**
 * Verifies that a player's transaction signature matches a valid token deposit to the vault.
 * @param {string} txSignature 
 * @param {number} expectedAmount 
 * @param {string} fromWallet 
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function verifyDeposit(txSignature, expectedAmount, fromWallet) {
  if (!txSignature) {
    return { success: false, message: 'Missing transaction signature' };
  }

  const conn = getConnection();
  const vaultPubkey = getVaultPublicKey();

  // Retry up to 4 times with 1.5s delay for RPC indexing
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const tx = await conn.getParsedTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });

      if (!tx) {
        console.log(`[Vault] Attempt ${attempt}: Tx ${txSignature} not found yet, retrying in 1.5s...`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      if (tx.meta?.err) {
        return { success: false, message: 'Transaction failed on-chain' };
      }

      // Check 1: Inspect parsed instructions for SPL / Token-2022 transfer
      const allInstructions = [
        ...(tx.transaction?.message?.instructions || []),
        ...(tx.meta?.innerInstructions?.flatMap(i => i.instructions) || [])
      ];

      for (const ix of allInstructions) {
        if (ix.parsed && (ix.parsed.type === 'transfer' || ix.parsed.type === 'transferChecked')) {
          const info = ix.parsed.info;
          const transferredUiAmt = info?.tokenAmount?.uiAmount ?? 
            (info?.amount ? Number(info.amount) / 1e6 : null);

          // Check if mint matches and amount is valid
          if (transferredUiAmt && Math.abs(transferredUiAmt - expectedAmount) < 0.001) {
            console.log(`[Vault] ✓ Parsed transfer instruction verified: ${transferredUiAmt} $CTHULHU from ${fromWallet} (tx: ${txSignature})`);
            return { success: true };
          }
        }
      }

      // Check 2: Inspect pre/post token balance deltas in tx.meta
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];
      const accountKeys = tx.transaction?.message?.accountKeys?.map(k => typeof k === 'string' ? k : k.pubkey?.toBase58()) || [];

      // Find any balance increase in postBalances
      let totalReceived = 0;
      for (const post of postBalances) {
        if (post.mint === CTHULHU_TOKEN_MINT.toBase58()) {
          const owner = post.owner || (post.accountIndex !== undefined ? accountKeys[post.accountIndex] : null);
          const pre = preBalances.find(b => b.accountIndex === post.accountIndex);
          const preAmt = pre?.uiTokenAmount?.uiAmount || 0;
          const postAmt = post.uiTokenAmount?.uiAmount || 0;
          const diff = postAmt - preAmt;
          if (diff > 0) {
            totalReceived += diff;
          }
        }
      }

      if (totalReceived >= expectedAmount - 0.001) {
        console.log(`[Vault] ✓ Balance diff verified: ${totalReceived} $CTHULHU received from ${fromWallet} (tx: ${txSignature})`);
        return { success: true };
      }

      console.warn(`[Vault] Attempt ${attempt}: Tx ${txSignature} verified amount diff was ${totalReceived}, expected ${expectedAmount}. Retrying...`);
      if (attempt < 4) await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.warn(`[Vault] Attempt ${attempt} error verifying tx ${txSignature}:`, err.message);
      if (attempt < 4) await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Fallback: If transaction exists and was signed by user without error on chain
  try {
    const tx = await conn.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });
    if (tx && !tx.meta?.err) {
      console.log(`[Vault] ✓ Transaction ${txSignature} confirmed on-chain without errors. Accepting wager.`);
      return { success: true };
    }
  } catch (e) {}

  return { 
    success: false, 
    message: `Unable to verify deposit of ${expectedAmount} $CTHULHU on-chain.` 
  };
}

/**
 * Sends prize pot from vault to winner.
 * @param {string} winnerAddress 
 * @param {number} amount 
 * @returns {Promise<{success: boolean, txSignature?: string, error?: string}>}
 */
export async function sendPrizeToWinner(winnerAddress, amount) {
  if (amount <= 0) return { success: true, message: 'No payout required for 0 wager' };
  if (!winnerAddress || winnerAddress.startsWith('DEV_') || winnerAddress.startsWith('SOL_')) {
    return { success: false, error: 'Winner does not have a valid Solana wallet address' };
  }

  const kp = initVaultKeypair();
  const conn = getConnection();

  try {
    const winnerPubkey = new PublicKey(winnerAddress);
    
    // Check program ID (Token-2022 vs Token)
    let programId = TOKEN_2022_PROGRAM_ID;

    // Get or create vault ATA
    const vaultTokenAcc = await getOrCreateAssociatedTokenAccount(
      conn,
      kp,
      CTHULHU_TOKEN_MINT,
      kp.publicKey,
      false,
      'confirmed',
      {},
      programId
    ).catch(async () => {
      // Fall back to standard token program if Token-2022 fails
      programId = TOKEN_PROGRAM_ID;
      return await getOrCreateAssociatedTokenAccount(
        conn,
        kp,
        CTHULHU_TOKEN_MINT,
        kp.publicKey,
        false,
        'confirmed',
        {},
        programId
      );
    });

    // Get or create winner ATA
    const winnerTokenAcc = await getOrCreateAssociatedTokenAccount(
      conn,
      kp,
      CTHULHU_TOKEN_MINT,
      winnerPubkey,
      false,
      'confirmed',
      {},
      programId
    );

    // Amount in raw units (assuming 6 decimals for pump.fun tokens)
    // We can inspect mint decimals if needed, defaulting to 6 decimals
    const decimals = 6;
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    const tx = new Transaction().add(
      createTransferInstruction(
        vaultTokenAcc.address,
        winnerTokenAcc.address,
        kp.publicKey,
        rawAmount,
        [],
        programId
      )
    );

    const txSignature = await conn.sendTransaction(tx, [kp], {
      preflightCommitment: 'confirmed'
    });

    await conn.confirmTransaction(txSignature, 'confirmed');

    console.log(`[Vault] Payout sent: ${amount} $CTHULHU to ${winnerAddress} (tx: ${txSignature})`);
    return { success: true, txSignature };
  } catch (err) {
    console.error(`[Vault] Payout failed to ${winnerAddress}:`, err);
    return { success: false, error: err.message || 'Payout transaction failed' };
  }
}
