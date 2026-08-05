import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, SystemProgram, PublicKey } from '@solana/web3.js';
import idl from './idl/cthulhu_referee.json';

const PROGRAM_ID = new PublicKey("Bu732QhW9cRJSN9TAuoaavABDoYUeDWgKRgkdntevHo8");

class EphemeralWallet {
  constructor(keypair) {
    this.keypair = keypair;
    this.publicKey = keypair.publicKey;
  }
  async signTransaction(tx) {
    tx.partialSign(this.keypair);
    return tx;
  }
  async signAllTransactions(txs) {
    txs.forEach((t) => t.partialSign(this.keypair));
    return txs;
  }
}

export class RefereeClient {
  constructor(network = 'https://api.devnet.solana.com') {
    this.connection = new Connection(network, 'confirmed');
    // For prototyping, we use an ephemeral wallet that we fund (or assume is funded if on localnet)
    // In production, this would use the player's connected wallet via WalletManager.
    this.ephemeralKeypair = Keypair.generate();
    const wallet = new EphemeralWallet(this.ephemeralKeypair);
    this.provider = new anchor.AnchorProvider(this.connection, wallet, { commitment: 'confirmed' });
    this.program = new anchor.Program(idl, PROGRAM_ID, this.provider);
  }

  async initializeEphemeralWallet() {
    console.log("Requesting airdrop for ephemeral referee wallet...");
    const airdropSignature = await this.connection.requestAirdrop(
      this.ephemeralKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await this.connection.confirmTransaction(airdropSignature);
    console.log("Ephemeral wallet funded!");
  }

  async rollDice(gameId, combatId, numDice) {
    try {
      const [rollAccountPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("roll"),
          Buffer.from(gameId),
          Buffer.from(combatId)
        ],
        this.program.programId
      );

      console.log(`Requesting on-chain dice roll for combat ${combatId}...`);
      
      const tx = await this.program.methods
        .rollDice(gameId, combatId, numDice)
        .accounts({
          rollAccount: rollAccountPda,
          user: this.ephemeralKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("On-chain roll transaction signature:", tx);

      // Fetch the results
      const account = await this.program.account.rollAccount.fetch(rollAccountPda);
      console.log("On-chain dice results:", account.results);
      return account.results;
    } catch (err) {
      console.error("Failed to roll dice on-chain:", err);
      throw err;
    }
  }
}
