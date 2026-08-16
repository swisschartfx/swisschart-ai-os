# SWISSCHART AI OS — ARCHITECTURE

Status: ACTIVE — AUTHORITATIVE ARCHITECTURE AND PERMANENT RULES
Last Updated: 2026-08-16

## 1. Authoritative Principle

Swisschart AI OS uses **Top-Down Architectural Definition and Bottom-Up Capability Completion**.

Stable interface, authority, orchestration, capability, execution-control, data-boundary and provider contracts are defined in advance, while implementation remains evidence-driven.

The architecture is a dependency graph, not a mandatory processing pipeline. Logical layers do not prescribe physical repository structure.

Each real capability is completed end-to-end using only the shared infrastructure it actually requires. New domains and Agents plug into existing contracts and may extend shared infrastructure where justified, but must not create competing business authority, conflicting canonical data or metric definitions, independent shared-intelligence systems, or parallel execution-control authorities.

Domain-local implementations, caches, projections, provider-specific logic and specialized analytics are allowed when ownership remains explicit and they do not create a second source of truth or competing brain.

Future Agents are never prerequisites for an existing capability to become production-complete.

## 2. Logical Architecture

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

┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│ SHARED CORE CONCERNS     │ DOMAIN CAPABILITIES      │ EXECUTION & CONTROL      │
│ Data & Normalization     │ Trading                  │ Task                     │
│ Metrics                  │ Publishing               │ Event                    │
│ Analytics                │ Content                  │ Rule                     │
│ Intelligence             │ Telegram                 │ Approval                 │
│ Advisor                  │ Instagram                │ Scheduler                │
│ Knowledge                │ X                        │ Automation               │
│ Context / Memory         │ YouTube                  │ Audit                    │
│ Identity / References    │ Website                  │ Idempotency              │
│ Brand Identity           │ Future domains           │ Operational State        │
│ Cost / Usage             │                          │                          │
└──────────────────────────┴──────────────────────────┴──────────────────────────┘

  ↓ only where genuinely required
AGENTS / WORKFLOWS
  ↓
PROVIDER SERVICES
  ↓
