import type { Address } from '@btc-vision/transaction';
import { BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import type { CallResponse } from '@btc-vision/unit-test-framework';
import { BytecodeManager, ContractRuntime } from '@btc-vision/unit-test-framework';

interface CasinoOptions {
    readonly address: Address;
    readonly deployer: Address;
    readonly gasLimit?: bigint;
}

export class CasinoRuntime extends ContractRuntime {
    readonly #depositSel: number;
    readonly #addHouseFundsSel: number;
    readonly #placeBetSel: number;
    readonly #revealBetSel: number;
    readonly #requestWithdrawalSel: number;
    readonly #confirmWithdrawalSel: number;
    readonly #forfeitExpiredBetSel: number;
    readonly #setPausedSel: number;
    readonly #getBalanceSel: number;
    readonly #getHouseBalanceSel: number;

    public constructor(opts: CasinoOptions) {
        super({
            address: opts.address,
            deployer: opts.deployer,
            gasLimit: opts.gasLimit ?? 300_000_000_000n,
        });

        this.#depositSel = this.#sel('deposit(uint256)');
        this.#addHouseFundsSel = this.#sel('addHouseFunds(uint256)');
        this.#placeBetSel = this.#sel('placeBet(uint8,uint64,uint256,uint256)');
        this.#revealBetSel = this.#sel('revealBet(uint256,uint256)');
        this.#requestWithdrawalSel = this.#sel('requestWithdrawal(uint256)');
        this.#confirmWithdrawalSel = this.#sel('confirmWithdrawal(uint256)');
        this.#forfeitExpiredBetSel = this.#sel('forfeitExpiredBet(uint256)');
        this.#setPausedSel = this.#sel('setPaused(bool)');
        this.#getBalanceSel = this.#sel('getBalance(address)');
        this.#getHouseBalanceSel = this.#sel('getHouseBalance()');
    }

    public async deposit(amount: bigint): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#depositSel);
        cdata.writeU256(amount);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async addHouseFunds(amount: bigint): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#addHouseFundsSel);
        cdata.writeU256(amount);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async placeBet(
        gameType: number,
        betParam: bigint,
        commitHash: bigint,
        amount: bigint,
    ): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#placeBetSel);
        cdata.writeU8(gameType);
        cdata.writeU64(betParam);
        cdata.writeU256(commitHash);
        cdata.writeU256(amount);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async revealBet(betId: bigint, secret: bigint): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#revealBetSel);
        cdata.writeU256(betId);
        cdata.writeU256(secret);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async requestWithdrawal(amount: bigint): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#requestWithdrawalSel);
        cdata.writeU256(amount);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async confirmWithdrawal(withdrawalId: bigint): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#confirmWithdrawalSel);
        cdata.writeU256(withdrawalId);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async forfeitExpiredBet(betId: bigint): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#forfeitExpiredBetSel);
        cdata.writeU256(betId);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async setPaused(paused: boolean): Promise<void> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#setPausedSel);
        cdata.writeBoolean(paused);
        this.#check(await this.execute({ calldata: cdata.getBuffer() }));
    }

    public async getBalance(player: Address): Promise<bigint> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#getBalanceSel);
        cdata.writeAddress(player);
        const r = await this.execute({ calldata: cdata.getBuffer() });
        this.#check(r);
        return new BinaryReader(r.response).readU256();
    }

    public async getHouseBalance(): Promise<bigint> {
        const cdata = new BinaryWriter();
        cdata.writeSelector(this.#getHouseBalanceSel);
        const r = await this.execute({ calldata: cdata.getBuffer() });
        this.#check(r);
        return new BinaryReader(r.response).readU256();
    }

    protected override handleError(error: Error): Error {
        return new Error(`(Casino @ ${this.address}): ${error.message}`);
    }

    protected override defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode('./build/Casino.wasm', this.address);
    }

    #sel(sig: string): number {
        return Number(`0x${this.abiCoder.encodeSelector(sig)}`);
    }

    #check(r: CallResponse): void {
        if (r.error !== undefined) throw this.handleError(r.error);
    }
}
