export function loadSharedParts() {
    const headerHtml = `
    <div id="header">
        <!-- Badge -->
        <a href="index.html">
            <div id="header_logo"></div>
        </a>
        <div id="header_title">TONCO Tools</div>    
        <div id="header_grow"></div>    
        <!-- TON Connect Button -->
        <!-- <div id="tonConnectButton"></div> -->
    </div>

    <div id="menu">
        <h1>List of tools</h1>
        <ul class="horizontal-menu">
                <li><a href="router.html"> Router </a></li>
                <li><a href="pool_factory.html"> Pool Factory </a></li>
                <li><a href="pools.html">   Pool </a></li>
                <li><a href="nft.html">   Position NFT </a></li>
                <li><a href="account.html">   User Account</a></li>
                <li><a href="transaction.html"> Transaction </a></li>

        </ul>
    </div>
    `;

    const footerHtml = `
        <footer>
            <p>Shared Footer</p>
        </footer>
    `;

    document.getElementById('header-placeholder')!.innerHTML = headerHtml;
    document.getElementById('footer-placeholder')!.innerHTML = footerHtml;
}
