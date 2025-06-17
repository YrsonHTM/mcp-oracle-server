#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const oracledb = require('oracledb');

// Configuración de Oracle
const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_DATABASE}`
};

class OracleServer {
  constructor() {
    this.server = new Server(
      {
        name: 'oracle-database-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // Listar herramientas disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_query',
          description: 'Ejecuta una consulta SELECT en la base de datos Oracle',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Consulta SQL SELECT a ejecutar',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'describe_table',
          description: 'Describe la estructura de una tabla',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: 'Nombre de la tabla a describir',
              },
            },
            required: ['table_name'],
          },
        },
        {
          name: 'list_tables',
          description: 'Lista todas las tablas disponibles para el usuario actual',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Manejar llamadas a herramientas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_query':
            return await this.executeQuery(args.query);
          case 'describe_table':
            return await this.describeTable(args.table_name);
          case 'list_tables':
            return await this.listTables();
          default:
            throw new Error(`Herramienta desconocida: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  // Validar que la consulta sea solo SELECT
  validateSelectQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      throw new Error('Solo se permiten consultas SELECT');
    }
    
    // Prohibir ciertas palabras clave peligrosas
    const prohibitedKeywords = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate'];
    for (const keyword of prohibitedKeywords) {
      if (trimmedQuery.includes(keyword)) {
        throw new Error(`Palabra clave prohibida encontrada: ${keyword}`);
      }
    }
  }

  async executeQuery(query) {
    let connection;

    try {
      // Validar consulta
      this.validateSelectQuery(query);

      // Conectar a la base de datos
      connection = await oracledb.getConnection(dbConfig);

      // Ejecutar consulta
      const result = await connection.execute(query, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        maxRows: 1000 // Limitar resultados para evitar sobrecarga
      });

      return {
        content: [
          {
            type: 'text',
            text: `Consulta ejecutada exitosamente. Filas encontradas: ${result.rows.length}\n\n` +
                  `Resultados:\n${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error ejecutando consulta: ${error.message}`,
          },
        ],
      };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error cerrando conexión:', error);
        }
      }
    }
  }

  async describeTable(tableName) {
    let connection;

    try {
      connection = await oracledb.getConnection(dbConfig);

      // Permitir que el usuario pase 'esquema.tabla' o solo 'tabla'
      let owner = null;
      let table = null;
      if (tableName.includes('.')) {
        [owner, table] = tableName.split('.');
        owner = owner.replace(/['"]/g, '').toUpperCase();
        table = table.replace(/['"]/g, '').toUpperCase();
      } else {
        
        // Si no se especifica esquema, usar el usuario actual
        owner = (process.env.ORACLE_USER || '').toUpperCase();
        table = tableName.replace(/['"]/g, '').toUpperCase();
        return {
          content: [
            {
              type: 'text',
              text: `No se ingreso el esquema, busque primero el esquema para hacer la consulta para la tabla: ${table}`,
            },
          ],
        };
      }

      // Escapar los valores para evitar inyección (solo letras, números y guion bajo)
      if (!/^[A-Z0-9_]+$/.test(owner) || !/^[A-Z0-9_]+$/.test(table)) {
        return {
          content: [
            {
              type: 'text',
              text: `Nombre de esquema o tabla inválido: ${owner}.${table}`,
            },
          ],
        };
      }

      const query = `
        SELECT 
          COLUMN_NAME AS "Nombre",
          DATA_TYPE AS "Tipo",
          DATA_LENGTH AS "Longitud",
          NULLABLE AS "Nulo",
          DATA_DEFAULT AS "Valor por Defecto"
        FROM ALL_TAB_COLUMNS
        WHERE OWNER = '${owner}' 
          AND TABLE_NAME = '${table}'
        ORDER BY COLUMN_ID
      `;

      const result = await connection.execute(query, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      if (result.rows.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Tabla '${owner}.${table}' no encontrada o sin permisos para verla. con query: ${query}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Estructura de la tabla ${owner}.${table}:\n\n` +
                  `${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error describiendo tabla: ${error.message} con query: ${query}`,
          },
        ],
      };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error cerrando conexión:', error);
        }
      }
    }
  }

  async listTables() {
    let connection;

    try {
      connection = await oracledb.getConnection(dbConfig);

      // Primero intentar con USER_TABLES, luego con ALL_TABLES
      let query = `
        SELECT TABLE_NAME, NUM_ROWS 
        FROM USER_TABLES 
        ORDER BY TABLE_NAME
      `;

      let result = await connection.execute(query, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      // Si no hay resultados, intentar con ALL_TABLES
      if (result.rows.length === 0) {
        query = `
          SELECT OWNER, TABLE_NAME, NUM_ROWS 
          FROM ALL_TABLES 
          WHERE OWNER = USER
          ORDER BY TABLE_NAME
        `;
        
        result = await connection.execute(query, [], {
          outFormat: oracledb.OUT_FORMAT_OBJECT
        });
      }

      // Si aún no hay resultados, intentar una consulta más amplia
      if (result.rows.length === 0) {
        query = `
          SELECT OWNER, TABLE_NAME 
          FROM ALL_TABLES 
          WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'CTXSYS', 'MDSYS', 'OLAPSYS', 'ORDSYS', 'OUTLN', 'WMSYS')
          ORDER BY OWNER, TABLE_NAME
        `;
        
        result = await connection.execute(query, [], {
          outFormat: oracledb.OUT_FORMAT_OBJECT
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: `Tablas disponibles (${result.rows.length} encontradas):\n\n` +
                  `${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listando tablas: ${error.message}`,
          },
        ],
      };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error cerrando conexión:', error);
        }
      }
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Servidor MCP Oracle iniciado en stdio');
  }
}

const server = new OracleServer();
server.run().catch(console.error);