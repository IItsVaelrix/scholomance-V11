/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  authorizeAudioRequest,
  buildAudioUnauthorizedPayload,
  AUDIO_ADMIN_HEADER,
} from '../../codex/server/audioAuth.js';

describe('[Server] audioAuth helpers', () => {
  const productionConfig = {
    isProduction: true,
    configuredAdminToken: 'top-secret-token',
  };

  it('authorizes all audio requests outside production', () => {
    const result = authorizeAudioRequest(
      { headers: {} },
      { isProduction: false, configuredAdminToken: null },
    );

    expect(result).toEqual({ authorized: true });
  });

  it('rejects production requests without admin token header', () => {
    const result = authorizeAudioRequest({ headers: {} }, productionConfig);

    expect(result).toEqual({
      authorized: false,
      reason: 'missing_admin_token',
    });
  });

  it('rejects production requests with invalid admin token header', () => {
    const result = authorizeAudioRequest(
      {
        headers: {
          [AUDIO_ADMIN_HEADER]: 'wrong-token',
        },
      },
      productionConfig,
    );

    expect(result).toEqual({
      authorized: false,
      reason: 'invalid_admin_token',
    });
  });

  it('accepts production requests with matching admin token header', () => {
    const result = authorizeAudioRequest(
      {
        headers: {
          [AUDIO_ADMIN_HEADER]: 'top-secret-token',
        },
      },
      productionConfig,
    );

    expect(result).toEqual({ authorized: true });
  });

  it('does not accept a user session without token in production', () => {
    const result = authorizeAudioRequest(
      {
        headers: {},
        session: { user: { id: 1 } },
      },
      productionConfig,
    );

    expect(result).toEqual({
      authorized: false,
      reason: 'missing_admin_token',
    });
  });

  it('builds stable unauthorized payloads with reason', () => {
    expect(buildAudioUnauthorizedPayload('missing_admin_token')).toEqual({
      message: 'Unauthorized: missing audio admin token.',
      reason: 'missing_admin_token',
    });
    expect(buildAudioUnauthorizedPayload('invalid_admin_token')).toEqual({
      message: 'Unauthorized: invalid audio admin token.',
      reason: 'invalid_admin_token',
    });
  });
});
