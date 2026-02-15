export default function LotesTable({ lotes, stageNameByIndex }) {
  return (
    <div className="overflow-x-auto border rounded-2xl">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>Código</th>
            <th>Fecha recepción</th>
            <th>Origen</th>
            <th>Kg</th>
            <th>Etapa actual</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => (
            <tr key={l.id}>
              <td className="font-medium">{l.codigo}</td>
              <td>{l.fechaRecepcion}</td>
              <td>{l.origen}</td>
              <td>{l.kg}</td>
              <td>{stageNameByIndex(l.stageIndex)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
