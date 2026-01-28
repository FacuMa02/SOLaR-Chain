import 'dotenv/config';
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { dirname,join } from "path";
import { fileURLToPath } from 'url';

// Formatear el path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//Cargamos el ABI desde el archivo JSON
const abiPath = join(__dirname,"../abis/Almazara.json");
const abiJson = JSON.parse(readFileSync(abiPath, "utf8"));
const ABI = abiJson.abi;

// Configuracion de conexion
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY,provider);

// Instancia del contrato de lista para usarse
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS,ABI,wallet);

console.log("Conectado a Blockchain en:",process.env.CONTRACT_ADDRESS);

export { contract };