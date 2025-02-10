import { Address, Cell, fromNano, Slice, Transaction } from "@ton/core"
import { ContractOpcodes, ErrorsLookup, OpcodesLookup } from "../wrappers/opCodes"
import { FEE_DENOMINATOR, getApproxFloatPrice, MaxUint128, TickMath } from "../wrappers/frontmath/frontMath"

import { RouterV3Contract } from "../wrappers/RouterV3Contract";
import { PoolV3Contract } from "../wrappers/PoolV3Contract";
import { PositionNFTV3Contract } from "../wrappers/PositionNFTV3Contract";
import { AccountV3Contract } from "../wrappers/AccountV3Contract";
import { ParseDataVisitor } from "./meta/parseDataVisitor";
import { ContractMessageMeta } from "./meta/structureVisitor";
import { JettonWallet } from "../wrappers/common/JettonWallet";
import { PTonWalletV2 } from "../wrappers/3rd_party/PTonWalletV2";
import { PoolFactoryContract } from "../wrappers/PoolFactoryContract";
import { JettonMinter } from "../wrappers/common/JettonMinter";


type DecodedMessage = {
    decoded : ContractMessageMeta[]
    remainder : Slice
}


export type TransactionEx = Transaction & {
    block : string

}

function printParsedInput(obj : any , body: Cell) : DecodedMessage {

    let result : ContractMessageMeta[] = []
    let p = body.beginParse()
    let op : number  = p.preloadUint(32)

    for (let meta of obj.metaDescription) {
        if (op == meta.opcode) {
            console.log(`Processing ${OpcodesLookup[op]}`)
            let visitor = new ParseDataVisitor
            let remainder = visitor.visitCell(body, meta.acceptor)
            return { decoded: visitor.result, remainder} 
        }
    }
    return { decoded: result, remainder: p };
}



export class UniversalParser
{
    static printParsedInput(body: Cell) : DecodedMessage
    {     
        let objects = [RouterV3Contract, PoolV3Contract, PositionNFTV3Contract, AccountV3Contract, PoolFactoryContract, JettonWallet, JettonMinter, PTonWalletV2]
        for (let obj of objects) {
            if ("metaDescription" in obj) {
                try {
                    const result = printParsedInput(obj, body)
                    if (result.decoded.length != 0)
                        return result    
                } catch {}
            }
        }      
        try {        
            let p = body.beginParse()        
            let op : number  = p.preloadUint(32)
            if (op == 0xffffffff) {
                op = p.loadUint(32)
                return { 
                    decoded : [
                      { name:`op` , value: `${p.loadUint(32) }`, type:`Uint(32) op`}
                    ],
                    remainder : p
                }
            }
        } catch {}
        return { 
            decoded : [],
            remainder : body.beginParse()
        }
    }
}


export function printWalletParsedInput(body: Cell) : {name: string, value: string, type:string }[] {
    let result : {name: string, value: string, type:string }[] = []

    const OpLookup : {[key : number] : string} = OpcodesLookup
    let p = body.beginParse()
    
    let op : number  = p.loadUint(32)
    console.log("op == ", OpLookup[op])

    p = body.beginParse()
    if (op == ContractOpcodes.JETTON_EXCESSES)
    {       
        result.push({ name:`op`,            value: `${p.loadUint(32)  }`, type:`Uint(32) op`})     
        result.push({ name:`query_id`,      value: `${p.loadUint(64)  }`, type:`Uint(64) `})         
    }      
    return result;

  }

export type ContractDictionary =  { [x : string] : {name: string, parser?:any} }


