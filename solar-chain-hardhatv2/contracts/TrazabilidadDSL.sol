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
        NO_CONFORME,
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
        uint256 maxPeroxidosVirgen; // <= 20 (Aplica a AOVE y Virgen)
        uint256 maxPeroxidosCorriente; // <= 15
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
        if (
            etapa == Etapa.RECEPCION ||
            etapa == Etapa.MOLIENDA ||
            etapa == Etapa.BATIDO ||
            etapa == Etapa.DECANTACION
        ) {
            return
                Validacion(false, ResultadoValidacion.APROBADO, "Transito OK");
        }

        // LÓGICA ACTUALIZADA: Clasificación por Acidez + Peróxidos
        if (etapa == Etapa.CENTRIFUGADO) {
            if (kpis.acidez == 0 && kpis.peroxidos == 0) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.NO_CONFORME,
                        "Error: Valores quimicos nulos"
                    );
            }

            // AOVE: Acidez < 0.8% y Peróxidos <= 20
            if (
                kpis.acidez < limites.maxAcidezExtra &&
                kpis.peroxidos <= limites.maxPeroxidosVirgen
            ) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Calidad Extra Virgen"
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
                        ResultadoValidacion.OBSERVADO,
                        "Calidad Virgen"
                    );
            }
            // Corriente: Acidez < 3.3% y Peróxidos <= 15
            if (
                kpis.acidez < limites.maxAcidezCorriente &&
                kpis.peroxidos <= limites.maxPeroxidosCorriente
            ) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.OBSERVADO,
                        "Calidad Corriente"
                    );
            }
            // Refinado: Peróxidos <= 5 (Si no cumplió los requisitos de acidez anteriores pero tiene peróxidos bajos)
            if (kpis.peroxidos <= limites.maxPeroxidosRefinado) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.OBSERVADO,
                        "Calidad Refinado"
                    );
            }

            // Si falla todo lo anterior (Acidez alta o peróxidos fuera de rango)
            return
                Validacion(
                    false,
                    ResultadoValidacion.NO_CONFORME,
                    "V. Lampante NO APTO PARA CONSUMO"
                );
        }

        if (etapa == Etapa.ANALISIS) {
            if (kpis.rendimiento == 0) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.NO_CONFORME,
                        "Error: Rendimiento cero"
                    );
            }
            if (kpis.rendimiento >= limites.minRendimiento) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Rendimiento Optimo"
                    );
            }
            return
                Validacion(
                    false,
                    ResultadoValidacion.NO_CONFORME,
                    "Rendimiento Bajo"
                );
        }

        if (etapa == Etapa.ALMACENAMIENTO) {
            return
                Validacion(
                    false,
                    ResultadoValidacion.APROBADO,
                    "Pendiente (Stock Disponible)"
                );
        }

        return
            Validacion(
                true,
                ResultadoValidacion.NO_CONFORME,
                "Etapa desconocida"
            );
    }
}
