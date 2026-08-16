# Mission 9 — Founder-Approved Signal Publishing to Telegram

Date: 2026-08-15
Status: CORRECTIVE PATCH DEPLOYED — TWO-MESSAGE PRODUCTION PROOF AWAITS FOUNDER APPROVAL

Swisschart now supports a narrowly scoped signal-publication action through the existing single `swisschart.query` MCP tool. Swisschart renders the final signal message, binds that immutable content, the configured primary Telegram destination, signal reference and metadata to a SHA-256 payload hash, and requires explicit authenticated Founder approval before execution.

Approved execution follows the structured Assistant and Capability Gateway path to a dedicated approval-required Telegram Signal capability, which reuses the existing Publishing Agent and Telegram service. Signal creation and signal publication remain separate approval actions. Generic Telegram messages, scheduling and unrelated mutations are not enabled by Mission 9.

Production deployment `958f231d-9b99-4c94-933b-b983c6f093c4` is SUCCESS. Railway environment configuration now includes the existing Telegram credential variable names without storing their values in source or Project Brain. The destination was verified read-only as the `Swiss chart trading` channel with username `@swisschart_SCT`.

After exact Founder approval, the SCT-2646 test signal was published exactly once. Telegram returned message ID `590`. Replaying the identical approval returned the stored same message ID with `replayed=true` and did not invoke a second publish. Railway logs show one pending preparation, one completed execution and one completed replay; Scheduler event count remained zero.

Verification passed for payload-change rejection, approval requirement, destination binding, referenced-Notion-signal verification, replay idempotency, Mission 7 reads, Mission 8 signal creation, Cloud/OAuth, Capability Gateway, Trading/Analytics/General Analysis, Notion filtering, Telegram regressions and `git diff --check`.

Remaining limitation: Telegram does not provide a client-supplied idempotency key. Swisschart prevents normal retry/replay duplication with durable state, but an infrastructure crash in the narrow interval after Telegram accepts a post and before the completion record is persisted cannot be proven exactly-once. Scheduled execution must use a conservative recovery/hold policy.

## Corrective two-message bundle

The Founder identified that the canonical Risk Management reminder must immediately precede every signal. The authoritative existing template is reused from `03_Workflows/riskReminder.js`; no wording was invented. The approval payload now binds the exact Risk Management message, exact rendered signal, configured channel, signal reference, format metadata and strict order `risk_management` then `signal`.

Message-level state is persisted after each verified Telegram response. A normal retry or restart skips any completed first message and resumes only the failed/missing second message. Completed replay sends neither message. Concurrent approvals for one action are serialized. If the process dies after Telegram accepts a message but before its message ID is persisted, the recovered `sending` state becomes `delivery_uncertain` and automatic retry is blocked for review, because Telegram provides no client idempotency key or history reconciliation primitive.

Final corrective deployment `00cc1b58-4630-444a-b35b-b5f9bcadab0b` is SUCCESS. `/health`, exactly one public tool, Mission 7 read and unapproved rejection pass. A production bundle was prepared with both message states pending; no corrective test message has been sent. Scheduling and Scheduler remain disabled.

## Conversational signal intake hardening

Schema `4.2` adds the non-mutating semantic action `signal_validate` inside the same single public tool. Claude may submit an empty or partial signal snapshot while collecting fields conversationally. Swisschart returns the exact ordered `missingFields`, separately reports invalid supplied fields, never supplies absent values, and produces a normalized signal only when all nine required fields validate. `signal_prepare` remains the separate full-draft Notion approval boundary; Telegram bundle preparation/approval remains separate again.

Production deployment `4b1d00c7-ed7d-4ed2-a185-1b006d05152f` is SUCCESS. Empty, partial and complete validation calls passed without creating a signal or publishing a message. Claude retains conversational slots and submits the current snapshot; Swisschart remains stateless and authoritative for validation. A live Claude conversational E2E has not yet been performed, and an existing Claude conversation may retain schema `4.1`; a new conversation is required to guarantee discovery of schema `4.2`.

## Authoritative Founder signal UX revision

Schema `4.3` treats every natural Founder “Signal / سیگنال” equivalent as the domain intent `swisschart_signal_workflow`; Claude must call `signal_intake_start` immediately and must not ask what kind of signal or destination. The backend returns one-field collection order Asset, Direction, Entry, Stop Loss, Risk, Grade and accepts multiple volunteered fields in one snapshot.

A provider-neutral Instrument Normalizer currently contains verified aliases for EURUSD, GBPUSD and XAUUSD, including the required Persian/English GBPUSD and XAUUSD forms. Unknown instruments return `SIGNAL_ASSET_UNKNOWN`, keep `nextField=pair`, and require clarification.

Legacy audit found no authoritative TP-generation rule. The old Assistant explicitly collects TP1, TP2 and TP3, while `createSignal()` only derives Stop Size and R:R from supplied prices. Consequently, after the six primary fields schema `4.3` returns `SIGNAL_TP_RULE_MISSING` and collects TP1, TP2 and TP3 one at a time without fabrication. Once supplied, the existing `createSignal()` derives canonical symbol, pip stop size, R:R values, planned RR, star formatting and publication formatting. Trade ID remains the SCT-YYNN allocator's responsibility after separate Notion approval.

Final non-mutating deployment `ca6b9033-8702-467a-b845-38be252e7db7` is SUCCESS and healthy. No SCT-2647, Telegram approval/send or Scheduler event occurred. Mission 10 remains stopped.

## Session closeout — 2026-08-15

Status: **MISSION 9 OPEN — SESSION CLOSED — 2026-08-15**

Do not mark Mission 9 complete. The original single-message SCT-2646 publication returned message ID `590`, but the required corrective Risk Management→Signal two-message bundle has not yet been proven with a real send.

The deployed implementation has immutable bundle approval, exact destination `@swisschart_SCT`, shared URL `https://linktr.ee/swisschart`, per-message durable state, signal-only resume after a persisted successful first message, concurrent approval serialization and zero-send completed replay. Telegram's provider crash window remains handled through `delivery_uncertain` / held-for-review.

Before that proof, the live Claude intake blocker must be fixed. Backend schema `4.3` is healthy, but Claude did not route Founder `سیگنال` directly to `signal_intake_start`; it returned generic interpretations and later a capability choice. The next task is schema/tool-description semantic hardening so the first effective response becomes `Asset چیه؟`.

No SCT-2647 exists. The intended next real test may create it only after a complete conversational preview and explicit Notion approval. Telegram remains a later, separate explicit approval. Mission 10 remains STOPPED. Full handoff: `16_SESSION_HANDOFF_2026-08-15.md`.
