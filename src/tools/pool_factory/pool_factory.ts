import { ammInfoRouter } from "../../scripts/amm/cliAmmInfoRouter";
import { Logger } from "../../scripts/consoleWebLogger";
import { loadSharedParts } from "../common/common";

loadSharedParts();
const buttonElement = document.getElementById("router-button") as HTMLButtonElement;

buttonElement.addEventListener("click", async () => {
    await ammInfoRouter({}, new Logger("console"))
})