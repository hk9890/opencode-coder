Let me read the spec first.

The file doesn't exist at that path. Let me check if it's somewhere else in the repo.

The file `docs/search-spec.md` doesn't exist in this repository. I can't proceed with creating the epic and tasks based on a spec that isn't there.

To move forward, you have a couple of options:

1. **Create the file** — drop `docs/search-spec.md` into the repo with the spec details, and I'll read it and create the epic + tasks.
2. **Paste the contents here** — share the spec text directly in the chat and I'll work from that.
3. **Give me the details verbally** — describe the requirements (tech stack, API contract, DB, auth, etc.) and I'll create the issues from what you tell me.

The three things you mentioned (full-text search, faceted filtering by category + price range, pagination) give me enough for the broad shape, but before a developer can start I'd also need clarity on things like:
- What database/search engine (Postgres `tsvector`, Elasticsearch, Typesense, etc.)?
- REST or GraphQL?
- Auth requirements on the endpoint?
- Expected response shape and field list?
- Performance/latency targets?

Without that, some tasks would need to be flagged for human decision (`bd human`) rather than marked ready. Let me know how you'd like to proceed.
