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
