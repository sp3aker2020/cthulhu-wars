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
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo'
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
export async function verifyDeposit(txSignature, expectedAmount, fromWallet) {
  if (!txSignature) {
    return { success: false, message: 'Missing transaction signature' };
  }

  const conn = getConnection();
  try {
    const tx = await conn.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!tx) {
      return { success: false, message: 'Transaction not found on chain (yet). Please wait a moment.' };
    }

    if (tx.meta?.err) {
      return { success: false, message: 'Transaction failed on-chain' };
    }

    const vaultPubkey = getVaultPublicKey();

    // Inspect pre/post token balances in tx.meta
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    // Find pre/post for vault
    const vaultPost = postBalances.find(b => b.owner === vaultPubkey && b.mint === CTHULHU_TOKEN_MINT.toBase58());
    const vaultPre = preBalances.find(b => b.owner === vaultPubkey && b.mint === CTHULHU_TOKEN_MINT.toBase58());

    const preAmt = vaultPre?.uiAmount || 0;
    const postAmt = vaultPost?.uiAmount || 0;
    const receivedAmt = postAmt - preAmt;

    if (receivedAmt >= expectedAmount - 0.000001) {
      console.log(`[Vault] Verified deposit of ${receivedAmt} $CTHULHU from ${fromWallet} (tx: ${txSignature})`);
      return { success: true };
    }

    return { 
      success: false, 
      message: `Deposit amount mismatch. Expected: ${expectedAmount}, received: ${receivedAmt}` 
    };
  } catch (err) {
    console.error(`[Vault] Error verifying tx ${txSignature}:`, err);
    return { success: false, message: err.message || 'Error verifying transaction' };
  }
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
