# SWISSCHART AI OS

# CODING AGENT INSTRUCTIONS

Version: 1.2
Status: Active
Last Updated: 2026-08-12

---

# Purpose

This file defines the entry instructions for AI Coding Agents working inside Swisschart AI OS.

Detailed development rules are maintained inside Project Brain.

---

# SOURCE OF TRUTH

The Project Brain is the primary source of truth.

Before starting any development task, read:

F:\Swisschart AI OS\00_PROJECT_BRAIN\01_VISION.md

F:\Swisschart AI OS\00_PROJECT_BRAIN\02_STATE.md

F:\Swisschart AI OS\00_PROJECT_BRAIN\03_ROADMAP.md

F:\Swisschart AI OS\00_PROJECT_BRAIN\04_RULES.md

F:\Swisschart AI OS\00_PROJECT_BRAIN\05_SESSION.md

F:\Swisschart AI OS\00_PROJECT_BRAIN\06_NEXT_ACTION.md


The Session file defines the current development position.

The Next Action file defines the exact next development action.

Do not repeat previous discovery work when the current position is already documented.

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

Current project structure:

01_Core

02_Agents

03_Workflows

04_Knowledge

05_Content

06_Data

07_Tools

08_Documents

09_Backup

99_Archive


Never use shortened or assumed paths.

Example:

Wrong:

02

Correct:

02_Agents


Always confirm the actual path before creating or modifying files.

---

# DEVELOPMENT CONTINUITY

The current development position is recorded in:

F:\Swisschart AI OS\00_PROJECT_BRAIN\05_SESSION.md


The next development action must always start from:

Next Session Starting Point


Do not restart architecture analysis unless the project structure has materially changed.

---

# CURRENT ARCHITECTURE

Swisschart AI OS is a centralized AI Operating System.

Architecture:

Founder

↓

Swisschart AI Assistant

↓

Task / Event / Workflow Engine

↓

Capabilities / Agents

↓

Services

↓

External Systems


The Assistant is the central coordinator.

Agents and Workflows are reusable capabilities.

---

# EXISTING CAPABILITIES

Current Agents:

- Journal Agent
- Publishing Agent
- Content Agent


Current Workflows:

- Signal Execution
- Signal Workflow
- Risk Reminder
- Trade Lifecycle


Do not recreate existing capabilities without a clear architectural reason.

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


Current Blueprint:

F:\Swisschart AI OS\01_Core\Assistant\02_Assistant_Blueprint.md

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

# SESSION END RULE

At the end of each development session:

Update Project Brain when required.

Ensure 05_SESSION.md contains:

- Completed work
- Decisions made
- Current position
- Remaining work
- Exact next development action


The next session must continue without repeating discovery.

---

# FINAL PRINCIPLE

The founder communicates with one Assistant.

The Assistant coordinates the entire Swisschart AI OS.
