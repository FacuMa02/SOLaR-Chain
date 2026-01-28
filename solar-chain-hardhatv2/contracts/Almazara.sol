// SPDX-License-Identifier: GPL-3.0
// licencia de uso de smart contract

pragma solidity >=0.7.0 <0.9.0;

contract Almazara {
    enum TipoUnidad {
        CAJONES,
        BOLSAS
    }
    enum EtapaProceso {
        RECEPCION,
        MOLIENDA,
        BATIDO,
        CENTRIFUGADO,
        DECANTACION,
        ANALISIS,
        ALMACENAMIENTO
    }
    enum EstadoSanitario {
        BUENO,
        REGULAR,
        MALO
    }

    struct Lote {
        uint256 id;
        uint256 fechaCreacion; // timestamp blockchain
        EstadoSanitario estado; // enum → seguro y compacto
        EtapaProceso etapa; // KPI / trazabilidad
        bytes32 hashMetadata; // referencia off-chain
        address creadoPor; // auditoría
    }

    mapping(uint256 => Lote) public lotes;
    uint256 public contadorLotes;

    event LoteCreado(uint256 idLote, uint256 fecha);

    function crearLote(EstadoSanitario _estado, bytes32 _hashMetadata) public {
        contadorLotes++;

        lotes[contadorLotes] = Lote({
            id: contadorLotes,
            fechaCreacion: block.timestamp,
            estado: _estado,
            etapa: EtapaProceso.RECEPCION,
            hashMetadata: _hashMetadata,
            creadoPor: msg.sender
        });
        emit LoteCreado(contadorLotes, block.timestamp);
    }

    function getLote(uint256 _id) public view returns (Lote memory) {
        return lotes[_id];
    }
}
