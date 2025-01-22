import { loadSharedParts } from "../common/common";
import { ApolloClient, InMemoryCache, gql} from "@apollo/client/core";
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";
import { explorerUrl, getUserAndClient } from "../../scripts/utils";
import { Address, TonClient4 } from "@ton/ton";
import { ammInfo } from "../../scripts/amm/cliAmmInfoPool";
import { Logger } from "../../scripts/consoleLogger";

loadSharedParts()
loadDevMessages()
loadErrorMessages()

const buttonElement  = document.getElementById("download-pools" ) as HTMLButtonElement;
const poolsContainer = document.getElementById("pool-list-placeholder") as HTMLDivElement;


export const POOLS_QUERY = gql`
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
  }   
}
`;

async function loadPoolData(address : string) {
    console.log(`Info for: ${address}`)
    await ammInfo({pool: address},  new Logger("console"))
}

(window as any).loadPoolData = loadPoolData;

buttonElement.addEventListener("click", async () => {
    
    const table = document.createElement('table');
    poolsContainer.appendChild(table)
    const header = document.createElement('thead');
    table.appendChild(header)
    header.innerHTML = `<tr><th>#</th><th>?</th><th>Pool Address</th><th>Jetton 0</th><th>jetton 1</th><tr>`
  
    const appoloClient = new ApolloClient({
        uri: "https://indexer.tonco.io/", // Replace with your GraphQL endpoint
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
        const response = await appoloClient.query({ query: POOLS_QUERY });
        const appoloPoolList =  response.data.pools
        console.log(appoloPoolList.length);
    
        
        for (let poolData of appoloPoolList) {
            jettons[poolData.jetton0.address] = {name: poolData.jetton0.symbol, address: poolData.jetton0.address, decimals:poolData.jetton0.decimals, walletBalance: 0n, poolsBalance: 0n}
            jettons[poolData.jetton1.address] = {name: poolData.jetton1.symbol, address: poolData.jetton1.address, decimals:poolData.jetton1.decimals, walletBalance: 0n, poolsBalance: 0n}            
        }
        
        const {client: clientAPI, name:credentialsName} = await getUserAndClient()
        let client = clientAPI as TonClient4
        /* Due to async work we can't do precise checks */

        for (let [i, poolData] of appoloPoolList.entries()) {
            console.log("Address: ", poolData.name.padEnd(15), " - ", poolData.address)
           /* let poolContract = client.open(new PoolV3Contract(Address.parse(poolData.address)))
            let status = await poolContract.getPoolStateAndConfiguration()
            jettons[poolData.jetton0.address].poolsBalance += status.reserve0
            jettons[poolData.jetton1.address].poolsBalance += status.reserve1*/
            const poolAddress = Address.parse(poolData.address)
            const jetton0Symbol = poolData.jetton0.symbol
            const jetton0Address = Address.parse(poolData.jetton0.address)

            const jetton1Symbol = poolData.jetton1.symbol
            const jetton1Address = Address.parse(poolData.jetton1.address)
            

            const line = document.createElement('tr');
            line.innerHTML = 
            `<td>${i}</td>` + 
            `<td><button onclick='loadPoolData("${poolAddress}")'>Info</button></td>` + 
            `<td><a href="${explorerUrl(poolAddress.toString(), false)}">${jetton0Symbol} - ${jetton1Symbol}</a></td>` + 
            `<td><a href="${explorerUrl(jetton0Address.toString(), false)}">${jetton0Symbol}</a></td>` + 
            `<td><a href="${explorerUrl(jetton1Address.toString(), false)}">${jetton1Symbol}</a></td>`  
            table.appendChild(line)
        }
    } catch (e) {
        console.log(`Error ` + e)
    }
})


