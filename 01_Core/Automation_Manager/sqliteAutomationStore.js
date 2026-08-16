const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

class SqliteAutomationStore {
    constructor(options = {}) {
        if (!options.databasePath) {
            throw coded("AUTOMATION_DATABASE_PATH_REQUIRED", "Injected databasePath is required");
        }
        this.databasePath = path.resolve(options.databasePath);
        fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
        this.db = options.database || new DatabaseSync(this.databasePath);
        this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
        this.migrate();
    }

    migrate() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS schedule_revisions (
                schedule_id TEXT NOT NULL,
                revision INTEGER NOT NULL,
                payload_json TEXT NOT NULL,
                payload_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                tombstoned INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(schedule_id, revision)
            );
            CREATE TABLE IF NOT EXISTS schedule_heads (
                schedule_id TEXT PRIMARY KEY,
                active_revision INTEGER NOT NULL,
                enabled INTEGER NOT NULL,
                tombstoned INTEGER NOT NULL DEFAULT 0,
                approved_payload_hash TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(schedule_id, active_revision)
                  REFERENCES schedule_revisions(schedule_id, revision)
            );
            CREATE TABLE IF NOT EXISTS prepared_schedule_mutations (
                approval_id TEXT PRIMARY KEY,
                mutation_type TEXT NOT NULL,
                schedule_id TEXT NOT NULL,
                expected_revision INTEGER,
                payload_hash TEXT NOT NULL,
                candidate_json TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                approved_at TEXT,
                result_json TEXT
            );
            CREATE TABLE IF NOT EXISTS schedule_approvals (
                approval_id TEXT PRIMARY KEY,
                schedule_id TEXT NOT NULL,
                revision INTEGER NOT NULL,
                payload_hash TEXT NOT NULL,
                decision TEXT NOT NULL,
                decided_by TEXT NOT NULL,
                decided_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS schedule_occurrences (
                occurrence_key TEXT PRIMARY KEY,
                occurrence_identity TEXT NOT NULL UNIQUE,
                schedule_id TEXT NOT NULL,
                revision INTEGER NOT NULL,
                local_date TEXT NOT NULL,
                resolved_instant TEXT NOT NULL,
                state TEXT NOT NULL,
                approval_hash TEXT NOT NULL,
                planned_at TEXT NOT NULL,
                claimed_at TEXT,
                updated_at TEXT NOT NULL,
                message_id TEXT,
                detail_json TEXT
            );
            CREATE TABLE IF NOT EXISTS schedule_execution_attempts (
                attempt_id TEXT PRIMARY KEY,
                occurrence_key TEXT NOT NULL,
                state TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                result_json TEXT,
                FOREIGN KEY(occurrence_key) REFERENCES schedule_occurrences(occurrence_key)
            );
            CREATE INDEX IF NOT EXISTS schedule_occurrences_due
              ON schedule_occurrences(state, resolved_instant);
        `);
    }

    savePreparedMutation(record) {
        this.db.prepare(`INSERT INTO prepared_schedule_mutations
            (approval_id,mutation_type,schedule_id,expected_revision,payload_hash,
             candidate_json,status,created_at)
            VALUES (?,?,?,?,?,?,?,?)`).run(
            record.approvalId, record.mutationType, record.scheduleId,
            record.expectedRevision ?? null, record.payloadHash,
            record.candidate ? JSON.stringify(record.candidate) : null,
            "pending_approval", record.createdAt);
        return this.getPreparedMutation(record.approvalId);
    }

    getPreparedMutation(approvalId) {
        const row = this.db.prepare("SELECT * FROM prepared_schedule_mutations WHERE approval_id=?")
            .get(approvalId);
        return row ? prepared(row) : null;
    }

    listSchedules(filters = {}) {
        const rows = this.db.prepare(`SELECT r.payload_json,h.active_revision,h.enabled,
            h.tombstoned,h.approved_payload_hash,h.updated_at
            FROM schedule_heads h JOIN schedule_revisions r
              ON r.schedule_id=h.schedule_id AND r.revision=h.active_revision
            ORDER BY h.schedule_id`).all();
        return rows.map(headRecord).filter(schedule =>
            (filters.includeTombstoned === true || !schedule.tombstoned) &&
            (filters.enabled === undefined || schedule.enabled === filters.enabled) &&
            (filters.weekday === undefined || schedule.weekdays.includes(Number(filters.weekday))) &&
            (!filters.triggerType || schedule.trigger.type === filters.triggerType));
    }

    getSchedule(scheduleId, options = {}) {
        const row = this.db.prepare(`SELECT r.payload_json,h.active_revision,h.enabled,
            h.tombstoned,h.approved_payload_hash,h.updated_at
            FROM schedule_heads h JOIN schedule_revisions r
              ON r.schedule_id=h.schedule_id AND r.revision=h.active_revision
            WHERE h.schedule_id=?`).get(scheduleId);
        const schedule = row ? headRecord(row) : null;
        return schedule && (options.includeTombstoned || !schedule.tombstoned)
            ? schedule : null;
    }

    approvePreparedMutation(input, now) {
        return this.transaction(() => {
            const row = this.db.prepare("SELECT * FROM prepared_schedule_mutations WHERE approval_id=?")
                .get(input.approvalId);
            if (!row) throw coded("SCHEDULE_APPROVAL_NOT_FOUND", "Prepared schedule mutation was not found");
            const action = prepared(row);
            if (action.payloadHash !== input.payloadHash) {
                throw coded("SCHEDULE_PAYLOAD_HASH_MISMATCH", "Schedule payload changed; prepare again");
            }
            if (input.confirm !== true) {
                throw coded("SCHEDULE_EXPLICIT_APPROVAL_REQUIRED", "Explicit Founder approval is required");
            }
            if (action.status === "completed") return { ...action.result, replayed: true };
            if (action.status !== "pending_approval") {
                throw coded("SCHEDULE_APPROVAL_NOT_PENDING", "Schedule mutation is not pending approval");
            }
            const head = this.getSchedule(action.scheduleId, { includeTombstoned: true });
            if (action.mutationType === "create" && head) {
                throw coded("SCHEDULE_ALREADY_EXISTS", "Schedule already exists");
            }
            if (["update", "delete"].includes(action.mutationType)) {
                if (!head) throw coded("SCHEDULE_NOT_FOUND", "Schedule was not found");
                if (head.revision !== action.expectedRevision) {
                    throw coded("SCHEDULE_STALE_REVISION", "Schedule revision changed; prepare again");
                }
            }
            const revision = action.mutationType === "create" ? 1 : head.revision + 1;
            const candidate = action.mutationType === "delete"
                ? { ...head, revision, enabled: false, tombstoned: true }
                : { ...action.candidate, revision, tombstoned: false };
            this.db.prepare(`INSERT INTO schedule_revisions
                (schedule_id,revision,payload_json,payload_hash,created_at,tombstoned)
                VALUES (?,?,?,?,?,?)`).run(action.scheduleId, revision,
                JSON.stringify(candidate), action.payloadHash, now, candidate.tombstoned ? 1 : 0);
            this.db.prepare(`INSERT INTO schedule_heads
                (schedule_id,active_revision,enabled,tombstoned,approved_payload_hash,updated_at)
                VALUES (?,?,?,?,?,?) ON CONFLICT(schedule_id) DO UPDATE SET
                active_revision=excluded.active_revision,enabled=excluded.enabled,
                tombstoned=excluded.tombstoned,
                approved_payload_hash=excluded.approved_payload_hash,updated_at=excluded.updated_at`)
                .run(action.scheduleId, revision, candidate.enabled ? 1 : 0,
                    candidate.tombstoned ? 1 : 0, action.payloadHash, now);
            this.db.prepare(`INSERT INTO schedule_approvals
                (approval_id,schedule_id,revision,payload_hash,decision,decided_by,decided_at)
                VALUES (?,?,?,?,?,?,?)`).run(action.approvalId, action.scheduleId,
                revision, action.payloadHash, "approved", "founder", now);
            const result = { status: "completed", mutationType: action.mutationType,
                schedule: candidate, approvalId: action.approvalId,
                payloadHash: action.payloadHash, replayed: false };
            this.db.prepare(`UPDATE prepared_schedule_mutations SET status='completed',
                approved_at=?,result_json=? WHERE approval_id=?`)
                .run(now, JSON.stringify(result), action.approvalId);
            return result;
        });
    }

    planOccurrence(occurrence, schedule, now) {
        this.db.prepare(`INSERT OR IGNORE INTO schedule_occurrences
            (occurrence_key,occurrence_identity,schedule_id,revision,local_date,
             resolved_instant,state,approval_hash,planned_at,updated_at,detail_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
            occurrence.occurrenceKey, occurrence.identity, schedule.scheduleId,
            schedule.revision, occurrence.localDate, occurrence.resolvedInstant,
            "planned", schedule.approval.approvedPayloadHash, now, now,
            JSON.stringify({ display: occurrence.display }));
        return this.getOccurrence(occurrence.occurrenceKey);
    }

