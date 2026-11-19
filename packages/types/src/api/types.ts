import type { SQL } from "drizzle-orm";

/**
 * Options for BaseService.findMany. All optional: findMany() = page 1, 10 items, ordered by id.
 *   findMany({ page: 2 })                                  → items 11-20
 *   findMany({ filter: { status: "open" } })              → WHERE status = 'open'
 *   findMany({ where: ilike(roomTable.title, "%yoga%") }) → any Drizzle condition
 */
export interface FindManyOptions<Row> {
  /** 1-based page number. Default 1. */
  page?: number;
  /** Items per page. Default 10, at most 100. */
  pageSize?: number;
  /**
   * Equality filters on columns, all must match: { ownerId: 7, image: null }
   * → owner_id = 7 AND image IS NULL. Typed from the table, so a wrong column is a compile error.
   */
  filter?: Partial<Row>;
  /** Anything else (ranges, search, OR): a Drizzle condition. Combined with `filter` using AND. */
  where?: SQL;
}

export interface PaginationMeta {
  /** The page returned (1-based). */
  page: number;
  pageSize: number;
  /** Rows matching the filters, across all pages. */
  totalItems: number;
  /** 0 when nothing matches. */
  totalPages: number;
}

/** One page of results: { items: [...], meta: { page, pageSize, totalItems, totalPages } } */
export interface Paginated<Item> {
  items: Item[];
  meta: PaginationMeta;
}
