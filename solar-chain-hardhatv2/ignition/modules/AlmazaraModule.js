import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AlmazaraModule", (m) => {
    // Desplegamos el contrato Almazara
    const almazara = m.contract("Almazara");

    return { almazara };
});