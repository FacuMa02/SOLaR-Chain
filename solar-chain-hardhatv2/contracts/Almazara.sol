// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TrazabilidadDSL.sol";

contract Almazara {
    using ProductionDSL for ProductionDSL.Etapa;

    // --- ESTRUCTURAS ---
    struct Lote {
        uint256 id;
        string numeroRemito;
        string idBaseDatos; // String para compatibilidad
        ProductionDSL.Etapa etapaActual;
        ProductionDSL.ResultadoValidacion estadoCalidad;
        ProductionDSL.KPIs kpis;
        string observaciones;
        uint256 timestamp;
    }

    mapping(uint256 => Lote) public lotes;
    uint256 public contadorLotes;

    // --- EVENTOS ---
    event LoteCreado(
        uint256 indexed idSC,
        string numeroRemito,
        string idBaseDatos
    );
    event AvanceEtapa(
        uint256 indexed idSC,
        ProductionDSL.Etapa etapa,
        ProductionDSL.ResultadoValidacion resultado,
        string motivo,
        uint256 timestamp
    );

    // --- ERRORES ---
    error TransicionInvalida(
        ProductionDSL.Etapa actual,
        ProductionDSL.Etapa solicitada
    );
    error LoteNoExiste(uint256 id);

    // --- FUNCIONES ---

    function crearLote(
        string memory _numeroRemito,
        string memory _idBaseDatos
    ) public {
        contadorLotes++;

        lotes[contadorLotes] = Lote({
            id: contadorLotes,
            numeroRemito: _numeroRemito,
            idBaseDatos: _idBaseDatos,
            etapaActual: ProductionDSL.Etapa.RECEPCION,
            estadoCalidad: ProductionDSL.ResultadoValidacion.APROBADO,
            kpis: ProductionDSL.KPIs(0, 0, 0), // Inicializamos en 0
            observaciones: "Inicio de proceso",
            timestamp: block.timestamp
        });

        emit LoteCreado(contadorLotes, _numeroRemito, _idBaseDatos);
    }

    function avanzarEtapa(
        uint256 _idLote,
        ProductionDSL.Etapa _siguienteEtapa,
        uint256 _rendimiento,
        uint256 _acidez,
        uint256 _peroxidos
    ) public {
        // 1. Chequeo básico
        if (lotes[_idLote].id == 0) revert LoteNoExiste(_idLote);
        Lote storage lote = lotes[_idLote];

        // 2. Chequeo de flujo (1 -> 2 -> 3...)
        if (
            !ProductionDSL.esTransicionValida(lote.etapaActual, _siguienteEtapa)
        ) {
            revert TransicionInvalida(lote.etapaActual, _siguienteEtapa);
        }

        // 3. Validación de Reglas con el DSL
        ProductionDSL.KPIs memory nuevosKPIs = ProductionDSL.KPIs(
            _rendimiento,
            _acidez,
            _peroxidos
        );

        ProductionDSL.Validacion memory validacion = ProductionDSL.validarEtapa(
            _siguienteEtapa,
            nuevosKPIs
        );

        // --- 🛑 EL BLOQUEO ---
        // Solo revertimos si la validación es "BLOQUEANTE" (es decir, KPIs en 0)
        if (validacion.esBloqueante) {
            revert(validacion.motivo);
        }
        // ---------------------

        // 4. Guardado (Si no fue bloqueante, guardamos TODO, incluso si es NO_CONFORME)
        lote.etapaActual = _siguienteEtapa;
        lote.kpis = nuevosKPIs;
        lote.estadoCalidad = validacion.resultado;
        lote.observaciones = validacion.motivo;
        lote.timestamp = block.timestamp;

        emit AvanceEtapa(
            _idLote,
            _siguienteEtapa,
            validacion.resultado,
            validacion.motivo,
            block.timestamp
        );
    }

    function getLote(uint256 _id) public view returns (Lote memory) {
        if (lotes[_id].id == 0) revert LoteNoExiste(_id);
        return lotes[_id];
    }
}
