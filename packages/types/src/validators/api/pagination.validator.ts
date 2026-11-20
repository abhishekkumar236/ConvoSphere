import { z } from "zod";

/**
 * ?page=2&pageSize=20 from the URL. Query values are strings, so they are coerced to numbers.
 * Missing → page 1, 10 items. Invalid (page=0, pageSize=500, page=abc) → 400.
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
