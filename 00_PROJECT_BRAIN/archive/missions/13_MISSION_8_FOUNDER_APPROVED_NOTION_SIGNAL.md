# Mission 8 — Founder-Approved Signal Creation to Notion

Date: 2026-08-14
Status: COMPLETE

## Architecture

Founder → Claude → one public `swisschart.query` tool → Signal Draft validation → durable prepared action → explicit Founder approval → immutable hash verification → `SwisschartAssistant.handle(object)` → Capability Gateway → `signal.notion` capability → Notion Service → one verified page.

Claude interprets Persian/English. Swisschart owns required fields, normalization, fixed destination, approval state, execution, audit and idempotency. `LLMRequestUnderstanding` is bypassed.

## Signal Draft contract

Contract version `1.0` requires pair, direction, entry, stop loss, three targets, risk and grade. Swisschart normalizes pair/direction/numbers, validates price ordering and grade, and adds the authoritative New York publish date/time. The initial destination is fixed server-side to the primary Swisschart trading journal.

## Approval contract

Preparation stores an immutable normalized draft, destination and metadata. A SHA-256 payload hash binds all three. Execution requires the authenticated Founder to send `confirm=true`, the prepared action ID and the exact hash. Missing approval, invalid IDs and changed hashes are rejected. Every signal creation requires a new approval.

## Idempotency model

The payload hash is the idempotency key and produces a deterministic test trade identifier. Prepared, approved, completed and result state is stored atomically beside OAuth state on the Railway Volume. A completed action replay returns the stored page/trade reference and never calls Notion again. Concurrent approval is blocked once the action leaves `pending_approval`.

If the process stops after external creation but before completion is persisted, the action remains non-retryable pending manual reconciliation; automatic uncertain retries are intentionally disabled to prevent duplicates.

## Production evidence

- Existing Railway service deployment `037da1e2-3406-4075-a13f-4c13df1fbd9b`: SUCCESS
- Health: PASS
- Public MCP tools: exactly one, `swisschart.query`
- Mission 7 production read: PASS
- Unapproved/unknown signal execution: rejected
- Founder explicitly approved the exact prepared test payload
- Exactly one Notion page created and retrieved successfully
- Trade ID: `SCT-M8-683ED1D603`
- Replay returned `replayed=true` and the same page ID
- Production logs showed prepare, rejection, approved completion and replay only
- No Telegram, publishing or Scheduler event was observed

## Tests

Cloud/OAuth, Signal validation/approval/hash/idempotency, Capability Gateway, Trading Data/records, Trading Analytics, General Trading Analysis, Notion period filtering and Telegram runtime/polling/adapter all PASS. `git diff --check` PASS.

## Limitations

- Only primary trading-journal signal creation is enabled; generic Notion mutation remains unavailable.
- Signal editing, rejection UX and administrative reconciliation have no public operations.
- Uncertain external outcomes require manual reconciliation and cannot auto-retry.
- The durable file store remains appropriate only for the current single Railway replica.
- Telegram publishing and scheduling remain disabled.

## Exact next step

No next mission is authorized. Any Telegram publishing, scheduling or broader mutation work requires a separately scoped Founder mission.

---

## Corrective patch — Sequential Trade ID and view ordering

Date: 2026-08-14
Status: CODE/DEPLOYMENT COMPLETE; EXISTING RECORD CORRECTION AWAITS FOUNDER APPROVAL

The first read-only inspection found a typo titled `TSC-2645`; the Founder manually corrected it to `SCT-2645`. The authoritative standard is exclusively `^SCT-\d+$` because SCT means Swiss Chart Trading. `TSC-N` and every other prefix are invalid and must not participate in allocation or ordering. The corrected production tail is `SCT-2644`, `SCT-2645`, `SCT-2646`.

The Mission 8 hash-style ID generator was replaced. The finalized canonical contract is `SCT-YYNN`: `YY` is the final two digits of the authoritative `America/New_York` calendar year and `NN` is that year's sequence from `01` through `99`. Allocation considers only exact canonical IDs for the current New York year and resets to `01` at New York midnight on January 1; prior-year values never carry forward. A single-process allocation queue plus a per-year reservation floor prevents simultaneous approvals from receiving the same ID. Durable completed-action replay still returns the same stored ID/page without executing Notion again; restart/redeploy reconstructs replay state from the Railway Volume.

The exact canonical validation pattern is `^SCT-\d{2}(0[1-9]|[1-9]\d)$`. Examples: the successor of `SCT-2646` during 2026 is `SCT-2647`; the first 2027 ID is `SCT-2701`; the first 2028 ID is `SCT-2801`. UTC year is never used for allocation.

Notion view inspection using the current View API found four accessible views (`Untitled`, `Equity Curve`, `Public Track Record`, `Gallery`) and every view reported `sorts: null`. The visible position is therefore not caused by an explicit Publish Date, Created Time or Trade ID sort. It is the unsorted/manual/default insertion order. No business timestamp was changed and no view configuration was modified.

Corrective deployment `af3c62e5-aaff-455a-8f18-526dbaedc975` is SUCCESS; health, one-tool MCP exposure and Mission 7 read regression pass. The existing `SCT-M8-683ED1D603` page remains unchanged.

Proposed authorized correction: update only that existing page's `Trade ID` title to `SCT-2646`, after confirming no other numeric 2646 has appeared. For visual placement, the smallest no-schema change is to move the row manually in the currently unsorted view. For deterministic future ordering, the Founder may separately authorize an explicit view sort; Created Time ascending preserves creation order, while robust numeric-ID ordering would require a dedicated numeric sequence property. No view change is authorized in this corrective patch.

### Authorized record correction completed

Date: 2026-08-15

The Founder explicitly approved changing only the existing test page title. Immediately before mutation, production was re-queried and neither `SCT-2646` nor `TSC-2646` existed; exactly one `SCT-M8-683ED1D603` target existed. That same page's `Trade ID` was changed to `SCT-2646`. Post-update retrieval confirmed the same page ID, active/non-archived state, and byte-equivalent JSON for every property other than `Trade ID`. No date, time, view, Telegram, Scheduler or other record was changed.
