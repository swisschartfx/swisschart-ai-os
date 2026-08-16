# SWISSCHART AI OS

# CODING AGENT INSTRUCTIONS

Version: 1.3
Status: Active
Last Updated: 2026-08-16

---

# Purpose

This file defines the entry instructions for AI Coding Agents working inside Swisschart AI OS.

Detailed development rules are maintained inside Project Brain.

---

# MANDATORY PROJECT ENTRY PROTOCOL

The Project Brain is the primary source of truth.

Before designing, implementing, refactoring or modifying Swisschart AI OS, read:

F:\Swisschart AI OS\00_PROJECT_BRAIN\00_START_HERE.md

Then follow its mandatory reading order.

At minimum, every development task must read:

1. `00_PROJECT_BRAIN/00_START_HERE.md`
2. `00_PROJECT_BRAIN/03_CURRENT_STATE.md`
3. `00_PROJECT_BRAIN/04_NEXT_ACTION.md`

Before any source, contract, architecture or Project Brain rule change, also read:

4. `00_PROJECT_BRAIN/02_ARCHITECTURE.md`

Do not implement from assumptions, stale Mission documents, archived Session files, historical chat context or superseded Next Actions.

Only the six active canonical Project Brain files may define current truth or authorize continuation. Files under `00_PROJECT_BRAIN/archive/` are historical evidence and cannot override current state, architecture or next action.

---

# CODEX USAGE POLICY

Architecture, product decisions, rules and planning must be decided before invoking Codex.

Use Codex mainly for:

- Implementation
- Multi-file edits
- Tests
- Debugging
- Time-consuming mechanical work

Avoid unnecessary full-project scans.

Give Codex small, precise and scoped tasks to conserve Plus weekly usage.

---

# PATH SAFETY

Never guess project paths.

Always verify the real filesystem structure before modifying files.

The physical roots retain historical numeric prefixes for stable navigation. They do not represent a mandatory architecture pipeline:

- `01_Core` contains the Central Assistant and execution/control runtime.
- `02_Core` contains capability contracts, domain/shared capabilities, provider services, time and signal contracts.
- `02_Agents` contains only Agents or explicitly labeled legacy compatibility components.
- `03_Workflows` contains lifecycle coordination that is still genuinely required.
- `06_Data` contains local runtime data locations and is not a universal data platform.
- `08_Documents/archive` contains non-authoritative historical implementation documents.
- `09_Backup` and `99_Archive` are not active architecture or Project Brain authority.

Verify the real filesystem with `rg --files` before acting. Do not recreate an empty root merely because an older repository inventory listed it.


Never use shortened or assumed paths.

Example:

Wrong:

02

Correct:

02_Agents


Always confirm the actual path before creating or modifying files.

---

# DEVELOPMENT CONTINUITY

The current development position is recorded only in:

F:\Swisschart AI OS\00_PROJECT_BRAIN\03_CURRENT_STATE.md

The exact authorized continuation is recorded only in:

F:\Swisschart AI OS\00_PROJECT_BRAIN\04_NEXT_ACTION.md

Do not restart discovery already captured in the active canonical files. Archived Mission, Session and handoff documents cannot authorize continuation.

---

# CURRENT ARCHITECTURE

Swisschart AI OS is a centralized AI Operating System. The Central Assistant is the Business Orchestrator and Capability Gateway is the authority boundary.

The authoritative logical architecture is defined in `00_PROJECT_BRAIN/02_ARCHITECTURE.md`.

It is a dependency graph, not a mandatory processing pipeline, and it does not prescribe physical repository folders. Capabilities do not inherently require Agents.

---

# EXISTING CAPABILITIES

Do not maintain a second capability inventory here. Current implemented and production-proven capabilities are owned by `00_PROJECT_BRAIN/03_CURRENT_STATE.md`.

Before creating a component, verify that an equivalent capability, workflow, Agent, or provider service does not already exist. Historical or guarded compatibility components do not become current authority merely because their files remain in the repository.

---

# ASSISTANT CORE

Assistant Core must eventually:

- Understand founder intent
- Create structured tasks
- Select capabilities
- Coordinate Agents
- Execute workflows
- Track execution
- Report results


Current Assistant architecture and boundaries are defined in:

F:\Swisschart AI OS\00_PROJECT_BRAIN\02_ARCHITECTURE.md

---

# PRODUCTION ARCHITECTURE

Swisschart AI OS is designed for:

- Cloud operation
- 24/7 availability
- Device independence


The founder can access the same Assistant through:

- Laptop
- Mobile phone
- Tablet
- Web interface
- Future applications
- Future messaging interfaces


Personal devices are interfaces, not dependencies.

The system must continue operating when founder devices are offline.

---

# MODEL INDEPENDENCE

Do not permanently couple the architecture to a single AI model provider.


The AI model layer must remain replaceable without rebuilding:

- Telegram integration
- Notion integration
- Journal system
- Publishing system
- Scheduler
- Workflows
- Core business logic

---

# DEVELOPMENT METHOD

Follow:

Architecture

↓

Implementation

↓

Testing

↓

Verification


Before changing files:

1. Inspect existing architecture
2. Understand dependencies
3. Modify only required components
4. Run tests when possible
5. Report changed files
6. Report test results
7. Report remaining issues

---

# FILE CREATION RULE

Before creating a new file:

- Check if an equivalent file exists
- Use the correct architectural layer
- Avoid duplicate systems
- Preserve existing architecture

---

# SAFETY RULES

Never delete historical trading data.

Never overwrite confirmed trading data without explicit instruction.

Never invent missing trading information.

Accuracy is more important than speed.

---

# CODEX APPROVAL POLICY

## Automatic Approval — Normal Development Operations

Codex may proceed without requesting additional approval for normal, non-sensitive development operations within this project:

- Reading project files
- Running non-destructive verification commands
- Creating new files in the verified project architecture
- Updating documentation files
- Updating Project Brain session files
- Creating blueprint files

## Explicit Confirmation Required

Codex must request explicit founder confirmation before:

- Deleting files or directories
- Running destructive commands
- Overwriting existing important data
- Modifying historical or confirmed trading data
- Modifying `.env` files, credentials, secrets or access tokens
- Changing core architecture files or architectural decisions
- Any action with a material external, financial, security or irreversible impact

## Safety Controls

This policy does not remove platform-enforced sandbox restrictions, escalation requirements or safety checks.

When an operation is sensitive, ambiguous, destructive or outside the verified project architecture, Codex must stop, explain the scope and request confirmation before proceeding.

---

# CANONICAL UPDATE RULE

At the end of work, update only canonical files whose facts actually changed:

- `03_CURRENT_STATE.md` when current truth changed
- `04_NEXT_ACTION.md` when authorized continuation changed
- `05_HISTORY.md` when a durable milestone, decision, incident or proof completed

Update `01_MASTER_CONTEXT.md` or `02_ARCHITECTURE.md` only when their durable context, principles or rules genuinely change with appropriate authorization.

Do not create permanent session-summary files for ordinary conversational continuity.

---

# FINAL PRINCIPLE

The founder communicates with one Assistant.

The Assistant coordinates the entire Swisschart AI OS.
