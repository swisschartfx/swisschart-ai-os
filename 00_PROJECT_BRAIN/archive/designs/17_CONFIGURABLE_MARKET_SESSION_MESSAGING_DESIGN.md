# Configurable Market-Session and Scheduled Channel Messaging

Date: 2026-08-16
Status: Codex 2/3 implementation complete locally; production activation not authorized

## Scope and invariants

- This capability extends the existing Swisschart scheduling and publishing architecture. It does not create a second scheduler, automation manager, Assistant, approval system, or Telegram path.
- Claude is the Founder conversational interface. Swisschart validates, previews, persists, schedules, executes and audits deterministically.
- Schedule configuration mutations require explicit authenticated Founder approval. An unchanged approved recurring schedule may execute unattended under its durable schedule approval grant.
- Every Telegram send remains behind Capability Gateway and passes through Publishing Agent and Telegram Service.
- Mission 10 remains STOPPED. This design does not authorize implementation, deployment, schedule creation, Scheduler activation or publication.

## Existing components to reuse

- Central `SwisschartAssistant` and the single semantic `swisschart.query` surface for Founder interaction.
- Capability Gateway as the authority boundary.
- `AutomationManager` as the schedule/rule management domain API; extend its contract instead of adding another manager.
- `AutomationSchedulerBridge` to convert enabled configuration into due scheduler candidates.
- `SchedulerRuntime`, `SchedulerEventAdapter` and Event Engine for time polling, normalized scheduled events and routing.
- Task Engine for authoritative execution lifecycle and Results.
- Publishing Agent and Telegram Service as the only production publication path.
- Existing immutable prepared-action/hash pattern from Mission 8/9 as the model for schedule mutation approvals.
- Existing Railway Volume for durable, laptop-independent state.

Do not duplicate Scheduler, AutomationManager, Task Engine, Event Engine, approval infrastructure, Publishing Agent, Telegram Service, or create a Claude-owned schedule store.

## Proposed architecture

Founder → Claude → `swisschart.query` → SwisschartAssistant → Capability Gateway → Schedule Management Capability → validate/preview → durable prepared mutation → explicit Founder approval → AutomationManager → transactional schedule store.

At runtime:

Transactional schedule store → AutomationSchedulerBridge/occurrence planner → SchedulerRuntime → Scheduler Event Adapter → Event Engine → Task Engine defense-in-depth validation of the approved schedule revision → scheduled publishing capability → Publishing Agent → Telegram Service → durable occurrence Result.

Scheduler decides when. The approved automation record defines what. Publishing Agent owns Telegram delivery. A future holiday capability may suppress an occurrence before Task creation.

## Rule model

Each schedule is versioned; updates create a new immutable revision and preserve audit history.

```json
{
  "scheduleId": "schedule-london-open-warning",
  "revision": 1,
  "name": "London open warning",
  "enabled": true,
  "weekdays": [1, 2, 3, 4, 5],
  "trigger": {
    "type": "session_relative",
    "session": "london",
    "boundary": "open",
    "authoritativeLocalTime": "08:00",
    "timezone": "Europe/London",
    "offsetMinutes": -5
  },
  "publication": {
    "destination": "telegram.primary",
    "template": { "templateId": "founder-supplied", "revision": 1 },
    "displayTimezone": "America/New_York",
    "rendererVersion": "1.0"
  },
  "executionPolicy": {
    "misfireMode": "skip_and_record",
    "misfireGraceSeconds": null,
    "holidayPolicy": "none"
  },
  "approval": {
    "status": "approved",
    "approvedRevision": 1,
    "approvedPayloadHash": "sha256",
    "approvedBy": "founder",
    "approvedAt": "UTC ISO timestamp"
  },
  "createdAt": "UTC ISO timestamp",
  "updatedAt": "UTC ISO timestamp"
}
```

Supported triggers:

- `session_relative`: authoritative IANA timezone, local session wall time and signed offset.
- `local_time`: recurring local wall time in an IANA timezone for general weekday/weekend messages.

The initial six rules are configuration records, not six workflows. Five distinct trigger definitions produce six messages because New York close warning and end-of-day message are separate schedules. Exact production templates and misfire grace values remain Founder-supplied and must not be invented.

