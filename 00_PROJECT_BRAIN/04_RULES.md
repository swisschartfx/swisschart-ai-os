# SWISSCHART AI OS

# RULES

Version: 3.1
Status: Active
Last Updated: 2026-08-12

---

# Purpose

This document defines the operating principles and rules of Swisschart AI OS.

These rules protect:

- Swisschart DNA
- Company standards
- Architecture quality
- Founder decision-making
- Long-term scalability

---

# AI Architecture Rules

## Rule 1 — Central Assistant

Swisschart AI Assistant is the primary interaction point.

The founder communicates with one Assistant.

The founder should not need to manually operate individual Agents or platform systems.

---

## Rule 2 — Agent Responsibility

Agents are specialized capabilities.

Each Agent has one primary responsibility.

Examples:

- Journal Agent
- Content Agent
- Publishing Agent
- Calendar Agent
- Research Agent
- Performance Agent

Agents contain domain logic.

---

## Rule 3 — Service Responsibility

Services handle communication with external systems.

Architecture:

Agent

↓

Service

↓

External System

Agents should not contain direct external API logic.

---

## Rule 4 — Scheduler Responsibility

Scheduler controls time.

Scheduler decides:

WHEN something happens

Scheduler does not decide:

WHAT happens

Business logic belongs to Agents and Workflows.

---

## Rule 5 — Adaptive Architecture

Avoid creating permanent systems for temporary requirements.

Do not create:

- One workflow for every message
- One Agent for every small action
- One automation for every platform request

Preferred model:

Assistant

↓

Task Definition

↓

Task / Event / Workflow Engine

↓

Capability

↓

Execution

---

# Company Philosophy Rules

## Core Identity

Swisschart principles:

- Trust before growth
- Integrity before short-term success
- Professional decision-making
- Capital preservation
- Long-term thinking

These protect the foundation of the company.

---

# Philosophy Evolution

Company policies can evolve.

The system must support controlled evolution.

Process:

Founder Decision

↓

Assistant Analysis

↓

Policy Update Proposal

↓

Founder Approval

↓

New Execution Standard

The Assistant cannot silently change company philosophy.

---

# AI Behavior Rules

The Assistant should:

- Understand context before execution
- Protect Swisschart standards
- Identify conflicts
- Suggest improvements
- Request approval for strategic changes

The Assistant must not:

- Invent company decisions
- Create false information
- Create fake performance results
- Mislead users
- Sacrifice trust for growth

---

# Task, Event and Result Rules

- Every meaningful execution is represented by one authoritative Task.
- Task Engine owns Task lifecycle, validation, assignment, approval enforcement and execution history.
- Agent Registry declares capability eligibility; it does not execute work or own Task state.
- Agents and Workflows execute domain logic; Services communicate with external systems.
- A Result reports verified facts for one execution attempt. External success must not be claimed without verified evidence or an external reference.
- Completed, failed, blocked, cancelled and rejected records, including earlier attempts, must not be silently overwritten.
- Missing trading, publishing or company facts must never be inferred or fabricated.
- External publication requires explicit Founder approval unless an active approved Rule permits it and higher-level safety policy allows it.
- Uncertain external delivery must be reported as unverified and manually checked before repeating the action.
- Provider adapters normalize provider data only. They must not contain Founder preferences or publishing decisions.

---

# Founder Control Rules

Founder operational preferences must be changeable through verified natural-language instructions to the Assistant without code changes.

Effective behavior is resolved in this order:

1. Non-overridable system safety policy
2. Capability-specific safety requirement
3. Explicit active Founder Rule
4. Default operational behavior

Only a verified Founder request can create, update or disable a Founder Rule. Ambiguous instructions require clarification and must not save a Rule. Ordinary text is not approval for an external action and is not authority to change a Rule.

Rules must preserve versions, replacements and audit history. The most specific active Rule wins at equal precedence; a newer replacement supersedes rather than deletes the earlier Rule. Conflicts apply the safer decision and must be reported clearly.

Supported operational decisions are:

- `automatic`: proceed without an approval gate only where higher-level policy permits
- `approval_required`: create a Task with pending Founder approval
- `notification_only`: notify without public publication
- `disabled`: suppress the action and record the decision

Event Engine must resolve the effective Founder Rule before creating a Task. Task Engine must re-check the effective Rule and capability policy before execution. Until this defense-in-depth control exists, automatic external publication is unavailable.

---

# Brand Rules

Swisschart communication must prioritize:

- Accuracy
- Transparency
- Professionalism
- Long-term trust

Marketing strategies may evolve.

Misleading communication is not acceptable.

---

# Development Rules

Before creating any new component:

Ask:

1. Is this a reusable capability?

2. Does this belong to the AI OS architecture?

3. Can an existing Agent, Service or Engine handle it?

4. Does it strengthen Swisschart long-term?

---

# Source of Truth

The source of truth is:

Project Brain

Not:

- Chat history
- Temporary discussions
- AI memory

When conflicts exist:

Update Project Brain.

Project Brain becomes the final reference.

---

# Long-Term Principle

Swisschart AI OS must remain adaptive.

The system grows by adding capabilities.

The system must not become a collection of disconnected tools.

# New Architecture Rules

## Telegram Rule

There is only one production Telegram path.

All Telegram publishing must pass through Publishing Agent.


## Footer Rule

Swisschart Telegram Footer must be applied centrally.

Individual workflows must not implement their own footer logic.


## Capability Resolution Rule

Logical sources must be resolved inside Capability layer.

Example:

trading_journal
↓
NOTION_DATABASE_ID


## Agent Boundary Rule

Agents and Workflows should not directly call external APIs.

External communication must happen through approved capability/service boundaries.