EXTERNAL SYSTEMS / APIs
```

Shared Core, Domain and Execution & Control are parallel conceptual concerns, not a vertical stack. They may depend on each other through explicit contracts.

Valid dependency examples include:

- Central Assistant → Capability Gateway → Trading Data Capability → Notion
- Central Assistant → Capability Gateway → Trading Analytics → Trading Data → Notion
- Central Assistant → Capability Gateway → Advisor → Cross-domain Analytics → Shared Data / Metrics

No request must traverse every concern.

This logical architecture does not authorize a giant shared-core folder, package, service or monolith. Physical organization changes only when implementation evidence justifies it.

## 3. Authority Hierarchy

### Founder

The Founder owns strategic decisions, company philosophy and approvals that policy assigns to the Founder.

### Founder Interfaces and Claude

Claude is the primary Founder conversational interface and general reasoning layer. Claude may interpret Persian/English intent, maintain conversational context, collect fields and phrase responses.

Interfaces must delegate to the Central Assistant and must not duplicate business authority, persistent operational state, canonical validation or execution intelligence. Telegram and future interfaces are interfaces to the same Assistant, not separate Assistants.

### Central Swisschart Assistant

The Central Assistant is the Business Orchestrator. It coordinates intent, structured requests, capability selection, workflow/task creation and reporting. It does not surrender deterministic business authority to an interface or provider.

### Swisschart Backend

Swisschart owns deterministic business truth, normalization, validation, missing-data enforcement, calculations, capability execution, authorization, approvals, mutations, publishing, durable operational state and idempotency/recovery.

### Capability Gateway

The Capability Gateway is the authority boundary. Business capabilities and mutations must not bypass it. Public interfaces expose semantic Founder operations, not internal provider methods or raw Task/Event/Approval APIs.

Every registered operation has one explicit access classification: read, governed mutation or internal/delegated execution. Governed mutations fail closed at the Gateway unless their declared approval, immutable payload-binding and idempotency requirements are satisfied. Capability-local checks remain as defense in depth. Internal/delegated operations may establish a Task/Approval lifecycle but do not authorize provider effects by themselves.

## 4. Capabilities, Agents, Workflows and Services

A Capability owns a reusable business or technical responsibility. A Capability does not require an Agent.

Agents are optional specialized implementation components used only when an independent actor, workflow lifecycle, specialized worker or orchestration behavior is genuinely needed. Each Agent has one primary responsibility and must not become an isolated mini-system or competing business brain.

Workflows coordinate reusable multi-step domain behavior when a lifecycle is genuinely required. Do not create one Workflow for every message or one Agent for every small action.

Services communicate with external systems. Provider SDK calls and provider-specific property mapping remain behind approved Service/capability boundaries. Services normalize provider data; they do not own Founder preferences, canonical policy or business decisions.

## 5. Canonical Ownership and Duplication

Source-of-truth and contract ownership must be explicit for:

- Data
- Metrics
- Identity
- Policy
- Operational State
- Shared Intelligence

No Agent, domain, interface or provider adapter may silently become a competing authority.

Technical/local duplication can be legitimate for caches, projections, provider-specific logic and specialized analytics. Prohibited duplication is competing or inconsistent business authority, canonical truth, canonical metrics, shared business intelligence or execution-control authority.

Domain-specific analytics are allowed—for example Trading Max Consecutive Losses, Instagram Reel Retention or YouTube Watch-Time analysis. Canonical metric definitions, shared intelligence, cross-domain analytics and authoritative interpretations require explicit ownership and cannot be independently redefined across Agents.

## 6. Operational State and Memory

Context / Memory may contain conversational context, prior Founder decisions and reasoning/workflow-context references.

Operational State contains approvals, tasks, events, scheduler occurrences, automation state, execution attempts/results, idempotency and durable workflow/business state.

Operational State must be deterministic and durable. It must never be treated as AI memory, and AI memory must never substitute for authoritative Operational State.

## 7. Identity / Entity References

Future domain entities should be capable of exposing normalized references conceptually containing:

- `entity_type`
- `entity_id`
- `source`
- `external_reference`
- parent/reference relationships

This is a principle, not a universal cross-platform schema. Exact Trade, Reel, Telegram Post, Campaign and future relationships must be designed from real domain requirements.

## 8. Execution and Control Boundaries

### Task

- One authoritative Task represents each meaningful execution.
- Task Engine owns Task lifecycle, validation, assignment, approval enforcement and execution history.
- Completed, failed, blocked, cancelled, rejected and prior-attempt records must not be silently overwritten.
- A Result reports verified facts for one attempt. External success cannot be claimed without verified evidence or an external reference.

### Event

- Event Engine normalizes events and evaluates routing/policy candidates.
- It does not own Task execution, publish directly or access providers outside adapters.

### Rule and Policy

- Rules define policy and Founder operational preferences.
- Only a verified Founder request can create, update or disable a Founder Rule.
- Ambiguous text is not approval and cannot silently alter a Rule.
- Rules preserve version, replacement and audit history.
- At equal precedence, the most specific active Rule wins; conflicts apply the safer decision and must be reported.

Effective behavior is resolved in this order:

1. Non-overridable system safety policy
2. Capability-specific safety requirement
3. Explicit active Founder Rule
4. Default operational behavior

Supported decisions are `automatic`, `approval_required`, `notification_only` and `disabled`, subject to higher-level safety policy.

### Approval

- External mutation or publication requires explicit Founder approval unless an active approved Rule and higher-level safety policy explicitly permit unattended execution.
- Approval binds the exact normalized action where applicable: content, destination, metadata, reference, schedule/revision and immutable payload hash.
- Changed payload, destination, schedule or relevant policy invalidates the approval.
- Separate effects require separate approval boundaries where defined.

### Scheduler and Automation

- Scheduler controls **when** something happens; it does not decide **what** happens.
- Rules and approved automation records define policy and intended action.
- Task controls execution lifecycle; Capabilities/Agents perform business work.
- Scheduler, Automation, Task, Event, Rule and Approval must not become parallel execution authorities.
- Durable occurrence claims and idempotency are required before unattended production execution.
- Schedule occurrence ownership is deterministic: SQLite owns durable claim/finalization state, Task owns execution outcome, and Scheduler owns timing only. Pre-publication definite failure may become safely retryable; policy/authorization non-execution is held; publication uncertainty is held as delivery-uncertain and is never automatically replayed.

### Audit and Idempotency

- Every material execution and external result must be auditable.
- Durable idempotency prevents normal replay/restart duplication.
- Completed replay returns the stored result without repeating the external effect.
- Uncertain provider delivery must be held for review rather than blindly retried.
- Missing facts and uncertain outcomes must never be invented.

## 9. Trading Data and Notion Boundary

Notion is the current Trading Journal provider, not the Trading Analytics authority.

Reference dependency pattern:

```text
Notion
  ↓
