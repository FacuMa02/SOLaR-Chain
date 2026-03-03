const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Sistema de Trazabilidad Almazara - Integración Completa", function () {

    // --- FIXTURE: Prepara el escenario limpio ---
    async function deployAlmazaraFixture() {
        const [owner, operario] = await ethers.getSigners();

        // Desplegamos el contrato
        const Almazara = await ethers.getContractFactory("Almazara");
        const almazara = await Almazara.deploy();

        return { almazara, owner, operario };
    }

    // =========================================================
    // BLOQUE 1: CONFIGURACIÓN DE LÍMITES (ADMINISTRACIÓN)
    // =========================================================
    describe("Configuración de KPIs", function () {
        it("Debe permitir al owner cambiar los límites de KPIs", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            // Cambiamos el límite de Extra Virgen a 0.5% (50)
            await almazara.setLimitesKPI(50, 200, 330, 20, 15, 5, 10);

            const limites = await almazara.limitesActuales();
            expect(limites.maxAcidezExtra).to.equal(50);
        });

        it("Debe rechazar cambios si no es el owner", async function () {
            const { almazara, operario } = await loadFixture(deployAlmazaraFixture);
            await expect(
                almazara.connect(operario).setLimitesKPI(50, 200, 330, 20, 15, 5, 10)
            ).to.be.revertedWithCustomError(almazara, "NoAutorizado");
        });
    });

    // =========================================================
    // BLOQUE 2: GESTIÓN DE INVENTARIO (TOLVA) Y CREACIÓN
    // =========================================================
    describe("Gestión de Tolva y Creación de Lote", function () {
        it("Debe abastecer la tolva correctamente", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await expect(almazara.abastecerTolva(5000))
                .to.emit(almazara, "TolvaAbastecida")
                .withArgs(5000, 5000, anyValue);

            const pesoActual = await almazara.pesoTolva();
            expect(pesoActual).to.equal(5000n);
        });

        it("Debe descontar el peso de la tolva al crear un lote", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(5000); // Llenamos con 5000 kg

            await expect(almazara.crearLote("DB-ID-1", "Arbequina", 2000))
                .to.emit(almazara, "LoteCreado")
                .withArgs(1, "DB-ID-1", "Arbequina", 2000, anyValue);

            const pesoRestante = await almazara.pesoTolva();
            expect(pesoRestante).to.equal(3000n);
        });

        it("Debe REVERTIR si se intenta crear un lote con más kilos de los disponibles", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(1000); // Solo 1000 kg disponibles

            await expect(
                almazara.crearLote("DB-ID-2", "Picual", 1500)
            ).to.be.revertedWithCustomError(almazara, "PesoTolvaInsuficiente")
                .withArgs(1000, 1500);
        });
    });

    // =========================================================
    // BLOQUE 3: VALIDACIONES QUÍMICAS (CENTRIFUGADO)
    // =========================================================
    describe("Validación de Etapa: CENTRIFUGADO (Química)", function () {
        it("Clasifica como Extra Virgen (Acidez < 0.8% y Peróxidos <= 20)", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            // ⚠️ EL TRUCO: Llenamos la tolva antes de crear el lote en todos los tests
            await almazara.abastecerTolva(10000);
            await almazara.crearLote("DB-01", "Blend", 1000);

            await almazara.avanzarEtapa(1, 1, 0, 0, 0);
            await almazara.avanzarEtapa(1, 2, 0, 0, 0);

            // Acidez 50 (0.5%), Peroxidos 18
            await expect(almazara.avanzarEtapa(1, 3, 0, 50, 18))
                .to.emit(almazara, "AvanceEtapa")
                .withArgs(1, 3, 0, "Calidad Extra Virgen");
        });

        it("Clasifica como Corriente (Acidez < 3.3% y Peróxidos <= 15)", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(10000);
            await almazara.crearLote("DB-02", "Blend", 1000);

            await almazara.avanzarEtapa(1, 1, 0, 0, 0);
            await almazara.avanzarEtapa(1, 2, 0, 0, 0);

            // Acidez 250 (2.5%), Peroxidos 14
            await expect(almazara.avanzarEtapa(1, 3, 0, 250, 14))
                .to.emit(almazara, "AvanceEtapa")
                .withArgs(1, 3, 1, "Calidad Corriente"); // 1 = OBSERVADO
        });

        it("Falla la validación (Lampante) si Peróxidos > 15 en categoría Corriente", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(10000);
            await almazara.crearLote("DB-03", "Blend", 1000);

            await almazara.avanzarEtapa(1, 1, 0, 0, 0);
            await almazara.avanzarEtapa(1, 2, 0, 0, 0);

            // Acidez 250 (2.5%), Peroxidos 18 (Excede el límite de 15)
            await expect(almazara.avanzarEtapa(1, 3, 0, 250, 18))
                .to.emit(almazara, "AvanceEtapa")
                .withArgs(1, 3, 2, "V. Lampante NO APTO PARA CONSUMO"); // 2 = NO_CONFORME
        });
    });

    // =========================================================
    // BLOQUE 4: RENDIMIENTO Y ALMACENAMIENTO FINAL
    // =========================================================
    describe("Validación de Etapa: ANÁLISIS (Rendimiento) y ALMACENAMIENTO", function () {
        it("Bloquea la transacción (Revert) si el rendimiento es 0 absoluto", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(10000);
            await almazara.crearLote("DB-04", "Blend", 1000);

            await almazara.avanzarEtapa(1, 1, 0, 0, 0);
            await almazara.avanzarEtapa(1, 2, 0, 0, 0);
            await almazara.avanzarEtapa(1, 3, 0, 70, 10); // Centrifugado OK
            await almazara.avanzarEtapa(1, 4, 0, 0, 0);   // Decantacion OK

            // Intentar Análisis con Rendimiento 0
            await expect(
                almazara.avanzarEtapa(1, 5, 0, 0, 0)
            ).to.be.revertedWith("Error: Rendimiento cero");
        });

        it("Marca el stock disponible en Almacenamiento (Flujo Completo)", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(10000);
            await almazara.crearLote("DB-05", "Blend", 1000);

            await almazara.avanzarEtapa(1, 1, 0, 0, 0);
            await almazara.avanzarEtapa(1, 2, 0, 0, 0);
            await almazara.avanzarEtapa(1, 3, 0, 70, 10); // Centrifugado OK
            await almazara.avanzarEtapa(1, 4, 0, 0, 0);   // Decantacion OK
            await almazara.avanzarEtapa(1, 5, 15, 0, 0);  // Analisis OK (15%)

            await expect(almazara.avanzarEtapa(1, 6, 0, 0, 0))
                .to.emit(almazara, "AvanceEtapa")
                .withArgs(1, 6, 0, "Pendiente (Stock Disponible)");
        });
    });

    // =========================================================
    // BLOQUE 5: CANCELACIÓN (KILL SWITCH)
    // =========================================================
    describe("Cancelación de Lotes Errados", function () {
        it("Debe permitir al owner cancelar un lote en producción", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(10000);
            await almazara.crearLote("DB-06", "Blend", 1000);

            await expect(almazara.cancelarLote(1, "Error en pesaje"))
                .to.emit(almazara, "LoteCancelado")
                .withArgs(1, "Error en pesaje", anyValue);

            const lote = await almazara.getLote(1);
            expect(lote.estadoCalidad).to.equal(3n); // 3 = CANCELADO
        });

        it("Debe BLOQUEAR el avance de un lote cancelado", async function () {
            const { almazara } = await loadFixture(deployAlmazaraFixture);

            await almazara.abastecerTolva(10000);
            await almazara.crearLote("DB-07", "Blend", 1000);

            await almazara.cancelarLote(1, "Lote contaminado");

            // Intentamos mover la máquina de estados
            await expect(
                almazara.avanzarEtapa(1, 1, 0, 0, 0)
            ).to.be.revertedWithCustomError(almazara, "LoteBloqueadoPorCancelacion");
        });
    });

});