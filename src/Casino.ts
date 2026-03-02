import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    AddressMemoryMap,
    Blockchain,
    BytesWriter,
    Calldata,
    EMPTY_POINTER,
    OP_NET,
    Revert,
    SafeMath,
    StoredBoolean,
    StoredMapU256,
    StoredU256,
} from '@btc-vision/btc-runtime/runtime';
import {
    BetForfeitedEvent,
    BetPlacedEvent,
    BetResolvedEvent,
    DepositedEvent,
    HouseFundedEvent,
    PausedEvent,
    WithdrawalConfirmedEvent,
    WithdrawalRequestedEvent,
} from './events/GameEvents';

// ─── Game type constants ────────────────────────────────────────────────────
const GAME_COIN_FLIP: u8 = 0;
const GAME_DICE: u8 = 1;
const GAME_ROULETTE: u8 = 2;
const GAME_SLOTS: u8 = 3;

// ─── Timing ─────────────────────────────────────────────────────────────────
// Minimum blocks between placeBet and revealBet (~20 min at 10 min/block)
const MIN_REVEAL_DELAY: u64 = 2;
// Blocks before an unrevealed bet expires and can be forfeited (~24 h)
const BET_EXPIRY_BLOCKS: u64 = 144;

// ─── Payout multipliers (basis points, i.e. × 100) ──────────────────────────
// CoinFlip: 1.95× win → 5% house edge
const COIN_FLIP_PAYOUT: u64 = 195;
// Dice: straight (pick number 1–6) → 5.7× win
const DICE_STRAIGHT_PAYOUT: u64 = 570;
// Dice: over3 (4,5,6) or under4 (1,2,3) → 1.9×
const DICE_RANGE_PAYOUT: u64 = 190;
// Roulette: straight up (0–36) → 35×
const ROULETTE_STRAIGHT_PAYOUT: u64 = 3500;
// Roulette: colour / odd-even → 1.9×
const ROULETTE_EVEN_PAYOUT: u64 = 190;
// Roulette: dozen (1-12, 13-24, 25-36) → 2.85×
const ROULETTE_DOZEN_PAYOUT: u64 = 285;
// Slots three-of-a-kind payouts
const SLOTS_3SEVEN: u64 = 2500; // 25×
const SLOTS_3BAR: u64 = 1000; //  10×
const SLOTS_3BELL: u64 = 500; //   5×
const SLOTS_3CHERRY: u64 = 300; //  3×
const SLOTS_3LEMON: u64 = 200; //   2×
// Slots two-of-a-kind payouts (highest symbol wins)
const SLOTS_2SEVEN: u64 = 300; // 3×
const SLOTS_2BAR: u64 = 200; //   2×
const SLOTS_2BELL: u64 = 150; //   1.5×

// ─── Roulette red numbers ────────────────────────────────────────────────────
const RED_NUMBERS: u8[] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// ─── Outcome codes emitted in BetResolvedEvent ───────────────────────────────
const OUTCOME_LOSE: u8 = 0;
const OUTCOME_WIN: u8 = 1;

// ─── Module-level storage pointer allocation ─────────────────────────────────
// (order must be stable across deploys — never reorder these)
const nextBetIdPointer: u16 = Blockchain.nextPointer;
const houseBalancePointer: u16 = Blockchain.nextPointer;
const pendingBetTotalPointer: u16 = Blockchain.nextPointer;
const isPausedPointer: u16 = Blockchain.nextPointer;
const withdrawalCounterPointer: u16 = Blockchain.nextPointer;
const playerBalancesPointer: u16 = Blockchain.nextPointer;
const betCommitHashPointer: u16 = Blockchain.nextPointer;
const betAmountPointer: u16 = Blockchain.nextPointer;
const betCommitBlockPointer: u16 = Blockchain.nextPointer;
const betGameParamPointer: u16 = Blockchain.nextPointer;
const betPlayerPointer: u16 = Blockchain.nextPointer;
const withdrawalPendingPointer: u16 = Blockchain.nextPointer;

@final
export class Casino extends OP_NET {
    // ── Scalar storage ───────────────────────────────────────────────────────
    private readonly nextBetId: StoredU256;
    private readonly houseBalance: StoredU256;
    private readonly pendingBetTotal: StoredU256;
    private readonly isPaused: StoredBoolean;
    private readonly withdrawalCounter: StoredU256;

