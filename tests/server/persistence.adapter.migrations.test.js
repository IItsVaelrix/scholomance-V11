import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runSqliteMigrations } from '../../codex/server/db/sqlite.migrations.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Persistence Migration Drift Regression', () => {
    let db;
    let dbPath;

    beforeEach(() => {
        dbPath = path.join(os.tmpdir(), `migration_test_${Date.now()}.sqlite`);
        db = new Database(dbPath);
    });

    afterEach(() => {
        db.close();
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    });

    it('should handle existing tables when schema_migrations is missing', () => {
        // PRE-CONDITION: Create a table that a future migration will also try to create
        db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL
            );
        `);

        const migrations = [
            {
                version: 1,
                name: 'create_users_table',
                up(database) {
                    database.exec(`
                        CREATE TABLE IF NOT EXISTS users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            username TEXT UNIQUE NOT NULL
                        );
                    `);
                }
            }
        ];

        // This should NOT throw if migrations use CREATE TABLE IF NOT EXISTS
        // and the runner handles the missing schema_migrations table by starting at version 0.
        expect(() => {
            runSqliteMigrations(db, { namespace: 'test', migrations });
        }).not.toThrow();

        const row = db.prepare('SELECT version FROM schema_migrations WHERE namespace = ?').get('test');
        expect(row.version).toBe(1);
    });

    it('should fail if migration uses raw CREATE TABLE on existing table', () => {
        // This test documents the behavior that IF NOT EXISTS is mandatory for drift resilience.
        db.exec(`CREATE TABLE legacy_table (id INTEGER);`);

        const migrations = [
            {
                version: 1,
                name: 'create_legacy_table',
                up(database) {
                    database.exec(`CREATE TABLE legacy_table (id INTEGER);`);
                }
            }
        ];

        expect(() => {
            runSqliteMigrations(db, { namespace: 'fail_test', migrations });
        }).toThrow(/table legacy_table already exists/);
    });
});
