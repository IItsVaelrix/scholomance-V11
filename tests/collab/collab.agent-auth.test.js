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
        `scholomance_collab_agent_auth_${Date.now()}_${process.pid}.sqlite`,
    );

    process.env.COLLAB_DB_PATH = testDbPath;
    vi.resetModules();

    const serviceMod = await import('../../codex/server/collab/collab.service.js?test=collab-service');
    const persistenceMod = await import('../../codex/server/collab/collab.persistence.js');
    const authMod = await import('../../codex/server/collab/collab.agent-auth.js');

    collabService = serviceMod.collabService;
    collabPersistence = persistenceMod.collabPersistence;

    // Register test agents
    collabService.registerAgent({
        id: 'agent-remote',
        name: 'Remote Agent',
        role: 'backend',
        capabilities: ['node', 'remote'],
    });
});

afterAll(async () => {
    if (existsSync(testDbPath)) {
        rmSync(testDbPath, { force: true });
    }
    // Clean up WAL files
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (existsSync(walPath)) rmSync(walPath, { force: true });
    if (existsSync(shmPath)) rmSync(shmPath, { force: true });
});

describe('Agent Key Authentication', () => {
    describe('generateAgentKey', () => {
        it('generates a key with correct format', async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const result = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
                expiresInDays: 0,
            });

            expect(result.keyId).toBeDefined();
            expect(result.plaintextKey).toBeDefined();
            expect(result.plaintextKey).toMatch(/^sk-scholomance-agent-remote-[a-f0-9]{64}$/);
        });

        it('stores the key hashed (not plaintext)', async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const result = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
            });

            const storedKey = collabPersistence.agent_keys.getById(result.keyId);
            expect(storedKey).toBeDefined();
            expect(storedKey.key_hash).toBeDefined();
            expect(storedKey.key_hash).not.toBe(result.plaintextKey);
            expect(storedKey.key_hash).toMatch(/^\$2[abyb]\$/); // bcrypt prefix
        });

        it('sets expiry when expiresInDays > 0', async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const result = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
                expiresInDays: 30,
            });

            const storedKey = collabPersistence.agent_keys.getById(result.keyId);
            expect(storedKey.expires_at).toBeDefined();
            expect(new Date(storedKey.expires_at)).toBeInstanceOf(Date);
        });
    });

    describe('validateAgentKey', () => {
        let validKey;

        beforeAll(async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');
            const result = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
            });
            validKey = result.plaintextKey;
        });

        it('accepts a valid key and resolves agent identity', async () => {
            const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const agent = await validateAgentKey(validKey);

            expect(agent).toBeDefined();
            expect(agent.id).toBe('agent-remote');
            expect(agent.name).toBe('Remote Agent');
            expect(agent.role).toBe('backend');
            expect(agent.capabilities).toContain('node');
        });

        it('rejects an invalid key', async () => {
            const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const agent = await validateAgentKey('sk-scholomance-fake-invalid-key');

            expect(agent).toBeNull();
        });

        it('rejects an empty key', async () => {
            const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            expect(await validateAgentKey('')).toBeNull();
            expect(await validateAgentKey(null)).toBeNull();
            expect(await validateAgentKey(undefined)).toBeNull();
        });

        it('rejects a revoked key', async () => {
            const { generateAgentKey, revokeAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');
            const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const result = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
            });

            // Revoke the key
            const revoked = revokeAgentKey(result.keyId);
            expect(revoked).toBe(true);

            // Validate should reject
            const agent = await validateAgentKey(result.plaintextKey);
            expect(agent).toBeNull();
        });

        it('rejects an expired key', async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');
            const { validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const result = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
                expiresInDays: 0,
            });

            // Manually expire the key using persistence API
            collabPersistence.agent_keys.expire(result.keyId);

            const agent = await validateAgentKey(result.plaintextKey);
            expect(agent).toBeNull();
        });
    });

    describe('rotateAgentKey', () => {
        it('revokes all existing keys and generates a new one', async () => {
            const { generateAgentKey, rotateAgentKey, validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            // Generate an initial key
            const initial = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
            });

            // Rotate
            const rotated = await rotateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
            });

            // Old key should be rejected
            const oldAgent = await validateAgentKey(initial.plaintextKey);
            expect(oldAgent).toBeNull();

            // New key should work
            const newAgent = await validateAgentKey(rotated.plaintextKey);
            expect(newAgent).toBeDefined();
            expect(newAgent.id).toBe('agent-remote');
        });
    });

    describe('Key security properties', () => {
        it('does not return key material in agent identity', async () => {
            const { generateAgentKey, validateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const result = await generateAgentKey({
                agentId: 'agent-remote',
                createdBy: 'angel',
            });

            const agent = await validateAgentKey(result.plaintextKey);

            // Agent identity should NOT contain the key
            expect(agent).not.toHaveProperty('key');
            expect(agent).not.toHaveProperty('key_hash');
            expect(agent).not.toHaveProperty('plaintextKey');
        });

        it('stores unique hashes for each key generation', async () => {
            const { generateAgentKey } = await import('../../codex/server/collab/collab.agent-auth.js');

            const key1 = await generateAgentKey({ agentId: 'agent-remote', createdBy: 'angel' });
            const key2 = await generateAgentKey({ agentId: 'agent-remote', createdBy: 'angel' });

            const stored1 = collabPersistence.agent_keys.getById(key1.keyId);
            const stored2 = collabPersistence.agent_keys.getById(key2.keyId);

            // Each key should have a unique hash (bcrypt uses random salts)
            expect(stored1.key_hash).not.toBe(stored2.key_hash);
        });
    });
});
