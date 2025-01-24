import { Address, Cell, Contract, Transaction } from "@ton/core";
import { Api, HttpClient, Trace } from "tonapi-sdk-js";
import { flattenTrace } from "../../scripts/tonapiTotoncore";
import { ContractDictionary, traceToMermaid, UniversalParser } from "../../scripts/traceToMermaid";
import mermaid from 'mermaid';
import { loadSharedParts } from "../common/common";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";
import { JettonAPI } from "../../wrappers/JettonAPI";
import { TonClient4 } from "@ton/ton";
import { getUserAndClient } from "../../scripts/utils";
import { getHttpV4Endpoint } from "@orbs-network/ton-access";


// Import Mermaid for initialization and rendering
//declare var mermaid: any;

loadSharedParts();

const traceInputElement  = document.getElementById("transaction-input") as HTMLInputElement;
const testnetFlagElement = document.getElementById("testnet-input") as HTMLInputElement;
const indexerFlagElement = document.getElementById("indexer-input") as HTMLInputElement;

const mermaidInputElement = document.getElementById("mermaid-input") as HTMLTextAreaElement;

const downloadElement = document.getElementById("download-and-parse-button") as HTMLButtonElement;

const genGraphElement = document.getElementById("generate-button") as HTMLButtonElement;
const graphContainer = document.getElementById("graph-container") as HTMLDivElement;

// Initialize Mermaid
mermaid.initialize({ startOnLoad: false });


async function fillDictFromIndexer(testnet : boolean, contractDict : ContractDictionary ) {
    const JETTONS_QUERY = gql`
        query JettonsQuery {
            jettons {
                address
                wallet
                symbol
                name
                decimals
                volumeUsd
            }
        }
        `;
    
        const apolloClient = new ApolloClient({
            uri: testnet ? "https://testnet-indexer.tonco.io" : "https://indexer.tonco.io/", // Replace with your GraphQL endpoint
            credentials: 'same-origin',
            cache: new InMemoryCache(),
        });

        const response = await apolloClient.query({ query: JETTONS_QUERY });
            const apolloJettonList =  response.data.jettons
            console.log(apolloJettonList.length);
        
        console.log(apolloJettonList)

        for (let jettonData of apolloJettonList) {
            const minterAddress = Address.parse(jettonData.address).toString()
            contractDict[minterAddress] = {name: `Minter_${jettonData.name}`, parser: (x: Cell) => UniversalParser.printParsedInput(x)}

            const walletAddress = Address.parse(jettonData.wallet).toString()
            contractDict[walletAddress] = {name: `RWallet_${jettonData.name}`, parser: (x: Cell) => UniversalParser.printParsedInput(x)}
        }
}

