# SWISSCHART AI OS

# TASK ENGINE BLUEPRINT

Version: 1.0
Status: Design Phase
Last Updated: 2026-08-12

---

# Purpose

Task Engine is the execution coordination layer of Swisschart AI OS.

Its purpose is to turn an approved founder request or internal system event into a structured, traceable and controlled execution process.

Task Engine does not replace Assistant Core, Agents, Workflows, Scheduler or Services.

It connects them.

---

# Architecture Position

Founder Request / Internal Event

↓

Swisschart AI Assistant

↓

Task Engine

↓

Agent Registry

↓

Capabilities / Agents / Workflows

↓

Services

↓

External Systems

↓

Execution Result

↓

Task Engine

↓

Swisschart AI Assistant

↓

Founder Report

---

# Core Principle

Every meaningful system execution must be represented by a Task.

A Task is the single structured record of:

- Why work was requested
- What work must be performed
- Which capability is responsible
- Which inputs and rules apply
- What happened during execution
- What result was produced

This provides traceability without placing company intelligence inside individual Workflows or Services.

---

# Responsibilities

Task Engine must:

- Create and identify Tasks
- Validate required task information
- Apply execution rules and approval requirements
- Determine task priority
- Request capability selection through Agent Registry
- Assign Tasks to the selected capability
- Track task status and execution history
- Capture results, failures and blocking conditions
- Return structured outcomes to Assistant Core

Task Engine must not:

- Interpret founder language independently of Assistant Core
- Contain domain logic owned by an Agent
- Communicate directly with external platforms
- Decide when scheduled work occurs
- Silently change Swisschart policy or execute unapproved strategic changes

---

# System Boundaries

## Assistant Core

Assistant Core understands founder intent, builds an initial task request and reports the final outcome to the founder.

Assistant Core does not own task state or agent execution tracking.

## Task Engine

Task Engine owns the Task lifecycle, validation, assignment coordination and execution tracking.

## Agent Registry

Agent Registry describes which capabilities exist, what they can perform, their required inputs and their execution eligibility.

Task Engine uses Agent Registry to select an eligible capability. Agent Registry does not execute work.

## Agents and Workflows

Agents contain reusable domain logic. Workflows contain defined execution sequences.

They receive a Task instruction, perform their responsibility and return a structured result. They do not create a second task-management system.

## Scheduler

Scheduler controls when a task should start. It may create a task trigger, but Task Engine owns the task record and its execution lifecycle.

## Services

Services communicate with external systems such as Telegram and Notion. They do not decide business logic or task routing.

---

# Task Model

Every Task should contain the following conceptual fields.

```js
{
  id,
  source,
  intent,
  capability,
  assignedAgent,
  input,
  context,
  status,
  priority,
  approvalRequired,
  approvalStatus,
  createdAt,
  startedAt,
  completedAt,
  result,
  error,
  executionHistory
}
```

## Field Definitions

- `id`: Unique, immutable Task identifier.
- `source`: Origin of the Task, such as `founder`, `scheduler`, `event` or `workflow`.
- `intent`: Structured description of the requested outcome.
- `capability`: Required capability, such as Journal Analysis or Signal Publishing.
- `assignedAgent`: The Agent or Workflow selected for execution. This remains empty until assignment.
- `input`: The verified operational data required to execute the Task.
- `context`: Relevant company, policy or historical context supplied by Assistant Core or Knowledge Layer.
- `status`: Current lifecycle status.
- `priority`: Execution priority determined by defined rules.
- `approvalRequired`: Whether founder approval is required before execution.
- `approvalStatus`: Pending, approved, rejected or not required.
- `createdAt`, `startedAt`, `completedAt`: Lifecycle timestamps.
- `result`: Structured successful output returned by the executing capability.
- `error`: Structured failure information, without inventing missing facts.
- `executionHistory`: Immutable status transitions, assignment events, attempts and meaningful execution notes.

