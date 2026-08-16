# Mission 6 — Founder Operations Capability Audit and Design

Date: 2026-08-14
Status: Audit and design complete; no mutation path enabled

## Production invariants

- Public MCP surface remains exactly one tool: `swisschart.query`.
- Claude interprets Persian/English language and submits semantic structured arguments.
- Swisschart validates normalized business periods and actions server-side.
- Claude-originated objects continue through `SwisschartAssistant.handle(object)` and bypass `LLMRequestUnderstanding`.
- Cloud remains read/analyze-only. Telegram polling, Scheduler execution, Notion mutation, publishing and all other mutations remain disabled.
- Mission 5 OAuth persistence and `/health` configuration remain unchanged.

## Capability audit ratings

| Area | Rating | Current evidence |
|---|---|---|
| Natural time ranges | MISSING | Public queries and Trading Data accept `current_month` only; General Analysis accepts `current_month` or `all_time`. |
| New York timezone standard | PARTIAL | Signal timestamps use `America/New_York`, but Notion month filtering uses UTC and automation parsing defaults to `Europe/Istanbul` or UTC. |
| Signal to Notion | PARTIAL | A legacy Journal Agent can create a Notion trade, but it bypasses Gateway/Task/Approval, uses separate environment names and has no idempotent production contract. |
| Signal to Telegram | PARTIAL | Existing Publishing Agent can format/publish signals, and an approved text Task path exists, but the legacy signal route publishes directly and Signal/photo publishing lacks Task-level idempotency. |
| Timed/scheduled messages | PARTIAL | One-time and daily foundations exist, but weekly/delay contracts, durable execution state, missed-run policy and production composition are missing. |
| Approval/safety model | PARTIAL | Task/Approval/Rule foundations exist, but Task, approval and execution state are in memory and no durable prepared-action hash binds approval to exact future effects. |

## Provider-neutral structured period contract

Claude may choose the requested semantic preset or provide explicit local dates. Claude must not calculate provider filters or internal capability names. Swisschart resolves and validates the range using its authoritative clock.

```json
{
  "period": {
    "contractVersion": "1.0",
    "preset": "today",
    "timezone": "America/New_York"
  }
}
```

Explicit range input:

```json
{
  "period": {
    "contractVersion": "1.0",
    "preset": "explicit",
    "startDate": "2026-08-01",
    "endDate": "2026-08-14",
    "timezone": "America/New_York"
  }
}
```

Allowed presets: `today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_30_days`, `last_3_months`, `year_to_date`, `explicit`.

Server-normalized output must contain `startLocalDate`, `endLocalDateExclusive`, `startInstant`, `endInstantExclusive`, `timezone`, `resolvedAt` and `contractVersion`. Ranges are half-open. Explicit `endDate` is Founder-facing inclusive and is normalized to the next local date as `endLocalDateExclusive`.

Deterministic definitions in New York:

- `today`: local start of today through local start of tomorrow.
- `yesterday`: local start of yesterday through local start of today.
- `this_week`: Monday 00:00 through local start of tomorrow, for date-based trading queries.
- `last_week`: prior Monday through current Monday.
- `this_month`: first local calendar day of this month through local start of tomorrow.
- `last_month`: first day of prior month through first day of this month.
- `last_30_days`: local date 29 days before today through local start of tomorrow.
- `last_3_months`: local date three calendar months before today through local start of tomorrow; invalid day-of-month is clamped to that month’s last day.
- `year_to_date`: January 1 through local start of tomorrow.
- `explicit`: validated ISO local dates, `startDate <= endDate`, with a configured maximum span.

For Notion date-only `Publish Date`, use `startLocalDate` with `on_or_after` and `endLocalDateExclusive` with `before`. For datetime providers, use normalized UTC instants. Providers receive normalized boundaries and do not interpret presets.

## New York timezone rules

Business timezone is the IANA zone `America/New_York`; no fixed UTC offset is allowed.

