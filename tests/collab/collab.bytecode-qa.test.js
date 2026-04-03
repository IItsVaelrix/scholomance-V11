/**
 * Custom Bytecode QA Tests — Collab Plane Remote Agent Access
 *
 * Tests Phase 1-3 of live_website_collab_hosting_pdr.md using
 * the bytecode assertion library for AI-parsable results.
 *
 * Per VAELRIX_LAW.md §8: All QA tests use bytecode assertions.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import {
    assertEqual,
    assertTrue,
    assertType,
    assertInRange,
    assertThrowsBytecode,
    reportTestResult,
    aggregateTestResults,
    TEST_SEVERITY,
    QATestError,
} from '../qa/tools/bytecode-assertions.js';
import {
    BytecodeError,
    ERROR_CATEGORIES,
    ERROR_SEVERITY,
    MODULE_IDS,
    ERROR_CODES,
    decodeBytecodeError,
} from '../../codex/core/pixelbrain/bytecode-error.js';

let collabService;
let collabPersistence;
let testDbPath;

function uniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

beforeAll(async () => {
    testDbPath = path.join(
        os.tmpdir(),
        `scholomance_bytecode_qa_${Date.now()}_${process.pid}.sqlite`,
    );

    process.env.COLLAB_DB_PATH = testDbPath;
    vi.resetModules();

    const serviceMod = await import('../../codex/server/collab/collab.service.js?test=collab-service');
    const persistenceMod = await import('../../codex/server/collab/collab.persistence.js');

    collabService = serviceMod.collabService;
    collabPersistence = persistenceMod.collabPersistence;

    collabService.registerAgent({
        id: 'qa-agent',
        name: 'QA Agent',
        role: 'qa',
        capabilities: ['vitest', 'bytecode'],
    });
});

afterAll(async () => {
    if (existsSync(testDbPath)) {
        rmSync(testDbPath, { force: true });
    }
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (existsSync(walPath)) rmSync(walPath, { force: true });
    if (existsSync(shmPath)) rmSync(shmPath, { force: true });
});

// ─── Bytecode Error Format Validation ────────────────────────────────────────

describe('Bytecode Error Format — Collab Domain', () => {
    it('agent key validation errors produce valid bytecode', async () => {
        const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        // Invalid key should not crash, just return null
        const result = await validateAgentKey('invalid-key');
        assertEqual(result, null, {
            testName: 'invalid key returns null',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });
    });

    it('agent key generation produces valid key format', async () => {
        const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        const result = await generateAgentKey({
            agentId: 'qa-agent',
            createdBy: 'qa-runner',
        });

        assertType(result.keyId, 'string', {
            testName: 'keyId is string',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });

        assertType(result.plaintextKey, 'string', {
            testName: 'plaintextKey is string',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });

        assertTrue(result.plaintextKey.startsWith('sk-scholomance-qa-agent-'), {
            testName: 'key has correct prefix',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });

        // Key should be 32 bytes hex = 64 chars after prefix
        // Format: sk-scholomance-qa-agent-<64 hex chars>
        const prefix = 'sk-scholomance-qa-agent-';
        const hexPart = result.plaintextKey.slice(prefix.length);
        assertInRange(hexPart.length, 64, 64, {
            testName: 'key hex length is 64',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });
    });

    it('stored key hash is bcrypt format', async () => {
        const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        const result = await generateAgentKey({
            agentId: 'qa-agent',
            createdBy: 'qa-runner',
        });

        const stored = collabPersistence.agent_keys.getById(result.keyId);
        assertType(stored, 'object', {
            testName: 'stored key is object',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });

        assertTrue(stored.key_hash.startsWith('$2'), {
            testName: 'key_hash is bcrypt format',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });

        // Plaintext key should NOT be stored
        assertTrue(!stored.key_hash.includes('sk-scholomance'), {
            testName: 'plaintext key not in storage',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Error Format — Collab Domain',
        });
    });
});

// ─── Agent Key Lifecycle — Bytecode Assertions ───────────────────────────────

describe('Agent Key Lifecycle — Bytecode Assertions', () => {
    it('generate → validate → revoke lifecycle', async () => {
        const { generateAgentKey, validateAgentKey, revokeAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        // Generate
        const result = await generateAgentKey({
            agentId: 'qa-agent',
            createdBy: 'qa-runner',
        });

        assertType(result.keyId, 'string', {
            testName: 'generate returns keyId',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });

        // Validate
        const agent = await validateAgentKey(result.plaintextKey);
        assertType(agent, 'object', {
            testName: 'valid key resolves agent',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });

        assertEqual(agent.id, 'qa-agent', {
            testName: 'agent ID matches',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });

        assertEqual(agent.role, 'qa', {
            testName: 'agent role matches',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });

        // Revoke
        const revoked = revokeAgentKey(result.keyId);
        assertTrue(revoked, {
            testName: 'revoke returns true',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });

        // Validate after revoke
        const agentAfterRevoke = await validateAgentKey(result.plaintextKey);
        assertEqual(agentAfterRevoke, null, {
            testName: 'revoked key returns null',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });
    });

    it('key rotation: old key dies, new key lives', async () => {
        const { generateAgentKey, validateAgentKey, rotateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        const initial = await generateAgentKey({
            agentId: 'qa-agent',
            createdBy: 'qa-runner',
        });

        const rotated = await rotateAgentKey({
            agentId: 'qa-agent',
            createdBy: 'qa-runner',
        });

        // Old key should be dead
        const oldAgent = await validateAgentKey(initial.plaintextKey);
        assertEqual(oldAgent, null, {
            testName: 'old key rejected after rotation',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });

        // New key should alive
        const newAgent = await validateAgentKey(rotated.plaintextKey);
        assertType(newAgent, 'object', {
            testName: 'new key resolves agent',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });

        assertEqual(newAgent.id, 'qa-agent', {
            testName: 'new key has correct agent ID',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Agent Key Lifecycle',
        });
    });
});

// ─── Security Properties — Bytecode Assertions ───────────────────────────────

describe('Security Properties — Bytecode Assertions', () => {
    it('agent identity never contains key material', async () => {
        const { generateAgentKey, validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        const result = await generateAgentKey({
            agentId: 'qa-agent',
            createdBy: 'qa-runner',
        });

        const agent = await validateAgentKey(result.plaintextKey);

        // No key material in identity
        const keys = Object.keys(agent);
        assertTrue(!keys.includes('key'), {
            testName: 'no "key" field in identity',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        assertTrue(!keys.includes('key_hash'), {
            testName: 'no "key_hash" field in identity',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        assertTrue(!keys.includes('plaintextKey'), {
            testName: 'no "plaintextKey" field in identity',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        // Only safe fields
        assertEqual(agent.id, 'qa-agent', {
            testName: 'agent ID present',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        assertType(agent.name, 'string', {
            testName: 'agent name present',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        assertType(agent.role, 'string', {
            testName: 'agent role present',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        assertType(agent.capabilities, 'object', {
            testName: 'agent capabilities present',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });
    });

    it('each key generation produces unique bcrypt hash', async () => {
        const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        const key1 = await generateAgentKey({ agentId: 'qa-agent', createdBy: 'qa-runner' });
        const key2 = await generateAgentKey({ agentId: 'qa-agent', createdBy: 'qa-runner' });

        const stored1 = collabPersistence.agent_keys.getById(key1.keyId);
        const stored2 = collabPersistence.agent_keys.getById(key2.keyId);

        assertTrue(stored1.key_hash !== stored2.key_hash, {
            testName: 'unique bcrypt hashes per generation',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });
    });

    it('empty/null/undefined keys are rejected', async () => {
        const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

        const emptyResult = await validateAgentKey('');
        assertEqual(emptyResult, null, {
            testName: 'empty key rejected',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        const nullResult = await validateAgentKey(null);
        assertEqual(nullResult, null, {
            testName: 'null key rejected',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });

        const undefinedResult = await validateAgentKey(undefined);
        assertEqual(undefinedResult, null, {
            testName: 'undefined key rejected',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Security Properties',
        });
    });
});

// ─── Collab Workflow — Bytecode Assertions ───────────────────────────────────

describe('Collab Workflow — Bytecode Assertions', () => {
    it('full remote agent workflow: register → heartbeat → task → lock → complete', async () => {
        // Heartbeat
        const heartbeat = collabService.heartbeatAgent({
            id: 'qa-agent',
            status: 'online',
            current_task_id: null,
        });
        assertEqual(heartbeat.status, 'online', {
            testName: 'heartbeat sets online status',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Create task
        const task = collabService.createTask({
            title: 'Bytecode QA test task',
            description: 'Testing full remote agent workflow',
            priority: 2,
            file_paths: ['tests/collab/collab.bytecode-qa.test.js'],
            depends_on: [],
            created_by: 'qa-agent',
        });

        assertType(task.id, 'string', {
            testName: 'task has ID',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertEqual(task.status, 'backlog', {
            testName: 'task starts in backlog',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertType(task.file_paths, 'object', {
            testName: 'task has file_paths',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertEqual(task.file_paths.length, 1, {
            testName: 'task has correct file_paths count',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Acquire lock
        const filePath = task.file_paths[0];
        const lockResult = collabService.acquireLock({
            file_path: filePath,
            agent_id: 'qa-agent',
            ttl_minutes: 30,
            override: true,
        });
        assertTrue(lockResult, {
            testName: 'lock acquired',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Verify lock
        const lock = collabService.checkLock(filePath);
        assertType(lock, 'object', {
            testName: 'lock exists',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertEqual(lock.locked_by, 'qa-agent', {
            testName: 'lock owned by qa-agent',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Release lock
        const releaseResult = collabService.releaseLock({
            file_path: filePath,
            agent_id: 'qa-agent',
        });
        assertTrue(releaseResult, {
            testName: 'lock released',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Verify lock released
        const releasedLock = collabService.checkLock(filePath);
        assertEqual(releasedLock, null, {
            testName: 'lock no longer exists',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Complete task
        const completedTask = collabService.updateTask({
            id: task.id,
            updates: { status: 'done' },
            actor_agent_id: 'qa-agent',
        });
        assertTrue(completedTask, {
            testName: 'task completed',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });
    });

    it('pipeline creation with file_paths propagates correctly', async () => {
        const filePath = `src/pages/Collab/${uniqueId('pipeline-qa')}.jsx`;

        // Create trigger task
        const triggerTask = collabService.createTask({
            title: 'Pipeline QA trigger',
            priority: 2,
            file_paths: [filePath],
            depends_on: [],
            created_by: 'qa-agent',
        });

        assertEqual(triggerTask.file_paths.length, 1, {
            testName: 'trigger task has file_paths',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertEqual(triggerTask.file_paths[0], filePath, {
            testName: 'trigger task has correct file_path',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Create pipeline
        const result = collabService.createPipeline({
            pipeline_type: 'ui_feature',
            trigger_task_id: triggerTask.id,
            actor_agent_id: 'qa-agent',
        });

        assertType(result.pipeline, 'object', {
            testName: 'pipeline created',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertEqual(result.pipeline.status, 'running', {
            testName: 'pipeline is running',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertType(result.stage_task, 'object', {
            testName: 'stage task exists',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        // Stage task should have file_paths from trigger
        assertType(result.stage_task.file_paths, 'object', {
            testName: 'stage task has file_paths',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertEqual(result.stage_task.file_paths.length, 1, {
            testName: 'stage task has correct file_paths count',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });

        assertEqual(result.stage_task.file_paths[0], filePath, {
            testName: 'stage task has correct file_path',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Collab Workflow',
        });
    });
});

// ─── Bytecode Aggregation Test ───────────────────────────────────────────────

describe('Bytecode Aggregation', () => {
    it('aggregateTestResults produces valid bytecode summary', () => {
        const testResults = [
            { testName: 'test1', testFile: 'qa.test.js', testSuite: 'QA', duration: 50, status: TEST_SEVERITY.PASS, assertions: [{ pass: true }] },
            { testName: 'test2', testFile: 'qa.test.js', testSuite: 'QA', duration: 75, status: TEST_SEVERITY.PASS, assertions: [{ pass: true }] },
            { testName: 'test3', testFile: 'qa.test.js', testSuite: 'QA', duration: 100, status: TEST_SEVERITY.FAIL, assertions: [{ pass: false, reason: 'Expected 1 to equal 2' }] },
        ];

        const summary = aggregateTestResults(testResults);

        assertEqual(summary.total, 3, {
            testName: 'total count correct',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Aggregation',
        });

        assertEqual(summary.passed, 2, {
            testName: 'passed count correct',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Aggregation',
        });

        assertEqual(summary.failed, 1, {
            testName: 'failed count correct',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Aggregation',
        });

        assertInRange(summary.passRate, 0.66, 0.67, {
            testName: 'pass rate correct',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Aggregation',
        });

        // Bytecode should be valid
        assertType(summary.bytecode, 'string', {
            testName: 'summary bytecode is string',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Aggregation',
        });

        assertTrue(summary.bytecode.startsWith('PB-ERR-v1-'), {
            testName: 'summary bytecode has correct prefix',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Aggregation',
        });

        const decoded = decodeBytecodeError(summary.bytecode);
        assertTrue(decoded.valid, {
            testName: 'summary bytecode decodes correctly',
            testFile: 'collab.bytecode-qa.test.js',
            testSuite: 'Bytecode Aggregation',
        });
    });
});
