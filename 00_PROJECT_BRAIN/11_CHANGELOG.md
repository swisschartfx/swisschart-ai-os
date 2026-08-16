# CHANGELOG — APPEND-ONLY CONTINUATION

The prior changelog remains preserved in `00_PROJECT_BRAIN.zip`. This loose append-only continuation was initialized during phase closure because the protocol-named file was not present in the working Project Brain directory.

---

## 2026-08-13 — Central Assistant + Founder Telegram Interface Phase Closure

### Completed Milestone

- Central Swisschart Assistant is reachable through the private Founder Telegram interface
- Telegram interface delegates to the existing `SwisschartAssistant`
- Capability Gateway remains the authority boundary
- Fixed Trading Analytics route is operational
- Adaptive General Trading Analysis is operational beyond hard-coded analytical metric names
- Missing-data planning and safe `missing_data` behavior are operational
- Publishing Agent remains isolated from the Founder Telegram chat interface

### Founder-Confirmed REAL E2E Proofs

- Founder Telegram → Assistant → Telegram response succeeded
- Adaptive Max Consecutive Losses analysis succeeded with sufficient real data
- Adaptive Max Drawdown analysis detected insufficient schema, reported exact missing requirements and invented no result
- Telegram polling recovered after a temporary network error
- Ctrl+C graceful shutdown succeeded

### Runtime Hardening Verified

- Private Founder authorization
- Long polling
- Same-chat responses
- Controlled network retry
- Graceful shutdown
- Duplicate in-process start protection
- Long-response truncation safeguard

### Final Local / Mock Regression

- PASS — 12/12 selected relevant tests
- No REAL OpenAI, Telegram or Notion API calls occurred

### Phase Status

Central Assistant + Founder Telegram Interface phase: COMPLETE

Next existing roadmap milestone: Market Intelligence / production-ready Market News and Forex Factory integration through existing architecture.

---

## 2026-08-14 — Cloud Runtime + Secure Read-Only MCP

- Added root `npm start` production command and Node version declaration
- Added Railway-compatible native HTTP runtime and `GET /health`
- Added authenticated Remote MCP endpoint with one `swisschart.query` tool
- Restricted the cloud edge to allowlisted read/analyze operations
- Delegated structured MCP calls through `SwisschartAssistant.handle(object)` and the existing Capability Gateway
- Kept OpenAI Request Understanding out of Claude-originated structured execution
- Removed unnecessary eager loading of local signal/publishing dependencies from read-only Assistant composition
- Preserved Telegram polling and production publishing paths
- Added coordinated shutdown and safe structured runtime logging
- Added focused cloud/MCP tests; all focused tests and 11 relevant regression suites passed without external API calls

---

## 2026-08-14 — Railway Deployment + Real Backend E2E

- Added safe Railway upload exclusions to `.gitignore`
- Created Railway project and read-only service
- Configured environment-only Notion and Founder bearer credentials without recording values
- Deployed the existing runtime successfully through `npm start`
- Created and verified Railway-managed HTTPS endpoint
- Proved health, MCP initialization, one-tool discovery and authentication enforcement
- Proved real Notion trading summary, Trading Analytics and General Trading Analysis execution
- Proved all required write/mutation/interface attempts are rejected
- Proved restart survival and post-restart real Notion access
- Confirmed production logs contain no credentials or full trading records
- Identified Claude.ai OAuth compatibility as the remaining blocker; static bearer access was not weakened

---

## 2026-08-14 — Claude OAuth Bridge + Real Persian E2E

- Added a minimal Founder-only OAuth bridge isolated in the Cloud Secure Edge
- Added OAuth discovery, dynamic client registration, exact redirect allowlisting, PKCE S256 and expiring authorization artifacts
- Stored access-token records as hashes and preserved the internal bearer boundary
- Kept MCP exposure to exactly one tool, `swisschart.query`
- Added five semantic read/analyze queries mapped server-side to existing Assistant and Capability Gateway paths
- Fixed Claude's initial operation rejection in the Secure Edge without changing business logic
- Deployed and connected Claude.ai successfully through OAuth
- Completed 5/5 real Persian E2E tests against Notion-backed Trading Data, Trading Analytics and General Trading Analysis
- Confirmed Claude calls bypass `LLMRequestUnderstanding`
- Reconfirmed authentication, mutation rejection, safe logs, health and restart survival

