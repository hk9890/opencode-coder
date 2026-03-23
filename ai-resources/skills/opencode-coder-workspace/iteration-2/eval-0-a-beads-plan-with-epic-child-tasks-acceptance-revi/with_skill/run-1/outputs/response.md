Now let me read the spec file.

The file `docs/search-spec.md` doesn't exist in this repository. Since this task is clearly about a different (user's webshop) project, I'll proceed with the information you've described directly: full-text search over products, faceted filtering by category and price range, and pagination.

Before I create the plan, I need to flag a few open questions that would block a developer from starting without guessing:

**Questions that need answers before tasks can be fully specified:**

1. **Search backend** — What technology will power full-text search? (e.g., PostgreSQL `tsvector`, Elasticsearch/OpenSearch, Typesense, MeiliSearch, or in-database `LIKE`?) This changes every implementation task.
2. **API style** — REST (`GET /products/search?q=...`) or GraphQL? What's the existing API convention?
3. **Pagination style** — Offset/limit or cursor-based? What's the max page size?
4. **Price range facets** — Are the price buckets dynamic (from data) or fixed tiers (e.g., $0–25, $25–100, $100+)?
5. **Authentication** — Is the search endpoint public or does it require auth?
6. **Category taxonomy** — Is `category` a flat list or a tree? Does filtering support multi-select?
7. **Existing data model** — What does the `products` table/collection look like? (fields, ORM, DB engine)

---

Given that the spec file is missing and these architectural questions are unresolved, the correct beads pattern is to create the epic + a `needs:discussion` planning/scoping task that blocks everything else, so developers don't pick up work prematurely.

Shall I go ahead and create the epic with a `needs:discussion` scoping task now? Once you answer the questions above (or point me to the actual spec), I can create the full set of implementation tasks with proper instructions and acceptance criteria.
