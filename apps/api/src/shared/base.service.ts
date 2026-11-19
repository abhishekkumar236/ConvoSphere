import {
  and,
  count,
  eq,
  getTableColumns,
  isNull,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from "drizzle-orm";
import type {
  AnyPgColumn,
  AnyPgTable,
  PgInsertValue,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core";
import { db } from "db";
import type { Paginated } from "types";
import type { FindManyOptions } from "./types.js";

type TableWithId = AnyPgTable & { id: AnyPgColumn };

export abstract class BaseService<Table extends TableWithId> {
  private static readonly MAX_PAGE_SIZE = 100;
  private static readonly DEFAULT_PAGE_SIZE = 10;

  constructor(protected readonly table: Table) {}

  /**
   * One page of rows plus counts. Ordered by id, so pages don't shift between requests.
   *   await service.findMany({ page: 2, pageSize: 10, filter: { ownerId: 7 } })
   *   → { items: [...10 rows], meta: { page: 2, pageSize: 10, totalItems: 34, totalPages: 4 } }
   */
  async findMany(
    options: FindManyOptions<InferSelectModel<Table>> = {},
  ): Promise<Paginated<InferSelectModel<Table>>> {
    const pageSize = this.clamp(
      options.pageSize,
      BaseService.DEFAULT_PAGE_SIZE,
      1,
      BaseService.MAX_PAGE_SIZE,
    );
    const page = this.clamp(options.page, 1, 1, Number.MAX_SAFE_INTEGER);
    const where = this.buildWhere(options);

    // The page and the total are two queries, run at the same time.
    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(this.table)
        .where(where)
        .orderBy(this.table.id)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(this.table).where(where),
    ]);
    const totalItems = totals[0]?.total ?? 0;

    return {
      items: this.asRows(rows),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async findById(id: number): Promise<InferSelectModel<Table> | null> {
    const [row] = this.asRows(
      await db.select().from(this.table).where(eq(this.table.id, id)).limit(1),
    );
    return row ?? null;
  }

  async create(
    data: InferInsertModel<Table>,
  ): Promise<InferSelectModel<Table>> {
    const [row] = this.asRows(
      await db
        .insert(this.table)
        .values(data as unknown as PgInsertValue<Table>)
        .returning(),
    );

    if (!row)
      throw new Error(`Insert into ${this.constructor.name} returned no row`);
    return row;
  }

  /**
   * Changes only the given fields. undefined = leave as is (what zod's .partial() produces), so
   * { title: "New", image: undefined } changes the title only. Nothing to change → the row as is.
   */
  async update(
    id: number,
    data: { [Column in keyof InferInsertModel<Table>]?: InferInsertModel<Table>[Column] | undefined },
  ): Promise<InferSelectModel<Table> | null> {
    const changes = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length === 0) return this.findById(id);
    const [row] = this.asRows(
      await db
        .update(this.table)
        .set(changes as PgUpdateSetSource<Table>)
        .where(eq(this.table.id, id))
        .returning(),
    );
    return row ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = this.asRows(
      await db.delete(this.table).where(eq(this.table.id, id)).returning(),
    );
    return rows.length > 0;
  }

  /** filter (column = value, or IS NULL for null) AND where. undefined = no WHERE at all. */
  private buildWhere(
    options: FindManyOptions<InferSelectModel<Table>>,
  ): SQL | undefined {
    const columns: Record<string, AnyPgColumn> = getTableColumns(this.table);
    const conditions: (SQL | undefined)[] = [];
    for (const [key, value] of Object.entries(options.filter ?? {})) {
      if (value === undefined) continue;
      const column = columns[key];
      // Only possible when the type check is bypassed (e.g. an object built from a request).
      if (!column) throw new Error(`Unknown column "${key}" in filter`);
      conditions.push(value === null ? isNull(column) : eq(column, value));
    }
    if (options.where) conditions.push(options.where);
    return and(...conditions);
  }

  /** Whole number between min and max. Missing or not a number (undefined, NaN) → fallback. */
  private clamp(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
  }

  private asRows(result: unknown): InferSelectModel<Table>[] {
    return result as InferSelectModel<Table>[];
  }
}
