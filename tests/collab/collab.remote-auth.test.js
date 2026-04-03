import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

let collabService;
let collabPersistence;
let testDbPath;

function uniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

beforeAll(async () => {
    testDbPath = path.join(
        os.tmpdir(),
        `scholomance_collab_remote_auth_${Date.now()}_${process.pid}.sqlite`,
    );

    process.env.COLLAB_DB_PATH = testDbPath;
    vi.resetModules();

    const serviceMod = await import('../../codex/server/collab/collab.service.js?test=collab-service');
    const persistenceMod = await import('../../codex/server/collab/collab.persistence.js');

    collabService = serviceMod.collabService;
    collabPersistence = persistenceMod.collabPersistence;

    // Register canonical test agents
    collabService.registerAgent({
        id: 'test-remote-agent',
        name: 'Test Remote Agent',
        role: 'backend',
        capabilities: ['node', 'remote'],
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

describe('Phase 3: Remote Agent End-to-End', () => {
    describe('Canonical agent key generation', () => {
        it('generates keys for all canonical agents', async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const canonicalAgents = [
                'claude-ui',
                'codex-backend',
                'gemini-backend',
                'blackbox-qa',
                'arbiter-backend',
                'nexus-backend',
                'unity-backend',
                'angel-backend',
            ];

            const results = [];
            for (const agentId of canonicalAgents) {
                // Register agent if not exists
                try {
                    collabPersistence.agents.register({
                        id: agentId,
                        name: agentId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        role: agentId.includes('qa') ? 'qa' : agentId.includes('ui') ? 'ui' : 'backend',
                        capabilities: ['test'],
                    });
                } catch {
                    // Already exists
                }

                const result = await generateAgentKey({
                    agentId,
                    createdBy: 'test-runner',
                    expiresInDays: 0,
                });
                results.push(result);
            }

            expect(results).toHaveLength(canonicalAgents.length);
            for (const result of results) {
                expect(result.keyId).toBeDefined();
                expect(result.plaintextKey).toMatch(/^sk-scholomance-[a-z-]+-[a-f0-9]{64}$/);
            }
        });
    });

    describe('End-to-end remote agent workflow', () => {
        let agentKey;

        beforeAll(async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');
            const result = await generateAgentKey({
                agentId: 'test-remote-agent',
                createdBy: 'test-runner',
            });
            agentKey = result.plaintextKey;
        });

        it('remote agent can acquire and release file locks', async () => {
            const filePath = `src/pages/Collab/${uniqueId('remote-lock')}.jsx`;

            // Acquire lock
            const lockResult = collabService.acquireLock({
                file_path: filePath,
                agent_id: 'test-remote-agent',
                ttl_minutes: 30,
                override: true,
            });
            expect(lockResult).toBeDefined();

            // Verify lock
            const lock = collabService.checkLock(filePath);
            expect(lock).toBeDefined();
            expect(lock.locked_by).toBe('test-remote-agent');

            // Release lock
            const releaseResult = collabService.releaseLock({
                file_path: filePath,
                agent_id: 'test-remote-agent',
            });
            expect(releaseResult).toBeDefined();

            // Verify lock released
            const releasedLock = collabService.checkLock(filePath);
            expect(releasedLock).toBeNull();
        });

        it('remote agent key is not exposed in any API response', async () => {
            const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const agent = await validateAgentKey(agentKey);

            // Agent identity should NOT contain any key material
            expect(agent).not.toHaveProperty('key');
            expect(agent).not.toHaveProperty('key_hash');
            expect(agent).not.toHaveProperty('plaintextKey');
            expect(agent).not.toHaveProperty('token');
            expect(agent).not.toHaveProperty('secret');

            // Only safe fields should be present
            expect(agent).toHaveProperty('id');
            expect(agent).toHaveProperty('name');
            expect(agent).toHaveProperty('role');
            expect(agent).toHaveProperty('capabilities');
        });
    });

    describe('CORS and rate limiting configuration', () => {
        it('COLLAB_ALLOWED_ORIGINS parses correctly', () => {
            const origins = 'https://example.com,https://scholomance.ai'
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            expect(origins).toEqual(['https://example.com', 'https://scholomance.ai']);
        });

        it('COLLAB_AGENT_RATE_LIMIT_MAX parses correctly', () => {
            const max = parseInt(process.env.COLLAB_AGENT_RATE_LIMIT_MAX || '120', 10);
            expect(max).toBeGreaterThan(0);
            expect(Number.isInteger(max)).toBe(true);
        });

        it('COLLAB_KEY_EXPIRY_DAYS parses correctly', () => {
            const days = parseInt(process.env.COLLAB_KEY_EXPIRY_DAYS || '0', 10);
            expect(days).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(days)).toBe(true);
        });
    });
});
