// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ProductionDSL {
    enum Etapa {
        RECEPCION, // 0
        MOLIENDA, // 1
        BATIDO, // 2
        CENTRIFUGADO, // 3 (Acidez y Peróxidos)
        DECANTACION, // 4
        ANALISIS, // 5 (Rendimiento)
        ALMACENAMIENTO // 6
    }

    // AÑADIDO: Estado CANCELADO
    enum ResultadoValidacion {
        APROBADO,
        OBSERVADO,
        BLOQUEADO,
        CANCELADO
    }

    struct KPIs {
        uint256 rendimiento;
        uint256 acidez;
        uint256 peroxidos;
    }

    // ACTUALIZADO: Variables de peróxidos específicas
    struct LimitesKPI {
        uint256 maxAcidezExtra; // ej: 80 (0.8%)
        uint256 maxAcidezVirgen; // ej: 200 (2.0%)
        uint256 maxAcidezCorriente; // ej: 330 (3.3%)
        uint256 maxAcidezRefinado; // ej: 30 (0.3%)
        uint256 maxAcidezOliva; // ej: 100 (1.0%)
        uint256 maxPeroxidosVirgen; // <= 20 (Aplica a AOVE y Virgen)
        uint256 maxPeroxidosOliva; // <= 15
        uint256 maxPeroxidosRefinado; // <= 5
        uint256 minRendimiento; // ej: 10
    }

    struct Validacion {
        bool esBloqueante;
        ResultadoValidacion resultado;
        string motivo;
    }

    function esTransicionValida(
        Etapa actual,
        Etapa siguiente
    ) internal pure returns (bool) {
        if (uint(siguiente) == uint(actual) + 1) return true;
        return false;
    }

    function validarEtapa(
        Etapa etapa,
        KPIs memory kpis,
        LimitesKPI memory limites
    ) internal pure returns (Validacion memory) {
        // Etapas sin validación de KPIs
        if (
            etapa == Etapa.RECEPCION ||
            etapa == Etapa.MOLIENDA ||
            etapa == Etapa.BATIDO ||
            etapa == Etapa.CENTRIFUGADO
        ) {
            return
                Validacion(false, ResultadoValidacion.APROBADO, "Transito OK");
        }

        // DECANTACION: validar rendimiento estimado (kgAceite / kgAceituna * 100)
        if (etapa == Etapa.DECANTACION) {
            if (kpis.rendimiento >= limites.minRendimiento) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Rendimiento Estimado Optimo"
                    );
            }
            return
                Validacion(
                    false,
                    ResultadoValidacion.OBSERVADO,
                    "Rendimiento Estimado Bajo"
                );
        }

        // ANALISIS: sin validación de KPIs
        if (etapa == Etapa.ANALISIS) {
            return
                Validacion(false, ResultadoValidacion.APROBADO, "Transito OK");
        }

        // ALMACENAMIENTO: clasificación por Acidez + Peróxidos + rendimiento definitivo
        if (etapa == Etapa.ALMACENAMIENTO) {
            // Refinado: Acidez < 0.3% y Peróxidos <= 5
            if (
                kpis.acidez < limites.maxAcidezRefinado &&
                kpis.peroxidos <= limites.maxPeroxidosRefinado
            ) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Analisis Quimico: Calidad Refinado"
                    );
            }
            // Extra Virgen: Acidez < 0.8% y Peróxidos <= 20
            if (
                kpis.acidez < limites.maxAcidezExtra &&
                kpis.peroxidos <= limites.maxPeroxidosVirgen
            ) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Analisis Quimico: Calidad Extra Virgen"
                    );
            }
            // Oliva: Acidez < 1.0% y Peróxidos <= 15
            if (
                kpis.acidez < limites.maxAcidezOliva &&
                kpis.peroxidos <= limites.maxPeroxidosOliva
            ) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Analisis Quimico: Calidad Oliva"
                    );
            }
            // Virgen: Acidez < 2.0% y Peróxidos <= 20
            if (
                kpis.acidez < limites.maxAcidezVirgen &&
                kpis.peroxidos <= limites.maxPeroxidosVirgen
            ) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Analisis Quimico: Calidad Virgen"
                    );
            }

            // Lampante: fuera de todos los rangos de calidad
            return
                Validacion(
                    false,
                    ResultadoValidacion.BLOQUEADO,
                    "Analisis Quimico: Calidad Lampante"
                );
        }

        return
            Validacion(
                true,
                ResultadoValidacion.BLOQUEADO,
                "Etapa desconocida"
            );
    }
}