- Persist/audit machine timestamps as UTC ISO instants.
- Persist the originating IANA zone and local wall-clock specification for scheduled operations.
- Display Founder business times in New York with local date/time and offset/zone label.
- Resolve recurring daily/weekly occurrences independently in New York; never add 24 hours to the prior UTC instant.
- Delay schedules use elapsed duration from an absolute instant and are unaffected by DST wall-clock changes.
- Reject nonexistent spring-forward local times and request a new time.
- For duplicated fall-back local times, require explicit earlier/later occurrence selection; never guess.
- Date-only Notion fields remain New York business dates. Datetime fields use UTC instants with the New York zone retained in execution metadata.

Current risks:

- `notionCapability.currentMonthFilter()` derives year/month with `getUTC*`, producing wrong business-month selection near New York month boundaries.
- Cloud business queries hard-code `current_month`.
- `analysisRequirementContract` restricts periods to `current_month/all_time`.
- `founderCommandParser` hard-codes `Europe/Istanbul` and a fixed +03 conversion.
- Scheduler defaults unspecified zones to UTC.
- Scheduler conversion has no explicit nonexistent/ambiguous DST policy.
- Signal/trade lifecycle uses `Intl` with New York correctly for the current instant, but stores date and time in separate fields without offset or source instant.

## Signal to Notion audit and proposed flow

Existing reusable pieces:

- `createSignal()` validates pair, direction, entry, stop, three targets, risk and grade; calculates stop size and planned RR.
- Journal Agent maps a Signal to a Notion page and can create/update trades.
- Notion read access is provider-abstracted through current Capability/Service boundaries.

Current blockers:

- `signalExecution.js` calls Telegram and Notion directly, outside Capability Gateway, Task Engine and Approval.
- Legacy Journal code uses `NOTION_TOKEN` and `NOTION_DATA_SOURCE_ID`, while Cloud uses `NOTION_API_TOKEN` and `NOTION_DATABASE_ID`.
- Trade ID generation scans records and increments in memory; concurrent requests can duplicate IDs.
- No durable idempotency key or verified prepared-action record exists.
- The Journal Agent logs the full trade object.
- The Cloud Registry exposes no approved Notion signal-create operation.
- Notion schema compatibility is assumed rather than checked before preparation.

Required Notion properties include Trade ID/title, Grade/select, Pair/select, Direction/select, Result/select, Trade State/select, Status/select, Entry/rich text, Stop Loss/rich text, TP1/TP2/TP3 Price/rich text, Stop size/number, Risk/number, Planned RR/number, Publish Date/date, Signal Time NY/rich text, plus optional screenshots and TradingView URL.

Proposed path:

Claude intent → `swisschart.query` semantic operation → validate Signal contract → normalize New York timestamp → validate Notion schema → create immutable prepared action + hash/idempotency key → Founder approval → Capability Gateway → Notion Signal Capability → Notion Service → verify page ID → durable audit Result.

Notion signal creation requires explicit Founder approval for every creation in the first write milestone.

## Signal to Telegram audit and proposed flow

Existing reusable pieces:

- Publishing Agent formats signals and sends text or photo to the configured Telegram destination.
- Central footer enforcement exists.
- `TelegramPublishingCapability` declares mutating behavior and required approval.
- Task Engine validates the approved primary destination and records verified Telegram `message_id` for text publication.

Current blockers:

- Legacy `signalExecution.js` sends a risk reminder and signal directly without Task/Gateway approval.
- Task Engine v1 supports approved text only, not the structured Signal/photo payload.
- Agent Registry explicitly declares `idempotencySupport: false`.
- Task, approval and execution history are in memory.
- No immutable prepared-message preview/hash binds approval to exact content, image and destination.
- Uncertain Telegram delivery has no durable reconciliation record.

Proposed path:

Claude intent → semantic `swisschart.query` operation → validate Signal → render canonical preview → prepare immutable publication action with destination/content/image hash/idempotency key → Founder approval → Capability Gateway → Telegram Publishing Capability → Publishing Agent → Telegram Service → verify chat/message ID → durable audit Result.

