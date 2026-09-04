import { z } from "zod";
import { paginationQuery } from "./common.js";

export const listCustomersQuery = paginationQuery.extend({
  type: z.enum(["retail", "wholesale"]).optional(),
  sort: z
    .enum(["createdAt", "-createdAt", "name", "-name", "orders", "-orders"])
    .default("-createdAt"),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuery>;
