# ARCHITECTURE DECISIONS — APPEND-ONLY CONTINUATION

The prior architecture-decision history remains preserved in `00_PROJECT_BRAIN.zip`. This loose append-only continuation was initialized during phase closure because the protocol-named file was not present in the working Project Brain directory.

---

# ADR — Telegram Is an Interface to the Central Assistant

Date: 2026-08-13

## Decision

Telegram is an interface to the Central Swisschart Assistant. It is not a separate Assistant.

Founder

↓

Telegram Interface

↓

Central Swisschart Assistant

↓

Capability Gateway

↓

Capabilities / Agents / Services

Specialized interfaces must delegate to the Central Assistant and must not duplicate Assistant intelligence.

## Reason

One central intelligence and authority path preserves consistent request understanding, capability selection, safety controls and execution behavior across present and future interfaces.

## Impact

The Founder Telegram interface handles transport, Founder authorization, supported-message filtering and same-chat responses. Capability execution remains governed by the Central Assistant and Capability Gateway. Production Telegram publishing remains isolated behind the existing Publishing Agent path.

---

# ADR — Top-Down Architectural Definition + Bottom-Up Capability Completion

Date: 2026-08-16

Status: APPROVED

## Decision

Swisschart AI OS defines stable interface, authority, orchestration, capability, execution-control, data-boundary and provider contracts top-down, while completing real capabilities bottom-up and end-to-end from evidence.

The architecture is a dependency graph, not a mandatory pipeline. Logical layers do not prescribe physical repository structure. Capabilities do not inherently require Agents, and future Agents are never prerequisites for existing capability completion.

Canonical ownership must remain explicit for Data, Metrics, Identity, Policy, Operational State and Shared Intelligence. Domain-local implementations are allowed; competing business authority, canonical truth, canonical metrics, shared-intelligence systems and execution-control authorities are prohibited.

## Authoritative Detail

The complete decision is recorded in `18_TOP_DOWN_ARCHITECTURAL_DEFINITION_BOTTOM_UP_CAPABILITY_COMPLETION.md`.
