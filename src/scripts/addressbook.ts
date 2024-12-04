import { Address } from "@ton/core";
import { BLACK_HOLE_ADDRESS } from "../wrappers/tonUtils";

export class AddressBook {

//    private static instance : AddressBook

    router : string
    pTon   : string

    //multisig : string = "EQBKKK_fh1A_me7QaR87wYR4yqDuYE_JgIR5Sw4O9Al2G-Nv"
    multisig : string = "EQCREXe_J-1_zQHRQxYKzRu8MUUlBve4k_TFdJVEnhIULVwV"

    minters : {[x : string] : string}

    pools : {[x : string] : string}

    private constructor(deployedInfoFile : string) {
        this.minters = {}
        this.pools = {}               
       
        this.router = "EQC_-t0nCnOFMdp7E7qPxAOCbCWGFz-e3pwxb6tTvFmshjt5"
        this.pTon = "EQCUnExmdgwAKADi-j2KPKThyQqTc7U650cgM0g78UzZXn9J"
    }

    /* Singleton is broken. TODO: Fix it later */
    static getInstance(name: string) : AddressBook {      
       /* console.log(`Getting addressbook for ${name}`)
        let prefix = name.replace(" ", "_")
        let deployedFileName = prefix + '_deployed.json'*/
        return new AddressBook(/*deployedFileName*/"")
    }

    printAddressBook() {
//        const addressBook = AddressBook.getInstance()
        console.log("Address book")
        console.log("Router:")
        console.log(`${"Router".padEnd(10)} | ${this.router}`)        
        console.log("Minters:")
        console.log(`${"pTon".padEnd(10)} | ${this.pTon}`)
        
        for (let k in this.minters) {
            console.log(`${k.padEnd(10)} | ${this.minters[k]}`)
        }

        console.log("Pools:")
        for (let p in this.pools) {
            console.log(`${p.padEnd(12)} | ${this.pools[p]}`)
        }
    }

    getAddress(name : string, defaultAddr : Address = BLACK_HOLE_ADDRESS) : Address {
//        const addressBook = AddressBook.getInstance()

        if (!name || name == "" )
            return defaultAddr

        if (name == "BLACK_HOLE")
            return BLACK_HOLE_ADDRESS;      
        
        if (name === "S") {
            return Address.parse(this.multisig)
        }        
        if (name === "R") {
            return Address.parse(this.router)
        }        
        if (name === "M:pTon") {
            return Address.parse(this.pTon)
        }
        if (name.startsWith("M:")) {
            let minter = name.split(":")[1]
            if (minter in this.minters)
                return Address.parse(this.minters[minter])
            return defaultAddr
        }

        if (name.startsWith("P:")) {
            let pool = name.split(":")[1]
            if (pool in this.pools) {
                console.log("We have it in the book", this.pools[pool])
                return Address.parse(this.pools[pool])
            }
            return defaultAddr
        }

        return Address.parse(name)
    }


}