import { describe, it, expect } from 'vitest';
import {
    PipelineType,
    CreatePipelineSchema,
    ListTasksQuerySchema,
    ListActivityQuerySchema,
    MAX_PAGE_LIMIT,
} from '../../codex/server/collab/collab.schemas.js';

describe('collab pipeline schemas', () => {
    it('accepts ui_feature as a valid pipeline type', () => {
        expect(PipelineType.safeParse('ui_feature').success).toBe(true);
        expect(CreatePipelineSchema.safeParse({ pipeline_type: 'ui_feature' }).success).toBe(true);
    });

    it('rejects unknown pipeline types', () => {
        expect(PipelineType.safeParse('unknown_pipeline').success).toBe(false);
    });

    it('coerces and validates task list query pagination', () => {
        const parsed = ListTasksQuerySchema.safeParse({
            status: 'backlog',
            priority: '2',
            limit: '25',
            offset: '10',
        });
        expect(parsed.success).toBe(true);
        expect(parsed.data.limit).toBe(25);
        expect(parsed.data.offset).toBe(10);
        expect(parsed.data.priority).toBe(2);
    });

    it('rejects task list query with excessive limit', () => {
        const parsed = ListTasksQuerySchema.safeParse({ limit: String(MAX_PAGE_LIMIT + 1) });
        expect(parsed.success).toBe(false);
    });

    it('rejects activity query with negative offset', () => {
        const parsed = ListActivityQuerySchema.safeParse({ offset: '-1' });
        expect(parsed.success).toBe(false);
    });
});