The final implementation may add technical fields, but it must preserve this business-level model.

---

# Task Lifecycle

Primary lifecycle:

```text
Created
  ↓
Validated
  ↓
Awaiting Approval (only when required)
  ↓
Queued
  ↓
Assigned
  ↓
Running
  ↓
Completed
```

Alternative outcomes:

```text
Validation Failed
Awaiting Approval → Rejected
Queued / Assigned / Running → Blocked
Queued / Assigned / Running → Failed
Created / Validated / Queued → Cancelled
```

## Lifecycle Rules

- A Task cannot run before validation succeeds.
- A Task requiring approval cannot be assigned or run until approval is recorded.
- Every status transition must be recorded in `executionHistory`.
- Completed, failed and cancelled Tasks are terminal records; they are not silently overwritten.
- Retrying a failed Task must create a recorded new attempt and preserve the original failure information.
- A blocked Task must report the specific missing input, dependency or approval that prevents progress.

---

# Execution Flow

## Founder-Initiated Flow

1. Founder makes a request to Assistant Core.
2. Assistant Core determines intent and creates a task request.
3. Task Engine creates the Task with status `Created`.
4. Task Engine validates required input, policy constraints and approval requirements.
5. If required, the Task waits for explicit founder approval.
6. Task Engine asks Agent Registry for an eligible capability.
7. Task Engine assigns the Task and starts execution.
8. The Agent or Workflow performs its domain responsibility through the appropriate Service.
9. The executing capability returns a structured result or error.
10. Task Engine records the outcome and final status.
11. Assistant Core reports the verified result to the founder.

## Event-Initiated Flow

1. Scheduler or future Event Engine detects a defined trigger.
2. The trigger provides a structured task request to Task Engine.
3. Task Engine follows the same validation, approval, assignment, execution and reporting lifecycle.

The origin changes, but the Task model and execution controls remain the same.

---

# Approval and Safety Controls

Task Engine must support approval gates for actions with material impact.

Examples that may require approval:

- Publishing externally on behalf of Swisschart
- Changing company policy or standards
- Modifying confirmed trading data
- Triggering a new strategic workflow
- Executing an action with incomplete or conflicting information

Approval requirements must be supplied by policy and capability rules. Task Engine enforces them; it does not invent policies.

Historical trading data must never be deleted or overwritten through a Task without explicit founder instruction and a confirmed execution path.

---

# Initial Capability Integration

The first Task Engine version should integrate existing capabilities only:

- Journal Capability
- Publishing Capability
- Content Capability
- Telegram Capability
- Notion Capability
- Scheduler Capability
- Existing Signal Execution, Signal Workflow, Risk Reminder and Trade Lifecycle Workflows

No existing Agent or Workflow should be redesigned during the first integration. The Task Engine adds a consistent request and result contract around them.

---

# Implementation Phases

## Phase A — Architecture and Contracts

- Finalize Task object fields and lifecycle rules
- Define the task request and task result contracts
- Define Agent Registry capability metadata
- Define approval and validation boundaries

## Phase B — First Synchronous Execution Flow

- Connect Assistant Core to Task Engine
- Create and validate a Task
- Route one low-risk Task to an existing capability
- Record and return the result

## Phase C — Persistent Tracking

- Add durable Task storage
- Preserve execution history and task outcomes
- Add retry and blocked-task handling

## Phase D — Event and Workflow Coordination

- Connect Scheduler and Event Engine task triggers
- Support multi-step Workflow execution
- Add execution monitoring and reporting

## Phase E — Production Operation

- Add cloud-safe asynchronous execution
- Add worker, queue and recovery design as required
- Maintain model-provider independence at the Assistant boundary

---

# Current Status

Task Engine architecture is defined at blueprint level.

No Task Engine code, storage, Agent Registry or execution integration has been implemented yet.

---

# Next Development Action

Review and approve this blueprint, then define the final Task object contract and Agent Registry architecture before implementing the first Assistant-driven execution flow.
