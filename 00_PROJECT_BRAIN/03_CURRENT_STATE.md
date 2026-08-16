# SWISSCHART AI OS — CURRENT STATE

Status: ACTIVE — ONLY CANONICAL CURRENT TRUTH
As Of: 2026-08-16

This document states what is true now. Historical snapshots and archived Mission documents cannot override it.

## Production

### Central Assistant and Authority Path

- The Central Swisschart Assistant is implemented and production-proven.
- Claude is the primary Founder conversational interface through the authenticated Remote MCP connection.
- Structured Claude requests execute through `SwisschartAssistant` and Capability Gateway; they do not depend on OpenAI Request Understanding.
- Capability Gateway is the business authority boundary.
- The Founder Telegram interface and the production Publishing Agent path remain separate interfaces/roles around the same Central Assistant architecture.

### Railway and MCP

- Railway project: `swisschart-ai-os`.
- Service: `swisschart-read-only`.
- Server name/version: `swisschart-read-only` `1.1.0`.
- `GET /health` is implemented and configured as the Railway health check.
- Exactly one public MCP tool is exposed: `swisschart.query`.
- Production MCP schema: `4.4`.
- Production schema `4.4` contains the narrow exact standalone `Signal` / `سیگنال` routing metadata for `signal_intake_start` and retains `period=all`.
- Latest documented schema 4.4 deployment: `e0062500-a579-4280-86fe-bf0fbc202e34`, status SUCCESS.
- The production service remains cloud-based and does not depend on the Founder laptop being online.

### Authentication and Durable State

- Claude uses the Founder-only OAuth boundary with PKCE and hashed access-token records.
- OAuth client/token state and durable prepared-action state are persisted on the managed Railway Volume mounted at `/data`.
- Restart and redeploy survival are production-proven.
- Raw access tokens and Founder credentials are not persisted in Project Brain or source.
- Current persistence/coordination is designed for one Railway service replica. Horizontal multi-replica coordination is not implemented.

### Trading Data and Analytics

- Real Notion-backed Trading Data, Trading Analytics and General Trading Analysis are production-proven through Claude in Persian.
- Period Contract `1.0` and `America/New_York` business boundaries are deployed.
- Supported periods include `period=all` and Founder-inclusive explicit ranges.
- Notion remains behind provider-neutral Trading Data boundaries.

### Signal Creation to Notion

- Mission 8's narrowly scoped, Founder-approved Signal creation path is production-proven.
- Signal preparation, immutable payload-hash approval, explicit Founder approval, SCT allocation, Notion creation and replay idempotency are implemented.
- Canonical Trade IDs use `SCT-YYNN` with the New York calendar year and annual sequence.
- Notion `Trade Sequence` ordering is production-complete.
- Generic Notion mutation is not exposed by this capability.

### Signal Publication to Telegram

- Mission 9 is production-complete.
- Notion signal creation and Telegram signal publication remain separate prepare/approve actions.
- The canonical Telegram bundle sends Risk Management first and Signal second through Capability Gateway, Publishing Agent and Telegram Service.
- Durable per-message state, zero-send completed replay, missing-second-message recovery and conservative uncertain-delivery handling are implemented.
- A real Founder Claude workflow production-proved one Notion creation followed by one separately approved two-message Telegram bundle, without approval bypass, duplicate execution or Scheduler involvement.

### Current Trading Evidence

- One legitimate active `SCT-2647` exists from the approved live Founder workflow.
- Notion page: `3be12820-1365-8122-8758-d05fbd660bc9`.
- Created: `2026-08-16T09:56:00.000Z`.
- Verified signal: GBPUSD SELL; Entry `1.34640`; Stop Loss `1.34846`; TP1 `1.32160`; TP2 `1.32100`; TP3 `1.32010`; Risk `1%`; Grade `3`.
- No active duplicate `SCT-2647` and no active `SCT-2648` were found in the recorded production verification.

## Local / Not Deployed