## Initial weekday configuration

All initial schedules use ISO weekdays `[1,2,3,4,5]` only:

1. London greeting: `08:00 Europe/London`, offset `-60` minutes.
2. London open warning: `08:00 Europe/London`, offset `-5` minutes.
3. London close warning: `17:00 Europe/London`, offset `-5` minutes.
4. New York open warning: `08:00 America/New_York`, offset `-5` minutes.
5. New York close warning: `17:00 America/New_York`, offset `-5` minutes.
6. End of trading day/channel activity: `17:00 America/New_York`, offset `0` unless the Founder later approves another explicit offset.

Saturday and Sunday have no initial records. Weekend support is data-driven: `weekdays` accepts ISO `1..7`, and `local_time` allows later Saturday/Sunday creation or edits without source changes or deployment.

## Timezone and DST strategy

- Persist the authoritative local date, wall time, IANA timezone and relative offset; never persist a fixed UTC equivalent as the recurrence definition.
- Resolve every occurrence independently for its actual local calendar date in its own timezone. Never derive London from New York, New York from London, or add 24 hours to the prior UTC instant.
- Use a shared IANA-aware resolver (native Temporal when production-supported, otherwise the Temporal polyfill) with explicit round-trip validation. Do not reuse the current iterative conversion without ambiguity/nonexistence checks.
- Reject nonexistent spring-forward wall times at configuration preview. For ambiguous fall-back wall times, require an explicit `earlier` or `later` disambiguation policy. Never guess.
- Apply relative offsets to the resolved session instant. Store the resulting occurrence instant as UTC plus the original local specification.
- Render all human-visible channel date/time references in `America/New_York`, independent of the trigger timezone.
- Test UK/US DST mismatch weeks explicitly.

## Conversational schedule management

Read-only intents execute immediately:

- `schedule_list`
- `schedule_inspect`

Mutations are always two-stage:

- `schedule_create_prepare` → validated normalized preview/hash → `schedule_create_approve`
- `schedule_update_prepare` → current revision plus patch preview/hash → `schedule_update_approve`
- `schedule_delete_prepare` → exact target/revision preview/hash → `schedule_delete_approve`

Enable and disable are updates to `enabled` and use the update prepare/approve pair. Changes to weekdays, wall time, offset, timezone, destination or template also use update prepare/approve. Claude may interpret Persian or English, but the backend resolves schedule identity, validates fields and computes the preview/hash.

Required contract behavior:

- List: optional `enabled`, weekday and trigger-type filters; returns summaries and revisions.
- Inspect: exact `scheduleId`; returns active revision, normalized trigger, approval state and next occurrence.
- Prepare create: complete candidate rule; returns normalized preview, next occurrences across DST boundaries, approval ID and payload hash; writes no active schedule.
- Approve create: approval ID, exact hash and `confirm=true`; transactionally creates the approved revision.
- Prepare update: exact schedule ID, expected revision and patch; returns before/after preview and a new hash.
- Approve update: rejects stale revision/hash; transactionally appends revision and activates it.
- Prepare delete: exact schedule ID and expected revision; previews the target and pending future occurrences.
- Approve delete: transactionally tombstones the schedule and prevents new claims; history remains.
- Enable/disable: update patch `{ "enabled": true|false }`; both require prepare/approve.

## Approval boundary

The schedule mutation approval binds the complete normalized rule revision: schedule ID, weekdays, trigger type, authoritative timezone/local time, offset, template revision/content hash, renderer version, destination, display timezone, misfire policy and holiday policy.

An approved schedule revision creates a durable recurring execution grant. A due occurrence does not require a second interactive approval only when Task Engine revalidates that:

- the schedule is enabled and not tombstoned;
- the revision and approved payload hash still match;
- the occurrence identity matches the deterministic planner output;
- destination and capability remain allowed;
- template/renderer versions match;
- no suppression applies; and
- the occurrence has not already been claimed/completed.

This is not an approval bypass: the Task records `approvalBasis=approved_schedule_revision`, the approval reference and hash. Any mutation invalidates the prior grant until the new revision is approved. Current Task Engine does not enforce this schedule grant and must gain this defense before Scheduler activation.

## Persistence decision

