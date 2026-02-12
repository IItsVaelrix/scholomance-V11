import { describe, it, expect } from 'vitest';
import { PipelineType, CreatePipelineSchema } from '../../codex/server/collab/collab.schemas.js';

describe('collab pipeline schemas', () => {
    it('accepts ui_feature as a valid pipeline type', () => {
        expect(PipelineType.safeParse('ui_feature').success).toBe(true);
        expect(CreatePipelineSchema.safeParse({ pipeline_type: 'ui_feature' }).success).toBe(true);
    });

    it('rejects unknown pipeline types', () => {
        expect(PipelineType.safeParse('unknown_pipeline').success).toBe(false);
    });
});
