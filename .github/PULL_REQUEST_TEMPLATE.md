### Título del Pull Request
Debe ser descriptivo y seguir una convención (como Conventional Commits).

Formato: [Tipo]: [Breve descripción] 

Ejemplo: feat: implementar smart contract de trazabilidad de lotes

### Resumen del cambio
Explica brevemente qué hiciste y por qué.

"Se integra el contrato Traceability.sol que permite el registro de la producción de aceite de oliva. Se añade la lógica de eventos para auditoría externa."

### Tipo de cambio
[ ] ✨ Feat (Nueva funcionalidad)

[ ] 🐞 Fix (Corrección de errores)

[ ] 📝 Docs (Cambios en la documentación o Tesis)

[ ] 🧪 Tests (Añadir o corregir pruebas en Hardhat)

[ ] ♻️ Refactor (Mejora de código sin cambiar funcionalidad)

### Relevancia con la Tesis
Es vital conectar el código con los objetivos académicos:

Objetivo relacionado: (Ej: Objetivo Específico 2 - Desarrollo del núcleo blockchain).

Diagrama afectado: (Ej: Actualización del Diagrama de Componentes C4).

### Guía de Revisión (Checklist)
Antes de marcar el PR como listo para revisión, asegúrate de cumplir con:

[ ] El código compila sin errores (npx hardhat compile).

[ ] Se han añadido tests unitarios y todos pasan (npx hardhat test).

[ ] La documentación de funciones (NatSpec en Solidity) está completa.

[ ] Se ha verificado el consumo de gas (si aplica).

### Evidencia Visual y Pruebas
Capturas o logs de la aplicación funcionando.
