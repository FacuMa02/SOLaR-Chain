// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TrazabilidadDSL.sol";

contract Almazara {
    using ProductionDSL for ProductionDSL.Etapa;

    struct Lote {
        uint256 id;
        string idBaseDatos; // Hash o ID de SQLite
        string variedad; // ej: "Arbequina", "Picual"
        uint256 pesoKg; // Peso asignado a este lote
        ProductionDSL.Etapa etapaActual;
        ProductionDSL.ResultadoValidacion estadoCalidad;
        ProductionDSL.KPIs kpis;
        string observaciones;
        uint256 timestamp; // Fecha de inicio de molienda
    }

    mapping(uint256 => Lote) public lotes;
    uint256 public contadorLotes;

    // --- VARIABLES DE CONFIGURACIÓN ---
    ProductionDSL.LimitesKPI public limitesActuales;
    address public owner;

    // --- EVENTOS ---

    event LoteCreado(
        uint256 indexed idSC,
        string idBaseDatos,
        string variedad,
        uint256 pesoKg,
        uint256 timestamp
    );
    event AvanceEtapa(
        uint256 indexed idSC,
        ProductionDSL.Etapa etapa,
        ProductionDSL.ResultadoValidacion resultado,
        string motivo
    );
    event LimitesActualizados(uint256 timestamp);
    event LoteCancelado(uint256 indexed idSC, string motivo, uint256 timestamp);

    // --- ERRORES ---
    error TransicionInvalida(
        ProductionDSL.Etapa actual,
        ProductionDSL.Etapa solicitada
    );
    error LoteNoExiste(uint256 id);
    error NoAutorizado();
    error LoteBloqueadoPorCancelacion();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NoAutorizado();
        _;
    }

    constructor() {
        owner = msg.sender;
        limitesActuales = ProductionDSL.LimitesKPI({
            maxAcidezExtra: 80,
            maxAcidezVirgen: 200,
            maxAcidezCorriente: 330,
            maxPeroxidosVirgen: 20,
            maxPeroxidosCorriente: 15,
            maxPeroxidosRefinado: 5,
            minRendimiento: 10
        });
    }

    function setLimitesKPI(
        uint256 _maxAcidezExtra,
        uint256 _maxAcidezVirgen,
        uint256 _maxAcidezCorriente,
        uint256 _maxPeroxidosVirgen,
        uint256 _maxPeroxidosCorriente,
        uint256 _maxPeroxidosRefinado,
        uint256 _minRendimiento
    ) external onlyOwner {
        limitesActuales.maxAcidezExtra = _maxAcidezExtra;
        limitesActuales.maxAcidezVirgen = _maxAcidezVirgen;
        limitesActuales.maxAcidezCorriente = _maxAcidezCorriente;
        limitesActuales.maxPeroxidosVirgen = _maxPeroxidosVirgen;
        limitesActuales.maxPeroxidosCorriente = _maxPeroxidosCorriente;
        limitesActuales.maxPeroxidosRefinado = _maxPeroxidosRefinado;
        limitesActuales.minRendimiento = _minRendimiento;

        emit LimitesActualizados(block.timestamp);
    }

    // --- ACTUALIZADO: Crear Lote ahora consume de la Tolva ---
    function crearLote(
        string memory _idBaseDatos,
        string memory _variedad,
        uint256 _pesoKg
    ) public {
        contadorLotes++;
        lotes[contadorLotes] = Lote({
            id: contadorLotes,
            idBaseDatos: _idBaseDatos,
            variedad: _variedad,
            pesoKg: _pesoKg,
            etapaActual: ProductionDSL.Etapa.RECEPCION,
            estadoCalidad: ProductionDSL.ResultadoValidacion.APROBADO,
            kpis: ProductionDSL.KPIs(0, 0, 0),
            observaciones: "Inicio de Molienda",
            timestamp: block.timestamp
        });
        emit LoteCreado(
            contadorLotes,
            _idBaseDatos,
            _variedad,
            _pesoKg,
            block.timestamp
        );
    }

    function avanzarEtapa(
        uint256 _idLote,
        ProductionDSL.Etapa _siguienteEtapa,
        uint256 _rendimiento,
        uint256 _acidez,
        uint256 _peroxidos
    ) public {
        if (lotes[_idLote].id == 0) revert LoteNoExiste(_idLote);
        Lote storage lote = lotes[_idLote];

        if (lote.estadoCalidad == ProductionDSL.ResultadoValidacion.CANCELADO) {
            revert LoteBloqueadoPorCancelacion();
        }

        if (
            !ProductionDSL.esTransicionValida(lote.etapaActual, _siguienteEtapa)
        ) {
            revert TransicionInvalida(lote.etapaActual, _siguienteEtapa);
        }

        ProductionDSL.KPIs memory nuevosKPIs = ProductionDSL.KPIs(
            _rendimiento,
            _acidez,
            _peroxidos
        );
        ProductionDSL.Validacion memory validacion = ProductionDSL.validarEtapa(
            _siguienteEtapa,
            nuevosKPIs,
            limitesActuales
        );

        if (validacion.esBloqueante) {
            revert(validacion.motivo);
        }

        lote.etapaActual = _siguienteEtapa;
        lote.kpis = nuevosKPIs;
        lote.estadoCalidad = validacion.resultado;
        lote.observaciones = validacion.motivo;
        lote.timestamp = block.timestamp;

        emit AvanceEtapa(
            _idLote,
            _siguienteEtapa,
            validacion.resultado,
            validacion.motivo
        );
    }

    function cancelarLote(
        uint256 _idLote,
        string memory _motivo
    ) public onlyOwner {
        if (lotes[_idLote].id == 0) revert LoteNoExiste(_idLote);
        Lote storage lote = lotes[_idLote];

        if (lote.estadoCalidad == ProductionDSL.ResultadoValidacion.CANCELADO) {
            revert("El lote ya se encuentra cancelado");
        }

        lote.estadoCalidad = ProductionDSL.ResultadoValidacion.CANCELADO;
        lote.observaciones = _motivo;
        lote.timestamp = block.timestamp;

        emit LoteCancelado(_idLote, _motivo, block.timestamp);
    }

    function getLote(uint256 _id) public view returns (Lote memory) {
        if (lotes[_id].id == 0) revert LoteNoExiste(_id);
        return lotes[_id];
    }
}
