# SWISSCHART AI OS — HISTORY

Status: ACTIVE HISTORICAL INDEX — NON-AUTHORITATIVE FOR CURRENT STATE
Last Updated: 2026-08-16

> **HISTORY IS NON-AUTHORITATIVE FOR CURRENT STATE.**
>
> This file records completed milestones, evidence, incidents and architecture evolution. Its historical use of “current,” “next,” “pending” or “authorized” cannot override `03_CURRENT_STATE.md`, `04_NEXT_ACTION.md` or active rules in `02_ARCHITECTURE.md`.

Detailed original evidence is preserved under `archive/`.

## 2026-08-12 — Core Telegram, Notion and Publishing Foundations

- Established the single production Telegram publishing path through Publishing Agent and Telegram Service.
- Centralized the Swisschart Telegram footer.
- Corrected logical `trading_journal` resolution behind the Notion capability boundary.
- Production-proved the Notion → Performance Summary → approval → Publishing Agent → Telegram flow.
- Established initial Task, approval, Journal, Publishing and capability foundations.

## 2026-08-13 — Central Assistant and Founder Telegram Interface

- Connected the private Founder Telegram interface to the existing Central Swisschart Assistant.
- Preserved Capability Gateway as the authority boundary and Publishing Agent isolation.
- Production-proved Founder Telegram conversation, adaptive Max Consecutive Losses analysis and safe missing-data behavior.
- Verified polling recovery, graceful shutdown and private Founder authorization.
- Approved the ADR that Telegram is an interface to the Central Assistant, not a separate Assistant.

## 2026-08-14 — Secure Cloud Runtime and Railway

- Added the root production command, native HTTP runtime, `/health` and authenticated MCP endpoint.
- Exposed exactly one semantic tool, `swisschart.query`.
- Deployed service `swisschart-read-only` to Railway and proved real Notion-backed read/analysis execution.
- Verified authentication rejection, mutation rejection, safe logs, restart survival and laptop-independent operation.

## 2026-08-14 — Claude OAuth and Persian E2E

- Added the Founder-only OAuth/PKCE bridge while preserving the internal bearer boundary.
- Connected Claude.ai and completed five real Persian Notion-backed trading queries.
- Confirmed structured Claude calls use the Assistant/Gateway path and bypass OpenAI Request Understanding.

## 2026-08-14 — OAuth Durability

- Added atomic file-backed OAuth state persistence on the managed Railway `/data` Volume.
- Persisted clients, transactions, codes and hashed token records without raw tokens or Founder credentials.
- Configured `/health` as the platform health check.
- Proved one OAuth token survived restart and redeploy.
- Retained the known single-replica coordination limitation.

## 2026-08-14 — Mission 6 Founder Operations Audit

- Audited New York periods, Signal→Notion, Signal→Telegram, scheduling and approval safety.
- Defined provider-neutral period/time contracts, immutable prepared actions, approval boundaries, durable idempotency and conservative uncertainty handling.
- Identified unsafe legacy direct execution paths and test isolation weaknesses.
- Performed audit/design only; no mutation path was enabled by Mission 6.

Detailed evidence: `archive/missions/12_MISSION_6_FOUNDER_OPERATIONS_AUDIT.md`.

## 2026-08-14 — Mission 7 New York Period Contract

- Implemented Period Contract `1.0`, `America/New_York` boundaries, Monday weeks, half-open ranges, `period=all` and explicit Founder-inclusive ranges.
- Moved Notion filtering to normalized provider-neutral boundaries.
- Deployed schema `2.0` and production-proved real Notion periods plus Persian explicit-range Claude E2E.

## 2026-08-14/15 — Mission 8 Founder-Approved Notion Signal

- Implemented provider-neutral Signal Draft validation, immutable prepared actions, explicit Founder approval, Capability Gateway execution and durable replay/idempotency.
- Production-proved one approved Notion signal creation and no-duplicate replay.
- Replaced the initial hash-style test identifier with canonical `SCT-YYNN`, using the New York year and annual sequence.
- The Founder corrected the isolated `TSC-2645` typo and approved correction of the test record to `SCT-2646` after uniqueness verification.
- Added Notion `Trade Sequence`, verified all 46 production rows and sorted only the primary `Untitled` view ascending. The verified tail was `SCT-2644`, `SCT-2645`, `SCT-2646`.

Detailed evidence:

- `archive/missions/13_MISSION_8_FOUNDER_APPROVED_NOTION_SIGNAL.md`
- `archive/evidence/14_NOTION_TRADE_SEQUENCE_ORDERING.md`