---

## 2026-08-14 — Mission 5 Production OAuth Durability

- Added atomic file-backed OAuth state persistence with restrictive permissions
- Persisted clients, authorization state/codes and hashed token records without raw tokens or Founder credentials
- Attached a managed Railway Volume at `/data` to the existing read-only service
- Added the `SWISSCHART_OAUTH_STATE_FILE` runtime variable name
- Configured Railway platform health checking explicitly to `/health`
- Documented Founder credential rotation, global revocation and Claude connector reauthorization
- Added restart-reconstruction and secret-absence tests
- Deployed to the existing service and proved one token survived restart and redeploy
- Reconfirmed one-tool MCP exposure, structured Request Understanding bypass and production write rejection
- Preserved all business capabilities, Gateway, Notion provider and Telegram fallback behavior

---

## 2026-08-14 — Mission 6 Founder Operations Audit and Design

- Audited current period/timezone assumptions and all requested Founder operational paths
- Classified natural periods as missing and Signal/Notion, Signal/Telegram, Scheduler and Approval foundations as partial
- Designed the provider-neutral New York Period Contract and DST rules
- Documented existing reusable Signal, Journal, Publishing, Scheduler, Task and Approval components
- Documented production blockers, schema requirements, idempotency and durable audit requirements
- Defined explicit Founder approval boundaries for Notion creation, immediate/scheduled Telegram publication, edits and cancellation
- Recommended a read-only Mission 7 period/timezone implementation before any mutation capability
- Ran affected mock/read-only tests; no external mutation or production Scheduler execution occurred
- Recorded legacy Notion assertion drift and Automation Bridge shared-store pollution; no local records were deleted without Founder authorization

---

## 2026-08-14 — Mission 7 New York Period Contract

- Added Period Contract `1.0` with ten supported presets and explicit Founder-inclusive date ranges
- Standardized business date boundaries on `America/New_York`, Monday weeks and half-open intervals
- Added injected-clock, month/year boundary, UTC crossover and DST validation tests
- Mapped normalized New York local dates to Notion `on_or_after`/`before` filters
- Extended existing read-only Trading Data, Trading Analytics and General Trading Analysis paths
- Updated the sole public `swisschart.query` schema to semantic `query + period` inputs without internal names
- Preserved compatibility for cached Mission 4 current-month requests while requiring periods for the new semantic contract
- Added secret-safe MCP initialize/tools-list schema-version diagnostics
- Deployed schema `2.0` to the existing Railway service and proved direct real Notion-backed reads across required periods
- Diagnosed Claude's stale tool definition as a conversation-level schema snapshot, not stale Railway deployment or OAuth client state
- Proved the refreshed schema in a new Claude conversation with a successful Persian explicit-range E2E request
- Reconfirmed Cloud/OAuth, Gateway, Trading, General Analysis, Notion filtering and Telegram regressions
- Kept OAuth persistence, one-tool exposure and all production read-only restrictions intact

---

## 2026-08-14 — Mission 8 Founder-Approved Notion Signal Creation

- Added Signal Draft contract `1.0` with server-side normalization and validation
- Added immutable SHA-256 approval binding for signal content, fixed destination and metadata
- Added durable prepared-action and idempotency state on the existing Railway Volume
- Added dedicated approval-required Notion Signal capability behind Capability Gateway
- Added semantic prepare/approve operations inside the sole `swisschart.query` MCP tool
- Preserved Claude structured bypass and Mission 7 query compatibility
- Deployed to the existing Railway service and proved unapproved rejection
- Created exactly one Founder-approved Notion test signal and verified the page
- Proved replay returns the same result without a duplicate Notion create
- Confirmed Telegram publishing, scheduling and unrelated mutation paths remain disabled

### Mission 8 corrective patch

