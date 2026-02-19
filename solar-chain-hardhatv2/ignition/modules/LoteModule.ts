import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LoteModule = buildModule("LoteModule", (m) => {
  // Despliega el contrato "Almazara" sin argumentos en el constructor
  const almazara = m.contract("Almazara");

  return { almazara };
});

export default LoteModule;