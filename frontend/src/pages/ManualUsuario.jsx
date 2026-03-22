export default function ManualUsuario() {
  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="mb-8 border-b border-base-300 pb-4">
        <h1 className="text-3xl font-bold text-primary">Manual de Usuario</h1>
        <p className="text-base-content/70 mt-2">
          Guía de uso para la plataforma de trazabilidad SOLaR-Chain.
        </p>
      </div>

      <div className="space-y-4">
        {/* SECCIÓN 1 */}
        <div className="collapse collapse-plus bg-base-200 border border-base-300">
          <input type="radio" name="manual-accordion" defaultChecked /> 
          <div className="collapse-title text-xl font-medium">
            1. Introducción al Sistema
          </div>
          <div className="collapse-content text-base-content/80 space-y-2">
            <p>
              <strong>SOLaR-Chain</strong> Es un sistema diseñado para digitalizar y registrar la trazabilidad del proceso productivo del aceite de oliva en la almazara de la UNLaR.
            </p>
            <p>
              Cada acción realizada sobre un lote de producción queda registrada de manera inmutable utilizando tecnología blockchain mediante contratos inteligentes, garantizando la transparencia y seguridad de los datos históricos.
            </p>
          </div>
        </div>

        {/* SECCIÓN 2 */}
        <div className="collapse collapse-plus bg-base-200 border border-base-300">
          <input type="radio" name="manual-accordion" /> 
          <div className="collapse-title text-xl font-medium">
            2. Acceso y Cuenta de Usuario
          </div>
          <div className="collapse-content text-base-content/80 space-y-2">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Iniciar Sesión:</strong> Ingrese su usuario y contraseña en la pantalla principal. Si es su primer ingreso, solicite las credenciales al administrador.</li>
              <li><strong>Cambiar Contraseña:</strong> Desde el menú superior derecho, seleccione <em>Sesión &gt; Cambiar contraseña</em>. Se le solicitará su clave actual y la nueva.</li>
              <li><strong>Cerrar Sesión:</strong> Para salir de forma segura, despliegue el menú superior y seleccione <em>Cerrar sesión</em>.</li>
            </ul>
          </div>
        </div>

        {/* SECCIÓN 3 */}
        <div className="collapse collapse-plus bg-base-200 border border-base-300">
          <input type="radio" name="manual-accordion" /> 
          <div className="collapse-title text-xl font-medium">
            3. Gestión de Lotes (Ingreso)
          </div>
          <div className="collapse-content text-base-content/80 space-y-2">
            <p>En esta sección se ingresa la materia prima al sistema al llegar a la planta.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Nuevo Lote / Remito:</strong> Utilice esta opción cuando ingrese un nuevo cargamento de aceitunas. Deberá completar los datos de origen, peso y variedad.</li>
              <li><strong>Cancelar Lote:</strong> Si hubo un error en el ingreso o la materia prima fue rechazada antes de procesarse, puede anular el registro desde esta opción.</li>
            </ul>
          </div>
        </div>

        {/* SECCIÓN 4 */}
        <div className="collapse collapse-plus bg-base-200 border border-base-300">
          <input type="radio" name="manual-accordion" /> 
          <div className="collapse-title text-xl font-medium">
            4. Proceso Productivo
          </div>
          <div className="collapse-content text-base-content/80 space-y-2">
            <p>Es el panel de control principal de la planta. Aquí visualizará todos los lotes activos.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Avanzar etapa:</strong> A medida que la pasta pasa por las maquinarias (molienda, batido, extracción), haga clic en el botón correspondiente para mover el lote a la siguiente fase.</li>
              <li><em>Nota:</em> Cada avance de etapa se sincroniza automáticamente con el contrato en la blockchain.</li>
            </ul>
          </div>
        </div>

        {/* SECCIÓN 5 */}
        <div className="collapse collapse-plus bg-base-200 border border-base-300">
          <input type="radio" name="manual-accordion" /> 
          <div className="collapse-title text-xl font-medium">
            5. Historial y Trazabilidad
          </div>
          <div className="collapse-content text-base-content/80 space-y-2">
            <p>Una vez que un lote termina su proceso, se archiva en esta pestaña.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Puede buscar producciones pasadas y ver la fecha/hora exacta en la que pasaron por cada etapa.</li>
              <li>Puede consultar el identificador único (Hash) de la transacción para auditorías externas.</li>
            </ul>
          </div>
        </div>

        {/* SECCIÓN 6 */}
        <div className="collapse collapse-plus bg-base-200 border border-base-300">
          <input type="radio" name="manual-accordion" /> 
          <div className="collapse-title text-xl font-medium">
            6. Personalización de la Interfaz
          </div>
          <div className="collapse-content text-base-content/80 space-y-2">
            <p>Para mayor comodidad durante su turno, desde el menú <em>Apariencia</em> puede ajustar:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Modo Oscuro / Claro:</strong> Reduce la fatiga visual en entornos con poca luz.</li>
              <li><strong>Tamaño de texto:</strong> Aumenta la legibilidad del sistema para pantallas táctiles o lectura a distancia.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}