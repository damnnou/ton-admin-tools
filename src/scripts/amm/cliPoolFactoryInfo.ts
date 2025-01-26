import { getUserAndClient } from "../utils"
import { Address, fromNano, TonClient4 } from "@ton/ton"
import { PoolFactoryContract } from "../../wrappers/PoolFactoryContract"
import { getDailyStorageFees } from "../../wrappers/tonUtils"
import { unpackJettonOnchainMetadata } from "../../wrappers/common/jettonContent"

export async function poolFactoryInfo(options : { [key: string]: any; }, logger : any) 
{   
    let askUser: boolean = (options.yes != true)
    console.log(`Should we ask user: <${askUser}>`)

    const {client: clientAPI, name:credentialsName} = await getUserAndClient()
    let client = clientAPI as TonClient4

    const poolFactory = new PoolFactoryContract(Address.parse(options.factory))
    const poolFactoryOpened = client.open(poolFactory)

    let seqno = (await client.getLastBlock()).last.seqno;
    let poolAccount = await client.getAccountLite(seqno, poolFactory.address)
    const sStats = poolAccount.account.storageStat

    let routerBalance = poolAccount.account.balance.coins
    let storageDayFee = getDailyStorageFees (BigInt(sStats!.used.bits), BigInt(sStats!.used.cells))

    logger.log("Blockchain Data:")        
    logger.log(`  Balance      : ${fromNano(routerBalance)} ton`)
    logger.log(`  Data used    : ${sStats!.used.bits} bits ${sStats?.used.cells} cells (days remaining = ${BigInt(routerBalance) / storageDayFee}, per day = ${fromNano(storageDayFee)})`)


    let data = await poolFactoryOpened.getPoolFactoryData()
    logger.log(`Pool Factory ${logger.magenta(poolFactory.address.toString())}`)
    logger.log(`   Admin  : ${ logger.magenta(data.admin_address .toString())}`)
    logger.log(`   Router : ${ logger.magenta(data.router_address.toString())}`)
    logger.log(`TON Price : ${fromNano(data.ton_price)} TON`)

    const nftContentUnpacked = unpackJettonOnchainMetadata(data.nftv3_content)
    const nftContentItemUnpacked = unpackJettonOnchainMetadata(data.nftv3item_content)

    logger.log(JSON.stringify(nftContentUnpacked, null, 2))
    logger.log(JSON.stringify(nftContentItemUnpacked, null, 2))
}
