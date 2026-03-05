import { describe, expect, it } from 'vitest';
import { isApiRoutePath, isStaticAssetPath, stripQueryFromUrl } from '../../codex/server/notFound.utils.js';

describe('[Server] notFound utils', () => {
  it('detects api/auth/collab paths as API routes', () => {
    expect(isApiRoutePath('/api/word-lookup/test')).toBe(true);
    expect(isApiRoutePath('/auth/me')).toBe(true);
    expect(isApiRoutePath('/collab/tasks?limit=10')).toBe(true);
  });

  it('does not classify frontend routes as API routes', () => {
    expect(isApiRoutePath('/read')).toBe(false);
    expect(isApiRoutePath('/watch/track-123')).toBe(false);
  });

  it('detects static asset paths', () => {
    expect(isStaticAssetPath('/assets/WatchPage-abc123.js')).toBe(true);
    expect(isStaticAssetPath('/favicon.ico')).toBe(true);
    expect(isStaticAssetPath('/audio/song.mp3')).toBe(true);
    expect(isStaticAssetPath('/watch')).toBe(false);
  });

  it('strips querystring from urls safely', () => {
    expect(stripQueryFromUrl('/api/test?x=1&y=2')).toBe('/api/test');
    expect(stripQueryFromUrl('')).toBe('/');
  });
});