function decodedToString(addrD: string, messageDecoded :DecodedMessage, contractDict: ContractDictionary) {
    let message = "";

    let op    = ""        
    let payloadTo = ""

    const emptyCellHex = Cell.EMPTY.toBoc().toString("hex")

    let decodedMessageFields = messageDecoded.decoded
    for (let field in decodedMessageFields)
    {
        let value = decodedMessageFields[field].value
        console.log(`Processing ${field} ${decodedMessageFields[field].name}:`)
        console.log(`   ${value}`)



        if (decodedMessageFields[field].type.endsWith("op") )
        {
            let opText = OpcodesLookup[Number(value)]
            op = value
            opText = opText.split(",")[0]
            value = "<b>" + opText + "</b> " + "0x" + Number(value).toString(16)

            console.log(`OP:  ${op} ${opText}`)
        }           

        /* Process other types */        
        if (decodedMessageFields[field].type.startsWith("Address") && value in contractDict ) {
            value = contractDict[value].name
        }                   

        if (decodedMessageFields[field].name == "exit_code" )
        {
            value += "&nbsp;<b>" + ErrorsLookup[Number(value)] + "</b>"
        }

        if (decodedMessageFields[field].type.includes("PriceX96") )
        {
            if (BigInt(value) == TickMath.MAX_SQRT_RATIO     )      value = "MAX_SQRT_RATIO"
            else if (BigInt(value) == TickMath.MAX_SQRT_RATIO - 1n) value = "MAX_SQRT_RATIO - 1"
            else if (BigInt(value) == TickMath.MIN_SQRT_RATIO     ) value = "MIN_SQRT_RATIO"
            else if (BigInt(value) == TickMath.MIN_SQRT_RATIO + 1n) value = "MIN_SQRT_RATIO + 1"
         //   console.log(value)
            else value = "p =" + getApproxFloatPrice(BigInt(value)).toString()
        }                   
    

        /* Guess payload target */
        if (Number(op) == ContractOpcodes.JETTON_TRANSFER)  {
            if (decodedMessageFields[field].name === "to_owner_address") {                        
                payloadTo = decodedMessageFields[field].value
                console.log("Cell found payload to ", decodedMessageFields[field])
                console.log("Target JETTON_TRANSFER: ", payloadTo)
            }
        } 

        if (Number(op) == ContractOpcodes.JETTON_TRANSFER_NOTIFICATION)  {
            payloadTo = addrD
            console.log("Target JETTON_TRANSFER_NOTIFICATION", payloadTo,  contractDict[payloadTo].name)
            console.log(`Processing ${decodedMessageFields[field].type}`)

        }      

        
        if (decodedMessageFields[field].type.startsWith("Cell") && decodedMessageFields[field].type.includes("Payload")) {

            if (value == emptyCellHex) {
                value = "Cell.EMPTY"
            } else if (value == "" || value == "none" ) {
                value = "null"
            } else if (payloadTo != "") {
                const target = contractDict[payloadTo]
                console.log("target", target)

                let hex = decodedMessageFields[field].value;
                console.log("hex", hex)
                if (hex != "" && hex != "none") {
                    const boc = Cell.fromBoc(Buffer.from(hex, "hex"))  
                    const payload = target.parser(boc[0])
                    console.log(payload)
                    value = "to " + target.name + "\n&nbsp;&nbsp;&nbsp;&nbsp; " + decodedToString(payloadTo, payload, contractDict).replace(/\n/g, "\n&nbsp;&nbsp;&nbsp;&nbsp;")
                }        
            } else {                  
                value = value.substring(0, 16) + (value.length > 16 ? "..." : "");
            }
        }

        if (decodedMessageFields[field].type.startsWith("Cell") && decodedMessageFields[field].type.includes("Metadata")) {
            value = value.substring(0, 16) + (value.length > 16 ? "..." : "");
        }


        if (decodedMessageFields[field].type.includes("Uint(128)")) {            
            if (BigInt(value) == MaxUint128) {
                value = "<i>2^128 - 1</i>" 
            }
        }
        if (decodedMessageFields[field].type.includes("Indexer")) {
            value = value + " <i><b>Indexer Only</b></i>"
        }

        if (decodedMessageFields[field].type.includes("Bool")) {
            value = Number(value) == 0 ? "false" : "true"
        }

        if (decodedMessageFields[field].type.includes("Fee")) {
            let val = Number(value)
            if (val > FEE_DENOMINATOR) {
                value = value + " <i>Leave default</i>" 
            }
        }



        /*if (messageDecoded[field].type.startsWith("Coins()")) {
            value = fromNano(value)
        }*/        
        message += `${decodedMessageFields[field].name}: ${value}\n`
    }
    if (messageDecoded.remainder) {
        if (messageDecoded.remainder.remainingBits != 0 || messageDecoded.remainder.remainingRefs != 0)
        {
            message += `Trailing data: bits=${messageDecoded.remainder.remainingBits} refs=${messageDecoded.remainder.remainingRefs}\n`
        }
    } else {
            message += "Remainder unknown\n"
    }

    message += `<span><button id="copy">Copy Raw Body</button></span>\n`

    return message

}

