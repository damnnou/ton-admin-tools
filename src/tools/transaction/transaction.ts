import { Cell, Transaction } from "@ton/core";
import { Api, HttpClient, Trace } from "tonapi-sdk-js";
import { flattenTrace } from "../../scripts/tonapiTotoncore";
import { ContractDictionary, traceToMermaid, UniversalParser } from "../../scripts/traceToMermaid";
import mermaid from 'mermaid';
import { loadSharedParts } from "../common/common";


// Import Mermaid for initialization and rendering
//declare var mermaid: any;

loadSharedParts();

const traceInputElement = document.getElementById("transaction-input") as HTMLInputElement;


const mermaidInputElement = document.getElementById("mermaid-input") as HTMLTextAreaElement;

const downloadElement = document.getElementById("download-and-parse-button") as HTMLButtonElement;

const genGraphElement = document.getElementById("generate-button") as HTMLButtonElement;
const graphContainer = document.getElementById("graph-container") as HTMLDivElement;

// Initialize Mermaid
mermaid.initialize({ startOnLoad: false });

downloadElement.addEventListener("click", async () => {
        const API_KEY = "AGHD4DYGGAWBDZAAAAAPYUMY4V22MOI74LDT4VIF47EBFARRYYABMNGJMDGF6QJI2JATNKA";
        const testnet = false

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
    
        let contractDict: ContractDictionary = {}
        for (let tx of flatTrace) {
            contractDict[tx.inMessage!.info.dest!.toString()] = {name: "?", parser: (x: Cell) => UniversalParser.printParsedInput(x)  }
            
        }
    
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