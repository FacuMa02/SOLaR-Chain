import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Almazara Trazabilidad", function () {
  
  // 1. FIXTURE: Esta función hace el deploy "limpio" antes de cada test.
  // Es mucho más rápido que hacer deploy manual cada vez.
  async function deployAlmazaraFixture() {
    // Obtenemos las cuentas de prueba (dueño y otro usuario)
    const [owner, otherAccount] = await ethers.getSigners();

    // Hacemos deploy del contrato
    const Almazara = await ethers.getContractFactory("Almazara");
    const almazara = await Almazara.deploy();

    return { almazara, owner, otherAccount };
  }

  describe("Función: Crear Lote", function () {
    
    it("Debería incrementar el contador de lotes al crear uno", async function () {
      const { almazara } = await loadFixture(deployAlmazaraFixture);
      
      const mockHash = ethers.id("metadata-json-ipfs"); // Generamos un hash falso tipo bytes32
      
      // Estado 0 = BUENO (según tu Enum)
      await almazara.crearLote(0, mockHash);

      expect(await almazara.contadorLotes()).to.equal(1);
    });

    it("Debería guardar los datos exactos (Estado, Hash y Creador)", async function () {
      const { almazara, owner } = await loadFixture(deployAlmazaraFixture);
      const mockHash = ethers.id("lote-aceite-2026");
      
      // Creamos un lote con EstadoSanitario.REGULAR (índice 1 en el Enum)
      // Pasamos 1 porque en JS los Enums se manejan como enteros
      await almazara.crearLote(1, mockHash);

      const lote = await almazara.getLote(1);

      // Verificaciones
      expect(lote.estado).to.equal(1); // 1 = REGULAR
      expect(lote.hashMetadata).to.equal(mockHash);
      expect(lote.creadoPor).to.equal(owner.address); // Verifica la auditoría
    });

    it("Debería inicializar siempre en etapa RECEPCION (0)", async function () {
      const { almazara } = await loadFixture(deployAlmazaraFixture);
      const mockHash = ethers.id("test-etapa");

      await almazara.crearLote(0, mockHash);
      const lote = await almazara.getLote(1);

      // Tu enum EtapaProceso empieza con RECEPCION, que es 0
      expect(lote.etapa).to.equal(0); 
    });

    it("Debería emitir el evento LoteCreado", async function () {
      const { almazara } = await loadFixture(deployAlmazaraFixture);
      const mockHash = ethers.id("evento-test");

      // Verificamos que al ejecutar la transacción, se emita el evento
      await expect(almazara.crearLote(0, mockHash))
        .to.emit(almazara, "LoteCreado")
        // .withArgs(idEsperado, cualquierCosaParaLaFecha)
        .withArgs(1, (val: any) => val > 0); // Aceptamos cualquier timestamp mayor a 0
    });
  });
});