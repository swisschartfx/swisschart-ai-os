# Session Handoff — 2026-08-15

Status: **SESSION CLOSED — 2026-08-15**

## Current production architecture

Founder → Claude → Swisschart Remote MCP on Railway → Business Orchestrator / Capability Gateway → Trading / Analytics / Notion / Publishing / future Scheduling.

Claude owns natural Persian/English conversation, Founder intent interpretation, conversational slot collection and phrasing. Swisschart owns business truth, normalization, validation, missing-data enforcement, deterministic calculations, capability execution, authorization, approvals, mutations, publishing, durable state and idempotency/recovery.

The public MCP surface must remain exactly one tool: `swisschart.query`. Never expose raw Notion, Telegram, Publishing, Task, Event, Rule, Approval or provider methods. Railway remains always-on.

## Production identifiers and Notion

- Canonical Trade ID: `SCT-YYNN`; SCT means Swiss Chart Trading.
- `TSC` is invalid.
- `YY` uses the authoritative `America/New_York` calendar year.
- `NN` resets annually and currently supports only `01..99`; do not invent a >99 format.
- Current verified tail: `SCT-2644`, `SCT-2645`, `SCT-2646`.
- Expected next ID during 2026, only after explicit approval: `SCT-2647`.
- First 2027 ID: `SCT-2701`.
- Mission 8 Notion creation is production-proven.
- `Trade Sequence` formula and ascending primary `Untitled` view ordering are production-complete.
- No `SCT-2647` exists.

## Mission 9 Telegram state

The original single-message SCT-2646 test produced Telegram message ID `590`. That exposed an incomplete behavior: every signal must be preceded immediately by the canonical Risk Management message.

Corrective implementation treats publication as one immutable two-message approval bundle to `@swisschart_SCT` (`Swiss chart trading`):

1. Risk Management
2. Signal

Both messages use the canonical shared URL `https://linktr.ee/swisschart`. Approval binds both exact messages, destination, signal reference, metadata and order. Message-level durable state supports zero-send completed replay, signal-only resume after a persisted successful Risk Management message, and serialization of concurrent same-action approvals.

Telegram has no client-supplied idempotency key. A crash after Telegram accepts a message but before Swisschart persists its message ID cannot be mathematically exactly-once; recovery conservatively enters `delivery_uncertain` / held-for-review rather than blindly resending.

The corrective real two-message production proof has **not** occurred. Mission 9 is not complete.

## Founder conversational signal contract

Production MCP schema: `4.3`.

Latest non-mutating production deployment: `ca6b9033-8702-467a-b845-38be252e7db7` — SUCCESS and healthy.

Evidence for that hardening: Scheduler events `0`; signal mutations `0`; Telegram approvals/sends `0`.

Schema `4.3` added `signal_intake_start`. Natural Founder equivalents such as `Signal`, `سیگنال`, `یه سیگنال دارم`, `سیگنال بزن`, `سیگنال منتشر کنیم` and `publish signal` mean “start Swisschart trading-signal intake.” Claude must not ask what kind of signal, whether it is stock/engineering/messenger, where it should publish, query versus signal, or show a generic capability menu.

Preferred one-field order:

1. Asset
2. Direction
3. Entry
4. Stop Loss
5. Risk
6. Grade
7. TP1
8. TP2
9. TP3

Accept all voluntarily supplied fields and skip fields already present.

Current verified aliases:

- EURUSD: `EURUSD`, `EUR USD`, `EUR/USD`, `euro dollar`, `euro/dollar`, `یورو دلار`, `یورو/دلار`
- GBPUSD: `GBPUSD`, `GBP USD`, `GBP/USD`, `pound dollar`, `pound/dollar`, `پوند دلار`, `پوند/دلار`
- XAUUSD: `XAUUSD`, `XAU USD`, `XAU/USD`, `Gold`, `gold dollar`, `طلا`, `طلا دلار`

Unknown/ambiguous assets require clarification and must never be guessed. Keep the registry extensible; do not turn it into a fixed UI dropdown.

Founder supplies Asset, Direction, Entry, Stop Loss, Risk, Grade, TP1, TP2 and TP3. Swisschart derives canonical symbol, Stop Size, three R:R values, Planned RR, grade stars, canonical Telegram formatting, Risk Management text, New York date/time and—after approved Notion creation—the SCT-YYNN ID.

There is no authoritative TP-generation rule. The legacy Assistant collects all three targets and `createSignal()` calculates Stop Size/R:R from supplied targets but does not create target prices. `SIGNAL_TP_RULE_MISSING` is intentional. Never invent a 1R/2R/3R TP formula without Founder instruction.

## Current blocker

Backend schema `4.3` and production validation tests pass, but live Claude routing is not correct. When the Founder sent `سیگنال`, Claude first returned generic meanings. After being told to use the connector, Claude recognized Swisschart but offered a capability choice and requested all details rather than immediately invoking `signal_intake_start`.

The active gap is Claude MCP tool discovery/semantic routing/tool-description behavior—not backend validation. A routing-hardening prompt was designed but has not been executed.

## Exact next execution sequence

1. Harden the sole MCP schema/tool description so explicit `Signal / سیگنال` intent directly calls `requestType=signal_intake_start` and asks only returned `nextField`.
2. Deploy only that non-mutating routing/schema-description hardening.
3. In a brand-new Claude conversation, send `سیگنال`; expected first response is effectively `Asset چیه؟` with no generic menu or clarification.
4. Prove one-field collection through Asset → Direction → Entry → Stop Loss → Risk → Grade → TP1 → TP2 → TP3, Persian aliases, normalized preview and deterministic Stop Size/R:R. Stop at Notion approval.
5. After new explicit Founder approval only, create exactly one signal. If the tail remains unchanged, it must be `SCT-2647`. Verify properties, `Trade Sequence=2647`, ordering and replay safety.
6. Prepare Telegram separately and display exact Risk Management text, SCT-2647 signal, destination, URLs, approval ID and payload hash. Stop at Telegram approval.
7. After separate explicit approval only, send Risk Management then SCT-2647 Signal. Verify two distinct message IDs, order, links, zero-send replay and Scheduler count zero. Only then close Mission 9.
8. Only afterward resume the authorized Mission 10 roadmap; its first real scheduled mutation still needs explicit Founder approval.

## Mission 10

Mission 10 is **STOPPED**. Partial work was intentionally removed and must not be assumed to exist.

Planned contract: immutable message/destination/New York schedule/timezone hash; DST-safe resolution; Railway Volume durability; lifecycle `pending_approval`, `scheduled`, `executed`, `cancelled`, `failed`, `held_for_review`; missed runs default to Founder review; restart/redeploy recovery; duplicate prevention; one semantic MCP tool; no raw scheduling internals.

## Product direction

Claude is the Founder-facing conversational brain. Swisschart on Railway is the deterministic always-on business authority. Telegram is fallback/publishing/alerts. Notion remains the current business source of truth; PostgreSQL is deferred where appropriate. Avoid dual-brain interpretation. Developer/Codex control remains a separate future security/control plane.

## Next session starting point

**Fix live Claude routing so Founder Signal/سیگنال immediately invokes `signal_intake_start` and asks Asset first.**

Do not create SCT-2647, mutate Notion, approve/send Telegram, or resume Mission 10 without reaching the specified approval gates.
