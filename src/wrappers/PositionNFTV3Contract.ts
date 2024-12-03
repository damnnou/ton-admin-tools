import { Address, beginCell, Builder, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from "@ton/core";
import { ContractOpcodes } from "./opCodes";
import { MetaMessage, StructureVisitor } from "../scripts/meta/structureVisitor";
import { ParseDataVisitor } from "../scripts/meta/parseDataVisitor";

/** Inital data structures and settings **/
// This is outdated
export type PositionNFTV3ContractConfig = {    
    poolAddress : Address, 
    userAddress : Address, 

    liquidity : bigint,
    tickLow   : number,
    tickHigh  : number,

    feeGrowthInside0LastX128 : bigint,
    feeGrowthInside1LastX128 : bigint,

}

export function positionNFTv3ContractConfigToCell(config: PositionNFTV3ContractConfig): Cell {
    return beginCell()
        .storeAddress(config.poolAddress)
        .storeAddress(config.userAddress)
        .storeUint(config.liquidity, 128)
        .storeInt (config.tickLow, 24)
        .storeInt (config.tickHigh, 24)
        .storeRef(beginCell()
            .storeUint (config.feeGrowthInside0LastX128, 256)
            .storeUint (config.feeGrowthInside1LastX128, 256)
        .endCell())        
    .endCell()    
}


export class PositionNFTV3Contract implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}
  
    static createFromConfig(
        config: PositionNFTV3ContractConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = positionNFTv3ContractConfigToCell(config);
        const init = { code, data };
        const address = contractAddress(workchain, init);  
        return new PositionNFTV3Contract(address, init);
    }
  
    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(
        provider: ContractProvider, 
        via: Sender, 
        params: {
            value?: bigint
            to: Address
            responseTo?: Address
            forwardAmount?: bigint
            forwardBody?: Cell | Builder
        }
    ) {
        await provider.internal(via, {
            value: params.value ?? toNano('0.05'),
            body: beginCell()
                .storeUint(ContractOpcodes.POSITIONNFTV3_NFT_TRANSFER, 32) // op
                .storeUint(0, 64) // query id
                .storeAddress(params.to)
                .storeAddress(params.responseTo)
                .storeBit(false) // custom payload
                .storeCoins(params.forwardAmount ?? 0n)
                .storeMaybeRef(params.forwardBody)
                .endCell()
        })
    }

    /** Getters **/
    async getBalance(provider: ContractProvider) {
        const { stack } = await provider.get("balance", []);
        return { number: stack.readNumber() };
    }

    async getUserAddress(provider: ContractProvider) : Promise<Address> {
      const { stack } = await provider.get("getUserAddress", []);
      return stack.readAddress();
    }
    
    async getPoolAddress(provider: ContractProvider) : Promise<Address> {
      const { stack } = await provider.get("getPoolAddress", []);
      return stack.readAddress();
    }

    async getPositionInfo(provider: ContractProvider) {
        const { stack } = await provider.get("getPositionInfo", []);
        return {
            liquidity: stack.readBigNumber(), 
            tickLow : stack.readNumber(), 
            tickHigh: stack.readNumber(),
            feeGrowthInside0LastX128: stack.readBigNumber(), 
            feeGrowthInside1LastX128: stack.readBigNumber()
        };
      }

    /* TODO: Should I use inheritance? */ 
    async getData(provider: ContractProvider) {
        const { stack } = await provider.get('get_nft_data', [])
        return {
            inited:     stack.readBoolean(),
            index:      stack.readBigNumber(),
            collection: stack.readAddressOpt(),
            owner:      stack.readAddressOpt(),
            content:    stack.readCellOpt(),
        }
    }
  
    static metaDescription : MetaMessage[] =     
    [
    {
        opcode : ContractOpcodes.POSITIONNFTV3_POSITION_INIT,
        description : "Initial message that pools sends to the NFT after state_init",
        rights : "This operation is allowed for positionv3::pool_address",
        acceptor : (visitor: StructureVisitor) => {
            visitor.visitField({ name:`op`,            type:`Uint`,    size:32,  meta:"op",   comment: ""})    
            visitor.visitField({ name:`query_id`,      type:`Uint`,    size:64,  meta:""  ,   comment : "queryid as of the TON documentation"}) 
            visitor.visitField({ name:`user_address`,  type:`Address`, size:267 , meta : ""  , comment : "NFT owner "})

            visitor.visitField({ name:`liquidity`,     type:`Uint`    , size:128 , meta : ""  , comment : "Amount of the liquidity"})   
            visitor.visitField({ name:`tickLower`,     type:`Int`     , size:24  , meta : ""  , comment : "Lower tick of the NFT"})
            visitor.visitField({ name:`tickUpper`,     type:`Int`     , size:24  , meta : ""  , comment : "Upper tick of the NFT"})

            visitor.enterCell({name: "old_fee_cell", comment : "Fee counters From"})
            visitor.visitField({ name:`feeGrowthInside0LastX128`, type:`Uint`, size:256, meta : "x128", comment: ""}) 
            visitor.visitField({ name:`feeGrowthInside1LastX128`, type:`Uint`, size:256, meta : "x128", comment: ""})    

            visitor.visitField({ name:`nftIndex`     , type:`Uint`,  size:64,  meta : "Indexer", comment: ""}) 
            visitor.visitField({ name:`jetton0Amount`, type:`Coins`, size:124, meta : "Indexer", comment: ""}) 
            visitor.visitField({ name:`jetton1Amount`, type:`Coins`, size:124, meta : "Indexer", comment: ""}) 
            visitor.visitField({ name:`tick`,          type:`Int`,   size:24,  meta : "Indexer", comment: ""})
            visitor.leaveCell({})
        }
    },
    {
        opcode : ContractOpcodes.POSITIONNFTV3_POSITION_BURN,
        description : "Message from the pool that is part of burn process. This message carries new feeGrowthInside?Last values form the pool",
        rights : "This operation is allowed for positionv3::user_address",
        acceptor : (visitor: StructureVisitor) => {
            visitor.visitField({ name:`op`,               type:`Uint`,    size:32,  meta:"op",   comment: ""})    
            visitor.visitField({ name:`query_id`,         type:`Uint`,    size:64,  meta:""  ,   comment : "queryid as of the TON documentation"}) 

            visitor.visitField({ name:`nft_owner`      , type:`Address` , size:267 , meta : ""  , comment : "NFT owner to receive funds"})
            visitor.visitField({ name:`liquidity2Burn` , type:`Uint`    , size:128 , meta : ""  , comment : "Amount of the liquidity to burn, 0 is a valid amount, in this case only collected fees would be returned"})   
            visitor.visitField({ name:`tickLower`      , type:`Int`     , size:24  , meta : ""  , comment : "Lower tick of the NFT. NFT would check that it is the same as in position"})
            visitor.visitField({ name:`tickUpper`      , type:`Int`     , size:24  , meta : ""  , comment : "Upper tick of the NFT. NFT would check that it is the same as in position"})

            visitor.enterCell({name: "old_fee_cell", comment : "Fee counters From"})
            visitor.visitField({ name:`feeGrowthInside0LastX128`, type:`Uint`, size:256, meta : "x128", comment: ""}) 
            visitor.visitField({ name:`feeGrowthInside1LastX128`, type:`Uint`, size:256, meta : "x128", comment: ""})
            visitor.leaveCell({})
        }
    },
    {
        opcode : ContractOpcodes.POSITIONNFTV3_NFT_TRANSFER,
        name : "POSITIONNFTV3_NFT_TRANSFER",
        description : "Transfer LP NFT to another user. Please be warned that some UI elements could be unable to track it. However with SDK it still can be burned",
        rights : "This operation is allowed for positionv3::user_address",
        acceptor : (visitor: StructureVisitor) => {
            visitor.visitField({ name:`op`,            type:`Uint`,    size:32,  meta:"op",  comment: ""})    
            visitor.visitField({ name:`query_id`,      type:`Uint`,    size:64,  meta:""  ,  comment : "queryid as of the TON documentation"}) 
            visitor.visitField({ name:`new_owner`,     type:`Address`, size:267, meta:""  ,  comment : "New NFT owner"})
            visitor.visitField({ name:`response_destination`, type:`Address`, size:267, meta:""  ,  comment : "Address to receive response"})
            
            visitor.visitField({ name:`custom_payload`,  type:`Cell`,    size:0, meta:"Maybe", comment: "Custom information for NFT. Ignored by our implementation"}) 
            visitor.visitField({ name:`forward_amount`,  type:`Coins`, size:124, meta:"",      comment: "Amount of coins to forward for processing"}) 
            visitor.visitField({ name:`forward_payload`, type:`Cell`,    size:0, meta:"Either",comment: "Payload for processing"}) 

        }
    }
    ]
  
}