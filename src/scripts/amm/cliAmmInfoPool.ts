import { getUserAndClient } from "../utils"
import { Contract, fromNano, TonClient4 } from "@ton/ton"
import { AddressBook } from "../addressbook"
import { PoolV3Contract } from "../../wrappers/PoolV3Contract"
import { getDailyStorageFees } from "../../wrappers/tonUtils"
import { JettonAPI } from "../../wrappers/JettonAPI"
import BigNumber from "bignumber.js"
import { FEE_DENOMINATOR, getApproxFloatPrice, TickMath } from "../../wrappers/frontmath/frontMath"

export async function ammInfo(options : { [key: string]: any; }, logger : any) 
{   
    const {client: clientAPI, name:credentialsName} = await getUserAndClient()
    let client = clientAPI as TonClient4
    const providerFunction = (x : Contract) => client.open(x) 

    const addressBook = AddressBook.getInstance(options.deploy != "" ? options.deploy : credentialsName)
    //addressBook.printAddressBook()

    let pools : {name: string, address: string}[] = []
    if (options.pool) {
        pools.push({ name : "Command Line", address : options.pool })
    } else {
        pools = Object.entries(addressBook.pools).map(([name, address]) => ({ name, address}))
    }
    
    for (let poolId in pools)
    {
        logger.log (`======= ${pools[poolId].name} =======`);
        const poolAddress = addressBook.getAddress(pools[poolId].address)
        
        let bseqno = (await client.getLastBlock()).last.seqno
        if (!await client.isContractDeployed(bseqno, poolAddress)){
            logger.log(`Pool ${poolAddress.toString()} is ${logger.red("Not Deployed")}`)
            continue
        }
        logger.log(`Pool ${poolAddress.toString()} is ${logger.green("Deployed")}`)
        
        let pool = client.open(new PoolV3Contract(poolAddress))
        const poolState = await pool.getPoolStateAndConfiguration()

        bseqno = (await client.getLastBlock()).last.seqno
        let poolAccount = await client.getAccountLite(bseqno, poolAddress)
        const sStats = poolAccount.account.storageStat

        let poolBalance = poolAccount.account.balance.coins
        let storageDayFee = getDailyStorageFees (BigInt(sStats!.used.bits), BigInt(sStats!.used.cells))
       
        logger.log("Blockchain Data:")        
        logger.log(`  Balance      : ${fromNano(poolBalance)} ton`)
        logger.log(`  Data used    : ${sStats!.used.bits} bits ${sStats?.used.cells} cells (days remaining = ${BigInt(poolBalance) / storageDayFee}, per day = ${fromNano(storageDayFee)}) ticks = ${poolState.ticks_occupied}`)
        //console.log(`  Data used    : ${sStats!.used.bits} bits ${sStats?.used.cells} cells (days remaining = ${BigInt(poolBalance) / storageDayFee}, per day = ${fromNano(storageDayFee)})`)

        let jetton0 : JettonAPI = new JettonAPI(poolState.jetton0_minter)
        let jetton1 : JettonAPI = new JettonAPI(poolState.jetton1_minter)
        await jetton0.open(providerFunction); await jetton0.loadData()
        await jetton1.open(providerFunction); await jetton1.loadData()

        const order = PoolV3Contract.orderJettonId(poolState.jetton0_wallet, poolState.jetton1_wallet)
        const jettonWallet0Check = await jetton0.getWalletAddress(poolState.router_address)
        const jettonWallet1Check = await jetton1.getWalletAddress(poolState.router_address)

        const reserve0 = BigNumber(poolState.reserve0.toString()).div((BigNumber(10).pow(BigNumber(jetton0.metadata.decimals))))
        const reserve1 = BigNumber(poolState.reserve1.toString()).div((BigNumber(10).pow(BigNumber(jetton1.metadata.decimals))))

        const checked0String = (jettonWallet0Check.toString() == poolState.jetton0_wallet.toString()) ? logger.green(poolState.jetton0_wallet.toString()) : logger.red(` Mismatch ${jettonWallet0Check} ${poolState.jetton0_wallet}`)
        const checked1String = (jettonWallet1Check.toString() == poolState.jetton1_wallet.toString()) ? logger.green(poolState.jetton1_wallet.toString()) : logger.red(` Mismatch ${jettonWallet1Check} ${poolState.jetton1_wallet}`)

        logger.log(`Jettons: ${order ? "Natural Order" : "Swapped"}`)
        logger.log(`  Jetton0   : wallet: ${checked0String}  minter: ${ poolState.jetton0_minter} [${jetton0.metadata.symbol}] - ${reserve0}`)
        logger.log(`  Jetton1   : wallet: ${checked1String}  minter: ${ poolState.jetton1_minter} [${jetton1.metadata.symbol}] - ${reserve1}`)
        logger.log("Admins:")
        logger.log("  Admin     :", poolState.admin_address)
        logger.log("  Router    :", poolState.router_address)
        logger.log("  Controller:", poolState.controller_address)


        logger.log(`Pool Data: - ${ poolState.pool_active ? logger.green("Active"): logger.red("Locked")}`)
        let baseFee     = poolState.lp_fee_base    / FEE_DENOMINATOR * 100
        let activeFee   = poolState.lp_fee_current / FEE_DENOMINATOR * 100
        let protocolFee = poolState.lp_fee_base * poolState.protocol_fee / (FEE_DENOMINATOR * FEE_DENOMINATOR) * 100

        let priceValue = getApproxFloatPrice(poolState.price_sqrt) * (10 ** Number(jetton0.metadata.decimals)) / (10 ** Number(jetton1.metadata.decimals))
        let priceText = `1${jetton0.metadata.symbol} =  ${priceValue}${jetton1.metadata.symbol}`

        logger.log(`  Tick Spacing : ${ poolState.tick_spacing }  Base Fee     : ${baseFee}%     Active Fee   : ${activeFee}%    Protocol Fee ${protocolFee}% `)        
        const protocol0 = BigNumber(poolState.collectedProtocolFee0.toString()).div((BigNumber(10).pow(BigNumber(jetton0.metadata.decimals))))
        const protocol1 = BigNumber(poolState.collectedProtocolFee1.toString()).div((BigNumber(10).pow(BigNumber(jetton1.metadata.decimals))))
        
        logger.log(`  Protocol Collected : ${protocol0} ${jetton0.metadata.symbol} and ${protocol1} ${jetton1.metadata.symbol}`)
        logger.log(`  Liquidity    : ${ poolState.liquidity }`)
        logger.log(`  Price        : ${priceText}  (${ poolState.price_sqrt })  (tick : ${poolState.tick})`)

        logger.log(`  Minted pos: ${ poolState.nftv3item_counter}  Active pos: ${ poolState.nftv3items_active} Ticks occupied: ${ poolState.ticks_occupied}   Seqno:  ${ poolState.seqno}`)

       /* let ticks = await pool.getTickInfosFromArr(TickMath.MIN_TICK - 1, 255)
        console.log(`  ActiveTicks  : ${ticks.length <= 255 ? ticks.length : colors.green(">255") }`)

        if (options.info) {
            for (let tick of ticks) {
                console.log(`${tick.tickNum} ${tick.liquidityGross} ${tick.liquidityNet}`)
            }
        }*/
        if (options.info) {
            let ticks0 = await pool.getTickInfosFromArr(TickMath.MIN_TICK - 1, 195)
            logger.log(`  ActiveTicks  : ${ticks0.length <= 180 ? ticks0.length : logger.red(">180") }`)

            let ticks1 = await pool.getTickInfosAll()
            logger.log(`  ActiveTicks  : ${ticks1.length}`)
        }
    } 
   
}