Trading Data Capability
  ↓
Trading Analytics / General Trading Analysis
  ↓
Capability Gateway
  ↓
Central Assistant
  ↓
Founder Interface
```

Analytics must not directly depend on Notion SDK or database-property details. Logical sources such as `trading_journal` are resolved inside the capability/provider boundary. This is a reference pattern, not a universal mandatory pipeline.

## 10. Time and Period Contract

The authoritative business timezone is the IANA zone `America/New_York`; fixed UTC offsets are not business-time authority.

Period Contract `1.0` supports:

- `today`
- `yesterday`
- `this_week`
- `last_week`
- `this_month`
- `last_month`
- `last_30_days`
- `last_3_months`
- `year_to_date`
- `all`
- Founder-inclusive explicit ranges

Weeks begin Monday. Bounded ranges are half-open. Explicit Founder end dates are inclusive and normalize to the next local date as `endLocalDateExclusive`. `all` is unbounded and applies no date filter. Providers receive normalized local boundaries or UTC instants and do not interpret presets.

Persist machine audit timestamps as UTC instants while retaining the originating IANA zone/local specification where business wall time matters. Recurring occurrences are resolved independently for each local date; never add 24 hours to a prior UTC occurrence. Nonexistent times are rejected; ambiguous times require explicit disambiguation.

## 11. Trading Signal Business Contracts

### Signal Intake and Validation

Founder-supplied signal fields are Asset, Direction, Entry, Stop Loss, Risk, Grade, TP1, TP2 and TP3. Swisschart owns normalization, validation, canonical symbol, Stop Size, R:R values, Planned RR, grade formatting and output formatting.

Unknown or ambiguous instruments require clarification and must never be guessed. There is no approved target-price generation rule: TP1/TP2/TP3 remain Founder-supplied. Stop Size and R:R are calculated only from supplied values.

Exact standalone Founder messages `Signal` and `سیگنال` mean start a new Swisschart trading-signal intake through the single semantic tool; unrelated phrases containing “signal” are not captured by this narrow rule.

### Trade Identifier

The canonical Trade ID contract is `SCT-YYNN`, validated by `^SCT-\d{2}(0[1-9]|[1-9]\d)$`.

- `YY` is the `America/New_York` calendar-year suffix.
- `NN` is the annual sequence `01..99` and resets at New York New Year.
- Other prefixes, including `TSC`, are invalid.
- No format beyond `99` may be invented without a new approved contract.

### Notion Creation Approval

Signal validation/preparation and Notion creation are distinct stages. Notion creation requires its own immutable prepared action and explicit authenticated Founder approval. Generic Notion mutation is not implicitly authorized.

### Telegram Publication Approval

Telegram signal publication is separate from Notion creation and requires a distinct immutable preparation and Founder approval.

Every signal publication is one ordered two-message bundle:

1. Canonical Risk Management message
2. Exact Signal message

Both exact messages, destination, signal reference, metadata and order are approval-bound. Telegram publication must pass through Capability Gateway, the Publishing Agent and Telegram Service. Completed replay sends nothing again. Persisted partial completion may resume only the missing message. Uncertain delivery is held for review.

## 12. Configurable Scheduling Architecture

Configurable market-session messaging extends the existing AutomationManager, Scheduler, Event Engine, Task Engine, Capability Gateway and Publishing Agent path. It must not create a parallel scheduler, approval system, task system or Telegram path.

Permanent scheduling rules:

- versioned immutable schedule revisions and audit history
- explicit Founder approval for create/update/delete/enable/disable mutations
- approval binds weekdays, trigger, IANA timezone, local time, offset, template/content hash, renderer, destination, display timezone, misfire and holiday policy
- an unchanged approved recurring revision may provide a durable unattended execution grant
- Task Engine revalidates the enabled approved revision, hash, occurrence, destination, template and suppression state before execution
- deterministic occurrence identity and transactional unique claim
- `Europe/London` and `America/New_York` occurrences resolve independently with IANA/DST rules
- human-visible business time uses `America/New_York`
- default stale-message behavior is skip/record or Founder review, never silent catch-up
- uncertain Telegram delivery is held, not automatically retried
- holiday intelligence is not implemented; only a stable suppression boundary exists
- horizontal replicas require separately designed leader election/coordination

For the current single-service/single-volume design, embedded SQLite on the existing durable Volume is the approved smallest transactional persistence. This does not establish SQLite as a universal data platform.

## 13. Development and Safety Rules

- Follow Architecture → Implementation → Testing → Verification.
- Inspect existing components before creating new ones.
- Avoid duplicate systems and permanent infrastructure for temporary requirements.
- Never invent missing trading, publishing or company facts.
- Never delete or overwrite confirmed historical trading data without explicit authorization.
- Do not expose credentials, tokens or production persisted state in source control.
- Use isolated mock/temp persistence for tests; a file named like a test must not be assumed safe.
- Broad auto-discovered legacy/manual tests are prohibited unless each test is proven isolated from production.
- Production actions, strategic changes and irreversible effects require the appropriate explicit authorization.

## 14. Deferred Architecture Decisions

The following remain **DEFERRED / UNKNOWN** until real requirements justify them:

- Data Warehouse technology
- Data Lake
- Kafka, broker or event bus
- Redis architecture
- Universal Social Data Schema
- universal Metric database schema
- universal Cross-platform Attribution Engine
- Instagram retention tables
- X ingestion method
- YouTube storage model
- universal ETL framework
- stream-processing framework
- Knowledge Graph
- Vector Database
- Feature Store
- detailed Advisor engine
- detailed Cross-platform Growth Intelligence
- universal provider ingestion architecture

Do not pre-build these from hypothetical requirements.

## 15. Concise ADR Ledger

### ADR — Telegram Is an Interface to the Central Assistant

**Approved:** 2026-08-13. Telegram handles transport and Founder authorization but delegates intelligence and capability execution to the Central Assistant and Capability Gateway. Production publishing remains on the Publishing Agent path.

### ADR — Founder Interface / Business Authority Split

Claude owns general conversational interpretation and phrasing. Swisschart owns deterministic business truth, authorization, mutation, durable state and execution. This prevents dual-brain behavior and preserves model independence.

### ADR — Provider-Neutral Trading Data

Notion remains behind Trading Data capability/service boundaries. Analytics does not depend on Notion SDK or database-property details.

### ADR — Durable Prepared Actions and Separate Approvals

External signal creation and publication use immutable prepared actions, exact approval binding and durable replay state. Notion creation and Telegram publication are separate approval boundaries.

### ADR — Top-Down Definition + Bottom-Up Completion

**Approved:** 2026-08-16. Architecture defines stable contracts top-down; implementation completes real capabilities bottom-up. Architecture is a dependency graph, logical layers do not dictate folders, Agents are optional, canonical ownership is explicit and future Agents cannot block present capability completion.

### ADR — Configurable Scheduling Persistence

For the current single Railway service and Volume, injected SQLite is the smallest correct transactional schedule/occurrence store. Scheduler activation, production schedules and horizontal coordination remain separately controlled.

## 16. Non-Goals

This architecture does not authorize new folders that mirror logical layers, speculative universal infrastructure, Agent proliferation, provider-specific business logic, deployment, production mutation, Scheduler activation or Mission 10.
