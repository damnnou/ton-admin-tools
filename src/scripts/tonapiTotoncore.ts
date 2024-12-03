import { Address, beginCell, Cell, Dictionary, Message, Transaction } from "@ton/core"
import { Trace } from "tonapi-sdk-js"
import { Message as TAMessage } from "tonapi-sdk-js";
import { BLACK_HOLE_ADDRESS } from "../wrappers/tonUtils";

export function toMessage(msg : TAMessage) : Message {
    return {
        info : {
            type: 'internal',
            ihrDisabled: msg.ihr_disabled,
            bounce: msg.bounce,
            bounced: msg.ihr_disabled,
            src:  Address.parse(msg.source?.address! ?? BLACK_HOLE_ADDRESS.toString()),
            dest: Address.parse(msg.destination?.address! ?? BLACK_HOLE_ADDRESS.toString()),
            value: {
                coins : BigInt(msg.value)
            },
            ihrFee: BigInt(msg.ihr_fee),
            forwardFee: BigInt(msg.fwd_fee),
            createdLt: BigInt(msg.created_lt),
            createdAt: msg.created_at
        },
        body : Cell.fromBoc(Buffer.from(msg.raw_body!, "hex"))[0]
    }
}



export function flattenTrace(t: Trace ) : Transaction[] 
{
    let result : Transaction[] = []

    const tr = t.transaction

    let outMessages : Dictionary<number, Message> = Dictionary.empty<number, Message>()

    console.log("out Messages :", tr.out_msgs)
    for (let [index, msg] of tr.out_msgs.entries() ) {
        outMessages.set(index, toMessage(msg))
    }
    console.log("out Messages :", outMessages.size)

    const thisTr : Transaction = {
            address: 0n,
            lt: BigInt(tr.lt),
            prevTransactionHash: BigInt("0x" + (tr.prev_trans_hash ?? "0")),
            prevTransactionLt:   BigInt("0x" + (tr.prev_trans_lt ?? "0")),
            now: 0,
            outMessagesCount: tr.out_msgs.length,
            oldStatus: 'active', //AccountStatus(tr.orig_status),
            endStatus: 'active', //AccountStatus(tr.end_status),
            inMessage: toMessage(tr.in_msg!),
            outMessages: outMessages,
            totalFees: {coins: 0n},
            stateUpdate: {
                oldHash : Buffer.from(tr.state_update_old, "hex"),
                newHash : Buffer.from(tr.state_update_new, "hex")
            },
            description: {
                type: "generic",
                aborted: false,
                destroyed : false,
                creditFirst : true,
                computePhase : 
                {
                    type: 'vm',
                    success: true,
                    messageStateUsed: true,
                    accountActivated: true,
                    gasFees: 0n,
                    gasUsed: 0n,
                    gasLimit: 0n,
                    gasCredit: undefined,

                    mode: 0,
                    exitCode: 0,
                    exitArg: undefined,
                    vmSteps: 0,
                    vmInitStateHash: 0n,
                    vmFinalStateHash: 0n
                }
            },
            raw: beginCell().endCell(),
            hash: () => Buffer.from("0", "hex")
        }
    
    let childTr : Transaction[] = []

    if (t.children) {
        console.log (`Processing ${t.children.length} subchilds`)
        for (let child of t.children) {
            const childResults = flattenTrace(child)
            thisTr.outMessages.set(thisTr.outMessages.size, childResults[0].inMessage!)

            //console.log (`${result.length} <- ${childResults.length}`)
            childTr = childTr.concat(childResults)
            //console.log (`${result.length}`)
        }
    }

    return [thisTr].concat(childTr)
}