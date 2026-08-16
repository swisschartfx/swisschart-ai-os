# SWISSCHART AI OS

# EVENT ENGINE BLUEPRINT

Version: 1.0
Status: Implementation Foundation
Last Updated: 2026-08-12

---

# Purpose

Event Engine converts normalized internal events into controlled Task requests.

It does not access external providers, parse provider-specific payloads, publish messages or execute Tasks. Provider Services and source-specific adapters supply normalized Events; Task Engine owns resulting Task execution.

```text
External Event Source
↓
Provider Service
↓
Source-specific Event Adapter
↓
Event Engine
↓
Event Rules
↓
Task Engine
↓
Agent / Workflow
↓
Result
```

---

# Boundaries

- Forex Factory is an external data source. Its payload mapping belongs only in `05_forexFactoryEventAdapter.js`.
- Scheduler remains time infrastructure. `06_schedulerEventAdapter.js` converts Scheduler triggers into normalized Events without modifying Scheduler.
- Event Engine owns Event validation, reconciliation, lifecycle transitions and rule dispatch.
- Event Rules produce Task requests. Task Engine enforces approval, routing and execution.
- The first rule creates a founder-approval-pending Task only. It does not publish externally.

---

# Initial Lifecycle

`received` → `normalized` → `validated` → `upcoming` → `approaching` → `released`

Alternative states: `invalid`, `cancelled`, `superseded`, `archived` and `stale`.

An Event reaches `released` only when a source adapter provides verified release data; Event Engine does not infer release merely because scheduled time has passed.

---

# Initial Rule

The `high_impact_event_approaching` rule matches a normalized high-impact economic event in `approaching` state. It creates a Task request with source `event`, capability `publishing.publish` and approval status `pending`.

This validates Event Engine → Task Engine coordination without automatic external publication.
