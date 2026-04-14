const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function updateBackendEnv(contractAddress) {
    const backendEnvPath = path.resolve(__dirname, "..", "..", "backend", ".env");
    if (!fs.existsSync(backendEnvPath)) {
        return;
    }

    const envContent = fs.readFileSync(backendEnvPath, "utf8");
    const nextContent = envContent.match(/^CONTRACT_ADDRESS=/m)
        ? envContent.replace(/^CONTRACT_ADDRESS=.*$/m, `CONTRACT_ADDRESS=${contractAddress}`)
        : `${envContent.trim()}\nCONTRACT_ADDRESS=${contractAddress}\n`;

    fs.writeFileSync(backendEnvPath, nextContent, "utf8");
}

function updateDeploymentRegistry(contractAddress) {
    const deploymentPath = path.resolve(__dirname, "..", "ignition", "deployments", "chain-1337", "deployed_addresses.json");
    const current = fs.existsSync(deploymentPath)
        ? JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
        : {};

    const next = {
        ...current,
        "AlmazaraModule#Almazara": contractAddress,
    };

    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying Almazara with account: ${deployer.address}`);

    const factory = await hre.ethers.getContractFactory("Almazara");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    updateBackendEnv(contractAddress);
    updateDeploymentRegistry(contractAddress);

    console.log(`Almazara desplegado en: ${contractAddress}`);
    console.log("backend/.env y deployed_addresses.json fueron sincronizados.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});