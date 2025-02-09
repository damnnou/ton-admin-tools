import { Address, beginCell, Cell, Dictionary, Message, Transaction } from "@ton/core"
import { Transaction as TonApiTransaction } from "tonapi-sdk-js"
import { Trace } from "tonapi-sdk-js"
import { Message as TAMessage } from "tonapi-sdk-js";
import { BLACK_HOLE_ADDRESS } from "../wrappers/tonUtils";
import { TransactionEx } from "./traceToMermaid";

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


export function flattenTrace(t: Trace ) : TransactionEx[] 
{
    const tr : TonApiTransaction = t.transaction

    let outMessages : Dictionary<number, Message> = Dictionary.empty<number, Message>()

    console.log("out Messages :", tr.out_msgs)
    for (let [index, msg] of tr.out_msgs.entries() ) {
        outMessages.set(index, toMessage(msg))
    }
    console.log("out Messages :", outMessages.size)

    const thisTr : TransactionEx = {
            block : tr.block,

            address: BigInt("0x" + tr.hash),
            lt: BigInt(tr.lt),
            prevTransactionHash: BigInt("0x" + (tr.prev_trans_hash ?? "0")),
            prevTransactionLt:   BigInt("0x" + (tr.prev_trans_lt ?? "0")),
            now: tr.utime,
            outMessagesCount: tr.out_msgs.length,
            oldStatus: 'active', //AccountStatus(tr.orig_status),
            endStatus: 'active', //AccountStatus(tr.end_status),
            inMessage: toMessage(tr.in_msg!),
            outMessages: outMessages,
            totalFees: {coins: BigInt(tr.total_fees)},
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
                    success: tr.compute_phase.success,
                    messageStateUsed: true,
                    accountActivated: true,
                    gasFees: BigInt(tr.compute_phase!.gas_fees ?? 0n),
                    gasUsed: BigInt(tr.compute_phase!.gas_used ?? 0n),
                    gasLimit: 0n,
                    gasCredit: undefined,

                    mode: 0,
                    exitCode: tr.compute_phase.exit_code,
                    exitArg: undefined,
                    vmSteps: tr.compute_phase.vm_steps,
                    vmInitStateHash: 0n,
                    vmFinalStateHash: 0n
                }
            },
            raw: beginCell().endCell(),
            hash: () => Buffer.from("0", "hex")          
        }
    
    let childTr : TransactionEx[] = []

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