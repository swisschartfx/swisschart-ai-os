# SWISSCHART AI OS — CURRENT STATE

Status: ACTIVE — ONLY CANONICAL CURRENT TRUTH
As Of: 2026-08-16

This document states what is true now. Historical snapshots, archived Mission documents and old Session records cannot override it.

## Production

### Central Assistant and Founder Interface

- The Central Swisschart Assistant is implemented and production-proven.
- Claude is the primary Founder conversational interface through the authenticated Remote MCP connection.
- Claude handles conversational interpretation and presentation; Swisschart AI OS owns deterministic business truth, authorization, durable state and execution.
- Structured Founder requests execute through `SwisschartAssistant` and Capability Gateway.
- Capability Gateway remains the business authority boundary.
- The system is cloud-based and does not depend on the Founder laptop being online.

### Railway Runtime

- Railway project: `swisschart-ai-os`.
- Environment: `production`.
- Service: `swisschart-read-only`.
- Region: Amsterdam / EU West.
- One Railway service replica is used.
- Managed Railway Volume is mounted at `/data`.
- `GET /health` is configured as the Railway health check.
- Production startup, Volume mount and health check are verified after the Scheduler wiring deployment.
- Production Scheduler Runtime is deployed and operationally enabled.

### Authentication and Durable State

- Claude uses the Founder-only OAuth boundary with PKCE and hashed access-token records.
- OAuth state and durable action state are persisted on `/data`.
- Durable schedule and occurrence state is persisted in:

`/data/schedules.sqlite`

- Restart and redeploy persistence on the managed Volume is production-proven.
- Raw access tokens and Founder credentials are not persisted in Project Brain or source.
- Persistence and coordination currently assume one Railway service replica.
- Horizontal multi-replica scheduling coordination is not implemented.

### Trading Data and Analytics

- Real Notion-backed Trading Data, Trading Analytics and General Trading Analysis are production-proven through Claude in Persian.
- Period Contract `1.0` and `America/New_York` business boundaries are deployed.
- Supported periods include `period=all` and Founder-inclusive explicit ranges.
- Notion remains behind provider-neutral Trading Data capability/service boundaries.

### Signal Creation to Notion

- Founder-approved Signal creation is production-proven.
- Signal preparation, immutable payload-hash approval, explicit Founder approval, SCT allocation, Notion creation and replay idempotency are implemented.
- Canonical Trade IDs use `SCT-YYNN` with the New York calendar year and annual sequence.
- Notion `Trade Sequence` ordering is production-complete.
- Generic Notion mutation is not implicitly exposed by this capability.

### Signal Publication to Telegram

- Founder-approved Telegram signal publication is production-proven.
- Notion signal creation and Telegram signal publication remain separate prepare/approve actions.
- The canonical Telegram bundle sends Risk Management first and Signal second.
- Publication passes through Capability Gateway, Publishing Agent and Telegram Service.
- Durable per-message state, replay protection, missing-second-message recovery and conservative uncertain-delivery handling are implemented.

## Production Configurable Scheduling

### Scheduling Foundation

The configurable scheduling architecture is deployed in Production.

Production scheduling uses the existing path:

Schedule Management
→ SQLite durable schedule / occurrence state
→ AutomationSchedulerBridge
→ SchedulerRuntime
→ Event Engine
→ Task Engine
→ PublishingAgentExecutor
→ Publishing Agent
→ Telegram

The Production Cloud Runtime constructs and supplies the durable Scheduler Runtime.

`SCHEDULER_ENABLED=true` is set in Production.

`SWISSCHART_SCHEDULE_DATABASE_FILE` points to the durable Railway Volume schedule database.

The legacy JSON-backed Scheduler is not the Production scheduling authority.

### Founder Schedule Management

Schedule Management is available through the existing Central Assistant / Capability Gateway path.

Founder schedule operations support governed:

- list
- inspect
- create prepare / approve
- update prepare / approve
- delete prepare / approve

Operational schedules can therefore be added or changed without source-code edits when the requested behavior fits the approved Schedule Management contract.

Schedule mutations remain approval-bound and persisted approved revisions remain the unattended execution authority.

### Active Market-Session Schedules

Five Founder-approved weekday market-session schedules are enabled in Production:

1. `market.london.preopen_60m`
   - Monday-Friday
   - 60 minutes before London open
   - London anchor: `08:00 Europe/London`

2. `market.london.preopen_5m`
   - Monday-Friday
   - 5 minutes before London open
   - London anchor: `08:00 Europe/London`

3. `market.london.preclose_5m`
   - Monday-Friday
   - 5 minutes before London close
   - London anchor: `17:00 Europe/London`

4. `market.newyork.preopen_5m`
   - Monday-Friday
   - 5 minutes before New York open
   - New York anchor: `08:00 America/New_York`

5. `market.newyork.preclose_5m`
   - Monday-Friday
   - 5 minutes before New York close
   - also serves as the Swisschart end-of-trading-day channel message
   - New York close anchor: `17:00 America/New_York`

All five are enabled at persisted revision `2`.

IANA timezone and DST resolution are used.

### Weekly Forex Open Schedule

