use anchor_lang::prelude::*;

declare_id!("Bu732QhW9cRJSN9TAuoaavABDoYUeDWgKRgkdntevHo8");

#[program]
pub mod cthulhu_referee {
    use super::*;

    pub fn roll_dice(
        ctx: Context<RollDice>,
        game_id: String,
        combat_id: String,
        num_dice: u8,
    ) -> Result<()> {
        let roll_account = &mut ctx.accounts.roll_account;
        roll_account.game_id = game_id;
        roll_account.combat_id = combat_id;
        roll_account.num_dice = num_dice;
        roll_account.roller = ctx.accounts.user.key();

        // Very basic pseudo-randomness using the clock
        let clock = Clock::get()?;
        let slot = clock.slot;
        let unix_timestamp = clock.unix_timestamp;

        // Generate pseudo-random rolls
        let mut results = Vec::with_capacity(num_dice as usize);
        for i in 0..num_dice {
            // A simple hash combination for pseudo-randomness.
            let seed_string = format!("{}-{}-{}-{}", slot, unix_timestamp, ctx.accounts.user.key(), i);
            let hash = anchor_lang::solana_program::hash::hash(seed_string.as_bytes());
            
            // Dice are 1 to 6
            let roll = (hash.to_bytes()[0] % 6) + 1;
            results.push(roll);
        }

        roll_account.results = results;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: String, combat_id: String, num_dice: u8)]
pub struct RollDice<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 256,
        seeds = [b"roll", game_id.as_bytes(), combat_id.as_bytes()],
        bump
    )]
    pub roll_account: Account<'info, RollAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct RollAccount {
    pub game_id: String,
    pub combat_id: String,
    pub num_dice: u8,
    pub roller: Pubkey,
    pub results: Vec<u8>,
}
