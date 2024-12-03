import colors from "colors/safe"
import { OptionValues } from "commander"
import { getUserAndClient } from "../utils"
import { Address, Cell, fromNano, Slice, TonClient4 } from "@ton/ton"
import { AddressBook } from "../addressbook"
import { RouterV3Contract, routerv3ContractCellToConfig } from "../../wrappers/RouterV3Contract"
import { getDailyStorageFees } from "../../wrappers/tonUtils"

export async function ammInfoRouter(options : OptionValues) {
    console.log(options)   

    const {key, wallet:walletV4, client: clientAPI, name:credentialsName} = await getUserAndClient()
    let client = clientAPI as TonClient4

    const addressBook = AddressBook.getInstance(options.deploy != "" ? options.deploy : credentialsName)
    addressBook.printAddressBook()

    let routerAddress  = addressBook.getAddress(options.router, Address.parse(addressBook.router))
    console.log(`Router        : ${routerAddress.toString()}`)
    const routerV3Contract =  client.open(new RouterV3Contract(routerAddress))
    /* Let's assume it is deployed */

    let seqno = (await client.getLastBlock()).last.seqno;
    let poolAccount = await client.getAccountLite(seqno, routerAddress)
    const sStats = poolAccount.account.storageStat

    let routerBalance = poolAccount.account.balance.coins
    let storageDayFee = getDailyStorageFees (BigInt(sStats!.used.bits), BigInt(sStats!.used.cells))

    console.log("Blockchain Data:")        
    console.log(`  Balance      : ${fromNano(routerBalance)} ton`)
    console.log(`  Data used    : ${sStats!.used.bits} bits ${sStats?.used.cells} cells (days remaining = ${BigInt(routerBalance) / storageDayFee}, per day = ${fromNano(storageDayFee)})`)

    let state = await routerV3Contract.getState()
    let adminAddress = state.admin
    let poolAdminAddress = state.pool_admin
    let poolFactoryAddress = state.pool_factory
    let flags = state.flags
    let rseqno = state.pool_seqno
       
    console.log(`ROUTER ${routerAddress} `)
    
    /* Temporary hack */
    //let routerState = await routerV3Contract.getState()
    /*let adminAddress 
    let poolFactoryAddress
    let flags : bigint = 0n*/

    console.log(`  Admin       : ${colors.magenta(adminAddress.toString())}`)
    console.log(`  PoolAdmin   : ${colors.magenta(poolAdminAddress.toString())}`)    
    console.log(`  PoolFactory : ${colors.magenta(poolFactoryAddress.toString())}`)
    console.log(`  Flags : ${"0x" + flags.toString(16).padStart(16, "0")}`)
    console.log(`  Seqno : ${rseqno}`)

    let codes = await routerV3Contract.getChildContracts();
    console.log(   `Pool     Code Hash:`, "0x" + codes.poolCode       .hash(0).toString("hex"))
    console.log(   `Account  Code Hash:`, "0x" + codes.accountCode    .hash(0).toString("hex"))
    console.log(   `Position Code Hash:`, "0x" + codes.positionNFTCode.hash(0).toString("hex"))


    console.log(`Direct from contract:`)
    seqno = (await client.getLastBlock()).last.seqno
    const routerAccount = await client.getAccount(seqno, routerAddress)
    if (routerAccount.account.state.type == "active") {
        const dataString : string = routerAccount.account.state.data!
        const codeString : string = routerAccount.account.state.code!

        const data : Cell = Cell.fromBase64(dataString)
        const code : Cell = Cell.fromBase64(codeString)
        
        const dataUnpacked = routerv3ContractCellToConfig(data)
        console.log(` Code Hash  : 0x${code.hash(0).toString("hex")}` )

        
        let s : Slice = data.beginParse()
        const subcodes = s.loadRef()
        const timelocks = s.loadRef().beginParse()
        const delay     = timelocks.loadUintBig(64)
        const codeLock  = timelocks.loadMaybeRef()
        const adminLock = timelocks.loadMaybeRef()
        const flagsLock = timelocks.loadMaybeRef()
        
        const nowTime = Math.floor(Date.now() / 1000)
        console.log(` Timelock delay : ${dataUnpacked.timelockDelay}` )
        console.log(` Now      : ${nowTime}` )
      
        if (adminLock) {
            const admin = adminLock.beginParse()
            const newAdmin = admin.loadAddressAny()
            const time = admin.loadUintBig(64)
            const timeDelta = time > nowTime
            console.log(` Admin   : ${newAdmin} till ${timeDelta ? colors.red(timeDelta.toString() + "left " + timeDelta + "s") :  colors.green(time.toString())}`)
        } else {
            console.log(` Admin   : No lock`)
        }

        if (codeLock) {
            const code = codeLock.beginParse()
            const time = code.loadUintBig(64)
            const newCode = code.loadRef()
            const timeDelta = time > nowTime
            console.log(` Code    : Has Lock ${newCode.hash(0).toString("hex")} till ${timeDelta ? colors.red(timeDelta.toString() + "left " + timeDelta + "s") :  colors.green(time.toString())} `)
        } else {
            console.log(` Code    : No lock`)
        }

        if (flagsLock) {
            const flags = flagsLock.beginParse()
            const value = "0x" + flags.loadUintBig(64).toString(16).padStart(16,"0")
            const time = flags.loadUintBig(64)
            const timeDelta = time > nowTime

            console.log(` Flags   : Has Lock ${value} till ${timeDelta ? colors.red(timeDelta.toString() + "left " + timeDelta + "s") :  colors.green(time.toString())} `)
        } else {
            console.log(` Flags   : No lock`)
        }
       
    }

}