- Diagnosed a `TSC-2645` typo; Founder corrected it and established SCT-N as the only authoritative format
- Replaced hash-style signal IDs with paginated, serialized next-`SCT-N` allocation
- Corrected allocation to canonical year-based `SCT-YYNN` with `America/New_York` year resolution and annual reset
- Added New York New Year rollover, invalid-prefix, concurrency and year-exhaustion tests
- Added the approved SCT-YYNN-derived `Trade Sequence` formula to the real journal
- Verified all 46 computed values and sorted only the primary `Untitled` view ascending
- Proved the production sorted tail is `SCT-2644`, `SCT-2645`, `SCT-2646`
- Added malformed-ID, max-2645, concurrent allocation and replay/restart coverage
- Inspected four Notion views and confirmed all have no configured sorts
- Deployed the corrected allocator without changing the existing incorrect record or any view
- After explicit Founder approval, rechecked uniqueness and corrected only the existing test page title to `SCT-2646`
- Verified the page identity and every non-title property remained unchanged; no view was modified

---

## 2026-08-15 — Mission 9 Founder-Approved Telegram Signal Publishing

- Added immutable preparation and Founder approval binding for exact signal content, destination, reference and metadata
- Added durable replay/idempotency state on the Railway Volume
- Added an approval-required Telegram Signal capability behind Capability Gateway
- Reused the existing Publishing Agent and Telegram service
- Extended the sole semantic `swisschart.query` tool without exposing internal names
- Configured existing Telegram environment credentials on Railway without recording secret values
- Deployed to the existing service and published SCT-2646 exactly once after explicit approval
- Verified replay returned the same Telegram message ID without a duplicate post
- Confirmed Mission 7/Mission 8 regressions and zero Scheduler activity

### Mission 9 corrective two-message bundle

- Reused the canonical existing Risk Management template instead of inventing wording
- Bound Risk Management text, signal text, exact destination, signal reference, metadata and send order into one approval hash
- Added durable per-message delivery state, risk-first execution and missing-signal-only recovery
- Added zero-send completed replay, concurrent-approval serialization and uncertain-delivery hold behavior
- Removed all partial Mission 10 scheduling work and kept Scheduler disabled
- Deployed corrective schema `4.1` without sending a real corrective Telegram bundle

### Mission 9 conversational signal intake hardening

- Added non-mutating `signal_validate` to the sole public `swisschart.query` tool
- Allowed empty/partial signal snapshots while keeping all nine fields mandatory for preparation
- Added exact missing-field and invalid-field responses with no inferred values
- Added normalized complete summary and explicit next-action metadata
- Preserved separate Notion creation approval and Telegram bundle approval
- Added progressive collection, correction, no-fabrication, normalized summary and approval-separation tests
- Deployed schema `4.2` and proved empty, partial and complete validation without external mutation

### Founder signal UX schema 4.3

- Added semantic `signal_intake_start` for the Swisschart-specific Signal/سیگنال domain intent
- Added one-field preferred collection order with multi-field snapshot acceptance
- Added provider-neutral Instrument Normalizer with Persian and English aliases
- Added explicit unknown-asset clarification without guessing
- Audited legacy workflow and documented that no authoritative TP-generation rule exists
- Kept TP1/TP2/TP3 Founder-supplied and exposed the gap instead of inventing a formula
- Reused existing deterministic Stop Size, R:R, grade and formatting calculations
- Preserved separate Notion and Telegram approvals, SCT-only IDs and risk-first Telegram bundle
- Deployed only non-mutating intake/normalization hardening; no SCT-2647 or message was created

---

## 2026-08-15 — Session Closeout

- Closed the session with production on healthy schema `4.3`, deployment `ca6b9033-8702-467a-b845-38be252e7db7`
- Recorded the SCT-YYNN/New York contract, canonical tail and absence of SCT-2647
- Recorded completed Notion ordering and the still-open Mission 9 corrective Telegram proof
- Recorded provider-neutral EURUSD/GBPUSD/XAUUSD aliases and the intentional TP-rule gap
- Recorded the live Claude failure to route `Signal / سیگنال` directly to `signal_intake_start`
- Set the next task to non-mutating MCP semantic-routing/tool-description hardening
- Confirmed Mission 10 remains stopped and partial implementation was removed
- Added `16_SESSION_HANDOFF_2026-08-15.md` for zero-context-loss continuation
- No deployment, Notion mutation, Telegram action, SCT creation or production behavior change occurred during closeout
