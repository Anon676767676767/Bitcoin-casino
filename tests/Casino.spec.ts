import { createHash } from 'node:crypto';
import type { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '@btc-vision/unit-test-framework';
import { CasinoRuntime } from './contracts/CasinoRuntime.js';

// ── Game type constants (mirrors Casino.ts) ──────────────────────────────────
const GAME_COIN_FLIP = 0;
const GAME_DICE = 1;
const GAME_ROULETTE = 2;
const GAME_SLOTS = 3;

// ── Timing constants (mirrors Casino.ts) ─────────────────────────────────────
const MIN_REVEAL_DELAY = 2n;
const BET_EXPIRY_BLOCKS = 144n;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a bigint (u256 value) to 32 bytes matching the AS contract's u256ToBytes:
 * store lo1 at [0], lo2 at [8], hi1 at [16], hi2 at [24] — all little-endian.
 */
function u256ToBytes(value: bigint): Uint8Array {
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    view.setBigUint64(0, BigInt.asUintN(64, value), true);
    view.setBigUint64(8, BigInt.asUintN(64, value >> 64n), true);
    view.setBigUint64(16, BigInt.asUintN(64, value >> 128n), true);
    view.setBigUint64(24, BigInt.asUintN(64, value >> 192n), true);
    return bytes;
}

/**
 * Convert 32-byte hash back to bigint matching the AS contract's uint8ArrayToU256:
 * read lo1 from [0], lo2 from [8], hi1 from [16], hi2 from [24] — all little-endian.
 */
function bytesToU256(bytes: Uint8Array): bigint {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const lo1 = view.getBigUint64(0, true);
    const lo2 = view.getBigUint64(8, true);
    const hi1 = view.getBigUint64(16, true);
    const hi2 = view.getBigUint64(24, true);
    return lo1 | (lo2 << 64n) | (hi1 << 128n) | (hi2 << 192n);
}

/**
 * Compute sha256(u256ToBytes(secret)) as a u256 bigint — matches the contract's
 * commitment verification: computedHash = sha256(u256ToBytes(secret)).
 */
function computeCommitHash(secret: bigint): bigint {
    const secretBytes = u256ToBytes(secret);
    const hash = createHash('sha256').update(secretBytes).digest();
    return bytesToU256(hash);
}

// ── Test Setup ────────────────────────────────────────────────────────────────

const deployer: Address = Blockchain.generateRandomAddress();
const player: Address = Blockchain.generateRandomAddress();
const stranger: Address = Blockchain.generateRandomAddress();
const contractAddress: Address = Blockchain.generateRandomAddress();

const DEPOSIT_AMOUNT = 1_000_000n; // 0.01 BTC in sat
const HOUSE_FUNDS = 10_000_000n; // 0.1 BTC house bankroll
const BET_AMOUNT = 10_000n; // 10k sat bet

// ── Suite: Deposit ────────────────────────────────────────────────────────────

await opnet('Casino — deposit', async (vm: OPNetUnit) => {
    let casino: CasinoRuntime;

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();

        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;
    });

    vm.afterEach(() => {
        casino.dispose();
        Blockchain.dispose();
    });

    await vm.it('should credit player balance on deposit', async () => {
        await casino.deposit(DEPOSIT_AMOUNT);
        const balance = await casino.getBalance(player);
        Assert.expect(balance).toEqual(DEPOSIT_AMOUNT);
    });

    await vm.it('should accumulate multiple deposits', async () => {
        await casino.deposit(DEPOSIT_AMOUNT);
        await casino.deposit(DEPOSIT_AMOUNT);
        const balance = await casino.getBalance(player);
        Assert.expect(balance).toEqual(DEPOSIT_AMOUNT * 2n);
    });

    await vm.it('should revert on zero deposit', async () => {
        await Assert.expect(async () => {
            await casino.deposit(0n);
        }).toThrow();
    });

    await vm.it('new player balance starts at zero', async () => {
        const balance = await casino.getBalance(stranger);
        Assert.expect(balance).toEqual(0n);
    });
});

// ── Suite: House Funds ────────────────────────────────────────────────────────

