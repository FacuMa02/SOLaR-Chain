const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ROOT = path.resolve(__dirname, "..", "..");
const HARDHAT_ROOT = path.resolve(ROOT, "solar-chain-hardhatv2");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY =
    process.env.PRIVATE_KEY ||
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";

function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

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
            if (res.ok) {
                return;
            }
        } catch {
            // Reintento
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw new Error(`Ganache no respondio en ${maxMs / 1000}s en ${url}`);
}

async function main() {
    const artifactPath = path.resolve(
        HARDHAT_ROOT,
        "artifacts",
        "contracts",
        "Almazara.sol",
        "Almazara.json"
    );

    const artifact = readJsonIfExists(artifactPath);
    if (!artifact || !artifact.abi || !artifact.bytecode) {
        throw new Error(`No se encontro artefacto compilado en ${artifactPath}.`);
    }

    const deploymentDir = path.resolve(HARDHAT_ROOT, "ignition", "deployments", "chain-1337");
    const deployedPath = path.join(deploymentDir, "deployed_addresses.json");

    console.log("Esperando nodo RPC de Ganache...");
    await waitForRpc(RPC_URL, 45000);

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const existing = readJsonIfExists(deployedPath);
    const existingAddress = existing?.["AlmazaraModule#Almazara"];

    if (existingAddress) {
        const code = await provider.getCode(existingAddress);
        if (code && code !== "0x") {
            console.log(`Contrato ya desplegado en ${existingAddress}.`);
            return;
        }

        console.log(`Direccion previa sin bytecode (${existingAddress}). Se redeploya.`);
    }

    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Desplegando Almazara con cuenta ${wallet.address}...`);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();

    fs.mkdirSync(deploymentDir, { recursive: true });
    fs.writeFileSync(
        deployedPath,
        `${JSON.stringify({ "AlmazaraModule#Almazara": contractAddress }, null, 2)}\n`,
        "utf8"
    );

    console.log(`Almazara desplegado en ${contractAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
