// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Importamos tu librería con las reglas hardcodeadas
import "./TrazabilidadDSL.sol";

contract Almazara {
    // Usamos los tipos de datos definidos en tu DSL
    using ProductionDSL for ProductionDSL.Etapa;

    struct Lote {
        uint256 id;
        string nroRemito;
        uint256 kgIniciales;
        ProductionDSL.Etapa etapaActual;
        ProductionDSL.ResultadoValidacion estadoCalidad; // APROBADO, OBSERVADO, NO_CONFORME
        ProductionDSL.KPIs kpis; // Rendimiento, Acidez, Peroxidos
        string observaciones;
        address creadoPor;
        uint256 timestamp;
    }

    // Almacenamiento
    mapping(uint256 => Lote) public lotes;
    uint256 public contadorLotes;

    // Eventos para el Frontend (y para el Indexer)
    event LoteCreado(uint256 indexed id, address creador);
    event AvanceEtapa(
        uint256 indexed id,
        ProductionDSL.Etapa etapa,
        ProductionDSL.ResultadoValidacion resultado,
        string motivo
    );

    // --- FUNCIÓN DE INICIO ---

    function crearLote(string memory _nroRemito, uint256 _kilos) public {
        contadorLotes++;

        lotes[contadorLotes] = Lote({
            id: contadorLotes,
            nroRemito: _nroRemito, // Guardamos el vínculo
            kgIniciales: _kilos, // Guardamos el peso
            etapaActual: ProductionDSL.Etapa.RECEPCION,
            estadoCalidad: ProductionDSL.ResultadoValidacion.APROBADO,
            kpis: ProductionDSL.KPIs(0, 0, 0),
            observaciones: "Recepcion de materia prima",
            creadoPor: msg.sender,
            timestamp: block.timestamp
        });

        // Emitimos el evento con el código externo para facilitar búsquedas
        emit LoteCreado(contadorLotes, msg.sender);
    }

    // --- MOTOR ÚNICO DE TRANSICIÓN ---

    /**
     * @dev Esta función única maneja CUALQUIER cambio de etapa.
     * La lógica de si está bien o mal está delegada totalmente en ProductionDSL.
     */
    function avanzarEtapa(
        uint256 _idLote,
        ProductionDSL.Etapa _siguienteEtapa,
        uint256 _rendimiento,
        uint256 _acidez,
        uint256 _peroxidos
    ) public {
        Lote storage lote = lotes[_idLote];

        // 1. VALIDACIÓN DE FLUJO (BLOQUEANTE) [cite: 113]
        // Usamos la función esTransicionValida de tu librería.
        // Si intentan saltar de Molienda a Analisis, esto revierte la transacción.
        require(
            ProductionDSL.esTransicionValida(lote.etapaActual, _siguienteEtapa),
            "DSL: Transicion de etapa no permitida por el flujo"
        );

        // 2. PREPARAR DATOS
        ProductionDSL.KPIs memory nuevosKPIs = ProductionDSL.KPIs({
            rendimiento: _rendimiento,
            acidez: _acidez,
            peroxidos: _peroxidos
        });

        // 3. VALIDACIÓN DE REGLAS DE NEGOCIO (NO BLOQUEANTE) [cite: 97]
        // Le preguntamos a la librería qué opina de estos datos para esta etapa
        ProductionDSL.Validacion memory validacion = ProductionDSL.validarEtapa(
            _siguienteEtapa,
            nuevosKPIs
        );

        // 4. ACTUALIZAR ESTADO (PERSISTENCIA)
        // Guardamos los datos independientemente de si fue APROBADO o NO_CONFORME
        // para garantizar la trazabilidad real (incluyendo errores).
        lote.etapaActual = _siguienteEtapa;
        lote.kpis = nuevosKPIs;
        lote.estadoCalidad = validacion.resultado;
        lote.observaciones = validacion.motivo;
        lote.timestamp = block.timestamp;

        // 5. EMITIR EVENTO
        emit AvanceEtapa(
            _idLote,
            _siguienteEtapa,
            validacion.resultado,
            validacion.motivo
        );
    }

    // --- FUNCIONES AUXILIARES (GETTERS) ---

    // Función útil para que tu frontend sepa qué datos tiene el lote
    function getLote(uint256 _id) public view returns (Lote memory) {
        return lotes[_id];
    }
}
