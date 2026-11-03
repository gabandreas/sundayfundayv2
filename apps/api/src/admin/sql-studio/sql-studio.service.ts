import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecuteQueryDto, TableRecordQueryDto } from './sql-studio.dto';

function serializeData(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'bigint') return Number(val);
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(serializeData);
  if (typeof val === 'object') {
    const res: any = {};
    for (const k of Object.keys(val)) {
      res[k] = serializeData(val[k]);
    }
    return res;
  }
  return val;
}

export interface ColumnMetadata {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: any;
}

export interface TableSummary {
  tableName: string;
  rowCount: number;
  primaryKey: string;
  columns: ColumnMetadata[];
}

@Injectable()
export class SqlStudioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Safely returns all base tables in the public schema.
   */
  async getValidTables(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name;
    `);
    return rows.map((r) => r.table_name);
  }

  /**
   * Returns schema information, columns, primary keys, and exact live row counts.
   */
  async getTablesWithMetadata(): Promise<TableSummary[]> {
    const validTables = await this.getValidTables();
    if (validTables.length === 0) return [];

    // Get column definitions
    const columnRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    // Get primary keys
    const pkRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT kcu.table_name, kcu.column_name as pk_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
    `);

    const pkMap = new Map<string, string>();
    pkRows.forEach((r) => pkMap.set(r.table_name, r.pk_column));

    const colMap = new Map<string, ColumnMetadata[]>();
    columnRows.forEach((r) => {
      if (!colMap.has(r.table_name)) colMap.set(r.table_name, []);
      colMap.get(r.table_name)!.push({
        columnName: r.column_name,
        dataType: r.data_type,
        isNullable: r.is_nullable === 'YES',
        defaultValue: r.column_default,
      });
    });

    const summaries: TableSummary[] = [];

    for (const tableName of validTables) {
      let rowCount = 0;
      try {
        const countRes = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT COUNT(*)::int AS count FROM "${tableName}";`
        );
        rowCount = countRes[0]?.count ?? 0;
      } catch {
        rowCount = 0;
      }

      summaries.push({
        tableName,
        rowCount,
        primaryKey: pkMap.get(tableName) || 'id',
        columns: colMap.get(tableName) || [],
      });
    }

    return summaries;
  }

  /**
   * Executes arbitrary SQL query with timing telemetry and execution mode safety.
   */
  async executeQuery(dto: ExecuteQueryDto) {
    const rawSql = dto.sql.trim();
    if (!rawSql) {
      throw new BadRequestException('SQL query cannot be empty.');
    }

    const mode = dto.mode || 'READ_ONLY';
    const startTime = performance.now();
    const upperSql = rawSql.toUpperCase();

    // 1. READ_ONLY Mode (Default Safe Mode)
    if (mode === 'READ_ONLY') {
      const dangerousKeywords = [
        'INSERT INTO',
        'UPDATE ',
        'DELETE FROM',
        'DROP ',
        'ALTER ',
        'TRUNCATE ',
        'CREATE ',
      ];
      const hasMutationKeyword = dangerousKeywords.some(
        (kw) => upperSql.includes(kw)
      );

      if (hasMutationKeyword) {
        throw new BadRequestException(
          'Database mutation is forbidden in READ_ONLY mode. Switch to "Write / Commit Mode" or "Dry-Run" to execute mutating statements.'
        );
      }

      try {
        const rows = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY;');
          return await tx.$queryRawUnsafe(rawSql);
        });

        const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
        const serialized = serializeData(rows);
        const rowArray = Array.isArray(serialized) ? serialized : [serialized];

        return {
          success: true,
          mode: 'READ_ONLY',
          executionTimeMs,
          rowCount: rowArray.length,
          rows: rowArray,
          fields: rowArray.length > 0 ? Object.keys(rowArray[0]) : [],
        };
      } catch (err: any) {
        const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
        throw new BadRequestException({
          success: false,
          mode: 'READ_ONLY',
          executionTimeMs,
          error: err.message || 'Error executing SQL query in READ_ONLY mode.',
        });
      }
    }

    // 2. DRY_RUN_ROLLBACK Mode
    if (mode === 'DRY_RUN_ROLLBACK') {
      try {
        let previewRows: any[] = [];
        let affectedCount = 0;

        await this.prisma.$transaction(async (tx) => {
          if (
            upperSql.startsWith('SELECT') ||
            upperSql.startsWith('WITH') ||
            upperSql.startsWith('EXPLAIN') ||
            upperSql.startsWith('SHOW') ||
            upperSql.includes('RETURNING')
          ) {
            previewRows = await tx.$queryRawUnsafe(rawSql);
            affectedCount = Array.isArray(previewRows) ? previewRows.length : 0;
          } else {
            affectedCount = await tx.$executeRawUnsafe(rawSql);
            previewRows = [{ affectedRows: affectedCount }];
          }

          // Force rollback
          throw new Error('__DRY_RUN_ROLLBACK_INTENTIONAL__');
        });
      } catch (err: any) {
        if (err.message === '__DRY_RUN_ROLLBACK_INTENTIONAL__') {
          const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
          return {
            success: true,
            mode: 'DRY_RUN_ROLLBACK',
            rolledBack: true,
            executionTimeMs,
            rowCount: 0,
            rows: [
              {
                status: 'ROLLED_BACK',
                message: 'Dry-run executed successfully. All mutations were rolled back safely with 0 disk drift.',
              },
            ],
            fields: ['status', 'message'],
          };
        }

        const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
        throw new BadRequestException({
          success: false,
          mode: 'DRY_RUN_ROLLBACK',
          executionTimeMs,
          error: err.message || 'Error executing SQL in DRY_RUN_ROLLBACK mode.',
        });
      }
    }

    // 3. EXECUTE_COMMIT Mode
    try {
      let rows: any[] = [];
      let rowCount = 0;

      if (
        upperSql.startsWith('SELECT') ||
        upperSql.startsWith('WITH') ||
        upperSql.startsWith('EXPLAIN') ||
        upperSql.startsWith('SHOW') ||
        upperSql.includes('RETURNING')
      ) {
        rows = await this.prisma.$queryRawUnsafe(rawSql);
        rowCount = Array.isArray(rows) ? rows.length : 0;
      } else {
        rowCount = await this.prisma.$executeRawUnsafe(rawSql);
        rows = [
          {
            affectedRows: rowCount,
            message: `Statement executed and committed successfully (${rowCount} row(s) affected).`,
          },
        ];
      }

      const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
      const serialized = serializeData(rows);
      const rowArray = Array.isArray(serialized) ? serialized : [serialized];

      return {
        success: true,
        mode: 'EXECUTE_COMMIT',
        executionTimeMs,
        rowCount: upperSql.startsWith('SELECT') ? rowArray.length : rowCount,
        rows: rowArray,
        fields: rowArray.length > 0 ? Object.keys(rowArray[0]) : [],
      };
    } catch (err: any) {
      const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
      throw new BadRequestException({
        success: false,
        mode: 'EXECUTE_COMMIT',
        executionTimeMs,
        error: err.message || 'Error executing SQL query.',
      });
    }
  }

  /**
   * Fast paginated and filterable table record browser.
   */
  async getTableRecords(tableName: string, query: TableRecordQueryDto) {
    const validTables = await this.getValidTables();
    if (!validTables.includes(tableName)) {
      throw new NotFoundException(`Table "${tableName}" not found.`);
    }

    // Get column metadata & primary key
    const columns = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}'
      ORDER BY ordinal_position;
    `);

    const colNames = columns.map((c) => c.column_name);

    const pkRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT kcu.column_name as pk_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'public' 
        AND tc.table_name = '${tableName}';
    `);

    const primaryKey = pkRows[0]?.pk_column || (colNames.includes('id') ? 'id' : colNames[0]);

    // Build WHERE clause
    const whereClauses: string[] = [];

    if (query.userId !== undefined && colNames.includes('userId')) {
      whereClauses.push(`"userId" = ${Number(query.userId)}`);
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim().replace(/'/g, "''");
      const textCols = columns.filter((c) =>
        ['character varying', 'text', 'character'].includes(c.data_type)
      );
      if (textCols.length > 0) {
        const searchOrs = textCols.map((c) => `"${c.column_name}"::text ILIKE '%${s}%'`);
        whereClauses.push(`(${searchOrs.join(' OR ')})`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count
    const countRes = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "${tableName}" ${whereSql};`
    );
    const totalRows = countRes[0]?.count ?? 0;

    // Sorting & Pagination
    let orderByCol = primaryKey;
    if (query.orderBy && colNames.includes(query.orderBy)) {
      orderByCol = query.orderBy;
    }
    const orderDir = query.orderDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(200, query.limit || 50));
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "${tableName}"
      ${whereSql}
      ORDER BY "${orderByCol}" ${orderDir}
      LIMIT ${limit} OFFSET ${offset};
    `);

    return {
      tableName,
      primaryKey,
      columns: columns.map((c) => ({
        columnName: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
      })),
      page,
      limit,
      totalRows,
      totalPages: Math.ceil(totalRows / limit),
      rows: serializeData(rows),
    };
  }

  /**
   * Superadmin E2E row insertion.
   */
  async createTableRecord(tableName: string, data: Record<string, any>) {
    const validTables = await this.getValidTables();
    if (!validTables.includes(tableName)) {
      throw new NotFoundException(`Table "${tableName}" not found.`);
    }

    const columns = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}';
    `);

    const validColNames = new Set(columns.map((c) => c.column_name));
    const insertCols: string[] = [];
    const insertVals: any[] = [];
    const placeholders: string[] = [];

    let paramIdx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!validColNames.has(k)) continue;
      // Skip undefined or null autoincrement id
      if (k === 'id' && (v === undefined || v === null || v === '')) continue;

      insertCols.push(`"${k}"`);
      placeholders.push(`$${paramIdx}`);
      insertVals.push(v);
      paramIdx++;
    }

    if (insertCols.length === 0) {
      throw new BadRequestException('No valid columns provided for insertion.');
    }

    const sql = `
      INSERT INTO "${tableName}" (${insertCols.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;

    const res = await this.prisma.$queryRawUnsafe<any[]>(sql, ...insertVals);
    return serializeData(res[0]);
  }

  /**
   * Superadmin E2E row update.
   */
  async updateTableRecord(tableName: string, id: any, data: Record<string, any>) {
    const validTables = await this.getValidTables();
    if (!validTables.includes(tableName)) {
      throw new NotFoundException(`Table "${tableName}" not found.`);
    }

    const pkRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT kcu.column_name as pk_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'public' 
        AND tc.table_name = '${tableName}';
    `);

    const primaryKey = pkRows[0]?.pk_column || 'id';

    const columns = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}';
    `);
    const validColNames = new Set(columns.map((c) => c.column_name));

    const setClauses: string[] = [];
    const setVals: any[] = [];
    let paramIdx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (!validColNames.has(k) || k === primaryKey) continue;
      setClauses.push(`"${k}" = $${paramIdx}`);
      setVals.push(v);
      paramIdx++;
    }

    if (setClauses.length === 0) {
      throw new BadRequestException('No fields provided to update.');
    }

    setVals.push(isNaN(Number(id)) ? id : Number(id));
    const sql = `
      UPDATE "${tableName}"
      SET ${setClauses.join(', ')}
      WHERE "${primaryKey}" = $${paramIdx}
      RETURNING *;
    `;

    const res = await this.prisma.$queryRawUnsafe<any[]>(sql, ...setVals);
    if (!res || res.length === 0) {
      throw new NotFoundException(`Record with ${primaryKey}=${id} not found in "${tableName}".`);
    }

    return serializeData(res[0]);
  }

  /**
   * Superadmin E2E row deletion.
   */
  async deleteTableRecord(tableName: string, id: any) {
    const validTables = await this.getValidTables();
    if (!validTables.includes(tableName)) {
      throw new NotFoundException(`Table "${tableName}" not found.`);
    }

    const pkRows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT kcu.column_name as pk_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'public' 
        AND tc.table_name = '${tableName}';
    `);

    const primaryKey = pkRows[0]?.pk_column || 'id';
    const parsedId = isNaN(Number(id)) ? id : Number(id);

    const res = await this.prisma.$queryRawUnsafe<any[]>(`
      DELETE FROM "${tableName}"
      WHERE "${primaryKey}" = $1
      RETURNING *;
    `, parsedId);

    if (!res || res.length === 0) {
      throw new NotFoundException(`Record with ${primaryKey}=${id} not found in "${tableName}".`);
    }

    return {
      success: true,
      deletedId: id,
      tableName,
      message: `Record with ${primaryKey}=${id} successfully deleted from "${tableName}".`,
    };
  }
}
