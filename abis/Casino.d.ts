import { Address, AddressMap } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type DepositedEvent = {
    readonly player: Address;
    readonly amount: bigint;
};
export type HouseFundedEvent = {
    readonly operator: Address;
    readonly amount: bigint;
};
export type BetPlacedEvent = {
    readonly player: Address;
    readonly betId: bigint;
    readonly gameType: number;
    readonly betParam: bigint;
    readonly amount: bigint;
    readonly commitBlock: bigint;
};
export type BetResolvedEvent = {
    readonly betId: bigint;
    readonly player: Address;
    readonly outcome: number;
    readonly payout: bigint;
};
export type WithdrawalRequestedEvent = {
    readonly player: Address;
    readonly withdrawalId: bigint;
    readonly amount: bigint;
};
export type WithdrawalConfirmedEvent = {
    readonly withdrawalId: bigint;
};
export type BetForfeitedEvent = {
    readonly betId: bigint;
};
export type PausedEvent = {
    readonly paused: boolean;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the deposit function call.
 */
export type Deposit = CallResult<{}, OPNetEvent<DepositedEvent>[]>;

/**
 * @description Represents the result of the addHouseFunds function call.
 */
export type AddHouseFunds = CallResult<{}, OPNetEvent<HouseFundedEvent>[]>;

/**
 * @description Represents the result of the placeBet function call.
 */
export type PlaceBet = CallResult<{}, OPNetEvent<BetPlacedEvent>[]>;

/**
 * @description Represents the result of the revealBet function call.
 */
export type RevealBet = CallResult<{}, OPNetEvent<BetResolvedEvent>[]>;

/**
 * @description Represents the result of the requestWithdrawal function call.
 */
export type RequestWithdrawal = CallResult<{}, OPNetEvent<WithdrawalRequestedEvent>[]>;

/**
 * @description Represents the result of the confirmWithdrawal function call.
 */
export type ConfirmWithdrawal = CallResult<{}, OPNetEvent<WithdrawalConfirmedEvent>[]>;

/**
 * @description Represents the result of the forfeitExpiredBet function call.
 */
export type ForfeitExpiredBet = CallResult<{}, OPNetEvent<BetForfeitedEvent>[]>;

/**
 * @description Represents the result of the setPaused function call.
 */
export type SetPaused = CallResult<{}, OPNetEvent<PausedEvent>[]>;

/**
 * @description Represents the result of the getBalance function call.
 */
export type GetBalance = CallResult<
    {
        balance: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getHouseBalance function call.
 */
export type GetHouseBalance = CallResult<
    {
        balance: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ICasino
// ------------------------------------------------------------------
export interface ICasino extends IOP_NETContract {
    deposit(amount: bigint): Promise<Deposit>;
    addHouseFunds(amount: bigint): Promise<AddHouseFunds>;
    placeBet(
        gameType: number,
        betParam: bigint,
        commitHash: bigint,
        amount: bigint,
    ): Promise<PlaceBet>;
    revealBet(betId: bigint, secret: bigint): Promise<RevealBet>;
    requestWithdrawal(amount: bigint): Promise<RequestWithdrawal>;
    confirmWithdrawal(withdrawalId: bigint): Promise<ConfirmWithdrawal>;
    forfeitExpiredBet(betId: bigint): Promise<ForfeitExpiredBet>;
    setPaused(paused: boolean): Promise<SetPaused>;
    getBalance(player: Address): Promise<GetBalance>;
    getHouseBalance(): Promise<GetHouseBalance>;
}