## 2026-08-15/16 — Mission 9 Founder-Approved Telegram Signal

- Implemented separate immutable Telegram signal prepare/approve actions behind Capability Gateway.
- Production-proved original SCT-2646 publication and replay with Telegram message ID `590`.
- Corrected canonical behavior to one Risk Management → Signal two-message bundle with durable per-message state, recovery and uncertain-delivery hold.
- Added conversational partial validation, one-field intake, instrument normalization and the explicit no-TP-generation-rule behavior.
- Deployed schema `4.4` routing metadata so exact standalone `Signal` / `سیگنال` discovers `signal_intake_start` without generic meaning clarification.
- A real Founder Claude E2E created legitimate active `SCT-2647` in Notion and separately approved one two-message Telegram bundle.
- Logs proved one Notion execution, exactly two ordered Publishing Agent sends, no third send, no duplicate, no `SCT-2648`, no approval bypass and no Scheduler involvement.
- Telegram provider message IDs for the final two-message proof remain unknown; this limitation was not guessed away.

Detailed evidence: `archive/missions/15_MISSION_9_FOUNDER_APPROVED_TELEGRAM_SIGNAL.md`.

## 2026-08-16 — Repository Hygiene Incident and Recovery

- A broad cleanup regression mistakenly executed a legacy file named as a test with `testMode: false` and live credentials.
- It sent two unintended Telegram messages and created an unintended GBPUSD fixture titled `SCT-2647` outside the v4.4 approval boundary.
- The Founder manually removed the Telegram messages.
- After exact page re-verification and explicit Founder authorization, only the unintended Notion page `3be12820-1365-81b0-b005-d6e5ff392f2a` was archived.
- A later legitimate, separately approved live Founder workflow created a different active `SCT-2647`, page `3be12820-1365-8122-8758-d05fbd660bc9`.
- The incident established the permanent rule that filenames do not prove test safety and broad legacy/manual test discovery must not be used without isolation review.

## 2026-08-16 — Safe Git Baseline

- Audited the repository after discovering that only five placeholder files were tracked.
- Strengthened `.gitignore`, performed a repository-wide secret audit and created a complete local baseline without pushing.
- Confirmed credentials, `.env`, OAuth state, runtime persistence, logs and generated artifacts remain excluded.

## 2026-08-16 — Configurable Market-Session Messaging Codex 1/3 and 2/3

- Designed scheduling as an extension of existing AutomationManager, Scheduler, Event, Task, Gateway and Publishing paths rather than a parallel system.
- Selected injected SQLite on the existing Volume for transactional revisions, approvals, occurrence claims and recovery in the current single-service architecture.
- Implemented schema `4.5` locally with IANA/Temporal DST handling, schedule management, durable occurrence state, suppression/misfire boundaries and Task authorization.
- `test:schedules` and `test:cloud` passed.
- Nothing was deployed, no schedules/templates were created, and Scheduler remained disabled.

Detailed design: `archive/designs/17_CONFIGURABLE_MARKET_SESSION_MESSAGING_DESIGN.md`.

## 2026-08-16 — Approved Architecture Formalization

- Founder and Architecture Reviewer approved **Top-Down Architectural Definition + Bottom-Up Capability Completion**.
- Formalized dependency-graph semantics, logical-versus-physical separation, optional Agents, parallel concerns, canonical ownership, Operational State versus Memory, analytics/identity principles, evidence-driven implementation and independent capability completion.
- Preserved all existing Central Assistant, Gateway, provider-neutral, approval, idempotency and Scheduler boundaries.

Original ADR evidence: `archive/decisions/18_TOP_DOWN_ARCHITECTURAL_DEFINITION_BOTTOM_UP_CAPABILITY_COMPLETION.md`.

## 2026-08-16 — Mission 3B Project Brain Consolidation

- Preserved a pre-existing non-clean worktree: `main` at `81bcf630982964abb6d2561bd2d1f9d788592c50`, three commits ahead of `origin/main`, with approved Brain/ADR changes and a separately modified non-authoritative Brain ZIP.
- Consolidated 17 fragmented active Brain files into six canonical active documents.
- Established `00_START_HERE.md` as the mandatory repository entry point.
- Separated current truth, authorized continuation, architecture, durable context and history.
- Moved Mission, design, ADR, evidence, Session, Roadmap and superseded status documents into an explicitly non-authoritative archive without deleting historical evidence.
- Updated agent and human entry instructions and preserved all production/local distinctions, safety boundaries and deferred decisions.

## 2026-08-16 — Missions 4A and 4B Repository Safety

