import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { ContractOpcodes, OpcodesLookup } from '../opCodes';
import { ContractMessageMeta } from '../../scripts/meta/structureVisitor';

export type JettonWalletConfig = {
    balance : bigint,
    owner_address : Address,
    jetton_master_address : Address,
    jetton_wallet_code : Cell
};

export function jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
    return beginCell()    
        .storeCoins  (config.balance)
        .storeAddress(config.owner_address)
        .storeAddress(config.jetton_master_address)
        .storeRef    (config.jetton_wallet_code)
    .endCell();
}

export class JettonWallet implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
        const data = jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }


    static transferMessage(
        jetton_amount: bigint, to: Address,
        responseAddress:Address,
        customPayload: Cell | null,
        forward_ton_amount: bigint,
        forwardPayload: Cell | null
    ) {

        return beginCell().storeUint(0xf8a7ea5, 32).storeUint(0, 64) // op, queryId
            .storeCoins(jetton_amount)
            .storeAddress(to)
            .storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(forwardPayload)
        .endCell();
    }

    static transferMessageComment(
        jetton_amount: bigint, to: Address,
        responseAddress:Address,
        customPayload: Cell | null,
        comment: string
    ) {
        let forwardPayload : Cell = beginCell().endCell()
        if (comment != "") {            
            forwardPayload = beginCell()
                .storeUint(0x00000000, 32)
                .storeBuffer(Buffer.from(comment))
            .endCell()
        }
        return this.transferMessage(jetton_amount, to, responseAddress, customPayload, toNano(0.0), forwardPayload)
    }
    
    async sendTransfer(
        provider: ContractProvider, via: Sender,
        value: bigint,
        jetton_amount: bigint, to: Address,
        responseAddress:Address,
        customPayload: Cell,
        forward_ton_amount: bigint,
        forwardPayload: Cell,        
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.transferMessage(jetton_amount, to, responseAddress, customPayload, forward_ton_amount, forwardPayload),
            value:value,
        });
    }

    async sendTransferWithComment(
        provider: ContractProvider, via: Sender,
        value: bigint,
        jetton_amount: bigint,
        to: Address,
        responseAddress:Address,
        comment : string       
    ) {
        let forwardPayload : Cell = beginCell().endCell()
        if (comment != "") {            
            forwardPayload = beginCell()
                .storeUint(0x00000000, 32)
                .storeBuffer(Buffer.from(comment))
            .endCell()
        }

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.transferMessage(jetton_amount, to, responseAddress, beginCell().endCell(), toNano(0.0), forwardPayload),
            value:value
        });
    }


    /*
      burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
                    response_destination:MsgAddress custom_payload:(Maybe ^Cell)
                    = InternalMsgBody;
    */
    static burnMessage(jetton_amount: bigint,
                       responseAddress:Address,
                       customPayload: Cell | null) {
        return beginCell().storeUint(0x595f07bc, 32).storeUint(0, 64) // op, queryId
                          .storeCoins(jetton_amount).storeAddress(responseAddress)
                          .storeMaybeRef(customPayload)
               .endCell();
    }

    async sendBurn(provider: ContractProvider, via: Sender, value: bigint,
                          jetton_amount: bigint,
                          responseAddress:Address,
                          customPayload: Cell) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.burnMessage(jetton_amount, responseAddress, customPayload),
            value:value
        });

    }
    /*
      withdraw_tons#107c49ef query_id:uint64 = InternalMsgBody;
    */
    static withdrawTonsMessage() {
        return beginCell().storeUint(0x6d8e5e3c, 32).storeUint(0, 64) // op, queryId
               .endCell();
    }

    async sendWithdrawTons(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.withdrawTonsMessage(),
            value:toNano('0.1')
        });

    }
    /*
      withdraw_jettons#10 query_id:uint64 wallet:MsgAddressInt amount:Coins = InternalMsgBody;
    */
    static withdrawJettonsMessage(from:Address, amount:bigint) {
        return beginCell()
            .storeUint(0x768a50b2, 32)
            .storeUint(0, 64) // op, queryId
            .storeAddress(from)
            .storeCoins(amount)
            .storeMaybeRef(null)
        .endCell();
    }

    async sendWithdrawJettons(provider: ContractProvider, via: Sender, from:Address, amount:bigint) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.withdrawJettonsMessage(from, amount),
            value:toNano('0.1')
        });

    }


    async getJettonBalance(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0n;
        }
        let res = await provider.get('get_wallet_data', []);
        return res.stack.readBigNumber();
    }

    async getWalletData(provider: ContractProvider) {
        const result = await provider.get('get_wallet_data', []);
        return {
            balance: result.stack.readBigNumber(),
            ownerAddress: result.stack.readAddress(),
            jettonMasterAddress: result.stack.readAddress(),
            jettonWalletCode: result.stack.readCell(),
        };
    }

    
    static printParsedInput(body: Cell) : ContractMessageMeta[] {
        let result : ContractMessageMeta[] = []
  
        const OpLookup : {[key : number] : string} = OpcodesLookup
        let p = body.beginParse()        
        let op : number  = p.preloadUint(32)

        if (op == ContractOpcodes.JETTON_TRANSFER)
        {          
            result.push({ name:`op`                    , value: `${p.loadUint(32)  }`, type:`Uint(32),op`})  
            result.push({ name:`query_id`              , value: `${p.loadUint(64) }` , type:`Uint(64) ` })              
            result.push({ name:`jetton_amount`         , value: `${p.loadCoins()  }` , type:`Coins()  ` })             
            result.push({ name:`to_owner_address`      , value: `${p.loadAddress()}` , type:`Address()` })                
            result.push({ name:`response_address`      , value: `${p.loadAddress()}` , type:`Address()` })                

            let customPayload = p.loadMaybeRef()
            if (customPayload) {
                result.push({ name:`custom_payload`    , value: customPayload.toBoc().toString('hex') , type:`Cell()` })
            } else {
                result.push({ name:`custom_payload`    , value: `none` , type:`Cell()` })
            }
            result.push({ name:`forward_ton`           , value: `${p.loadCoins()}` , type:`Coins()` })                
            let forwardPayload = p.loadMaybeRef()
            if (forwardPayload) {
                result.push({ name:`forward_payload`   , value: forwardPayload.toBoc().toString('hex') , type:`Cell(), Payload` })
            } else {
                result.push({ name:`forward_payload`   , value: `none` , type:`Cell()` })
            }
            

            //result.push({ name:`custom_payload`        , value: `${p.loadCe() }`     , type:`` })            

            //result.push({ name:`forward_ton_amount`    , value: `${p.loadCoins()}`    , type:`` })             
            //result.push({ name:`either_forward_payload`, value: `?`                 , type:`` })
        }

        if (op == ContractOpcodes.JETTON_INTERNAL_TRANSFER)
        {     
            result.push({ name:`op`                , value: `${p.loadUint(32) }`, type:`Uint(32) op`})  
            result.push({ name:`query_id`          , value: `${p.loadUint(64) }`, type:`Uint(64)` })              
            result.push({ name:`jetton_amount`     , value: `${p.loadCoins()  }`, type:`Coins()` })             
            result.push({ name:`from_address`      , value: `${p.loadAddress()}`, type:`Address()` })                
            result.push({ name:`response_address`  , value: `${p.loadAddress()}`, type:`Address()` })        
            result.push({ name:`forward_ton_amount`, value: `${p.loadCoins()  }`, type:`Coins(),TON` }) 
            
            let forwardPayload = p.loadMaybeRef()
            if (forwardPayload) {
                result.push({ name:`forward_payload`   , value: forwardPayload.toBoc().toString('hex') , type:`Cell(), Payload` })
            } else {
                result.push({ name:`forward_payload`   , value: `none` , type:`Cell()` })
            }
        }
      
        if (op == ContractOpcodes.JETTON_TRANSFER_NOTIFICATION)
        {     

         
        }


        return result
    } 

}
