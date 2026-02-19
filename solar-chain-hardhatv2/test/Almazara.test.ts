const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Sistema de Trazabilidad Almazara - Lógica Final", function () {

  // --- FIXTURE: Prepara el escenario limpio ---
  async function deployAlmazaraFixture() {
    // Obtenemos cuentas de prueba
    const [owner, operario] = await ethers.getSigners();

    // Desplegamos librerías y contrato
    const ProductionDSL = await ethers.getContractFactory("ProductionDSL");
    const dsl = await ProductionDSL.deploy();
    // Nota: Si ProductionDSL es librería externa, se linkea. Si es interna, Hardhat lo maneja solo.

    const Almazara = await ethers.getContractFactory("Almazara");
    const almazara = await Almazara.deploy();

    return { almazara, owner, operario };
  }

  // --- TEST 1: CASO BLOQUEANTE (Integridad de Datos) ---
  it("Debe BLOQUEAR (Revert) si el rendimiento es 0 absoluto", async function () {
    const { almazara } = await loadFixture(deployAlmazaraFixture);

    // 1. Crear lote y llevarlo hasta la puerta del Centrifugado
    await almazara.crearLote("R-Test-Block", "1");
    await almazara.avanzarEtapa(1, 1, 0, 0, 0); // Molienda (OK)
    await almazara.avanzarEtapa(1, 2, 0, 0, 0); // Batido (OK)

    // 2. Intentar pasar con Rendimiento 0
    // ESPERAMOS: Que la transacción falle y nos devuelva el motivo
    await expect(
      almazara.avanzarEtapa(1, 3, 0, 0, 0) // Etapa 3 = Centrifugado
    ).to.be.revertedWith("Error: Rendimiento no puede ser cero");
  });

  // --- TEST 2: CASO NO CONFORME (Calidad Mala, pero Dato Válido) ---
  it("Debe AVANZAR pero marcar NO_CONFORME si el rendimiento es bajo (2%)", async function () {
    const { almazara } = await loadFixture(deployAlmazaraFixture);

    await almazara.crearLote("R-Test-BadQuality", "2");
    await almazara.avanzarEtapa(1, 1, 0, 0, 0);
    await almazara.avanzarEtapa(1, 2, 0, 0, 0);

    // 1. Ejecutamos la transacción con rendimiento 2% (Malo)
    // ESPERAMOS: Que NO falle, pero que el evento diga "resultado: 2" (NO_CONFORME)
    await expect(almazara.avanzarEtapa(1, 3, 2, 0, 0))
      .to.emit(almazara, "AvanceEtapa")
      .withArgs(1, 3, 2, "Rendimiento Bajo", anyValue); // 2 = NO_CONFORME

    // 2. Verificación doble: Leemos el estado del lote en la blockchain
    const lote = await almazara.getLote(1);
    expect(lote.etapaActual).to.equal(3n); // Sí avanzó a Centrifugado
    expect(lote.estadoCalidad).to.equal(2n); // Pero quedó marcado como NO_CONFORME
  });

  // --- TEST 3: CASO IDEAL (Calidad Buena) ---
  it("Debe AVANZAR y marcar APROBADO si el rendimiento es óptimo (15%)", async function () {
    const { almazara } = await loadFixture(deployAlmazaraFixture);

    await almazara.crearLote("R-Test-GoodQuality", "3");
    await almazara.avanzarEtapa(1, 1, 0, 0, 0);
    await almazara.avanzarEtapa(1, 2, 0, 0, 0);

    // ESPERAMOS: Resultado 0 (APROBADO)
    await expect(almazara.avanzarEtapa(1, 3, 15, 0, 0))
      .to.emit(almazara, "AvanceEtapa")
      .withArgs(1, 3, 0, "Rendimiento Optimo", anyValue); // 0 = APROBADO
  });

});