Current `AutomationStore` JSON is adequate only as a local prototype configuration store. It is insufficient for production because writes are non-atomic, revision/approval history is absent, occurrence claims and Results are in memory, and it cannot enforce a unique occurrence across restart or overlapping processes.

Use one embedded SQLite database file on the existing Railway Volume as the smallest correct production change. PostgreSQL is not required for the current single-service/single-volume deployment. SQLite provides transactions, unique constraints, durable claims and crash recovery without adding a network database or parallel architecture.

Keep `AutomationManager` as the domain API and replace/inject only its store. Minimum tables:

- `schedule_revisions`
- `schedule_heads`
- `prepared_schedule_mutations`
- `schedule_approvals`
- `schedule_occurrences`
- `schedule_execution_attempts`

Use UTC audit timestamps. Preserve immutable revisions and tombstones; do not hard-delete audit history. Configure the database path under the existing `/data` volume. Production remains one scheduler leader; horizontal replicas require a later explicit leader-election design.

## Occurrence identity and idempotency

Occurrence identity is deterministic:

`schedule:{scheduleId}:revision:{revision}:local-date:{YYYY-MM-DD}:trigger:{resolvedInstant}`

Persist a SHA-256 occurrence key over those canonical fields. `schedule_occurrences.occurrence_key` is unique. Claim the occurrence transactionally before Task creation. Task idempotency and Telegram publication idempotency derive from the same occurrence key.

Occurrence states: `planned`, `claimed`, `publishing`, `completed`, `failed_safe_to_retry`, `delivery_uncertain`, `skipped`, `suppressed`, `cancelled`.

Record `publishing` before calling Telegram and persist the verified Telegram message ID immediately after success. A crash after provider acceptance but before message-ID persistence becomes `delivery_uncertain`; it must not auto-retry. This preserves Mission 9's conservative Telegram safety boundary.

Weekday filtering happens before claim creation using the authoritative trigger timezone's local date. DST resolution and uniqueness use the local date plus resolved instant, preventing mismatch-week collisions.

## Restart, misfire and failure behavior

- On startup, load enabled approved schedule heads and reconcile due occurrences from a bounded configured lookback.
- Never silently catch up stale channel warnings. Default `misfireMode=skip_and_record`; the Founder must approve each rule's grace window before activation.
- Resume `claimed` only if no external attempt began. Treat persisted `publishing` as `delivery_uncertain` and hold.
- Known pre-delivery validation/configuration failures record failure and disable no schedule automatically; report operationally.
- Telegram provider rejection before acceptance may be retryable only when evidence proves no message was created and policy permits it.
- No automatic retry for uncertain delivery.
- One schedule failure must not stop other due schedules; every outcome receives a durable Result.
- If two rules share the same instant, each has its own occurrence key and both execute in deterministic order (explicit priority, then schedule ID).

## Holiday extension boundary

No holiday intelligence is included. The rule retains `holidayPolicy: "none"`. Before occurrence claim/Task creation, a future `OccurrenceSuppressionPolicy` may evaluate the planned occurrence using calendar/date/session context and return allow or suppress with a reason/reference. It may not alter timezone calculation, schedule configuration or publishing logic.

## Codex 2/3 exact implementation scope

Local implementation only; no deployment, Scheduler activation, production schedules or Telegram sends:

1. Extend existing automation contracts for versioned weekly `local_time` and `session_relative` rules.
2. Add the shared Temporal/IANA occurrence resolver and New York display-context formatter.
3. Add the SQLite-backed AutomationStore on an injected path with schema migration, transactions, immutable revisions, prepared mutations, approvals and occurrence ledger.
4. Extend AutomationManager rather than creating a new manager.
5. Add one Schedule Management Capability behind Capability Gateway and semantic MCP intents for list/inspect/prepare/approve.
6. Extend AutomationSchedulerBridge and SchedulerRuntime to plan weekdays, claim durable occurrences and recover conservatively.
7. Add Task Engine validation for `approved_schedule_revision` grants and route execution through the existing Publishing Agent/Telegram Service.
8. Keep Scheduler disabled by default and create no initial schedule records because final templates/misfire grace are not yet approved.
9. Add only isolated mock/temp-database tests; do not run legacy/manual real-integration scripts.

