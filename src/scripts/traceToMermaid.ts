import { Cell, fromNano, Transaction } from "@ton/core"
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

function printParsedInput(obj : any , body: Cell) : ContractMessageMeta[] {

    let result : ContractMessageMeta[] = []
    let p = body.beginParse()
    let op : number  = p.preloadUint(32)

    for (let meta of obj.metaDescription) {
        if (op == meta.opcode) {
            console.log(`Processing ${OpcodesLookup[op]}`)
            let visitor = new ParseDataVisitor
            visitor.visitCell(body, meta.acceptor)
            result = [...result, ...visitor.result]
        }
    }
    return result;
}



export class UniversalParser
{
    static printParsedInput(body: Cell) : ContractMessageMeta[] {
        let result : ContractMessageMeta[] = []

        let objects = [RouterV3Contract, PoolV3Contract, PositionNFTV3Contract, AccountV3Contract]
        for (let obj of objects) {
            if ("metaDescription" in obj) {
                //console.log(`${obj} has a field with metaDescription`)
                
                try {
                    result = printParsedInput(obj, body)
                    if (result.length != 0)
                        return result    
                } catch {}
            }
        }
        try {        
            result = JettonWallet.printParsedInput(body)
            if (result.length != 0)
                return result    
        } catch {}
        try {        
            result = PTonWalletV2.printParsedInput(body)
            if (result.length != 0)
                return result    
        } catch {}
        return result
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

type MessageDecodedType = {name: string, value: string, type:string }[]

function decodedToString(addrD: string, messageDecoded :MessageDecodedType, contractDict: ContractDictionary) {
    const operations: {[key: number ]: string} = OpcodesLookup

    let message = "";

    let op    = ""        
    let payloadTo = ""

    for (let field in messageDecoded){
        let value = messageDecoded[field].value


        if (messageDecoded[field].type.endsWith("op") )
        {
            let opText = operations[Number(value)]
            op = value
            opText = opText.split(",")[0]
            value = "<b>" + opText + "</b> " + "0x" + Number(value).toString(16)

            console.log(`OP:  ${op} ${opText}`)
        }           

        /* Process other types */        
        if (messageDecoded[field].type.startsWith("Address") && value in contractDict ) {
            value = contractDict[value].name
        }                   

        if (messageDecoded[field].name == "exit_code" )
        {
            value += "&nbsp;<b>" + ErrorsLookup[Number(value)] + "</b>"
        }

        if (messageDecoded[field].type.includes("PriceX96") )
        {
            if (BigInt(value) == TickMath.MAX_SQRT_RATIO     )      value = "MAX_SQRT_RATIO"
            else if (BigInt(value) == TickMath.MAX_SQRT_RATIO - 1n) value = "MAX_SQRT_RATIO - 1"
            else if (BigInt(value) == TickMath.MIN_SQRT_RATIO     ) value = "MIN_SQRT_RATIO"
            
         //   console.log(value)
            else value = getApproxFloatPrice(BigInt(value)).toString()
        }                   
    

        /* Guess payload target */
        if (Number(op) == ContractOpcodes.JETTON_TRANSFER)  {
            if (messageDecoded[field].name === "to_owner_address") {                        
                payloadTo = messageDecoded[field].value
                console.log("Cell found payload to ", messageDecoded[field])
                console.log("Target JETTON_TRANSFER: ", payloadTo)
            }
        } 

        if (Number(op) == ContractOpcodes.JETTON_TRANSFER_NOTIFICATION)  {
            payloadTo = addrD
            console.log("Target JETTON_TRANSFER_NOTIFICATION", payloadTo,  contractDict[payloadTo].name)
            console.log(`Processing ${messageDecoded[field].type}`)

        }      

        
        if (messageDecoded[field].type.startsWith("Cell") && messageDecoded[field].type.includes("Payload")) {
            if (payloadTo != "") {
                const target = contractDict[payloadTo]
                console.log("target", target)

                let hex = messageDecoded[field].value;
                console.log("hex", hex)    
                if (hex != "none") {
                    const boc = Cell.fromBoc(Buffer.from(hex, "hex"))  
                    const payload = target.parser(boc[0])
                    console.log(payload)
                    value = "to " + target.name + "\n&nbsp; " + decodedToString(payloadTo, payload, contractDict).replace(/\n/g, "\n&nbsp; ")
                }        
            } else {                
                value = value.substring(0, 16) + (value.length > 16 ? "..." : "");
            }
        }

        if (messageDecoded[field].type.startsWith("Cell") && messageDecoded[field].type.includes("Metadata")) {
            value = value.substring(0, 16) + (value.length > 16 ? "..." : "");
        }


        if (messageDecoded[field].type.includes("Uint(128)")) {            
            if (BigInt(value) == MaxUint128) {
                value = "<i>2^128 - 1</i>" 
            }
        }
        if (messageDecoded[field].type.includes("Indexer")) {
            value = value + " <i><b>Indexer Only</b></i>"
        }

        if (messageDecoded[field].type.includes("Bool")) {
            value = Number(value) == 0 ? "false" : "true"
        }

        if (messageDecoded[field].type.includes("Fee")) {
            let val = Number(value)
            if (val > FEE_DENOMINATOR) {
                value = value + " <i>Leave default</i>" 
            }
        }



        /*if (messageDecoded[field].type.startsWith("Coins()")) {
            value = fromNano(value)
        }*/        
        message += `${messageDecoded[field].name}: ${value}\n`
    }
    return message

}


export function traceToMermaid(transactions : Transaction[], contractDict : ContractDictionary) : string {
    let lines = []
    lines.push("---")
    lines.push(`title: ${name}`)
    lines.push("---")
    lines.push("flowchart TD")
    
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


            messages[tx.inMessage.info.src + "_" + lt.toString()] = {raw: tx.inMessage.info, processed:message1}
        }
        if (tx.inMessage && tx.inMessage.info.type === 'external-in') {
            const lt = "external"
            let src = "external"
            if (tx.inMessage.info.src)
                src = tx.inMessage.info.src.toString()

            messages[src + "_" + lt.toString()] = {raw: tx.inMessage.info, processed:"external"}
            console.log(tx.inMessage.info)
        }
    }

