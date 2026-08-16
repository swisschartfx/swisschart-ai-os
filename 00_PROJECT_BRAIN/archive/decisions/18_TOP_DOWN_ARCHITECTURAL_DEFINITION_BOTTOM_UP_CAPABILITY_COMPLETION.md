# SWISSCHART AI OS

# TOP-DOWN ARCHITECTURAL DEFINITION + BOTTOM-UP CAPABILITY COMPLETION

Status: APPROVED
Date: 2026-08-16
Decision Type: Authoritative Architecture Principle

---

# Context / Problem

Swisschart AI OS already defines one Central Assistant, a Capability Gateway authority boundary, reusable capabilities, execution-control infrastructure, provider-neutral service boundaries and replaceable AI providers. Simplified vertical diagrams can nevertheless be misread as mandatory pipelines, logical layers as required repository folders, and Agents as prerequisites for every capability.

This decision formalizes and clarifies the existing architecture. It is not an architecture replacement and does not authorize runtime implementation.

# Final Principle

Swisschart AI OS uses **Top-Down Architectural Definition and Bottom-Up Capability Completion**.

Stable interface, authority, orchestration, capability, execution-control, data-boundary and provider contracts are defined in advance, while implementation remains evidence-driven.

The architecture is a dependency graph, not a mandatory processing pipeline, and logical layers do not prescribe physical repository structure.

Each real capability is completed end-to-end using only the shared infrastructure it actually requires.

New domains and Agents plug into existing contracts and may extend shared infrastructure where justified, but must not create competing business authority, conflicting canonical data or metric definitions, independent shared-intelligence systems, or parallel execution-control authorities.

Domain-local implementations, caches and specialized analytics are allowed when ownership remains explicit and they do not create a second source of truth or competing brain.

Future Agents are never prerequisites for an existing capability to become production-complete.

# Final Logical Architecture

Founder

↓

Founder Interfaces — Claude and fallback interfaces

↓

Central Swisschart Assistant — Business Orchestrator

↓

Capability Gateway — Authority Boundary

↓ conceptual dependency graph, not mandatory pipeline

## Shared Core Capabilities / Concerns

- Data & Normalization
- Metrics
- Analytics
- Intelligence
- Advisor
- Knowledge
- Context / Memory
- Identity / Entity References
- Brand Identity
- Cost / Usage

## Domain Capabilities

- Trading
- Publishing
- Content
- Instagram
- Telegram
- X
- YouTube
- Website
- Future domains

## Execution & Control Infrastructure

- Task
- Event
- Rule
- Approval
- Scheduler
- Automation
- Audit
- Idempotency
- Operational State

↓ only where genuinely needed

Agents / Workflows

↓

Provider Services

↓

External Systems / APIs, including Notion, Telegram, Meta / Instagram, X, YouTube, TradingView, Website and future providers.

# Dependency Graph Rule

No request must pass through every Shared Core concern. The real request and capability determine the dependency graph. Valid examples include:

- Central Assistant → Capability Gateway → Trading Data Capability → Notion
- Central Assistant → Capability Gateway → Trading Analytics Capability → Trading Data Capability → Notion
- Central Assistant → Capability Gateway → Advisor → Cross-domain Analytics → Shared Data / Metrics

These are valid dependencies, not universal pipelines.

# Logical Architecture Does Not Prescribe Physical Structure

This architecture does not authorize a giant `Shared_Core` folder, package, service or monolith. Logical ownership and stable contracts are the priority. Physical code organization evolves only when implementation evidence justifies it. No folder or service should be created merely to mirror the diagram.

# Shared Core, Domain and Execution-Control Distinction

Shared Core, Domain Capabilities and Execution & Control Infrastructure are parallel logical concerns, not a vertical stack. They may depend on one another through explicit contracts. Execution & Control remains separate from Data and Intelligence and must not become a second business brain.

# Agent Optionality

A Capability does not require an Agent. Trading Analytics may depend directly on Trading Data; Brand Identity may depend directly on a Brand Registry. Agents and Workflows exist only when an independent actor, workflow lifecycle, specialized worker or orchestration behavior is genuinely needed. Avoid Agent proliferation.

# Canonical Ownership and Duplication

