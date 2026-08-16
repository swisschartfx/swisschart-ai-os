# SWISSCHART AI OS — START HERE

Status: ACTIVE — MANDATORY ENTRY POINT
Last Updated: 2026-08-16

## Mandatory Entry Point

Before designing, implementing, refactoring or modifying Swisschart AI OS, begin here and follow the reading order below.

Do not infer current work from old Mission documents, archived Session files, historical chats, old Next Action statements or filenames.

## What Swisschart AI OS Is

Swisschart AI OS is the centralized, cloud-oriented intelligence and operating system through which the Founder directs Swisschart. One Central Swisschart Assistant coordinates deterministic business capabilities, controlled execution and provider services while preserving Swisschart knowledge, standards and authority boundaries.

## Mandatory Reading Order

For every development task, read:

1. `00_START_HERE.md`
2. `03_CURRENT_STATE.md`
3. `04_NEXT_ACTION.md`

Before implementation, source changes, contract changes, architecture changes, or Project Brain architecture/rule changes, also read:

4. `02_ARCHITECTURE.md`

Read `01_MASTER_CONTEXT.md` when business purpose, Founder intent, company direction or Swisschart DNA affects the decision.

Read `05_HISTORY.md` and `archive/` only when historical reasoning, evidence or audit detail is required.

## Compact Architecture

```text
FOUNDER
  ↓
FOUNDER INTERFACES
Claude / fallback interfaces
  ↓
CENTRAL SWISSCHART ASSISTANT
Business Orchestrator
  ↓
CAPABILITY GATEWAY
Authority Boundary
  ↓
DEPENDENCY GRAPH

SHARED CORE CAPABILITIES / CONCERNS
Data & Normalization · Metrics · Analytics · Intelligence · Advisor
Knowledge · Context / Memory · Identity / Entity References
Brand Identity · Cost / Usage

DOMAIN CAPABILITIES
Trading · Publishing · Content · Telegram · Instagram · X
YouTube · Website · Future Domains

EXECUTION & CONTROL INFRASTRUCTURE
Task · Event · Rule · Approval · Scheduler · Automation
Audit · Idempotency · Operational State

  ↓ only where genuinely required
AGENTS / WORKFLOWS
  ↓
PROVIDER SERVICES
  ↓
EXTERNAL SYSTEMS / APIs
```

These are dependency possibilities.

They are **not** a mandatory request pipeline.

They do **not** prescribe repository folders, packages or services.

## Development Method

Swisschart AI OS uses **Top-Down Architectural Definition + Bottom-Up Capability Completion**.

```text
DEFINE STABLE BOUNDARIES
  ↓
SELECT REAL CAPABILITY
  ↓
COMPLETE END-TO-END
  ↓
REUSE EXISTING SHARED INFRASTRUCTURE
  ↓
EXTEND SHARED INFRASTRUCTURE ONLY WHEN EVIDENCE REQUIRES
  ↓
TEST
  ↓
PROVE SAFELY
  ↓
UPDATE CANONICAL PROJECT BRAIN
  ↓
NEXT CAPABILITY
```

## Canonical Ownership

| Information | Canonical owner |
|---|---|
| Vision, purpose and durable business context | `01_MASTER_CONTEXT.md` |
| Architecture, permanent rules and active ADRs | `02_ARCHITECTURE.md` |
| Current implementation and production truth | `03_CURRENT_STATE.md` |
| Authorized continuation and near-term sequence | `04_NEXT_ACTION.md` |
| Completed milestones, evidence and incidents | `05_HISTORY.md` and `archive/` |

No evolving fact may have multiple independently maintained canonical owners. References are allowed; duplicate authority is not.

## Historical Truth Warning

Archived documents, dated handoffs, Mission plans, Session records and historical changelog entries describe what was true at their recorded time only.

Their words **current**, **next**, **pending** and **authorized** cannot override the six active canonical documents.

Only `03_CURRENT_STATE.md`, `04_NEXT_ACTION.md`, and explicitly referenced active rules in `02_ARCHITECTURE.md` define what is true and authorized now.
