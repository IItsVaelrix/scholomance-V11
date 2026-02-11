import { describe, it, expect } from 'vitest';
import {
    PIPELINE_DEFINITIONS,
    OWNERSHIP_MAP,
    isPathAllowedForRole,
    getRoleForPath,
    validateFileOwnership,
} from '../../codex/server/collab/collab.pipelines.js';

describe('PIPELINE_DEFINITIONS', () => {
    it('should define code_review_test pipeline with 3 stages', () => {
        const pipeline = PIPELINE_DEFINITIONS.code_review_test;
        expect(pipeline).toBeDefined();
        expect(pipeline.stages).toHaveLength(3);
        expect(pipeline.stages[0].name).toBe('implement');
        expect(pipeline.stages[1].name).toBe('review');
        expect(pipeline.stages[2].name).toBe('test');
    });

    it('should define schema_change pipeline with 3 stages', () => {
        const pipeline = PIPELINE_DEFINITIONS.schema_change;
        expect(pipeline).toBeDefined();
        expect(pipeline.stages).toHaveLength(3);
        expect(pipeline.stages[0].role).toBe('backend');
        expect(pipeline.stages[1].role).toBe('ui');
    });

    it('should define bug_fix pipeline with diagnose/fix/verify', () => {
        const pipeline = PIPELINE_DEFINITIONS.bug_fix;
        expect(pipeline).toBeDefined();
        expect(pipeline.stages[0].name).toBe('diagnose');
        expect(pipeline.stages[0].role).toBe('qa');
        expect(pipeline.stages[1].name).toBe('fix');
        expect(pipeline.stages[1].role).toBeNull();
    });

    it('all pipelines should have name and description', () => {
        for (const [key, def] of Object.entries(PIPELINE_DEFINITIONS)) {
            expect(def.name, `${key} missing name`).toBeTruthy();
            expect(def.description, `${key} missing description`).toBeTruthy();
            expect(def.stages.length, `${key} has no stages`).toBeGreaterThan(0);
        }
    });
});

describe('OWNERSHIP_MAP', () => {
    it('should have ui, backend, and qa roles', () => {
        expect(OWNERSHIP_MAP).toHaveProperty('ui');
        expect(OWNERSHIP_MAP).toHaveProperty('backend');
        expect(OWNERSHIP_MAP).toHaveProperty('qa');
    });
});

describe('isPathAllowedForRole', () => {
    it('should allow UI role to access src/pages/', () => {
        expect(isPathAllowedForRole('src/pages/Read/ReadPage.jsx', 'ui')).toBe(true);
    });

    it('should allow UI role to access src/components/', () => {
        expect(isPathAllowedForRole('src/components/Navigation/Navigation.jsx', 'ui')).toBe(true);
    });

    it('should allow UI role to access CSS files anywhere', () => {
        expect(isPathAllowedForRole('src/pages/Read/ReadPage.css', 'ui')).toBe(true);
        expect(isPathAllowedForRole('some/deep/path/styles.css', 'ui')).toBe(true);
    });

    it('should not allow UI role to access codex/', () => {
        expect(isPathAllowedForRole('codex/core/schemas.js', 'ui')).toBe(false);
    });

    it('should allow backend role to access codex/', () => {
        expect(isPathAllowedForRole('codex/core/schemas.js', 'backend')).toBe(true);
    });

    it('should allow backend role to access src/lib/', () => {
        expect(isPathAllowedForRole('src/lib/phoneme.js', 'backend')).toBe(true);
    });

    it('should allow QA role to access tests/', () => {
        expect(isPathAllowedForRole('tests/collab/test.js', 'qa')).toBe(true);
    });

    it('should not allow QA role to access src/pages/', () => {
        expect(isPathAllowedForRole('src/pages/Read/ReadPage.jsx', 'qa')).toBe(false);
    });

    it('should normalize backslashes to forward slashes', () => {
        expect(isPathAllowedForRole('src\\pages\\Read\\ReadPage.jsx', 'ui')).toBe(true);
    });

    it('should return false for unknown roles', () => {
        expect(isPathAllowedForRole('src/pages/test.jsx', 'unknown')).toBe(false);
    });
});

describe('getRoleForPath', () => {
    it('should return ui for pages', () => {
        expect(getRoleForPath('src/pages/Read/ReadPage.jsx')).toBe('ui');
    });

    it('should return backend for codex', () => {
        expect(getRoleForPath('codex/core/schemas.js')).toBe('backend');
    });

    it('should return qa for tests', () => {
        expect(getRoleForPath('tests/unit/test.js')).toBe('qa');
    });

    it('should return null for unmatched paths', () => {
        expect(getRoleForPath('random/unknown/file.txt')).toBeNull();
    });
});

describe('validateFileOwnership', () => {
    it('should validate all files belong to the role', () => {
        const result = validateFileOwnership(
            ['src/pages/Read/ReadPage.jsx', 'src/components/Nav.jsx'],
            'ui',
        );
        expect(result.valid).toBe(true);
        expect(result.conflicts).toHaveLength(0);
    });

    it('should detect ownership conflicts', () => {
        const result = validateFileOwnership(
            ['src/pages/Read/ReadPage.jsx', 'codex/core/schemas.js'],
            'ui',
        );
        expect(result.valid).toBe(false);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].file).toBe('codex/core/schemas.js');
        expect(result.conflicts[0].assigned_role).toBe('ui');
        expect(result.conflicts[0].owner_role).toBe('backend');
    });

    it('should return valid for empty file list', () => {
        const result = validateFileOwnership([], 'ui');
        expect(result.valid).toBe(true);
    });
});
