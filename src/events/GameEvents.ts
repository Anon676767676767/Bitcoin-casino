import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// Address = 32 bytes, u256 = 32 bytes

@final
export class DepositedEvent extends NetEvent {
    constructor(player: Address, amount: u256) {
        const data = new BytesWriter(64);
        data.writeAddress(player);
        data.writeU256(amount);
        super('Deposited', data);
    }
}

@final
export class BetPlacedEvent extends NetEvent {
    constructor(
        player: Address,
        betId: u256,
        gameType: u8,
        betParam: u64,
        amount: u256,
        commitBlock: u64,
    ) {
        // 32 (address) + 32 (betId) + 1 (gameType) + 8 (betParam) + 32 (amount) + 8 (commitBlock)
        const data = new BytesWriter(113);
        data.writeAddress(player);
        data.writeU256(betId);
        data.writeU8(gameType);
        data.writeU64(betParam);
        data.writeU256(amount);
        data.writeU64(commitBlock);
        super('BetPlaced', data);
    }
}

@final
export class BetResolvedEvent extends NetEvent {
    constructor(betId: u256, player: Address, outcome: u8, payout: u256) {
        // 32 (betId) + 32 (address) + 1 (outcome) + 32 (payout)
        const data = new BytesWriter(97);
        data.writeU256(betId);
        data.writeAddress(player);
        data.writeU8(outcome);
        data.writeU256(payout);
        super('BetResolved', data);
    }
}

@final
export class BetForfeitedEvent extends NetEvent {
    constructor(betId: u256) {
        const data = new BytesWriter(32);
        data.writeU256(betId);
        super('BetForfeited', data);
    }
}

@final
export class WithdrawalRequestedEvent extends NetEvent {
    constructor(player: Address, withdrawalId: u256, amount: u256) {
        // 32 (address) + 32 (withdrawalId) + 32 (amount)
        const data = new BytesWriter(96);
        data.writeAddress(player);
        data.writeU256(withdrawalId);
        data.writeU256(amount);
        super('WithdrawalRequested', data);
    }
}

@final
export class WithdrawalConfirmedEvent extends NetEvent {
    constructor(withdrawalId: u256) {
        const data = new BytesWriter(32);
        data.writeU256(withdrawalId);
        super('WithdrawalConfirmed', data);
    }
}

@final
export class HouseFundedEvent extends NetEvent {
    constructor(operator: Address, amount: u256) {
        const data = new BytesWriter(64);
        data.writeAddress(operator);
        data.writeU256(amount);
        super('HouseFunded', data);
    }
}

@final
export class PausedEvent extends NetEvent {
    constructor(paused: bool) {
        const data = new BytesWriter(1);
        data.writeBoolean(paused);
        super('Paused', data);
    }
}