    // ── Address → balance map ────────────────────────────────────────────────
    private readonly playerBalances: AddressMemoryMap;

    // ── Per-bet maps (betId: u256 key) ───────────────────────────────────────
    private readonly betCommitHash: StoredMapU256;
    private readonly betAmount: StoredMapU256;
    private readonly betCommitBlock: StoredMapU256;
    // Packed u256: bits 0–31 = betParam (u32), bits 32–39 = gameType (u8)
    private readonly betGameParam: StoredMapU256;
    // Player address encoded as u256 for map storage
    private readonly betPlayer: StoredMapU256;

    // ── Withdrawal map: withdrawalId → amount (0 = fulfilled) ───────────────
    private readonly withdrawalPending: StoredMapU256;

    public constructor() {
        super();
        this.nextBetId = new StoredU256(nextBetIdPointer, EMPTY_POINTER);
        this.houseBalance = new StoredU256(houseBalancePointer, EMPTY_POINTER);
        this.pendingBetTotal = new StoredU256(pendingBetTotalPointer, EMPTY_POINTER);
        this.isPaused = new StoredBoolean(isPausedPointer, false);
        this.withdrawalCounter = new StoredU256(withdrawalCounterPointer, EMPTY_POINTER);
        this.playerBalances = new AddressMemoryMap(playerBalancesPointer);
        this.betCommitHash = new StoredMapU256(betCommitHashPointer);
        this.betAmount = new StoredMapU256(betAmountPointer);
        this.betCommitBlock = new StoredMapU256(betCommitBlockPointer);
        this.betGameParam = new StoredMapU256(betGameParamPointer);
        this.betPlayer = new StoredMapU256(betPlayerPointer);
        this.withdrawalPending = new StoredMapU256(withdrawalPendingPointer);
    }

    public override onDeployment(_calldata: Calldata): void {
        // isPaused defaults to false — no action needed
    }

    // ── Player: deposit BTC to receive virtual balance ───────────────────────

    @payable
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('Deposited')
    public deposit(calldata: Calldata): BytesWriter {
        const amount: u256 = calldata.readU256();
        if (u256.eq(amount, u256.Zero)) {
            throw new Revert('No BTC sent');
        }
        const player = Blockchain.tx.sender;
        const current: u256 = this.playerBalances.get(player);
        this.playerBalances.set(player, SafeMath.add(current, amount));
        this.emitEvent(new DepositedEvent(player, amount));
        return new BytesWriter(0);
    }

    // ── Operator: fund the house bankroll ────────────────────────────────────

    @payable
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('HouseFunded')
    public addHouseFunds(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        const amount: u256 = calldata.readU256();
        if (u256.eq(amount, u256.Zero)) {
            throw new Revert('No BTC sent');
        }
        this.houseBalance.set(SafeMath.add(this.houseBalance.value, amount));
        this.emitEvent(new HouseFundedEvent(Blockchain.tx.sender, amount));
        return new BytesWriter(0);
    }

    // ── Player: place a bet (commit phase) ───────────────────────────────────

