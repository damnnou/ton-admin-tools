import { poolFactoryInfo } from "../../scripts/amm/cliPoolFactoryInfo";
import { Logger } from "../../scripts/consoleWebLogger";
import { loadSharedParts } from "../common/common";

loadSharedParts();
const buttonElement = document.getElementById("pool-factory-button") as HTMLButtonElement;

buttonElement.addEventListener("click", async () => {


    await poolFactoryInfo({factory:"EQDiNOe3qNffbCsEeX-6KYWT26TT1xL7D-dqx47-qqEkp4e9"}, new Logger("console"))
})