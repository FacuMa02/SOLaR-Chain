import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    // Esta configuración le dice a Hardhat cómo hablar con Ganache
    localhost: {
      url: rpcUrl,
      chainId: 1337 // <--- IMPORTANTE: Ganache usa 1337, Hardhat usa 31337 por defecto
    }
  }
};

export default config;
