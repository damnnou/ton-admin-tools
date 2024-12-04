import { Address, Cell, fromNano, Slice, TonClient4 } from "@ton/ton"
import { RouterV3Contract, routerv3ContractCellToConfig } from "../../wrappers/RouterV3Contract"
import { getDailyStorageFees } from "../../wrappers/tonUtils"
import { getUserAndClient } from "../utils";
import { AddressBook } from "../addressbook";

export async function ammInfoRouter(options : { [key: string]: any; }, logger : any) {
    logger.log(options)

    const {client: clientAPI, name:credentialsName} = await getUserAndClient()
    let client = clientAPI as TonClient4

    const addressBook = AddressBook.getInstance(options.deploy != "" ? options.deploy : credentialsName)
    addressBook.printAddressBook()

    let routerAddress  = addressBook.getAddress(options.router, Address.parse(addressBook.router))
    logger.log(`Router        : ${routerAddress.toString()}`)
    const routerV3Contract =  client.open(new RouterV3Contract(routerAddress))
    /* Let's assume it is deployed */

    let seqno = (await client.getLastBlock()).last.seqno;
    let poolAccount = await client.getAccountLite(seqno, routerAddress)
    const sStats = poolAccount.account.storageStat

    let routerBalance = poolAccount.account.balance.coins
    let storageDayFee = getDailyStorageFees (BigInt(sStats!.used.bits), BigInt(sStats!.used.cells))

    logger.log("Blockchain Data:")        
    logger.log(`  Balance      : ${fromNano(routerBalance)} ton`)
    logger.log(`  Data used    : ${sStats!.used.bits} bits ${sStats?.used.cells} cells (days remaining = ${BigInt(routerBalance) / storageDayFee}, per day = ${fromNano(storageDayFee)})`)

    let state = await routerV3Contract.getState()
    let adminAddress = state.admin
    let poolAdminAddress = state.pool_admin
    let poolFactoryAddress = state.pool_factory
    let flags = state.flags
    let rseqno = state.pool_seqno
       
    logger.log(`ROUTER ${routerAddress} `)
    
    logger.log(`  Admin       : ${logger.magenta(adminAddress.toString())}`)
    logger.log(`  PoolAdmin   : ${logger.magenta(poolAdminAddress.toString())}`)    
    logger.log(`  PoolFactory : ${logger.magenta(poolFactoryAddress.toString())}`)
    logger.log(`  Flags : ${"0x" + flags.toString(16).padStart(16, "0")}`)
    logger.log(`  Seqno : ${rseqno}`)

    let codes = await routerV3Contract.getChildContracts();
    logger.log(   `Pool     Code Hash:`, "0x" + codes.poolCode       .hash(0).toString("hex"))
    logger.log(   `Account  Code Hash:`, "0x" + codes.accountCode    .hash(0).toString("hex"))
    logger.log(   `Position Code Hash:`, "0x" + codes.positionNFTCode.hash(0).toString("hex"))


    logger.log(`Direct from contract:`)
    seqno = (await client.getLastBlock()).last.seqno
    const routerAccount = await client.getAccount(seqno, routerAddress)
    if (routerAccount.account.state.type == "active") {
        const dataString : string = routerAccount.account.state.data!
        const codeString : string = routerAccount.account.state.code!

        const data : Cell = Cell.fromBase64(dataString)
        const code : Cell = Cell.fromBase64(codeString)
        
        const dataUnpacked = routerv3ContractCellToConfig(data)
        logger.log(` Code Hash  : 0x${code.hash(0).toString("hex")}` )

        
        let s : Slice = data.beginParse()
        const subcodes = s.loadRef()
        const timelocks = s.loadRef().beginParse()
        const delay     = timelocks.loadUintBig(64)
        const codeLock  = timelocks.loadMaybeRef()
        const adminLock = timelocks.loadMaybeRef()
        const flagsLock = timelocks.loadMaybeRef()
        
        const nowTime = Math.floor(Date.now() / 1000)
        logger.log(` Timelock delay : ${dataUnpacked.timelockDelay}` )
        logger.log(` Now      : ${nowTime}` )
      
        if (adminLock) {
            const admin = adminLock.beginParse()
            const newAdmin = admin.loadAddressAny()
            const time = admin.loadUintBig(64)
            const timeDelta = time > nowTime
            logger.log(` Admin   : ${newAdmin} till ${timeDelta ? logger.red(timeDelta.toString() + "left " + timeDelta + "s") :  logger.green(time.toString())}`)
        } else {
            logger.log(` Admin   : No lock`)
        }

        if (codeLock) {
            const code = codeLock.beginParse()
            const time = code.loadUintBig(64)
            const newCode = code.loadRef()
            const timeDelta = time > nowTime
            logger.log(` Code    : Has Lock ${newCode.hash(0).toString("hex")} till ${timeDelta ? logger.red(timeDelta.toString() + "left " + timeDelta + "s") :  logger.green(time.toString())} `)
        } else {
            logger.log(` Code    : No lock`)
        }

        if (flagsLock) {
            const flags = flagsLock.beginParse()
            const value = "0x" + flags.loadUintBig(64).toString(16).padStart(16,"0")
            const time = flags.loadUintBig(64)
            const timeDelta = time > nowTime

            logger.log(` Flags   : Has Lock ${value} till ${timeDelta ? logger.red(timeDelta.toString() + "left " + timeDelta + "s") :  logger.green(time.toString())} `)
        } else {
            logger.log(` Flags   : No lock`)
        }
       
    }

}