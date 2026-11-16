import { eq, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import type {
  AnyPgColumn,
  AnyPgTable,
  PgInsertValue,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core";
import { db } from "db";

type TableWithId = AnyPgTable & { id: AnyPgColumn };

export abstract class BaseService<Table extends TableWithId> {
  private static readonly MAX_PAGE_SIZE = 100;
  constructor(protected readonly table: Table) {}

  async findMany(page = 1, pageSize = 20): Promise<InferSelectModel<Table>[]> {
    const limit = Math.min(Math.max(pageSize, 1), BaseService.MAX_PAGE_SIZE);
    const offset = (Math.max(page, 1) - 1) * limit;
    return this.asRows(
      await db
        .select()
        .from(this.table)
        .orderBy(this.table.id)
        .limit(limit)
        .offset(offset),
    );
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

  async update(
    id: number,
    data: Partial<InferInsertModel<Table>>,
  ): Promise<InferSelectModel<Table> | null> {
    if (Object.keys(data).length === 0) return this.findById(id);
    const [row] = this.asRows(
      await db
        .update(this.table)
        .set(data as PgUpdateSetSource<Table>)
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

  private asRows(result: unknown): InferSelectModel<Table>[] {
    return result as InferSelectModel<Table>[];
  }
}