- Mission 4A performed a read-only repository architecture audit and found the production cloud/Gateway path fundamentally aligned, with cleanup required around legacy/manual execution paths.
- Mission 4B neutralized only the four confirmed P0 hazards locally; broader P1/P2/P3 cleanup remains incomplete.
- Removed ordinary Assistant reachability to the legacy combined Signal → Telegram → Notion executor and added explicit manual-only, provider-specific authorization guards to the retained legacy module.
- Moved three production-capable scripts out of ordinary test locations into `manual/external/`; they fail closed unless an explicit production target and action-specific confirmations are supplied.
- Changed the legacy root entrypoint so JSON-backed Scheduler execution is disabled unless explicitly opted in.
- Added conservative Telegram delivery certainty: confirmed sends complete, provably definite-not-sent outcomes may retry, and all ambiguous outcomes are durably held for reconciliation without resend.
- Corrected the active Agent Registry policy reference from the archived `04_RULES.md` path to canonical `02_ARCHITECTURE.md`.
- Static P0 safety, cloud regression and schedule regression suites passed without external access or production/business mutation.

## 2026-08-16 — Mission 4C P1 Authority and Architecture Cleanup

- Added explicit per-operation read, governed-mutation and internal/delegated policies to the Capability contract.
- Made Capability Gateway fail closed for governed mutations unless declared approval, approved-mutation, payload-binding and idempotency authority is present; retained capability-local validation.
- Classified Notion signal creation, Telegram signal publication and approved schedule revisions as governed mutations while keeping read operations unaffected.
- Extended provider-neutral Trading Data with canonical Trade-ID reference resolution and removed all Notion/provider knowledge from Telegram Signal Capability.
- Routed ordinary fallback Telegram publication into the Gateway/Task lifecycle and fail-closed legacy raw approval, direct publishing, AutomationManager mutation and performance-publication routes.
- Added local SQLite Schedule Management composition without constructing or activating Scheduler runtime.
- Preserved approved schedule authorization through Event/Rule evaluation and completed deterministic occurrence finalization for completed, held, safely retryable and delivery-uncertain outcomes.
- Focused P1 authority, P0 safety, cloud and schedule suites passed using mocks and temporary local state. No production system or credential was accessed and no business mutation occurred.
- Repository Architecture Cleanup remains incomplete only for separately scoped P2/P3 debt; Codex 3/3 and Mission 10 remained stopped.

## 2026-08-16 — Mission 4D P2 Maintainability and Legacy Cleanup

- Removed only caller-verified dead/orphan implementations: the old simple Scheduler, unused configuration/Agent-contract placeholders, Trade Lifecycle workflow, obsolete Journal automation capability and signal formatter, orphan Content Agent, legacy automation intent handler, duplicate performance/publication workflows and formatter, and their implementation-specific tests.
- Removed legacy Notion Agent composition from normal Assistant/cloud runtime. The legacy Notion and Journal Agents remain documented, isolated compatibility/manual components; active Trading/Signal access stays behind provider-neutral capabilities and Notion Service.
- Removed the fallback Telegram interface's dependency on the legacy Journal Agent's private `node_modules`; `dotenv` is now an explicit root dependency.
- Renamed the JSON Automation store to `legacyJsonAutomationStore.js` and documented it as legacy/manual compatibility. Schema 4.5 continues to inject SQLite and explicitly disables JSON persistence.
- Preserved historical Assistant/Task/Event blueprints and Journal design material under the explicitly non-authoritative `08_Documents/archive/` tree.
- Preserved the stale non-authoritative Project Brain ZIP under `09_Backup/`, removing its adjacency to active Project Brain authority without regenerating or deleting it.
- Added a focused P2 maintainability regression. P0 safety, P1 authority, cloud, schedule and focused P2 suites passed using local/mock state only.
- No production system, external provider, credential or business data was accessed or mutated. Codex 3/3 remained unstarted and Mission 10 remained stopped.
- Repository Architecture Cleanup now retains only separately scoped P3 organization/naming decisions.

## 2026-08-16 — Mission 4E P3 Organization and Naming Review

