import {Address, beginCell, Cell, Contract, ContractProvider, Sender, toNano, Builder, StateInit, SendMode} from "@ton/core";

export type NftItemData = {
    inited: boolean
    index: number
    collection: Address | null
    owner: Address | null
    content: Cell | null
}

export class NftItem implements Contract {
    constructor(readonly address: Address, readonly init?: StateInit) {}

    static createFromAddress(address: Address) {
        return new NftItem(address);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(provider: ContractProvider, via: Sender, params: {
        value?: bigint
        to: Address
        responseTo?: Address
        forwardAmount?: bigint
        forwardBody?: Cell | Builder
    }) {
        await provider.internal(via, {
            value: params.value ?? toNano('0.05'),
            body: beginCell()
                .storeUint(0x5fcc3d14, 32) // op
                .storeUint(0, 64) // query id
                .storeAddress(params.to)
                .storeAddress(params.responseTo)
                .storeBit(false) // custom payload
                .storeCoins(params.forwardAmount ?? 0n)
                .storeMaybeRef(params.forwardBody)
                .endCell()
        })
    }

    async getData(provider: ContractProvider): Promise<NftItemData> {
        const { stack } = await provider.get('get_nft_data', [])
        return {
            inited: stack.readBoolean(),
            index: stack.readNumber(),
            collection: stack.readAddressOpt(),
            owner: stack.readAddressOpt(),
            content: stack.readCellOpt(),
        }
    }
}