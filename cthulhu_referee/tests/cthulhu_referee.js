const anchor = require("@coral-xyz/anchor");

describe("cthulhu_referee", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.CthulhuReferee;

  it("Rolls some dice!", async () => {
    const gameId = "game_123";
    const combatId = "combat_abc";
    
    // Generate a PDA for the roll account
    const [rollAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("roll"),
        Buffer.from(gameId),
        Buffer.from(combatId)
      ],
      program.programId
    );

    const tx = await program.methods
      .rollDice(gameId, combatId, 5) // roll 5 dice
      .accounts({
        rollAccount: rollAccountPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
      
    console.log("Transaction signature", tx);

    const account = await program.account.rollAccount.fetch(rollAccountPda);
    console.log("Dice Rolls:", account.results);
  });
});