    claimOccurrence(occurrenceKey, now) {
        return this.transaction(() => {
            const occurrence = this.getOccurrence(occurrenceKey);
            if (!occurrence) throw coded("SCHEDULE_OCCURRENCE_NOT_FOUND", "Occurrence was not found");
            if (!["planned", "failed_safe_to_retry"].includes(occurrence.state)) {
                return { claimed: false, occurrence };
            }
            const changed = this.db.prepare(`UPDATE schedule_occurrences SET
                state='claimed',claimed_at=?,updated_at=? WHERE occurrence_key=?
                AND state IN ('planned','failed_safe_to_retry')`).run(now, now, occurrenceKey);
            return { claimed: changed.changes === 1, occurrence: this.getOccurrence(occurrenceKey) };
        });
    }

    transitionOccurrence(occurrenceKey, state, fields = {}, now = new Date().toISOString()) {
        const occurrence = this.getOccurrence(occurrenceKey);
        if (!occurrence) throw coded("SCHEDULE_OCCURRENCE_NOT_FOUND", "Occurrence was not found");
        this.db.prepare(`UPDATE schedule_occurrences SET state=?,updated_at=?,
            message_id=COALESCE(?,message_id),detail_json=COALESCE(?,detail_json)
            WHERE occurrence_key=?`).run(state, now, fields.messageId ?? null,
            fields.detail ? JSON.stringify(fields.detail) : null, occurrenceKey);
        return this.getOccurrence(occurrenceKey);
    }