A sixth Production schedule was created directly through the Claude Founder interface:

`market.weekly.forexopen_preopen_5m`

Persisted configuration:

- approval status: `approved`
- enabled: `true`
- revision: `1`
- weekday: Sunday / ISO weekday `7`
- trigger: `session_relative`
- New York session open boundary
- offset: `-5 minutes`
- effective local time: `16:55`
- timezone: `America/New_York`
- destination: `telegram.primary`
- template revision: `1`

Approved message:

The market opens in 5 minutes

A new trading week is about to begin
Wishing all traders a focused, disciplined and successful week ahead

As precise as a Swiss watch

<a href="https://linktr.ee/swisschart">Swisschart Links</a>

The schedule was:

Founder request in Claude
→ duplicate check
→ prepare
→ preview
→ correction
→ immutable payload binding
→ explicit Founder approval
→ durable persistence
→ enabled Production schedule

No VS Code edit, SSH database mutation or source-code deployment was required to create this schedule.

This is the first Production proof that the Founder can create a compatible recurring operational schedule through the conversational interface while Swisschart AI OS retains deterministic authority and durable state.

### Current Scheduling Proof Boundary

The following are production-proven:

- durable Production schedule persistence
- Production Scheduler Runtime wiring
- Scheduler operational activation
- approved and enabled persisted schedule revisions
- Production schedule inspection
- next-occurrence resolution
- creation and approval of a new schedule through Claude
- IANA/DST-aware schedule resolution
- durable occurrence and execution authorization architecture through regression tests

The first actual provider delivery from the newly activated recurring schedule set has not yet been recorded in Project Brain as observed evidence.

Therefore:

Configuration and activation are complete.

The first real scheduled Telegram fire remains the final operational observation.

The mutation response field `executionMetadata.schedulerActivated` is not the authoritative health indicator for the long-running Scheduler Runtime. Scheduler activation is owned by Production runtime configuration.

## Repository and Architecture State

- Project Brain is consolidated into six active canonical documents plus the explicitly non-authoritative archive.
- `00_START_HERE.md` is the mandatory entry point.
- The active architecture is Top-Down Architectural Definition + Bottom-Up Capability Completion.
- Capability Gateway remains the single business authority boundary.
- Shared Core, Domain Capabilities and Execution & Control are logical architectural concerns and do not require a cosmetic one-to-one folder structure.
- Agents and workflows are optional execution components, not independent brains.
- Notion remains provider-neutral behind Trading Data boundaries.
- The active Publishing Agent module is `publishingAgent.js`.
- Active cloud composition is `cloudComposition.js`.
- Legacy raw Assistant approval, direct provider workflow and direct AutomationManager mutation paths are fail-closed or isolated behind explicit manual guards.
- The legacy combined Signal → Telegram → Notion execution path is not reachable through normal Assistant execution.
- Production-capable manual probes are isolated under `manual/external/`.

## Repository Cleanup Status

The earlier P0-P3 cleanup and closeout work is complete.

A broader Repository Architecture Conformance Audit & Cleanup remains the next separately authorized project Mission.

Its purpose is to compare the real Repository against the approved architecture and identify remaining:

- misplaced ownership
- duplicate responsibilities
- legacy active reachability
- authority bypasses
- provider leakage
- unnecessary parallel systems
- organizational inconsistencies
- stale active references

Existing production-proven implementation must not be rewritten merely to make folders visually resemble the logical architecture.

## Current Test Evidence

The following regression suites passed during the scheduling work:

- `npm.cmd run test:cloud`
- `npm.cmd run test:schedules`
- Market-session timezone/DST tests
- Market-session Schedule Management integration tests

The Production deployment also passed Railway `/health`.

## Current Git / Deployment Milestones

Relevant scheduling commits include:

- `fcf6903` — Add configurable market session schedules
- `6d6f09e` — Require Node 22 for SQLite runtime
- `62f4234` — Add guarded market session seed script
- `1a96789` — Wire production scheduler runtime

These changes were pushed and deployed during the session.

## Known Limitations

- Telegram has no client-supplied idempotency key. A crash after provider acceptance but before message-ID persistence cannot be proven exactly-once; uncertain delivery must remain held for review.
- Production durable state and scheduling coordination currently assume one Railway replica.
- Horizontal scheduler leadership/locking for multiple replicas is not implemented.
- Holiday intelligence is not implemented; only the suppression-policy boundary exists.
- The first observed real scheduled Telegram delivery from the newly activated schedule set has not yet been recorded as evidence.
- OAuth token expiry still requires normal reauthorization.
- Existing Claude conversations may retain stale MCP/tool discovery after future schema changes.
- There is no authoritative TP-generation formula; TP1, TP2 and TP3 remain Founder-supplied.
- Unknown instruments must be clarified rather than guessed.

## Stopped / Deferred

- Mission 10 remains STOPPED.
- Universal Data Warehouse/Lake, event bus, Redis, universal social/metric schemas, cross-platform attribution, Knowledge Graph, Vector Database, Feature Store, detailed Advisor engine and detailed Growth Intelligence remain deferred.
- Do not resume speculative universal infrastructure work without concrete capability evidence and Founder authorization.