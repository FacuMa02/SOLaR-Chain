// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ProductionDSL {
    // --- ESTRUCTURAS DE DATOS ---

    enum Etapa {
        RECEPCION, // 0
        MOLIENDA, // 1
        BATIDO, // 2
        CENTRIFUGADO, // 3 (Aquí validamos Rendimiento)
        DECANTACION, // 4
        ANALISIS, // 5 (Aquí validamos Acidez y Peróxidos)
        ALMACENAMIENTO // 6
    }

    enum ResultadoValidacion {
        APROBADO, // 0
        OBSERVADO, // 1
        NO_CONFORME // 2
    }

    struct KPIs {
        uint256 rendimiento; // Porcentaje (ej: 15 para 15%)
        uint256 acidez; // Decimales * 100 (ej: 80 para 0.8%)
        uint256 peroxidos; // Entero (ej: 20)
    }

    struct Validacion {
        bool esBloqueante; // <--- NUEVO: Si es true, hacemos Revert.
        ResultadoValidacion resultado;
        string motivo;
    }

    // --- LÓGICA DE TRANSICIONES (Máquina de Estados) ---
    function esTransicionValida(
        Etapa actual,
        Etapa siguiente
    ) internal pure returns (bool) {
        // Solo permitimos avanzar de a 1 paso a la vez
        if (uint(siguiente) == uint(actual) + 1) {
            return true;
        }
        return false;
    }

    // --- LÓGICA DE REGLAS DE NEGOCIO (KPIs) ---
    function validarEtapa(
        Etapa etapa,
        KPIs memory kpis
    ) internal pure returns (Validacion memory) {
        // 1. ETAPAS DE TRÁNSITO (Sin validación de números)
        // NOTA: Centrifugado y Análisis NO están aquí.
        if (
            etapa == Etapa.RECEPCION ||
            etapa == Etapa.MOLIENDA ||
            etapa == Etapa.BATIDO ||
            etapa == Etapa.DECANTACION ||
            etapa == Etapa.ALMACENAMIENTO
        ) {
            return
                Validacion(false, ResultadoValidacion.APROBADO, "Transito OK");
        }

        // 2. ETAPA CENTRIFUGADO (Validamos Rendimiento)
        if (etapa == Etapa.CENTRIFUGADO) {
            // REGLA BLOQUEANTE: El 0 es imposible físicamente
            if (kpis.rendimiento == 0) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.NO_CONFORME,
                        "Error: Rendimiento no puede ser cero"
                    );
            }

            // REGLAS DE CALIDAD (No bloqueantes, solo clasifican)
            if (kpis.rendimiento >= 10) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Rendimiento Optimo"
                    );
            }
            // Si es bajo (ej: 5%), avanza pero como NO_CONFORME
            return
                Validacion(
                    false,
                    ResultadoValidacion.NO_CONFORME,
                    "Rendimiento Bajo"
                );
        }

        // 3. ETAPA ANÁLISIS (Validamos Química)
        if (etapa == Etapa.ANALISIS) {
            // REGLA BLOQUEANTE: 0 absoluto en ambos es sospechoso (error de sensor)
            if (kpis.acidez == 0 && kpis.peroxidos == 0) {
                return
                    Validacion(
                        true,
                        ResultadoValidacion.NO_CONFORME,
                        "Error: Valores quimicos en cero"
                    );
            }

            // REGLAS DE CALIDAD
            if (kpis.acidez <= 8 && kpis.peroxidos <= 20) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.APROBADO,
                        "Calidad Extra Virgen"
                    );
            }
            if (kpis.acidez <= 20) {
                return
                    Validacion(
                        false,
                        ResultadoValidacion.OBSERVADO,
                        "Calidad Virgen"
                    );
            }

            // Si es muy ácido, avanza pero como NO_CONFORME (Lampante)
            return
                Validacion(
                    false,
                    ResultadoValidacion.NO_CONFORME,
                    "Calidad Lampante (No Conforme)"
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