    createExecutionAttempt(record) {
        this.db.prepare(`INSERT INTO schedule_execution_attempts
            (attempt_id,occurrence_key,state,started_at,result_json)
            VALUES (?,?,?,?,?)`).run(record.attemptId, record.occurrenceKey,
            record.state, record.startedAt, record.result ? JSON.stringify(record.result) : null);
    }

    completeExecutionAttempt(attemptId, state, result, completedAt) {
        this.db.prepare(`UPDATE schedule_execution_attempts SET state=?,completed_at=?,
            result_json=? WHERE attempt_id=?`).run(state, completedAt,
            JSON.stringify(result || null), attemptId);
    }

    getOccurrence(key) {
        const row = this.db.prepare("SELECT * FROM schedule_occurrences WHERE occurrence_key=?").get(key);
        return row ? occurrenceRecord(row) : null;
    }

    listOccurrences(filters = {}) {
        let sql = "SELECT * FROM schedule_occurrences WHERE 1=1";
        const params = [];
        if (filters.scheduleId) { sql += " AND schedule_id=?"; params.push(filters.scheduleId); }
        if (filters.state) { sql += " AND state=?"; params.push(filters.state); }
        sql += " ORDER BY resolved_instant, schedule_id";
        return this.db.prepare(sql).all(...params).map(occurrenceRecord);
    }

    recoverInterruptedPublishing(now) {
        this.db.prepare(`UPDATE schedule_occurrences SET state='delivery_uncertain',updated_at=?
            WHERE state='publishing'`).run(now);
    }

    recoverClaimedBeforePublishing(now) {
        return this.db.prepare(`UPDATE schedule_occurrences SET state='planned',
            claimed_at=NULL,updated_at=? WHERE state='claimed' AND occurrence_key NOT IN
            (SELECT occurrence_key FROM schedule_execution_attempts)`).run(now).changes;
    }

    countExecutionAttempts(occurrenceKey) {
        return Number(this.db.prepare(`SELECT COUNT(*) AS count FROM
            schedule_execution_attempts WHERE occurrence_key=?`).get(occurrenceKey).count);
    }

    transaction(fn) {
        this.db.exec("BEGIN IMMEDIATE");
        try { const result = fn(); this.db.exec("COMMIT"); return result; }
        catch (error) { this.db.exec("ROLLBACK"); throw error; }
    }
    close() { this.db.close(); }
}

function prepared(row) {
    return { approvalId: row.approval_id, mutationType: row.mutation_type,
        scheduleId: row.schedule_id, expectedRevision: row.expected_revision,
        payloadHash: row.payload_hash,
        candidate: row.candidate_json ? JSON.parse(row.candidate_json) : null,
        status: row.status, createdAt: row.created_at, approvedAt: row.approved_at,
        result: row.result_json ? JSON.parse(row.result_json) : null };
}
function headRecord(row) {
    const schedule = JSON.parse(row.payload_json);
    return { ...schedule, revision: row.active_revision, enabled: Boolean(row.enabled),
        tombstoned: Boolean(row.tombstoned), updatedAt: row.updated_at,
        approval: { status: "approved", approvedRevision: row.active_revision,
            approvedPayloadHash: row.approved_payload_hash } };
}
function occurrenceRecord(row) {
    return { occurrenceKey: row.occurrence_key, identity: row.occurrence_identity,
        scheduleId: row.schedule_id, revision: row.revision, localDate: row.local_date,
        resolvedInstant: row.resolved_instant, state: row.state,
        approvalHash: row.approval_hash, plannedAt: row.planned_at,
        claimedAt: row.claimed_at, updatedAt: row.updated_at,
        messageId: row.message_id,
        detail: row.detail_json ? JSON.parse(row.detail_json) : null };
}
function coded(code, message) { const error = new Error(message); error.code = code; return error; }

module.exports = SqliteAutomationStore;
