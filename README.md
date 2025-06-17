# MCP Oracle Server

Este proyecto es un **servidor Node.js** que expone herramientas para interactuar con una base de datos Oracle a través del protocolo Model Context Protocol (MCP). Permite ejecutar consultas SELECT, describir tablas y listar tablas disponibles en la base de datos Oracle de forma segura y controlada.

## ¿Para qué sirve?
- Ejecutar consultas SELECT sobre una base de datos Oracle.
- Describir la estructura de cualquier tabla Oracle.
- Listar todas las tablas disponibles para el usuario conectado.
- Facilita la integración de bases de datos Oracle con herramientas que soportan MCP.

## Requisitos
- Node.js >= 18
- Acceso a una base de datos Oracle
- Tener configuradas las variables de entorno para la conexión Oracle:
  - `ORACLE_USER`
  - `ORACLE_PASSWORD`
  - `ORACLE_HOST`
  - `ORACLE_PORT`
  - `ORACLE_DATABASE`

## Instalación
1. **Clona el repositorio:**
   ```sh
   git clone <URL_DEL_REPOSITORIO>
   cd mcp-oracle-server
   ```

2. **Instala las dependencias:**
   ```sh
   npm install
   ```

3. **Configura las variables de entorno:**
   Puedes crear un archivo `.env` o exportarlas en tu terminal:
   ```sh
   export ORACLE_USER=tu_usuario
   export ORACLE_PASSWORD=tu_contraseña
   export ORACLE_HOST=host.oracle.com
   export ORACLE_PORT=1521
   export ORACLE_DATABASE=servicio
   ```
   En Windows PowerShell:
   ```powershell
   $env:ORACLE_USER="tu_usuario"
   $env:ORACLE_PASSWORD="tu_contraseña"
   $env:ORACLE_HOST="host.oracle.com"
   $env:ORACLE_PORT="1521"
   $env:ORACLE_DATABASE="servicio"
   ```

## Uso

### Iniciar el servidor
```sh
npm start
```

El servidor se ejecutará y estará listo para recibir comandos MCP por stdio.

### Herramientas disponibles
- **execute_query**: Ejecuta una consulta SELECT en Oracle.
- **describe_table**: Describe la estructura de una tabla.
- **list_tables**: Lista todas las tablas disponibles para el usuario.

## Notas
- **No subas la carpeta `node_modules` al repositorio**. Ya está excluida por `.gitignore`.
- El servidor solo permite consultas SELECT para evitar modificaciones accidentales en la base de datos.
- Si tienes problemas con la conexión Oracle, revisa que las variables de entorno estén correctamente configuradas.

## Licencia
MIT 