- Renamed the active Publishing Agent entry from misleading `index02.js` to `publishingAgent.js` and updated its three callers.
- Renamed `readOnlyComposition.js` and `createReadOnlyComposition` to `cloudComposition.js` and `createCloudComposition` because the composition now includes explicitly governed mutation and schedule-management capabilities; no runtime policy changed.
- Removed eight verified-empty, unreferenced directories, including obsolete future-domain placeholders. Kept active archives, backups, data locations and all non-empty operational directories.
- Deliberately retained `01_Core`, `02_Core` and the remaining numbered active filenames because a broad rename would create import churn without improving authority, behavior or safety. Updated `AGENTS.md` to explain the physical roots without treating them as a mandatory logical pipeline.
- P0, P1, P2, cloud and schedule suites passed; broken relative imports were zero and active old-path references were zero outside negative regression assertions.
- No production system or business data was accessed or mutated. No deployment, commit or push occurred; Codex 3/3 remained unstarted and Mission 10 remained stopped.
- Repository Architecture Cleanup findings P0 through P3 are closed. A combined Repository Cleanup Closeout / Git Review is required before commit strategy or feature continuation.

## 2026-08-16 — Repository Cleanup Closeout / Git Review

- Reviewed and classified the complete combined Mission 3B/4B/4C/4D/4E worktree; every changed path belonged to the approved consolidation, safety, authority, maintainability, naming, regression, dependency or archival scope, with zero unrelated/unknown paths.
- Verified no credential values, `.env` files, OAuth/action state, SQLite/database/WAL/SHM files, logs, caches, temporary outputs, `node_modules` or backup artifacts entered the commit. Hardened `.gitignore` for database sidecars and removed the obsolete root Brain ZIP exception.
- Verified exactly six active canonical Project Brain files plus the explicitly non-authoritative archive, preserved architecture boundaries, found zero broken relative imports and zero stale active runtime/config references.
- Final P0 safety, P1 authority, P2 maintainability, cloud and schedule suites passed; `git diff --check` passed.
- Committed the consolidated cleanup phase locally as one cohesive commit. Nothing was pushed or deployed, no production/business system was accessed or mutated, Codex 3/3 remained unstarted and Mission 10 remained stopped.
## 2026-08-16 — Configurable Market-Session Messaging Production Completion

- Completed the Configurable Market-Session Messaging Production work.
- Finalized five Founder-approved recurring market-session Telegram messages covering London and New York session timing.
- Combined the New York pre-close message with the Swisschart end-of-trading-day message, resulting in five weekday schedules.
- Preserved the canonical Swisschart HTML footer in all Telegram templates:
  `<a href="https://linktr.ee/swisschart">Swisschart Links</a>`.
- Verified weekday filtering, IANA timezone handling and DST-aware schedule resolution.
- Production schedule state was persisted in `/data/schedules.sqlite` on the Railway persistent Volume.
- Railway initially selected Node 20, which did not provide the required `node:sqlite` module.
- Raised the Node requirement to Node 22 and successfully redeployed Production.
- Added a guarded manual Production seed utility.
- Seeded the five approved schedules into Production initially disabled for verification.
- Inspected the persisted schedules and verified their text, triggers, timezones and next occurrences.
- Wired Production Cloud Runtime to the durable scheduling execution path:
  `AutomationSchedulerBridge → SchedulerRuntime → Event Engine → Task Engine → PublishingAgentExecutor → Publishing Agent → Telegram`.
- `test:cloud` and `test:schedules` passed after the Production Scheduler wiring.
- Enabled `SCHEDULER_ENABLED` in Production.
- Enabled all five market-session schedules.
- Production inspection confirmed all five at `enabled=true`, revision `2`.
- Railway remained Online and `/health` passed after deployment.

Relevant commits:

- `fcf6903` — Add configurable market session schedules
- `6d6f09e` — Require Node 22 for SQLite runtime
- `62f4234` — Add guarded market session seed script
- `1a96789` — Wire production scheduler runtime

## 2026-08-16 — First Founder-Created Production Schedule Through Claude

- Tested Founder-configurable scheduling through the real Claude → Swisschart AI OS integration.
- Founder requested a Sunday Telegram message five minutes before the weekly Forex market open.
- Claude checked existing schedules and confirmed that no duplicate existed.
- The new schedule was prepared and previewed before approval.
- Founder reviewed and corrected message formatting, blank lines, HTML footer, timezone and trigger configuration.
- Final schedule ID:
  `market.weekly.forexopen_preopen_5m`.
- Final persisted configuration:
  - Sunday / ISO weekday `7`
  - `session_relative`
  - New York session open boundary
  - offset `-5 minutes`
  - `16:55 America/New_York`
  - destination `telegram.primary`
  - template revision `1`
  - enabled `true`
  - approval status `approved`
  - persisted revision `1`
- The exact approved message is:

```text
The market opens in 5 minutes

A new trading week is about to begin
Wishing all traders a focused, disciplined and successful week ahead

As precise as a Swiss watch

<a href="https://linktr.ee/swisschart">Swisschart Links</a>