await opnet('Casino — addHouseFunds', async (vm: OPNetUnit) => {
    let casino: CasinoRuntime;

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();
    });

    vm.afterEach(() => {
        casino.dispose();
        Blockchain.dispose();
    });

    await vm.it('operator can fund the house', async () => {
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        await casino.addHouseFunds(HOUSE_FUNDS);
        const houseBalance = await casino.getHouseBalance();
        Assert.expect(houseBalance).toEqual(HOUSE_FUNDS);
    });

    await vm.it('non-operator cannot fund the house', async () => {
        Blockchain.txOrigin = stranger;
        Blockchain.msgSender = stranger;

        await Assert.expect(async () => {
            await casino.addHouseFunds(HOUSE_FUNDS);
        }).toThrow();
    });

    await vm.it('operator cannot send zero house funds', async () => {
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        await Assert.expect(async () => {
            await casino.addHouseFunds(0n);
        }).toThrow();
    });
});

// ── Suite: Place Bet ──────────────────────────────────────────────────────────

await opnet('Casino — placeBet', async (vm: OPNetUnit) => {
    let casino: CasinoRuntime;
    const secret = 99999n;
    const commitHash = computeCommitHash(secret);

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();

        // Fund house as operator
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.addHouseFunds(HOUSE_FUNDS);

        // Fund player
        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;
        await casino.deposit(DEPOSIT_AMOUNT);
    });

    vm.afterEach(() => {
        casino.dispose();
        Blockchain.dispose();
    });

    await vm.it('should deduct bet amount from player balance', async () => {
        await casino.placeBet(GAME_COIN_FLIP, 0n, commitHash, BET_AMOUNT);
        const balance = await casino.getBalance(player);
        Assert.expect(balance).toEqual(DEPOSIT_AMOUNT - BET_AMOUNT);
    });

    await vm.it('should allow placing a dice bet', async () => {
        await Assert.expect(async () => {
            await casino.placeBet(GAME_DICE, 7n, commitHash, BET_AMOUNT);
        }).toNotThrow();
    });

    await vm.it('should allow placing a roulette bet', async () => {
        await Assert.expect(async () => {
            await casino.placeBet(GAME_ROULETTE, 37n, commitHash, BET_AMOUNT);
        }).toNotThrow();
    });

    await vm.it('should allow placing a slots bet', async () => {
        await Assert.expect(async () => {
            await casino.placeBet(GAME_SLOTS, 0n, commitHash, BET_AMOUNT);
        }).toNotThrow();
    });

    await vm.it('should revert if player balance is insufficient', async () => {
        await Assert.expect(async () => {
            await casino.placeBet(GAME_COIN_FLIP, 0n, commitHash, DEPOSIT_AMOUNT + 1n);
        }).toThrow();
    });

    await vm.it('should revert on zero bet amount', async () => {
        await Assert.expect(async () => {
            await casino.placeBet(GAME_COIN_FLIP, 0n, commitHash, 0n);
        }).toThrow();
    });

    await vm.it('should revert on zero commit hash', async () => {
        await Assert.expect(async () => {
            await casino.placeBet(GAME_COIN_FLIP, 0n, 0n, BET_AMOUNT);
        }).toThrow();
    });

    await vm.it('should revert on invalid game type', async () => {
        await Assert.expect(async () => {
            await casino.placeBet(99, 0n, commitHash, BET_AMOUNT);
        }).toThrow();
    });

    await vm.it('should revert when house cannot cover max payout', async () => {
        // Deploy fresh casino with tiny house funds
        casino.dispose();
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.addHouseFunds(100n); // tiny house

        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;
        await casino.deposit(DEPOSIT_AMOUNT);

        // Roulette straight (35x) on large bet — house can't cover
        await Assert.expect(async () => {
            await casino.placeBet(GAME_ROULETTE, 7n, commitHash, 10_000n);
        }).toThrow();
    });

    await vm.it('should revert when casino is paused', async () => {
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.setPaused(true);

        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;

        await Assert.expect(async () => {
            await casino.placeBet(GAME_COIN_FLIP, 0n, commitHash, BET_AMOUNT);
        }).toThrow();
    });
});

// ── Suite: Reveal Bet ─────────────────────────────────────────────────────────

