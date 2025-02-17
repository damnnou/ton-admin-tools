import { Address } from "@ton/core";
import { Logger } from "../../scripts/consoleWebLogger";
import { loadSharedParts } from "../common/common";
import { ApolloClient, InMemoryCache, gql} from "@apollo/client/core";
import { getApproxFloatPrice } from "../../wrappers/frontmath/frontMath";

loadSharedParts();

const downloadElement = document.getElementById("download-and-parse-button") as HTMLButtonElement;

const SWAPS_QUERY = gql`
query GetSwaps($where: SwapWhere) {
    swaps(where: $where) {
    toRefund1
    toRefund0
    to
    time
    sqrtPriceLimitX96      
    hash
    wallet: from
    amount
    isZeroToOne
    __typename
    }
}
`;

async function querySwaps(logger : Logger) {
    const appoloClient = new ApolloClient({
        uri: "https://indexer.tonco.io/", // Replace with your GraphQL endpoint
        credentials: 'same-origin',
        cache: new InMemoryCache(),
    });

    let poolAddress = Address.parse("EQD25vStEwc-h1QT1qlsYPQwqU5IiOhox5II0C_xsDNpMVo7")

    const currentTime = Date.now()
    const monthAgo = currentTime - 1000 * 60 * 60 * 24 * 30;
    

    const response = await appoloClient.query({ query: SWAPS_QUERY, variables: {
        "where": {
            "pool" : poolAddress.toRawString(),           
            "time": {
                 "gt": monthAgo.toString()
            } 
        }
        } });
    const appoloPositionsList =  response.data.swaps


    let stats : {[id: string] : {
        sum : number,
        num : number,

    }} = {} 
    for (let swap of appoloPositionsList) {
        let swapDir = swap.isZeroToOne ? "TON->USDT" : "USDT->TON"
        let walletAddr = Address.parseRaw(swap.wallet).toString()
        let price : number = getApproxFloatPrice(swap.sqrtPriceLimitX96)
        let amountUSD : number = swap.isZeroToOne ? (Number(swap.amount) * price / 10**6) : (swap.amount / 10**6)

        console.log(`${(new Date(swap.time)).toString()} ${swap.isZeroToOne} ${swapDir} ${Address.parseRaw(swap.wallet).toString()} ${Address.parseRaw(swap.to).toString()} ${swap.amount} ${swap.toRefund0} ${swap.toRefund1} ${amountUSD}USD`)
       

        stats[walletAddr] = {
            num : (stats[walletAddr]?.num ?? 0) + 1,
            sum : (stats[walletAddr]?.sum ?? 0) + amountUSD
        }
    }
    logger.log(`Start interval: ${(new Date(monthAgo)).toString()}`)
    logger.log(`End   interval: ${(new Date(currentTime)).toString()}`)
    

    logger.log(`Swaps found: ${appoloPositionsList.length}`)
    //console.log(stats)

    const sortedStats = Object.entries(stats)
        .map(([id, { sum, num }]) => ({ id, mean: sum / num, sum, num })) // Compute mean
        .sort((a, b) => b.num - a.num); // Sort by mean (ascending)

    const { totalSum, totalNum } = Object.values(stats).reduce(
        (acc, { sum, num }) => {
            acc.totalSum += sum;
            acc.totalNum += num;
            return acc;
        },
        { totalSum: 0, totalNum: 0 }
        );   

    // Print the sorted results
    for (let idx = 0; idx < Math.min(20, sortedStats.length); idx++) {
        let {id, mean, sum, num } = sortedStats[idx]
        logger.log(`Wallet: ${id}, Mean: ${mean.toFixed(2).padStart(8)}, Sum: ${sum.toFixed(2).padStart(13)} (${(sum / totalSum * 100.0).toFixed(2)}%), Num: ${num.toString().padStart(4)} (${(num / totalNum * 100.0).toFixed(2)}%)`);
    }
    logger.log(`...`)

    logger.log(`Total amount ${totalSum.toFixed(2)} with ${totalNum} exchanges`)
    
}


downloadElement.addEventListener("click", async () => {
    await querySwaps(new Logger("console"))
})
  