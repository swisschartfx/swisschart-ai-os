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