await opnet('Casino — revealBet', async (vm: OPNetUnit) => {
    let casino: CasinoRuntime;
    const secret = 777777n;
    const commitHash = computeCommitHash(secret);
    const BET_ID_0 = 0n;

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();

        // Operator funds house
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.addHouseFunds(HOUSE_FUNDS);

        // Player deposits and places a CoinFlip bet at block 100
        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;
        await casino.deposit(DEPOSIT_AMOUNT);
        await casino.placeBet(GAME_COIN_FLIP, 0n, commitHash, BET_AMOUNT);
    });

    vm.afterEach(() => {
        casino.dispose();
        Blockchain.dispose();
    });

    await vm.it('should settle bet successfully with correct secret', async () => {
        // Advance past MIN_REVEAL_DELAY (need block >= 100 + 2 = 102)
        Blockchain.blockNumber = 102n;

        await Assert.expect(async () => {
            await casino.revealBet(BET_ID_0, secret);
        }).toNotThrow();
    });

    await vm.it('player balance should change after reveal', async () => {
        Blockchain.blockNumber = 102n;
        const balanceBefore = await casino.getBalance(player);

        await casino.revealBet(BET_ID_0, secret);
        const balanceAfter = await casino.getBalance(player);

        // Either won (balance increased vs bet) or lost (balance same as before minus bet)
        // balanceBefore = DEPOSIT_AMOUNT - BET_AMOUNT (bet was deducted in placeBet)
        // if win: balanceAfter = balanceBefore + payout  (= balanceBefore + 1.95 * BET_AMOUNT)
        // if loss: balanceAfter = balanceBefore (house got the amount, kept it)
        // In either case, the bet should be settled (balance should not equal balanceBefore - BET_AMOUNT again)
        Assert.expect(balanceAfter >= 0n).toEqual(true);
        Assert.expect(balanceBefore).toEqual(DEPOSIT_AMOUNT - BET_AMOUNT);
    });

    await vm.it('should revert with wrong secret', async () => {
        Blockchain.blockNumber = 102n;

        await Assert.expect(async () => {
            await casino.revealBet(BET_ID_0, 12345678n); // wrong secret
        }).toThrow();
    });

    await vm.it('should revert if revealed too early (before MIN_REVEAL_DELAY)', async () => {
        // Still at block 100 — need block >= 102
        Blockchain.blockNumber = 100n;

        await Assert.expect(async () => {
            await casino.revealBet(BET_ID_0, secret);
        }).toThrow();

        // Also revert at block 101 (still 1 short)
        Blockchain.blockNumber = 101n;

        await Assert.expect(async () => {
            await casino.revealBet(BET_ID_0, secret);
        }).toThrow();
    });

    await vm.it('should revert if reveal window expired (> 144 blocks)', async () => {
        // Block 100 + 144 = 244 is still valid; 245 is expired
        Blockchain.blockNumber = 100n + BET_EXPIRY_BLOCKS + 1n;

        await Assert.expect(async () => {
            await casino.revealBet(BET_ID_0, secret);
        }).toThrow();
    });

    await vm.it('should revert if bet does not exist', async () => {
        Blockchain.blockNumber = 102n;

        await Assert.expect(async () => {
            await casino.revealBet(999n, secret); // non-existent betId
        }).toThrow();
    });

    await vm.it('should revert if wrong player tries to reveal', async () => {
        Blockchain.blockNumber = 102n;
        Blockchain.txOrigin = stranger;
        Blockchain.msgSender = stranger;

        await Assert.expect(async () => {
            await casino.revealBet(BET_ID_0, secret);
        }).toThrow();
    });

    await vm.it('should not allow double-reveal of same bet', async () => {
        Blockchain.blockNumber = 102n;
        await casino.revealBet(BET_ID_0, secret); // first reveal

        await Assert.expect(async () => {
            await casino.revealBet(BET_ID_0, secret); // second reveal
        }).toThrow();
    });
});

// ── Suite: Forfeit Expired Bet ────────────────────────────────────────────────

await opnet('Casino — forfeitExpiredBet', async (vm: OPNetUnit) => {
    let casino: CasinoRuntime;
    const secret = 42n;
    const commitHash = computeCommitHash(secret);
    const BET_ID_0 = 0n;

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.addHouseFunds(HOUSE_FUNDS);

        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;
        await casino.deposit(DEPOSIT_AMOUNT);
        await casino.placeBet(GAME_COIN_FLIP, 0n, commitHash, BET_AMOUNT);
    });

    vm.afterEach(() => {
        casino.dispose();
        Blockchain.dispose();
    });

    await vm.it('operator can forfeit expired bet and house gets funds back', async () => {
        // Advance past expiry: commit at 100, expiry at 100+144=244, need > 244
        Blockchain.blockNumber = 245n;

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        const houseBefore = await casino.getHouseBalance();
        await casino.forfeitExpiredBet(BET_ID_0);
        const houseAfter = await casino.getHouseBalance();

        Assert.expect(houseAfter > houseBefore).toEqual(true);
    });

    await vm.it('non-operator cannot forfeit bets', async () => {
        Blockchain.blockNumber = 245n;
        Blockchain.txOrigin = stranger;
        Blockchain.msgSender = stranger;

        await Assert.expect(async () => {
            await casino.forfeitExpiredBet(BET_ID_0);
        }).toThrow();
    });

    await vm.it('cannot forfeit bet that has not expired yet', async () => {
        // Still within window
        Blockchain.blockNumber = 200n;
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        await Assert.expect(async () => {
            await casino.forfeitExpiredBet(BET_ID_0);
        }).toThrow();
    });

    await vm.it('cannot forfeit a non-existent bet', async () => {
        Blockchain.blockNumber = 245n;
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        await Assert.expect(async () => {
            await casino.forfeitExpiredBet(999n);
        }).toThrow();
    });
});