Source-of-truth and contract ownership must be explicit for Data, Metrics, Identity, Policy, Operational State and Shared Intelligence. No Agent, domain or provider adapter may silently become a competing authority.

Technical/local duplication can be legitimate for caches, local projections, provider-specific logic and specialized analytics. Competing or inconsistent duplication of business authority, canonical truth, canonical metrics, shared business intelligence or execution-control authority is prohibited.

# Operational State Versus Memory

Context / Memory contains conversational context, prior Founder decisions and reasoning/workflow context references.

Operational State contains approvals, tasks, events, scheduler occurrences, automation state, execution records, idempotency and durable workflow/business state. It is deterministic and durable and must never be treated as AI memory. AI memory must never substitute for authoritative Operational State.

# Analytics Ownership

Domain-specific analytics are allowed, including Trading Max Consecutive Losses, Instagram Reel Retention Analysis and YouTube Watch-Time Analysis.

Canonical metric definitions, shared business intelligence, cross-domain analytics and authoritative interpretations require explicit ownership and must not be independently and inconsistently reimplemented across Agents. An Instagram-specific Reel Retention metric is valid; conflicting authoritative meanings for the same canonical `content_conversion_rate` are not.

# Identity / Entity-Reference Principle

Future domain entities should be capable of exposing normalized references conceptually containing `entity_type`, `entity_id`, `source`, `external_reference` and parent/reference relationships.

This formalizes only the principle. It does not define a universal cross-platform schema. Exact Trade, Reel, Telegram Post, Campaign and future relationships must be designed later from real domain requirements.

# Evidence-Driven Implementation

Top-Down Architecture does not mean Top-Down Implementation. Architecture may define future boundaries before implementation exists. Implementation occurs only when a real current capability requires it. Do not pre-build hypothetical universal infrastructure.

# Independent Production Completion

Every current Capability or Agent must be able to become production-complete without unrelated future Agents. Telegram can become production-complete without Instagram, X, YouTube or future Growth Intelligence. Future domains plug into existing contracts and minimally extend them only when real requirements demonstrate the need.

# Reference Trading / Notion Pattern

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

Analytics must not directly depend on Notion SDK or database-property details. Notion remains behind provider-neutral Trading Data boundaries. This is a reference pattern, not a mandatory universal pipeline.

# Deferred Decisions

The following remain **DEFERRED / UNKNOWN** until real domain requirements justify them:

- Data Warehouse technology
- Data Lake
- Kafka / broker / event bus
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

This ADR does not select or design any of them.

# Consequences / Tradeoffs

The decision provides stable authority and ownership, independent capability completion, reduced Agent/infrastructure proliferation, provider/model replaceability and consistent canonical definitions. It also requires explicit ownership decisions and case-specific dependency design, deliberately leaves some shared abstractions deferred, and requires duplication to be judged by authority and source-of-truth impact rather than a simplistic zero-duplication rule.

# Non-Goals

This decision does not replace existing architecture; implement runtime behavior; require new capabilities, Agents, folders, packages, services or databases; refactor current Agents or Request Understanding; implement Advisor, Shared Data Platform, Identity or Data Warehouse; define detailed domain schemas; or authorize deployment, scheduling, publication, external mutation or Mission 10.

# Relationship to Existing Architecture Decisions

This ADR preserves:

- one Central Swisschart Assistant
- Claude as Founder conversational interface / general reasoning layer
- Swisschart backend as deterministic business authority
- Capability Gateway as authority boundary
- interfaces do not duplicate core Assistant intelligence
- specialized Agents do not become isolated mini-systems
- provider implementations remain behind Services / capability boundaries
- AI provider/model independence
- approval gates and idempotency requirements
- Scheduler does not own business decisions
- Task / Event / Rule / Approval separation
- Notion remains behind provider-neutral Trading Data boundaries
- unattended writes require appropriate durable state/idempotency
- Mission 10 remains STOPPED unless separately authorized

The existing ADR **Telegram Is an Interface to the Central Assistant** remains authoritative. This decision generalizes the same authority and non-duplication principles across future interfaces, domains and capabilities.

# Decision

**APPROVED.** This document is the authoritative interpretation of Top-Down Architectural Definition and Bottom-Up Capability Completion for Swisschart AI OS.
