import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    // Esta configuración le dice a Hardhat cómo hablar con Ganache
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337 // <--- IMPORTANTE: Ganache usa 1337, Hardhat usa 31337 por defecto
    }
  }
};

export default config;
