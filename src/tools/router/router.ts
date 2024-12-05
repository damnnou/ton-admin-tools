import { ammInfoRouter } from "../../scripts/amm/cliAmmInfoRouter";
import { Logger } from "../../scripts/consoleLogger";
import { loadSharedParts } from "../common/common";

loadSharedParts();
const downloadElement = document.getElementById("router-button") as HTMLButtonElement;

downloadElement.addEventListener("click", async () => {
    ammInfoRouter({}, new Logger("console"))
})