    @method(
        { name: 'gameType', type: ABIDataTypes.UINT8 },
        { name: 'betParam', type: ABIDataTypes.UINT64 },
        { name: 'commitHash', type: ABIDataTypes.UINT256 },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('BetPlaced')
    public placeBet(calldata: Calldata): BytesWriter {
        if (this.isPaused.value) {
            throw new Revert('Casino is paused');
        }

        const gameType: u8 = calldata.readU8();
        const betParam: u64 = calldata.readU64();
        const commitHash: u256 = calldata.readU256();
        const amount: u256 = calldata.readU256();

        if (gameType > GAME_SLOTS) {
            throw new Revert('Invalid game type');
        }
        this.validateBetParam(gameType, betParam);

        if (u256.eq(amount, u256.Zero)) {
            throw new Revert('Bet amount must be > 0');
        }
        if (u256.eq(commitHash, u256.Zero)) {
            throw new Revert('Commitment hash must not be zero');
        }

        const player = Blockchain.tx.sender;
        const playerBalance: u256 = this.playerBalances.get(player);
        if (u256.lt(playerBalance, amount)) {
            throw new Revert('Insufficient player balance');
        }

        const maxPayout: u256 = this.computeMaxPayout(gameType, betParam, amount);
        const houseAvail: u256 = this.houseBalance.value;
        if (u256.lt(houseAvail, maxPayout)) {
            throw new Revert('House cannot cover max payout for this bet');
        }

        const betId: u256 = this.nextBetId.value;
        const commitBlock: u64 = Blockchain.block.number;

        // Effects (state changes before any interactions)
        this.playerBalances.set(player, SafeMath.sub(playerBalance, amount));
        // Lock maxPayout from house into pendingBetTotal
        this.houseBalance.set(SafeMath.sub(houseAvail, maxPayout));
        this.pendingBetTotal.set(SafeMath.add(this.pendingBetTotal.value, maxPayout));

        // Store bet data
        this.betCommitHash.set(betId, commitHash);
        this.betAmount.set(betId, amount);
        this.betCommitBlock.set(betId, u256.fromU64(commitBlock));
        // Pack: bits 0-31 = betParam, bits 32-39 = gameType
        this.betGameParam.set(betId, u256.fromU64(betParam | (u64(gameType) << 32)));
        // Store player as u256 (raw 32-byte reinterpret)
        this.betPlayer.set(betId, this.addressToU256(player));
        // Advance counter
        this.nextBetId.set(SafeMath.add(betId, u256.One));

        this.emitEvent(new BetPlacedEvent(player, betId, gameType, betParam, amount, commitBlock));
        return new BytesWriter(0);
    }

    // ── Player: reveal secret to settle the bet ──────────────────────────────

    @method(
        { name: 'betId', type: ABIDataTypes.UINT256 },
        { name: 'secret', type: ABIDataTypes.UINT256 },
    )
    @emit('BetResolved')
    public revealBet(calldata: Calldata): BytesWriter {
        const betId: u256 = calldata.readU256();
        const secret: u256 = calldata.readU256();

        const storedHash: u256 = this.betCommitHash.get(betId);
        if (u256.eq(storedHash, u256.Zero)) {
            throw new Revert('Bet not found or already settled');
        }

        const commitBlock: u64 = this.betCommitBlock.get(betId).toU64();
        const currentBlock: u64 = Blockchain.block.number;

        if (currentBlock < commitBlock + MIN_REVEAL_DELAY) {
            throw new Revert('Too early to reveal: wait for MIN_REVEAL_DELAY blocks');
        }
        if (currentBlock > commitBlock + BET_EXPIRY_BLOCKS) {
            throw new Revert('Reveal window expired: bet can be forfeited by operator');
        }

        // Verify caller is the original bettor
        const player = Blockchain.tx.sender;
        if (!u256.eq(this.betPlayer.get(betId), this.addressToU256(player))) {
            throw new Revert('Only the original bettor can reveal');
        }

        // Verify commitment: sha256(secret_bytes) == storedHash
        const secretBytes: Uint8Array = this.u256ToBytes(secret);
        const computedHash: u256 = this.uint8ArrayToU256(Blockchain.sha256(secretBytes));
        if (!u256.eq(computedHash, storedHash)) {
            throw new Revert('Invalid secret: does not match commitment');
        }

        // Derive random seed from secret and the block hash just after commit
        const pastHash: Uint8Array = Blockchain.getBlockHash(commitBlock + 1);
        const seed: Uint8Array = this.computeSeed(secretBytes, pastHash);

        // Load bet parameters
        const amount: u256 = this.betAmount.get(betId);
        const packedU64: u64 = this.betGameParam.get(betId).toU64();
        const betParam: u64 = packedU64 & u64(0xFFFFFFFF);
        const gameType: u8 = u8((packedU64 >> 32) & u64(0xFF));
        const maxPayout: u256 = this.computeMaxPayout(gameType, betParam, amount);

        // Run game and determine actual payout
        const payout: u256 = this.runGame(gameType, betParam, seed, amount);
        const outcome: u8 = u256.eq(payout, u256.Zero) ? OUTCOME_LOSE : OUTCOME_WIN;

        // Settle: release pending, update balances
        this.pendingBetTotal.set(SafeMath.sub(this.pendingBetTotal.value, maxPayout));
        if (outcome == OUTCOME_WIN) {
            // Player receives payout; house gets back unused lock
            this.playerBalances.set(
                player,
                SafeMath.add(this.playerBalances.get(player), payout),
            );
            // Return (maxPayout - payout) to house if any
            if (u256.gt(maxPayout, payout)) {
                this.houseBalance.set(
                    SafeMath.add(
                        this.houseBalance.value,
                        SafeMath.sub(maxPayout, payout),
                    ),
                );
            }
        } else {
            // House keeps betAmount + gets lock back → += maxPayout
            this.houseBalance.set(SafeMath.add(this.houseBalance.value, maxPayout));
        }

        // Mark bet as settled
        this.betCommitHash.set(betId, u256.Zero);

        this.emitEvent(new BetResolvedEvent(betId, player, outcome, payout));
        return new BytesWriter(0);
    }

    // ── Player: request a BTC withdrawal ─────────────────────────────────────

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('WithdrawalRequested')
    public requestWithdrawal(calldata: Calldata): BytesWriter {
        const amount: u256 = calldata.readU256();
        if (u256.eq(amount, u256.Zero)) {
            throw new Revert('Withdrawal amount must be > 0');
        }

        const player = Blockchain.tx.sender;
        const balance: u256 = this.playerBalances.get(player);
        if (u256.lt(balance, amount)) {
            throw new Revert('Insufficient balance');
        }

        this.playerBalances.set(player, SafeMath.sub(balance, amount));

        const wId: u256 = this.withdrawalCounter.value;
        this.withdrawalPending.set(wId, amount);
        this.withdrawalCounter.set(SafeMath.add(wId, u256.One));

        this.emitEvent(new WithdrawalRequestedEvent(player, wId, amount));
        return new BytesWriter(0);
    }

    // ── Operator: confirm a withdrawal was fulfilled off-chain ───────────────

    @method({ name: 'withdrawalId', type: ABIDataTypes.UINT256 })
    @emit('WithdrawalConfirmed')
    public confirmWithdrawal(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const wId: u256 = calldata.readU256();
        const pending: u256 = this.withdrawalPending.get(wId);
        if (u256.eq(pending, u256.Zero)) {
            throw new Revert('Withdrawal not found or already confirmed');
        }

        this.withdrawalPending.set(wId, u256.Zero);
        this.emitEvent(new WithdrawalConfirmedEvent(wId));
        return new BytesWriter(0);
    }

    // ── Operator: forfeit an expired bet ─────────────────────────────────────

    @method({ name: 'betId', type: ABIDataTypes.UINT256 })
    @emit('BetForfeited')
    public forfeitExpiredBet(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const betId: u256 = calldata.readU256();
        const storedHash: u256 = this.betCommitHash.get(betId);
        if (u256.eq(storedHash, u256.Zero)) {
            throw new Revert('Bet not found or already settled');
        }

        const commitBlock: u64 = this.betCommitBlock.get(betId).toU64();
        if (Blockchain.block.number <= commitBlock + BET_EXPIRY_BLOCKS) {
            throw new Revert('Bet not yet expired');
        }

        const amount: u256 = this.betAmount.get(betId);
        const packedU64: u64 = this.betGameParam.get(betId).toU64();
        const betParam: u64 = packedU64 & u64(0xFFFFFFFF);
        const gameType: u8 = u8((packedU64 >> 32) & u64(0xFF));
        const maxPayout: u256 = this.computeMaxPayout(gameType, betParam, amount);

        this.pendingBetTotal.set(SafeMath.sub(this.pendingBetTotal.value, maxPayout));
        this.houseBalance.set(SafeMath.add(this.houseBalance.value, maxPayout));

        // Mark as settled
        this.betCommitHash.set(betId, u256.Zero);

        this.emitEvent(new BetForfeitedEvent(betId));
        return new BytesWriter(0);
    }

    // ── Owner: pause / unpause the casino ────────────────────────────────────

    @method({ name: 'paused', type: ABIDataTypes.BOOL })
    @emit('Paused')
    public setPaused(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        const paused: bool = calldata.readBoolean();
        this.isPaused.value = paused;
        this.emitEvent(new PausedEvent(paused));
        return new BytesWriter(0);
    }

    // ── View: player balance ─────────────────────────────────────────────────

    @constant
    @method({ name: 'player', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'balance', type: ABIDataTypes.UINT256 })
    public getBalance(calldata: Calldata): BytesWriter {
        const player = calldata.readAddress();
        const balance: u256 = this.playerBalances.get(player);
        const writer = new BytesWriter(32);
        writer.writeU256(balance);
        return writer;
    }

    // ── View: house balance ──────────────────────────────────────────────────

    @constant
    @method()
    @returns({ name: 'balance', type: ABIDataTypes.UINT256 })
    public getHouseBalance(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this.houseBalance.value);
        return writer;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ════════════════════════════════════════════════════════════════════════

    private validateBetParam(gameType: u8, betParam: u64): void {
        if (gameType == GAME_COIN_FLIP) {
            if (betParam > 1) throw new Revert('CoinFlip: betParam must be 0 or 1');
        } else if (gameType == GAME_DICE) {
            if (betParam < 1 || betParam > 8) throw new Revert('Dice: betParam must be 1-8');
        } else if (gameType == GAME_ROULETTE) {
            if (betParam > 43) throw new Revert('Roulette: betParam must be 0-43');
        } else {
            if (betParam != 0) throw new Revert('Slots: betParam must be 0');
        }
    }

    private computeMaxPayout(gameType: u8, betParam: u64, amount: u256): u256 {
        let multiplier: u64 = 0;
        if (gameType == GAME_COIN_FLIP) {
            multiplier = COIN_FLIP_PAYOUT;
        } else if (gameType == GAME_DICE) {
            multiplier = betParam >= 1 && betParam <= 6 ? DICE_STRAIGHT_PAYOUT : DICE_RANGE_PAYOUT;
        } else if (gameType == GAME_ROULETTE) {
            if (betParam <= 36) {
                multiplier = ROULETTE_STRAIGHT_PAYOUT;
            } else if (betParam <= 40) {
                multiplier = ROULETTE_EVEN_PAYOUT;
            } else {
                multiplier = ROULETTE_DOZEN_PAYOUT;
            }
        } else {
            multiplier = SLOTS_3SEVEN;
        }
        return SafeMath.div(SafeMath.mul(amount, u256.fromU64(multiplier)), u256.fromU64(100));
    }

    private runGame(gameType: u8, betParam: u64, seed: Uint8Array, amount: u256): u256 {
        if (gameType == GAME_COIN_FLIP) return this.runCoinFlip(betParam, seed, amount);
        if (gameType == GAME_DICE) return this.runDice(betParam, seed, amount);
        if (gameType == GAME_ROULETTE) return this.runRoulette(betParam, seed, amount);
        return this.runSlots(seed, amount);
    }

    private runCoinFlip(betParam: u64, seed: Uint8Array, amount: u256): u256 {
        const result: u8 = seed[0] % 2;
        if (u64(result) != betParam) return u256.Zero;
        return SafeMath.div(
            SafeMath.mul(amount, u256.fromU64(COIN_FLIP_PAYOUT)),
            u256.fromU64(100),
        );
    }

    private runDice(betParam: u64, seed: Uint8Array, amount: u256): u256 {
        const roll: u64 = u64(seed[0] % 6) + 1;
        let multiplier: u64 = 0;
        if (betParam >= 1 && betParam <= 6) {
            if (roll == betParam) multiplier = DICE_STRAIGHT_PAYOUT;
        } else if (betParam == 7) {
            if (roll >= 4) multiplier = DICE_RANGE_PAYOUT;
        } else {
            if (roll <= 3) multiplier = DICE_RANGE_PAYOUT;
        }
        if (multiplier == 0) return u256.Zero;
        return SafeMath.div(SafeMath.mul(amount, u256.fromU64(multiplier)), u256.fromU64(100));
    }

    private runRoulette(betParam: u64, seed: Uint8Array, amount: u256): u256 {
        const ball: u64 = u64(seed[0] % 37);
        let multiplier: u64 = 0;

        if (betParam <= 36) {
            if (ball == betParam) multiplier = ROULETTE_STRAIGHT_PAYOUT;
        } else if (betParam == 37) {
            if (ball != 0 && this.isRedNumber(u8(ball))) multiplier = ROULETTE_EVEN_PAYOUT;
        } else if (betParam == 38) {
            if (ball != 0 && !this.isRedNumber(u8(ball))) multiplier = ROULETTE_EVEN_PAYOUT;
        } else if (betParam == 39) {
            if (ball != 0 && ball % 2 == 1) multiplier = ROULETTE_EVEN_PAYOUT;
        } else if (betParam == 40) {
            if (ball != 0 && ball % 2 == 0) multiplier = ROULETTE_EVEN_PAYOUT;
        } else if (betParam == 41) {
            if (ball >= 1 && ball <= 12) multiplier = ROULETTE_DOZEN_PAYOUT;
        } else if (betParam == 42) {
            if (ball >= 13 && ball <= 24) multiplier = ROULETTE_DOZEN_PAYOUT;
        } else {
            if (ball >= 25 && ball <= 36) multiplier = ROULETTE_DOZEN_PAYOUT;
        }

        if (multiplier == 0) return u256.Zero;
        return SafeMath.div(SafeMath.mul(amount, u256.fromU64(multiplier)), u256.fromU64(100));
    }

    private runSlots(seed: Uint8Array, amount: u256): u256 {
        const r1: u8 = seed[0] % 5;
        const r2: u8 = seed[1] % 5;
        const r3: u8 = seed[2] % 5;
        let multiplier: u64 = 0;

        if (r1 == r2 && r2 == r3) {
            if (r1 == 4) multiplier = SLOTS_3SEVEN;
            else if (r1 == 3) multiplier = SLOTS_3BAR;
            else if (r1 == 2) multiplier = SLOTS_3BELL;
            else if (r1 == 1) multiplier = SLOTS_3CHERRY;
            else multiplier = SLOTS_3LEMON;
        } else {
            const hasTwoSevens: bool =
                (r1 == 4 && r2 == 4) || (r1 == 4 && r3 == 4) || (r2 == 4 && r3 == 4);
            const hasTwoBARs: bool =
                (r1 == 3 && r2 == 3) || (r1 == 3 && r3 == 3) || (r2 == 3 && r3 == 3);
            const hasTwoBells: bool =
                (r1 == 2 && r2 == 2) || (r1 == 2 && r3 == 2) || (r2 == 2 && r3 == 2);

            if (hasTwoSevens) multiplier = SLOTS_2SEVEN;
            else if (hasTwoBARs) multiplier = SLOTS_2BAR;
            else if (hasTwoBells) multiplier = SLOTS_2BELL;
        }

        if (multiplier == 0) return u256.Zero;
        return SafeMath.div(SafeMath.mul(amount, u256.fromU64(multiplier)), u256.fromU64(100));
    }

    private isRedNumber(n: u8): bool {
        for (let i: i32 = 0; i < RED_NUMBERS.length; i++) {
            if (RED_NUMBERS[i] == n) return true;
        }
        return false;
    }

    private computeSeed(secretBytes: Uint8Array, pastHash: Uint8Array): Uint8Array {
        const input = new Uint8Array(64);
        for (let i: i32 = 0; i < 32; i++) input[i] = secretBytes[i];
        for (let i: i32 = 0; i < 32; i++) input[32 + i] = pastHash[i];
        return Blockchain.sha256(input);
    }

    // Convert u256 → 32-byte Uint8Array (native u256 limb layout)
    private u256ToBytes(value: u256): Uint8Array {
        const bytes = new Uint8Array(32);
        store<u64>(bytes.dataStart, value.lo1);
        store<u64>(bytes.dataStart + 8, value.lo2);
        store<u64>(bytes.dataStart + 16, value.hi1);
        store<u64>(bytes.dataStart + 24, value.hi2);
        return bytes;
    }

    // Convert 32-byte Uint8Array → u256 (native u256 limb layout)
    private uint8ArrayToU256(bytes: Uint8Array): u256 {
        return new u256(
            load<u64>(bytes.dataStart),
            load<u64>(bytes.dataStart + 8),
            load<u64>(bytes.dataStart + 16),
            load<u64>(bytes.dataStart + 24),
        );
    }

    // Encode an Address (32-byte Uint8Array) as u256 for map key storage
    private addressToU256(addr: Uint8Array): u256 {
        return new u256(
            load<u64>(addr.dataStart),
            load<u64>(addr.dataStart + 8),
            load<u64>(addr.dataStart + 16),
            load<u64>(addr.dataStart + 24),
        );
    }
}