Codex 3/3 must be separately authorized for production configuration, final Founder message templates, preview/approval of the six initial rules, deployment, controlled activation and read-only/live verification.

## Required tests

- Contract validation for list, inspect and every prepare/approve mutation pair.
- Explicit approval, payload-hash, stale-revision, wrong-target and replay rejection/idempotency.
- CRUD, enable/disable, weekday, time, offset, timezone and template changes using temporary SQLite.
- Monday-Friday inclusion and Saturday/Sunday exclusion; later weekend CRUD without code changes.
- London and New York occurrences across standard time, daylight time and both mismatch windows.
- Nonexistent/ambiguous local-time rejection/disambiguation.
- New York human-display conversion independent from trigger zone.
- Unique occurrence claims under concurrent ticks/process connections.
- restart before trigger, after claim, during publish and after completion.
- no duplicate Task or Telegram call on retry/restart.
- `delivery_uncertain` hold behavior.
- misfire skip/record behavior.
- disabled/deleted/stale-revision schedules never fire.
- two schedules at the same instant execute once each in deterministic order.
- holiday suppression interface default allows and optional mock suppresses without redesign.
- Capability Gateway, Task Engine, Publishing Agent path and existing `test:cloud` regressions.
- Cloud composition proves Scheduler remains off unless explicitly enabled.

## Definition of done

- Founder can list/inspect and prepare/approve every required schedule mutation through the single semantic Assistant tool.
- Configuration and occurrence history survive restart on injected durable storage.
- IANA/DST behavior and weekdays are deterministic and tested.
- An unchanged approved recurring rule can execute unattended through Task Engine and the sole Publishing Agent path.
- Duplicate claims/executions are prevented durably; uncertain Telegram delivery is held.
- No initial weekend schedules exist; weekend rules can later be managed as data.
- No holiday intelligence is implemented, but suppression has a stable boundary.
- Scheduler remains disabled until Codex 3/3 authorization.
- Mission 10 remains STOPPED.

## Codex 2/3 Local Completion — 2026-08-16

Implemented locally without deployment or production activation:

- Versioned weekly `local_time` and `session_relative` schedule contracts with ISO weekdays, explicit IANA timezone validation, offsets, immutable publication/template metadata, approval hashes and tombstones.
- Shared Temporal/IANA occurrence resolution with DST gap/ambiguity handling, independent London/New York calculation, New York display context and deterministic occurrence identities/keys.
- SQLite-backed injected AutomationStore with schema migration, immutable revisions, prepared mutations, approvals, schedule heads, durable occurrence claims and execution attempts.
- AutomationManager schedule list/inspect and create/update/delete prepare/approve operations, including enable/disable as approved updates, replay handling and stale-revision/hash rejection.
- One Schedule Management Capability behind Capability Gateway and semantic schedule intents inside the existing single `swisschart.query` MCP tool. Local schema version is `4.5`; the exact bare Signal/سیگنال routing contract remains preserved.
- Durable schedule planning through the existing AutomationSchedulerBridge and SchedulerRuntime, with bounded lookback, weekday filtering, deterministic ordering, suppression, misfire recording, transactional claims and conservative restart recovery.
- Task Engine defense-in-depth validation of `approved_schedule_revision` grants and occurrence transitions through the existing Publishing Agent path, including `delivery_uncertain` hold behavior.
- Stable default-allow holiday suppression boundary with no holiday intelligence implemented.
- Scheduler remains disabled by default. No initial schedules, templates or production database path were created.

Verification:

- `npm.cmd run test:schedules`: PASS — resolver/DST; management/SQLite/approval/CRUD/replay/Gateway; durable claims/restart/recovery/suppression/Task authorization/Publishing Agent.
- `npm.cmd run test:cloud`: PASS — all eight existing safe Cloud regressions.
- Interrupted Cloud-suite hang diagnosed as a stale schema `4.4` assertion occurring before local HTTP runtime shutdown. Updated the assertion/enum for `4.5` and preserved the pre-existing Signal discovery contract in the expanded tool description.

Codex 3/3 remains separately authorized work. No deployment, production schedule creation, Scheduler activation, Telegram send, Notion mutation or Railway access occurred. Mission 10 remains STOPPED.
