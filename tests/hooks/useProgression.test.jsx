import { renderHook, act } from '@testing-library/react';
import { ProgressionProvider, useProgression } from '../../src/hooks/useProgression';
import { describe, it, expect, beforeEach } from 'vitest';

const wrapper = ({ children }) => <ProgressionProvider>{children}</ProgressionProvider>;

describe('useProgression Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useProgression(), { wrapper });
    expect(result.current.progression.xp).toBe(0);
    expect(result.current.progression.unlockedSchools).toEqual(['SONIC']);
  });

  it('should add XP and update progression', () => {
    const { result } = renderHook(() => useProgression(), { wrapper });
    
    act(() => {
      result.current.addXP(100);
    });

    expect(result.current.progression.xp).toBe(100);
  });

  it('should not add XP for duplicate unique IDs', () => {
    const { result } = renderHook(() => useProgression(), { wrapper });

    act(() => {
      result.current.addXP(50, 'discovery', 'unique-item-1');
    });

    expect(result.current.progression.xp).toBe(50);

    act(() => {
      result.current.addXP(50, 'discovery', 'unique-item-1');
    });

    expect(result.current.progression.xp).toBe(50);
  });

  it('should unlock schools when XP threshold is met', () => {
    const { result } = renderHook(() => useProgression(), { wrapper });

    act(() => {
      result.current.addXP(250);
    });
    expect(result.current.progression.unlockedSchools).toContain('PSYCHIC');

    act(() => {
      result.current.addXP(1250); // Total XP: 1500
    });
    expect(result.current.progression.unlockedSchools).toContain('VOID');
  });

  it('should check if a school is unlocked', () => {
    const { result } = renderHook(() => useProgression(), { wrapper });
    expect(result.current.checkUnlocked('SONIC')).toBe(true);
    expect(result.current.checkUnlocked('PSYCHIC')).toBe(false);

    act(() => {
        result.current.addXP(250); 
    });

    expect(result.current.checkUnlocked('PSYCHIC')).toBe(true);
  });

  it('should reset progression', () => {
    const { result } = renderHook(() => useProgression(), { wrapper });

    act(() => {
      result.current.addXP(100);
    });

    expect(result.current.progression.xp).toBe(100);

    act(() => {
      result.current.resetProgression();
    });

    expect(result.current.progression.xp).toBe(0);
    expect(result.current.progression.unlockedSchools).toEqual(['SONIC']);
  });
});
