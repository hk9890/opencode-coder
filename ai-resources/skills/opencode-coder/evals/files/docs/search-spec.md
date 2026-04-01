## Search endpoint requirements

We need a product search endpoint for the webshop backend.

### Scope

- Full-text search over product title and description.
- Faceted filtering by:
  - category
  - price range (min and max)
- Pagination with deterministic ordering.

### Open questions

- Should out-of-stock products be included by default?
- What is the default sort order when no relevance score is available?
- What are the maximum page size and API rate limits?

### Non-goals

- No recommendation engine work in this phase.
- No frontend UI work in this phase.
