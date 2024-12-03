import { Cell, Slice } from "@ton/core";
import { ContractMessageMeta, MetaMessage, MetaMessageField, MetaPredicate, StructureVisitor } from "./structureVisitor";
import { ContractOpcodes, OpcodesLookup } from "../../wrappers/opCodes";


export class ParseDataVisitor implements StructureVisitor {

    result : ContractMessageMeta[]  = []
    slices : (Slice | null) [] = []

    skipFields : boolean = false;

    currentSlice() : Slice | null {
        return this.slices[this.slices.length - 1]
    }

    visitCell(cell : Cell, acceptor: any) {
        this.slices.push(cell.beginParse())
        acceptor(this)
        this.slices.pop()
    }

    visitField(field: MetaMessageField): void {
        if (this.skipFields)
            return

        let workSlice = this.currentSlice()
        if (workSlice == null)
            return


        let value: string = ""
        if (field.type == "Uint") {
            value = workSlice.loadUintBig(field.size).toString()
        }
        if (field.type == "Int") {
            value = workSlice.loadIntBig(field.size).toString()
        }
        if (field.type == "Address") {
            let address = workSlice.loadAddressAny()
            if (address != null)
                value = address.toString()
            else 
                value = "addr_none"
        }
        if (field.type == "Coins") {
            value = workSlice.loadCoins().toString()
        }
        if (field.type == "Cell") {
            if (field.meta.includes("Maybe")) {
                let cell = workSlice.loadMaybeRef()
                if (cell == null)
                    value = "";
                else
                    value = cell.toBoc().toString('hex')
            } else {
                value = workSlice.loadRef().toBoc().toString('hex')
            }
        }

        this.result.push({
            name : field.name,
            value: value,
            type : field.type.toString() + "("+field.size+")" + (field.meta != "" ? "," + field.meta : ""),
            comment : field.comment
        })
    }

    enterCell(opts: { name: string; type?: "Maybe" | "" }): void {
        if (this.skipFields)
            return

        let workSlice = this.currentSlice()
        if (workSlice == null)
            return

        if (opts.type && opts.type == "Maybe") {
            const subcell = workSlice.loadMaybeRef();
            if (subcell != null)
                this.slices.push(subcell.beginParse()) 
            else 
                this.slices.push(null) 
        } else {
            this.slices.push(workSlice.loadRef().beginParse())
        }
    }
    leaveCell(opts: { name: string; }): void {
        this.slices.pop()
    }

    predicateStart(predicate : MetaPredicate) : void
    {
        let predicateValue = false;
        let arg1 
        let arg2 = (typeof predicate.arg2 === "number") ? predicate.arg2 : undefined

        for (let field of this.result) 
        {
            if (field.name == predicate.arg1) {
                arg1 = Number(field.value)
            }
           
            if (arg2 === undefined && field.name == predicate.arg2) {
                arg2 = Number(field.value)
            }
        }

        if (predicate.action == "=") {
            predicateValue = (arg1  == arg2)
        }

        if (!predicateValue) {
            this.skipFields = true;
        }

        console.log("Predicate ", predicate, " evaluated to ", predicateValue)

    }
    predicateEnd  () : void
    {
        this.skipFields = false;
    }

}


export class TLBGenVisitor implements StructureVisitor {
   
    result : string[] = []
    indentation : string  = "    "


    isMaybe : boolean = false

    visitMetaMessage(name: string, metaMessage: MetaMessage ) {
        let opcodeName = OpcodesLookup[metaMessage.opcode];
        if (metaMessage.name)
            opcodeName = metaMessage.name
        this.result.push(`${opcodeName}#${metaMessage.opcode.toString(16)} `)
        metaMessage.acceptor(this)
        this.result.push(`= ${name}Messages;`)
        

    }
 
    visitCell(acceptor: any) {      
        
    }

    visitField(field: MetaMessageField): void {
        if (field.meta.includes("op")) {
            return
        }

        let tlbType: string = ""
        if (field.type == "Uint") {
            tlbType = "uint" + (field.size).toString()
        }
        if (field.type == "Int") {
            tlbType = "int" + (field.size).toString()
        }
        if (field.type == "Address") {
            tlbType = "MsgAddress"
        }
        if (field.type == "Coins") {
            tlbType = "(VarUInteger 16)"
        }

        if (field.type == "Cell") {
            if        (field.meta.includes("Maybe"))  {
                tlbType = "(Maybe ^Cell)"
            } else if (field.meta.includes("Either")) {
                tlbType = "(Either ^Cell Cell)"
            } else {
                tlbType = "Cell"
            }
        }
        this.result.push(this.indentation + `${field.name}:${tlbType}`)
    }

    enterCell(opts: { name: string; type? : "Maybe" | "" }): void {
        this.isMaybe = (opts.type == "Maybe")

        this.result.push(this.indentation + `${opts.name}:${this.isMaybe ? "(Maybe " : ""}^[`)
        this.indentation += "    "
    }
    leaveCell(opts: { name: string; }): void {
        this.indentation = this.indentation.substring(0, this.indentation.length - 4)
        this.result.push(this.indentation +  `] ${this.isMaybe ? ")" : ""} `)
    }

    getResult() : string {
        return this.result.join("\n");
    }

    predicateStart(predicate : MetaPredicate) : void 
    {
        let textPredicate = `${predicate.arg1} ${predicate.action} ${predicate.arg2}`
        this.result.push(this.indentation + `(${textPredicate})?(`)
        this.indentation += "    "
    }

    predicateEnd  () : void {
        this.indentation = this.indentation.substring(0, this.indentation.length - 4)
        this.result.push(this.indentation + `)`)
    }

}