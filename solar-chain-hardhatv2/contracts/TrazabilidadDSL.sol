// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0

library TrazabilidadDSL {
    // Etapas del proceso productivo
    enum Etapa {
        RECEPCION,
        MOLIENDA,
        BATIDO,
        CENTRIFUGADO,
        DECANTACION,
        ANALISIS,
        ALMACENAMIENTO
    }

    enum EstadoCalidad {
        APROBADO,
        OBSERVADO
    }

    struct ReglaNumerica {
        uint256 min;
        uint256 max;
        bool esTopeMaximo; // true = valor <= max, false = valor >= min
    }

    struct ResultadoValidacion {
        bool cumple;
        string mensaje;
    }

    // FUNCIONES DEL DSL

    //Verificar que el lote venga de la etapa correcta
    function validarTransicion(Etapa actual, Etapa requerida) internal pure {
        require(actual == requerida, "DSL: Transicion de etapa invalida");
    }

    //Evaluar regla de KPI sin revertir (soft validation)
    function evaluarRegla(uint256 valor,ReglaNumerica memory regla)
    internal 
    pure
    returns(EstadoCalidad)
    {
        bool cumple;
        if(regla.esTopeMaximo){
            cumple = valor <= regla.max; // acidez max. 0.8
        } else {
            cumple = valor >= regla.min;
        }

        return cumple ? EstadoCalidad.APROBADO : EstadoCalidad.OBSERVADO;
    }
}