function escapeNodeId(s: string) : string {
    return s.replace(/-/g,"_")
}


export function traceToMermaid(transactions : TransactionEx[], contractDict : ContractDictionary) : string {
    let lines = []
    lines.push("---")
    lines.push(`title: ${name}`)
    lines.push("---")
    lines.push("flowchart TD")
    lines.push("classDef decodedMessage text-align:left,white-space:nowrap;")
    lines.push("classDef decodedNode    text-align:left,white-space:nowrap,rx:10px,ry:10px;")
    
    /* I will  identify all messages by src and creation time. */
    let messages: {[lt: string] : {raw: any, processed:string}} = {}

    /* Pass1: collect all incoming messages */
    for (let [index, tx] of transactions.entries()) 
    {        
        if (tx.inMessage && tx.inMessage.info.type === 'internal') {
            const lt = tx.inMessage.info.createdLt

            let message1 = "NO DECODER"

            let addrD = tx.inMessage.info.dest?.toString()

            /*if (addrD in contractDict && contractDict[addrD].parser ) {
                let messageDecoded = contractDict[addrD].parser(tx.inMessage.body)

                message1 = decodedToString(addrD, messageDecoded, contractDict)
            }*/
            let messageDecoded = UniversalParser.printParsedInput(tx.inMessage.body)
            message1 = decodedToString(addrD, messageDecoded, contractDict) 


            if (message1 == "") {
                message1 = "EMPTY"
            }


            messages[escapeNodeId(tx.inMessage.info.src.toString()) + "_" + lt.toString()] = {raw: tx.inMessage.info, processed:message1}
        }
        if (tx.inMessage && tx.inMessage.info.type === 'external-in') {
            const lt = "external"
            let src = "external"
            if (tx.inMessage.info.src)
                src = tx.inMessage.info.src.toString()

            messages[escapeNodeId(src) + "_" + lt.toString()] = {raw: tx.inMessage.info, processed:"external"}
            console.log(tx.inMessage.info)
        }
    }

    /* Now we dump all the contract calls */
    for (let [index, tx] of transactions.entries()) {
                    
        if (!tx.inMessage) {
            continue;
        }
        let destText = "N/A"
        let txRawAddress = tx.inMessage.info.dest?.toString()
        let txNodeName = escapeNodeId(txRawAddress)
        console.log(txNodeName)
        if (txRawAddress !== undefined) {

            if (txRawAddress in contractDict) {
                destText = escapeNodeId(contractDict[txRawAddress].name)
            } else {
                destText = txNodeName.substring(0, 6)+ "___" +  txNodeName.substring(txNodeName.length - 6, txNodeName.length)            
            }
            txNodeName = txNodeName + "_" + index 

            if ((tx.description.type == "generic") && (tx.description.computePhase.type == "vm") ) {
                destText += "\n"
               
                let computePhase = tx.description.computePhase
                let error = (computePhase.exitCode in ErrorsLookup) ? "<b>" + ErrorsLookup[computePhase.exitCode] + "</b>" : computePhase.exitCode

                let strShard = tx.block.split(",")[1]
                let hexShard : bigint = BigInt("0x" + strShard)
                let binShard = hexShard.toString(2) + "b"

                let strAccout = (tx.inMessage.info.dest as Address).hash.toString("hex").slice(0, 16)
                let hexAccout : bigint = BigInt("0x" + strAccout)
                let binAccout = hexAccout.toString(2) + "b"
                
                let i = 0n
                for (; i < 64n; i++) {
                    if ((hexShard & (1n << i )) != 0n) {
                        break
                    }
                }
                let mask64 =  0xFFFFFFFFFFFFFFFFn; 
                let mask : bigint = (mask64 << (i + 1n)) & mask64;
                let shardOk = ((hexAccout ^ hexShard) & mask) == 0n

                let accShard = BigInt("0x" + (tx.inMessage.info.dest as Address).hash.toString("hex").slice(0, 16)) .toString(2) + "b"

                // https://tonviewer.com/block/(-1:8000000000000000:39991696)  
                // https://tonviewer.com/transaction/39229a9f8d0a3c5975e72059f9da02f5aae56abf4fb8731e5922482467976711

                destText += "Block: " + tx.block + "\n"
                destText += "B Shard: " + binShard + "\n"
                destText += "A Shard: " + binAccout + "\n"
                destText += "Shard Mask: " + mask.toString(2) + "b (" + i + ")\n"

                destText += "Shard Ok: " + shardOk + "\n"

                destText += "Success: " + computePhase.success + "\n"
                destText += "Gas Fee: " + computePhase.gasFees + "\n"
                destText += "Gas Used: " + computePhase.gasUsed + "\n"             
                destText += "Vm Steps: " + computePhase.vmSteps + "\n"
                destText += "Exit Code: " + error + "\n"
            }

            //txNodeName = "Test"
        }

        let valueIn = undefined
        let inLt = undefined
        let src = ""
        if (tx.inMessage?.info.type === 'internal') {
            valueIn = tx.inMessage.info.value.coins
            inLt    = tx.inMessage.info.createdLt
            src     = tx.inMessage.info.src.toString()
        }

        if (tx.inMessage?.info.type === 'external-in') {
            valueIn = tx.inMessage.info.importFee
            inLt    = "external"
            if (tx.inMessage.info.src) {
                src = tx.inMessage.info.src.toString()
            } else {
                src = "external"
            }

        }

        let sourceText = "N/A"
        let addrS = tx.inMessage.info.src?.toString()
        if (addrS !== undefined) {
            if (addrS in contractDict) {
                sourceText = escapeNodeId(contractDict[addrS].name)
            } else {
                sourceText = addrS.substring(0, 6)+ "..." +  addrS.substring(addrS.length - 6, addrS.length)            
            }
        }
        
        let inId = escapeNodeId(src) + "_" + inLt
        lines.push(`LT${inId} --> |${valueIn ? fromNano(valueIn) : "?"} ton| ${txNodeName}(["${destText}"]) `)
        lines.push(`class ${txNodeName} decodedNode;`)


        for (let m  in tx.outMessages.keys()){
            let outMessage = tx.outMessages.get(Number(m));
            let outLt = 0n
            if (outMessage?.info.type === 'internal') {
                outLt    = outMessage.info.createdLt
            }

            let outId = escapeNodeId(outMessage!.info.src!.toString()) + "_" + outLt
            lines.push(`${txNodeName} --> LT${outId}`)
        }

        //ids[index] = ${addrText}
     
        //if (index > 5) break;
    }

    for (let lt in messages)
    {
        lines.push(`class LT${lt} decodedMessage;`)
        lines.push(`LT${lt}[${messages[lt].processed}]`)
    } 

    
    return lines.join("\n")
}
