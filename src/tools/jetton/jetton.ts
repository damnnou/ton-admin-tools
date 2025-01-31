import { poolFactoryInfo } from "../../scripts/amm/cliPoolFactoryInfo";
import { Logger } from "../../scripts/consoleWebLogger";
import { loadSharedParts } from "../common/common";

loadSharedParts();


const jettonMinterInputElement  = document.getElementById("jetton-minter-input") as HTMLInputElement;
const testnetFlagElement = document.getElementById("testnet-input") as HTMLInputElement;
const buttonElement = document.getElementById("jetton-info-button") as HTMLButtonElement;

buttonElement.addEventListener("click", async () => {


    //await poolFactoryInfo({factory:"EQDiNOe3qNffbCsEeX-6KYWT26TT1xL7D-dqx47-qqEkp4e9"}, new Logger("console"))
})