downloadElement.addEventListener("click", async () => {
        const API_KEY = "AGHD4DYGGAWBDZAAAAAPYUMY4V22MOI74LDT4VIF47EBFARRYYABMNGJMDGF6QJI2JATNKA";
        const testnet = testnetFlagElement.checked
        const jettonIndexer = indexerFlagElement.checked

        /* tonApi client for fetching additional data, such as jetton balances, etc. */
        const httpClient = new HttpClient({
            baseUrl: testnet ? "https://testnet.tonapi.io" : "https://tonapi.io",
            baseApiParams: {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Content-type": "application/json",
                },
            },
        });
    
        const client = new Api(httpClient);
    
        //const accout = "kQBO-T0NCODKT87McOAK2Vb-Whx_jLFHU5NCDBJYkBcsiuTm"
        //const traces = await client.accounts.getAccountTraces(accout, {limit : 1})
        
        //const traceId = traces.traces[0].id

        const {client: clientAPI, name:credentialsName} = await getUserAndClient()
        let endpoint = await getHttpV4Endpoint({ network: testnet ? "testnet" : "mainnet" })
        let orbsClient = new TonClient4({ endpoint })

        const traceId = traceInputElement.value.trim();       
        console.log(`We will load and decode ${traceId}`)
        
        let trace : Trace
        try {
            trace = await client.traces.getTrace(traceId)
        } catch (e) {
            console.log(e)
            return
        }
    
        const flatTrace : Transaction[] = flattenTrace(trace)
        console.log(` Trace has ${flatTrace.length} transactions`)

        let contractDict: ContractDictionary = {
            "EQBxIE-Z9UhJI50Gew7cDAVRMwTy98zEsd08cbrLHwuvU1Is" : {name: "Testnet Wallet", parser: (x: Cell) => UniversalParser.printParsedInput(x)},
            "EQDnfag9lHlc0rS6YeI7WwRq-3ltcKSsYxLiXmveB7gNUzNO" : {name: "Testnet Router", parser: (x: Cell) => UniversalParser.printParsedInput(x)},

            "EQDiNOe3qNffbCsEeX-6KYWT26TT1xL7D-dqx47-qqEkp4e9" : {name: "Mainnet Pool Factory", parser: (x: Cell) => UniversalParser.printParsedInput(x)},
            "EQC_-t0nCnOFMdp7E7qPxAOCbCWGFz-e3pwxb6tTvFmshjt5" : {name: "Mainnet Router", parser: (x: Cell) => UniversalParser.printParsedInput(x)},
        }
        /*Let's load addressbook. Bring this to another file */
        const POOLS_QUERY = gql`
        query PoolsQuery {  
          pools {    
            name
            address
            jetton0 {
                address
                symbol
                decimals
            }
            jetton1 {
                address
                symbol
                decimals
            }
            totalValueLockedUsd
          }   
        }
        `;
        
        const apolloClient = new ApolloClient({
            uri: testnet ? "https://testnet-indexer.tonco.io" : "https://indexer.tonco.io/", // Replace with your GraphQL endpoint
            credentials: 'same-origin',
            cache: new InMemoryCache(),
        });
    
        let jettons : { [address: string] : {
            name : string, 
            address: string, 
            decimals : number,
            walletBalance : bigint, 
            poolsBalance: bigint} 
        } = {}
    
        try {
            const response = await apolloClient.query({ query: POOLS_QUERY });
            const apolloPoolList =  response.data.pools
            console.log(apolloPoolList.length);
    
            
            for (let poolData of apolloPoolList) {
                jettons[poolData.jetton0.address] = {name: poolData.jetton0.symbol, address: poolData.jetton0.address, decimals:poolData.jetton0.decimals, walletBalance: 0n, poolsBalance: 0n}
                jettons[poolData.jetton1.address] = {name: poolData.jetton1.symbol, address: poolData.jetton1.address, decimals:poolData.jetton1.decimals, walletBalance: 0n, poolsBalance: 0n}            

                let name = "Pool_" + poolData.name.replace("-", "_").replace("₮","T")
                
                contractDict[Address.parse(poolData.address).toString()] = { name: name, parser: (x: Cell) => UniversalParser.printParsedInput(x) }  
                //contractDict[poolData.jetton0.address] = {name: poolData.jetton0.symbol}
                //contractDict[poolData.jetton1.address] = {name: poolData.jetton1.symbol}
            }
            

            if (!jettonIndexer) {
                for (let jetton of Object.keys(jettons)) {
                    console.log(`processing ${jetton}`)
                    let jettonApi : JettonAPI = new JettonAPI(Address.parse(jetton))
                    await jettonApi.open((x: Contract) => orbsClient.open(x))
                    let walletJAddress = await jettonApi.getWalletAddress(Address.parse("EQBxIE-Z9UhJI50Gew7cDAVRMwTy98zEsd08cbrLHwuvU1Is"))
                    let routerJAddress = await jettonApi.getWalletAddress(Address.parse("EQDnfag9lHlc0rS6YeI7WwRq-3ltcKSsYxLiXmveB7gNUzNO"))

                    let name = jettons[jetton].name.replace("-", "_").replace("₮","T")
                    contractDict[walletJAddress.toString()] = { name: `wallet_jetton_for_` + name, parser: (x: Cell) => UniversalParser.printParsedInput(x) }  
                    contractDict[routerJAddress.toString()] = { name: `router_jetton_for_` + name, parser: (x: Cell) => UniversalParser.printParsedInput(x) }  
                }
            } else {
                await fillDictFromIndexer(testnet, contractDict)
            }


        } catch (e)        
        {
            console.log(e)
        }

        for (let tx of flatTrace) {
            let name = tx.inMessage!.info.dest!.toString()
            if (!contractDict[name]) {
                contractDict[name] = {name: name, parser: (x: Cell) => UniversalParser.printParsedInput(x)  }
            }
            
        }

        console.log(contractDict)
    
        mermaidInputElement.value = traceToMermaid(flatTrace, contractDict)
              
    
})


genGraphElement.addEventListener("click", () => {
    const mermaidCode = mermaidInputElement.value.trim();

    if (!mermaidCode) {
        alert("Please enter a valid Mermaid diagram code.");
        return;
    }

    // Clear the container before rendering
    graphContainer.innerHTML = "";

    try {
        // Create a div for the graph
        const graphDiv = document.createElement("div");
        graphDiv.classList.add("mermaid");
        graphDiv.textContent = mermaidCode;
        graphContainer.appendChild(graphDiv);

        // Render the Mermaid diagram
        mermaid.init(undefined, graphDiv);
    } catch (error) {
        console.error("Error rendering Mermaid graph:", error);
        alert("Failed to render the Mermaid diagram. Check the console for details.");
    }
});