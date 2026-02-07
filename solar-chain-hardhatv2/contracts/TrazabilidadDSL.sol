// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ProductionDSL {
    /* =======================
            ENUMS
    ======================= */

    enum Etapa {
        RECEPCION,
        MOLIENDA,
        BATIDO,
        CENTRIFUGADO,
        DECANTACION,
        ANALISIS,
        ALMACENAMIENTO
    }

    enum ResultadoValidacion {
        APROBADO,
        OBSERVADO,
        NO_CONFORME
    }

    /* =======================
            KPI STRUCT
    ======================= */

    struct KPIs {
        uint256 rendimiento; // porcentaje (ej: 6 = 6%)
        uint256 acidez; // índice de acidez
        uint256 peroxidos; // índice de peróxidos
    }

    /* =======================
        VALIDATION RESULT
    ======================= */

    struct Validacion {
        bool aplica;
        ResultadoValidacion resultado;
        string motivo;
    }

    /* =======================
        TRANSITION CHECK
    ======================= */

    function validarEtapa(
        Etapa etapa,
        KPIs memory kpis
    ) internal pure returns (Validacion memory) {
        // Etapas SIN validación de KPIs
        if (
            etapa == Etapa.RECEPCION ||
            etapa == Etapa.MOLIENDA ||
            etapa == Etapa.BATIDO ||
            etapa == Etapa.CENTRIFUGADO ||
            etapa == Etapa.DECANTACION
        ) {
            return
                Validacion({
                    aplica: false,
                    resultado: ResultadoValidacion.APROBADO,
                    motivo: "Etapa sin validacion de KPIs"
                });
        }

        // Etapa EXTRACCION (rendimiento)
        if (etapa == Etapa.CENTRIFUGADO) {
            if (kpis.rendimiento >= 10) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.APROBADO,
                        "Rendimiento ideal"
                    );
            }
            if (kpis.rendimiento >= 6) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.OBSERVADO,
                        "Rendimiento aceptable"
                    );
            }
            return
                Validacion(
                    true,
                    ResultadoValidacion.NO_CONFORME,
                    "Rendimiento bajo"
                );
        }

        // Etapa ANALISIS (acidez + peroxidos)
        if (etapa == Etapa.ANALISIS) {
            if (kpis.acidez <= 8 && kpis.peroxidos <= 20) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.APROBADO,
                        "Parametros dentro de norma"
                    );
            }

            if (kpis.acidez <= 12 && kpis.peroxidos <= 25) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.OBSERVADO,
                        "Parametros fuera del ideal"
                    );
            }

            return
                Validacion(
                    true,
                    ResultadoValidacion.NO_CONFORME,
                    "Parametros fuera de norma"
                );
        }

        // Etapa ALMACENAMIENTO (solo confirmación)
        if (etapa == Etapa.ALMACENAMIENTO) {
            return
                Validacion({
                    aplica: false,
                    resultado: ResultadoValidacion.APROBADO,
                    motivo: "Cierre del proceso productivo"
                });
        }

        revert("Etapa no contemplada en DSL");
    }

    /* =======================
        TRANSICIONES VALIDAS
    ======================= */

    function esTransicionValida(
        Etapa actual,
        Etapa siguiente
    ) internal pure returns (bool) {
        if (actual == Etapa.RECEPCION && siguiente == Etapa.MOLIENDA)
            return true;
        if (actual == Etapa.MOLIENDA && siguiente == Etapa.BATIDO) return true;
        if (actual == Etapa.BATIDO && siguiente == Etapa.CENTRIFUGADO)
            return true;
        if (actual == Etapa.CENTRIFUGADO && siguiente == Etapa.DECANTACION)
            return true;
        if (actual == Etapa.DECANTACION && siguiente == Etapa.ANALISIS)
            return true;
        if (actual == Etapa.ANALISIS && siguiente == Etapa.ALMACENAMIENTO)
            return true;

        return false;
    }
}
