//import colors from "colors/safe"
import { getHttpEndpoint, getHttpV4Endpoint } from "@orbs-network/ton-access";

import { Address, Cell, OpenedContract } from '@ton/core';
import { TonClient, TonClient4, WalletContractV4, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';


export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getUserAndClient(APIv4 : boolean = true) {
    /*
    const credentialsFile = process.env.CRED_FILE
    //console.log(process.env);

    let credentialsJsonFileName = credentialsFile
    if (!credentialsJsonFileName) {
        credentialsJsonFileName = "./scripts/testnet.1.cred.json"
    } else {
      console.log("We use credentials file: ", credentialsJsonFileName)
    }

    */

    /*let credentialsJson = fs.readFileSync(credentialsJsonFileName, "utf8")
    const jsonCredentials  = JSON.parse(credentialsJson);

    console.log("Loaded credentials: ", jsonCredentials.name)

    const mnemonic = jsonCredentials.mnemonic
    let mnemonicWords = []

    if (! Array.isArray(mnemonic)) {
        mnemonicWords = mnemonic.split(" ")
    } else {
        mnemonicWords = mnemonic
    }

    mnemonicWords = mnemonicWords.map((x : string) => x.trim())
    if (mnemonicWords.length != 24) {
        console.log("Your memo seem to be wrong");
    }
    const key = await mnemonicToWalletKey(mnemonicWords);*/
    let key = null

    /* We would need to be able to use different wallets */
    let wallet = null
   /* if (jsonCredentials.wallet == "wallet_v5r1" || jsonCredentials.wallet == "walletv5") {
        wallet = WalletContractV5
    }*/

   /* if (jsonCredentials.wallet == "wallet_v4" ) {
      wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 })
    }

    if (jsonCredentials.wallet == "wallet_v5" || jsonCredentials.wallet == "wallet_v5r1" ) {
      wallet = WalletContractV5R1.create({ publicKey: key.publicKey, workchain: 0 })
    }

    if (!wallet) {
        wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 })
    }*/
    
    let client
    let endpoint: string

      endpoint = await getHttpV4Endpoint()
      client =  new TonClient4({ endpoint })


    return {
        client : client, 
        name : "something"
    }
}

/*
export async function getUserDirectPermission() : Promise<boolean>
{
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function askQuestion(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
  }

  const answer = await askQuestion("Do you agree to proceed? TON will be spent! (Y/N): ");
  rl.close()
  if (answer != "Y") {
    return false;
  } 
  return true;
}
*/


export async function waitForNewSeqNo(oldSeqNo: number, walletContract: OpenedContract<WalletContractV4 | WalletContractV5R1>) {
  /* wait until confirmed */ 
  console.log(`waiting for transaction to confirm:`);

  const decor = ["|", "/", "-", "\\" ]
  let currentSeqno = oldSeqNo;

  let waitTime = 0;
  while (currentSeqno == oldSeqNo) {
    for (let i = 0; i < decor.length; i++) {
      waitTime += 500;
      await sleep(500);
      process.stdout.write(`\r${decor[i]} (${waitTime}ms)`);
    }
    currentSeqno = await walletContract.getSeqno();
  }
  console.log("Done");
}

export async function waitUntilDeployed(client: TonClient, address: Address) {
    console.log(`waiting for ${address} to be deployed:`);
    const decor = ["|", "/", "-", "\\" ]

    let waitTime = 0;      
    let deployed = false; 
    while (true) {
      deployed = await client.isContractDeployed(address)
      if (deployed)
        break;

      for (let i = 0; i < decor.length; i++) {
        waitTime += 500;
        await sleep(500);
        process.stdout.write(`\r${decor[i]} (${waitTime}ms)`);
      }
    }
    console.log("Done");
}

/*
export async function waitUntilDeployedV4(client: TonClient4, address: Address, maxWaitTime : number = 15*1000) {
  console.log(`waiting for ${address} to be deployed:`);
  const decor = ["|", "/", "-", "\\" ]

  let waitTime = 0;      
  let deployed = false; 
  while (waitTime < maxWaitTime) {
    let last = await client.getLastBlock();
    let seqno = last.last.seqno;
    deployed = await client.isContractDeployed(seqno,address)
    if (deployed)
      break;

    for (let i = 0; i < decor.length; i++) {
      waitTime += 500;
      await sleep(500);
      process.stdout.write(`\r${decor[i]} (${waitTime}ms)`);
    }
  }
  console.log(`Done. ${deployed ? colors.green("Deployed") : colors.red("Timeout")} `);
}
*/

// p:<price of 0 to 1>, r<r1>:<r0>
export function parsePrice(s : string) 
{
    if (s.startsWith("p:"))
    {
        const ps = s.split(":")[1]
        return {reserve1: BigInt(Number(ps) * 100000), reserve0: BigInt(100000)}
    }
    if (s.startsWith("r:"))
    {
        const rs1 = s.split(":")[1]
        const rs0 = s.split(":")[2]        
        return {reserve1: BigInt(rs0), reserve0: BigInt(rs1)}
    }

    return {reserve1: 1n, reserve0: 1n}
    //throw Error("Malformed price")
}


/*
export function loadPrecompiled(filename: string) : Cell {
    const jsonMinterFile = fs.readFileSync(filename, 'utf8');
    const jsonMinterCode = JSON.parse(jsonMinterFile)
    const minterRawBuffer = Buffer.from(jsonMinterCode.hex, "hex");
    //console.log("Code: ", minterRawBuffer);    
    return Cell.fromBoc(minterRawBuffer)[0]; 
}


export function scanDirectory(dir: string, pattern: RegExp): string[] {
  let results: string[] = [];

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(scanDirectory(fullPath, pattern));
    } else if (pattern.test(file)) {
      results.push(fullPath);
    }
  }

  return results;
}
*/


export async function verifyJettonInt(client: TonClient, minterAddress : Address,  minterCodeCell : Cell,  walletCodeCell : Cell) 
{
    let minterState = await client.getContractState(minterAddress)

    const remoteMinterHash = Cell.fromBoc(minterState.code!)[0].hash().toString("hex")
    const localMinterHash  = minterCodeCell.hash().toString("hex")

    const isMinterStandard = remoteMinterHash == localMinterHash
   /* if (isMinterStandart)
    {
        console.log(colors.green("Minter Contract is Standard"))
    } else {
        console.log(colors.red("Minter Contract is Custom (Non-Standard)"))
    } */

    let remoteMinterData = Cell.fromBoc(minterState.data!)[0]
    let p = remoteMinterData.beginParse()
    let id            = p.loadUint(32)
    let remoteWalletContent = p.loadRef()
    let remoteWalletCode    = p.loadRef()


    const remoteWalletHash = remoteWalletCode.hash().toString("hex")
    const localWalletHash  = walletCodeCell.hash().toString("hex")

    const isWalletStandard = remoteWalletHash == localWalletHash
    /*if (isWalletStandart)
    {
        console.log(colors.green("Wallet Contract is Standard"))
    } else {
        console.log(colors.red("Wallet Contract is Custom (Non-Standard)"))
    } */       

    return {isMinterStandard, isWalletStandard}
}