- Mission 4A found the repository fundamentally aligned with cleanup required; repository cleanup remains incomplete.
- Mission 4B P0 safety cleanup is implemented and verified locally, not deployed.
- Mission 4C P1 Authority and Architecture Cleanup is implemented and verified locally, not deployed.
- Mission 4D P2 Maintainability and Legacy Cleanup is implemented and verified locally, not deployed.
- Mission 4E P3 Organization and Naming Review is complete locally. Repository Architecture Cleanup findings P0 through P3 and the combined Closeout/Git Review are complete.
- The consolidated Mission 3B/4B/4C/4D/4E cleanup phase is committed locally as one cohesive change. It has not been pushed or deployed.
- The active Publishing Agent entry module is named `publishingAgent.js`; the cloud capability/runtime composition is named `cloudComposition.js`. All active references use the accurate names.
- Eight unused empty directories left by earlier implementation/removal work were removed. The historical `01_Core` and `02_Core` roots and other numbered active files were deliberately retained because renaming them would add broad churn without behavioral, authority or safety value.
- Normal Assistant/cloud composition no longer loads the legacy Notion Agent, duplicate performance/publication workflows, or the removed Content Agent. Legacy Journal/Notion components remain explicitly isolated for guarded manual compatibility and tests only.
- The fallback Telegram interface now uses the root `dotenv` dependency and no longer reaches into the legacy Journal Agent's private dependencies.
- Schema 4.5 schedule/occurrence state is owned by SQLite. The renamed legacy JSON Automation store remains manual compatibility only and cannot activate scheduling through ordinary startup.
- The tested `SchedulerRuntime` is the sole current scheduling foundation; the unreferenced simple Scheduler implementation and other proven dead/orphan components were removed.
- The current Telegram Signal formatter remains owned by Publishing Agent and preserves TP3, Risk, RR3 and canonical Trade ID output. The unreferenced legacy Journal signal formatter was removed.
- Stale implementation blueprints and legacy Journal design material are preserved under `08_Documents/archive/` as explicitly historical/non-authoritative evidence.
- The stale root Project Brain ZIP was preserved under `09_Backup/` and no longer sits beside active authority.
- Capability declarations now classify each operation as read, governed mutation or internal/delegated execution. Gateway centrally rejects governed mutations without approved-mutation authority, approval verification, and any declared payload-binding/idempotency context; capability-local checks remain.
- Registered governed mutations currently include Notion signal creation, Telegram signal publication, and schedule create/update/delete approval operations. Schedule list/inspect remain reads; schedule preparation and Task-mediated generic Telegram publication are internal/delegated operations that do not directly authorize provider effects.
- Telegram Signal Capability now validates canonical Trade IDs through provider-neutral Trading Data reference resolution and has no Notion service, database-ID, property or record dependency.
- Active legacy Assistant routes for raw Task approval, direct Telegram workflow execution, direct AutomationManager mutation and performance-summary publication are fail-closed. Ordinary Telegram text publication enters the registered `publishing.telegram` capability and Task approval lifecycle through Capability Gateway.
- Local cloud composition can instantiate SQLite-backed Schedule Management and register it with the Gateway without constructing or starting a Scheduler runtime.
- Approved immutable schedule grants survive Event/Rule evaluation without becoming a second pending approval. Durable occurrence states now deterministically distinguish completed, safely retryable pre-publication failure, held non-execution, suppression/skipping and delivery uncertainty.
- `npm.cmd run test:p1-authority`, `npm.cmd run test:p0-safety`, `npm.cmd run test:cloud`, and `npm.cmd run test:schedules` pass after Mission 4C using provider-neutral mocks and temporary local SQLite only.
- Ordinary Assistant execution can no longer reach the legacy combined Signal → Telegram → Notion workflow.
- The retained legacy signal workflow is manual-only, loads provider code only after authorization, and requires explicit production target plus separate Telegram and Notion confirmations.
- Production-capable Telegram/signal probe scripts are isolated under `manual/external/`, are no longer named as ordinary tests, and fail closed without explicit target/action flags.
- The legacy root entrypoint no longer starts its JSON-backed Scheduler unless `SWISSCHART_ENABLE_LEGACY_SCHEDULER=true`; this does not enable schema 4.5 scheduling.
- Local Telegram publication state now records `CONFIRMED_SENT`, `DEFINITE_NOT_SENT`, or `DELIVERY_UNCERTAIN`. Unknown/ambiguous failures and restart-in-`sending` are held for review and cannot resend; only explicitly proven pre-send/provider-rejected outcomes are retryable.
- The active Agent Registry policy reference now points to `00_PROJECT_BRAIN/02_ARCHITECTURE.md`.
- `npm.cmd run test:p0-safety`, `npm.cmd run test:cloud`, and `npm.cmd run test:schedules` pass after Mission 4B using static/mock/temp-only paths.
- Configurable Market-Session Messaging Codex 2/3 is implemented and verified locally.
- Local MCP schema is `4.5`; schema `4.5` is **not deployed**.
- Local implementation includes versioned schedule rules, semantic schedule management, Temporal/IANA DST resolution, injected SQLite persistence, durable occurrence claims/recovery, suppression/misfire boundaries and Task Engine approved-schedule validation.
- `npm.cmd run test:schedules` passed after Codex 2/3.
- `npm.cmd run test:cloud` passed after Codex 2/3.
- The exact standalone Signal/سیگنال schema 4.4 discovery contract remains preserved in local schema 4.5.

## Disabled

- Scheduler execution remains disabled by default in production.
- No production schedules exist.
- No initial weekday/weekend market-session schedule records exist in production.
- No final Founder market-session message templates or misfire grace values have been approved.
- No holiday intelligence is implemented; only a local extension boundary exists.

## Stopped / Deferred

- Mission 4A P0/P1/P2/P3 findings and the Repository Cleanup Closeout are complete locally. Configurable Market-Session Messaging Codex 3/3 is the next recommended development step and still requires separate Founder authorization.
- Codex 3/3 has not been executed and requires separate Founder authorization.
- Mission 10 remains **STOPPED**.
- Universal Data Warehouse/Lake, event bus, Redis, universal social/metric schemas, cross-platform attribution, Knowledge Graph, Vector Database, Feature Store, detailed Advisor and Growth Intelligence remain deferred.

## Known Limitations

- Telegram has no client-supplied idempotency key. A crash after provider acceptance but before message-ID persistence cannot be proven exactly-once; the system holds uncertain delivery for review.
- The strengthened same-process Telegram delivery-certainty taxonomy is local-only until separately deployed; production remains at its previously verified schema/runtime state.
- Telegram provider message IDs for the live Mission 9 two-message `SCT-2647` proof are unknown because structured logs did not contain them and persisted action files were not accessed.
- OAuth/action/schedule persistence is currently designed for a single Railway replica.
- OAuth token expiry still requires normal reauthorization; global revocation is an operational maintenance procedure.
- Existing Claude conversations may retain stale MCP schemas after schema changes; a new conversation may be required to discover a refreshed tool definition.
- There is no authoritative TP-generation formula; TP1, TP2 and TP3 remain Founder-supplied.
- Unknown instruments must be clarified rather than guessed.
- Scheduling production templates, activation parameters and controlled deployment remain incomplete.