Telegram signal publication requires explicit Founder approval for each immediate publication.

## Scheduling audit and proposed flow

Current support:

- `Scheduler.addJob()` supports in-process one-time execution.
- `Scheduler.addDailyJob()` supports in-process daily wall-clock jobs.
- Automation Manager models one-time and daily triggers and has a local JSON store.
- Scheduler Runtime creates Event Engine candidates and an approval-pending Task.
- Occurrence keys and scheduled idempotency keys suppress duplicates only within the running process.

Gaps:

- No first-class delay or weekly recurrence contract.
- Scheduler/Task/Event/Approval execution state and processed occurrences are not durable.
- Local automation JSON is not wired to the Cloud Railway Volume.
- No deterministic missed-run/catch-up policy.
- One-time automations are not automatically retired after completion.
- Daily occurrence generation can surface an already-due occurrence, but durable exactly-once behavior is absent.
- Production Scheduler remains disabled.

Proposed schedule contract supports `at`, `after`, and `recurring` (`daily`/`weekly`). It stores `timezone: America/New_York`, local schedule specification, resolved next UTC instant, immutable prepared action reference, approval hash, misfire policy and idempotency key.

Misfire policy for publishing should default to `hold_for_founder_review`; never silently publish stale signals. Duplicate prevention must use a durable unique occurrence key. Every attempt/result must be durable before production activation.

Scheduled Telegram publishing requires approval of the exact content, destination and schedule at creation. A due occurrence may execute without a second approval only if its immutable action hash still matches the approved hash. Any content/time/destination edit invalidates approval and requires new approval. Cancellation does not require a second approval but does require an authenticated explicit Founder command and audit record. Editing a scheduled job requires new Founder approval.

## Minimum safe Founder mutation flow

Claude intent → Swisschart semantic validation → immutable prepared action and preview → durable pending Task/approval record → Founder approve/reject → revalidate action hash, authorization, policy and idempotency → Capability Gateway → Notion/Telegram/Scheduler boundary → verified external reference → durable Result/audit history.

Approval decisions:

- Notion signal creation: REQUIRED.
- Immediate Telegram signal publishing: REQUIRED.
- Scheduled Telegram publishing: REQUIRED when exact payload/schedule is created; no second approval at execution if unchanged.
- Scheduled-job edit: REQUIRED and prior approval invalidated.
- Scheduled-job cancellation: no second approval, but authenticated explicit Founder confirmation and audit REQUIRED.

## Recommended next implementation sequence

Mission 7 should remain read-only and implement only the shared New York period foundation:

1. Add one provider-neutral Period Contract/Resolver with injected clock, IANA validation, half-open boundaries and explicit DST tests.
2. Replace UTC month filtering with normalized New York boundaries in Trading Data → Notion read queries.
3. Extend Trading Data, Trading Analytics and General Analysis inputs to the normalized Period Contract.
4. Extend the single `swisschart.query` schema with semantic query plus period input; expose no capability/operation names.
5. Add Persian/English Claude E2E coverage for every preset and explicit range, plus boundary/DST/missing-data regressions.
6. Deploy read-only and verify real Notion ranges before designing durable prepared actions.

Only after Mission 7 read-only proof should a separately authorized mutation mission implement durable prepared actions/approvals, then Notion signal creation, Telegram signal publishing and finally Scheduler activation in that order.

## Test-isolation finding

Two legacy Notion tests assert an obsolete result shape. The Automation Bridge integration test uses the shared local automation JSON instead of a temporary store; during this audit it added the fixtures `one-time-automation`, `disabled-automation` and `parsed-daily-automation` to `06_Data/Automation/automations.json`. No production Scheduler or external action ran. The records were not deleted because project rules require explicit Founder authorization for removal. Future work must inject a temporary Automation Store in this test before rerunning it.