    /* Now we dump all the contract calls */
    for (let [index, tx] of transactions.entries()) {
                    
        if (!tx.inMessage) {
            continue;
        }
        let destText = "N/A"
        let txNodeName = tx.inMessage.info.dest?.toString()
        if (txNodeName !== undefined) {

            if (txNodeName in contractDict) {
                destText = contractDict[txNodeName].name
            } else {
                destText = txNodeName.substring(0, 6)+ "___" +  txNodeName.substring(txNodeName.length - 6, txNodeName.length)            
            }

            txNodeName = destText.replace(/ /g, "_") + "_" + index 
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
                sourceText = contractDict[addrS].name
            } else {
                sourceText = addrS.substring(0, 6)+ "..." +  addrS.substring(addrS.length - 6, addrS.length)            
            }
        }
        
        let inId = src + "_" + inLt
        lines.push(`LT${inId} --> |${valueIn ? fromNano(valueIn) : "?"} ton| ${txNodeName}([${destText}]) `)

        for (let m  in tx.outMessages.keys()){
            let outMessage = tx.outMessages.get(Number(m));
            let outLt = 0n
            if (outMessage?.info.type === 'internal') {
                outLt    = outMessage.info.createdLt
            }

            let outId = outMessage!.info.src!.toString() + "_" + outLt
            lines.push(`${txNodeName} --> LT${outId}`)
        }

        //ids[index] = ${addrText}
     
        //if (index > 5) break;
    }

    for (let lt in messages)
    {
        lines.push(`style LT${lt} text-align:left`)
        lines.push(`LT${lt}[${messages[lt].processed}]`)
    } 
    
    return lines.join("\n")
}
