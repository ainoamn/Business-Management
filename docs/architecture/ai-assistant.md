# AI assistant and accounting

The assistant is disabled until a platform administrator configures a provider credential and a model, and an organization administrator explicitly enables selected models and consents to sending context to their provider endpoints. No model identifier, vendor price or usable credential is seeded. Provider prices are administrator supplied reference values in USD, not an invoice or a payment transaction.

## Access and context

`/platform/ai` manages connections, models, bounded usage, additional credit grants and uncertain usage reconciliation. `/app/settings/ai` controls organization policy, monthly vendor spending and per-member daily credit limits. `/app/ai` contains private conversations, estimates, source citations and proposals. Tasks, projects, meetings, documents, requests and reports link to a selected context.

Context comes from actual resource services, intersected with the caller's resource permissions and AI scope. References are checked again before dispatch, on history reads and before a draft is confirmed. Permission loss hides historical content. Private conversations, messages, requests and drafts have owner-specific forced PostgreSQL RLS; platform administration exposes accounting metadata through narrow functions rather than conversation text. There is no arbitrary SQL or tool execution supplied by a model. Credential-like text is redacted, but this is not a guarantee of detecting all business secrets: users must select appropriate context.

Local PDF.js text extraction runs in a bounded child process with an environment stripped of application secrets and limited filesystem access. This is defense in depth, not an operating-system sandbox. PDFs without extractable text are reported as unavailable for summarization; no OCR is claimed. Office and text documents use the document module's bounded, non-executing preview extractors. Context limits and omitted history are disclosed.

## Dispatch and pricing

The browser first obtains an estimate and explicitly approves its maximum credits and estimated USD amount. The server computes a conservative token bound from the complete encoded input, including instructions and output schema. Reservation locks enforce plan credits first, then extra wallet credits, the organization spending cap, provider spending cap and concurrency limits. Model, price, prompt revision and endpoint snapshots cannot change after reservation.

The real HTTP adapters support OpenAI Responses and compatible chat completions with strict JSON schema output and `store:false`. There are no automatic model retries. The same member/client key with the same normalized body returns the existing request. Provider usage is validated against reserved bounds; actual reported tokens determine the charge. Unused reservation is released. A known rejected request with no consumption charges zero. Invalid output with known usage still charges that known usage.

A durable provider receipt is written before accounting settlement. Settlement atomically records usage, consumes wallet/plan credit, writes the append-only ledger and saves any assistant message and proposals. Receipt accounting can retry without another provider call. An ambiguous network failure or untrustworthy usage becomes `UNCERTAIN`, retaining the reservation. Administrators must verify provider records before final reconciliation; a reason is audited, including verified zero-use outcomes. A durable receipt prevents manual settlement from overriding recorded usage.

## Human confirmation and privacy

Proposals cannot approve tasks, minutes, requests, spending or payments. A member reviews task/project details, then explicitly confirms creation. Confirmation and business creation share one transaction and draft version check, so repeated confirmation cannot create a second record. Full reviewed project plans can create phases, tasks with earlier-task dependencies, risks and a planning brief, subject to each domain permission.

Content erasure is irreversible: it removes prompts, answers, proposal text and context references while preserving token/cost accounting and already confirmed business records. Erasure during an in-flight provider call prevents late answers and proposals from restoring deleted content. The external provider's retention/deletion policy remains a separate matter; `store:false` is a request option, not a promise about all vendor logging.

## Secrets and verification

Credentials use AES-256-GCM with per-provider/version associated data and a separately managed 32-byte key. Development may create the ignored `.local/secrets/ai.key`; deployed environments require an explicit secret file or environment key. Losing it makes existing credentials undecryptable. Back it up separately from database exports, and never include it in repository artifacts or browser configuration.

`tests/integration/work-ai.test.ts` provisions a separate local PostgreSQL database and exercises actual HTTP adapters against an explicitly local contract simulator, real authentication, RLS, accounting, confirmation and erasure. `tests/browser/ai.verify.mjs` exercises actual forms and links. These fixtures do not prove access to a live paid provider. Live validation requires the site's own configured credential, reviewed provider/model pricing and organization consent.
