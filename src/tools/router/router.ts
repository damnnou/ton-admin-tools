import { ammInfoRouter } from "../../scripts/amm/cliAmmInfoRouter";

const downloadElement = document.getElementById("router-button") as HTMLButtonElement;

class Logger
{
    constructor(public elementId: string) {}


    log(...args : string[]) {
        const consoleDiv = document.getElementById(this.elementId);    
        if (consoleDiv) {
            const messageElement = document.createElement('div');
            for(let arg of args) {
                messageElement.innerHTML += arg;
            }
            consoleDiv.appendChild(messageElement);
        } 
    }

    red(s: string) : string {
        return `<font color="red">${s}</font>`
    }
    green(s: string) : string {
        return `<font color="green">${s}</font>`
    }
    magenta(s: string) : string {
        return `<font color="magenta">${s}</font>`
    }    

}

downloadElement.addEventListener("click", async () => {
    ammInfoRouter({}, new Logger("console"))


})