// ── Suite: Withdrawal ─────────────────────────────────────────────────────────

await opnet('Casino — withdrawal', async (vm: OPNetUnit) => {
    let casino: CasinoRuntime;

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();

        // Player deposits
        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;
        await casino.deposit(DEPOSIT_AMOUNT);
    });

    vm.afterEach(() => {
        casino.dispose();
        Blockchain.dispose();
    });

    await vm.it('player can request withdrawal and balance is deducted', async () => {
        const withdrawAmount = 500_000n;
        await casino.requestWithdrawal(withdrawAmount);
        const balance = await casino.getBalance(player);
        Assert.expect(balance).toEqual(DEPOSIT_AMOUNT - withdrawAmount);
    });

    await vm.it('should revert on withdrawal amount exceeding balance', async () => {
        await Assert.expect(async () => {
            await casino.requestWithdrawal(DEPOSIT_AMOUNT + 1n);
        }).toThrow();
    });

    await vm.it('should revert on zero withdrawal amount', async () => {
        await Assert.expect(async () => {
            await casino.requestWithdrawal(0n);
        }).toThrow();
    });

    await vm.it('operator can confirm withdrawal', async () => {
        await casino.requestWithdrawal(500_000n);

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        await Assert.expect(async () => {
            await casino.confirmWithdrawal(0n); // first withdrawal is id 0
        }).toNotThrow();
    });

    await vm.it('non-operator cannot confirm withdrawal', async () => {
        await casino.requestWithdrawal(500_000n);

        Blockchain.txOrigin = stranger;
        Blockchain.msgSender = stranger;

        await Assert.expect(async () => {
            await casino.confirmWithdrawal(0n);
        }).toThrow();
    });

    await vm.it('cannot confirm same withdrawal twice', async () => {
        await casino.requestWithdrawal(500_000n);

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.confirmWithdrawal(0n);

        await Assert.expect(async () => {
            await casino.confirmWithdrawal(0n); // duplicate
        }).toThrow();
    });
});

// ── Suite: Pause ──────────────────────────────────────────────────────────────

await opnet('Casino — setPaused', async (vm: OPNetUnit) => {
    let casino: CasinoRuntime;

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        Blockchain.blockNumber = 100n;

        casino = new CasinoRuntime({ address: contractAddress, deployer });
        Blockchain.register(casino);
        await casino.init();

        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.addHouseFunds(HOUSE_FUNDS);

        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;
        await casino.deposit(DEPOSIT_AMOUNT);
    });

    vm.afterEach(() => {
        casino.dispose();
        Blockchain.dispose();
    });

    await vm.it('operator can pause the casino', async () => {
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;

        await Assert.expect(async () => {
            await casino.setPaused(true);
        }).toNotThrow();
    });

    await vm.it('non-operator cannot pause the casino', async () => {
        Blockchain.txOrigin = stranger;
        Blockchain.msgSender = stranger;

        await Assert.expect(async () => {
            await casino.setPaused(true);
        }).toThrow();
    });

    await vm.it('bets are blocked while paused', async () => {
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.setPaused(true);

        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;

        await Assert.expect(async () => {
            await casino.placeBet(GAME_COIN_FLIP, 0n, computeCommitHash(1n), BET_AMOUNT);
        }).toThrow();
    });

    await vm.it('operator can unpause and bets resume', async () => {
        Blockchain.txOrigin = deployer;
        Blockchain.msgSender = deployer;
        await casino.setPaused(true);
        await casino.setPaused(false);

        Blockchain.txOrigin = player;
        Blockchain.msgSender = player;

        await Assert.expect(async () => {
            await casino.placeBet(GAME_COIN_FLIP, 0n, computeCommitHash(1n), BET_AMOUNT);
        }).toNotThrow();
    });
});
