/**
 * Deploy standalone — usa ethers directamente sin Hardhat.
 * Lee el artefacto ya compilado para no necesitar el toolchain completo.
 */
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY =
    process.env.PRIVATE_KEY ||
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";

async function waitForRpc(url, maxMs = 30000) {
    const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 });
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body,
            });
            if (res.ok) return;
        } catch {
            // nada, reintentamos
        }
        await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error(`Ganache no respondió en ${maxMs / 1000}s`);
}

async function main() {
    const artifactPath = path.resolve(
        __dirname,
        "..",
        "artifacts",
        "contracts",
        "Almazara.sol",
        "Almazara.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const deploymentDir = path.resolve(
        __dirname,
        "..",
        "ignition",
        "deployments",
        "chain-1337"
    );
    const deployedPath = path.join(deploymentDir, "deployed_addresses.json");

    console.log("Esperando a Ganache...");
    await waitForRpc(RPC_URL);

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    if (fs.existsSync(deployedPath)) {
        const existing = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
        const existingAddress = existing["AlmazaraModule#Almazara"];

        if (existingAddress) {
            const deployedCode = await provider.getCode(existingAddress);
            if (deployedCode && deployedCode !== "0x") {
                console.log(`Contrato ya desplegado en: ${existingAddress} — saltando.`);
                return;
            }
            console.log(`Dirección persistida sin bytecode (${existingAddress}). Se desplegará nuevamente.`);
        }
    }

    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Desplegando Almazara con cuenta: ${wallet.address}`);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    fs.mkdirSync(deploymentDir, { recursive: true });
    fs.writeFileSync(
        deployedPath,
        JSON.stringify({ "AlmazaraModule#Almazara": contractAddress }, null, 2) + "\n"
    );

    console.log(`Almazara desplegado en: ${contractAddress}`);
    console.log("deployed_addresses.json sincronizado.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
