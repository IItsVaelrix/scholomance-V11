/**
 * useCursorSync — Bytecode-driven cursor alignment hook
 * 
 * Ensures textarea and truesight overlay have identical typography
 * by compiling from a single bytecode blueprint source.
 * 
 * Uses computed styles from a reference element to ensure pixel-perfect alignment.
 */

import { useMemo, useRef, useLayoutEffect, useState } from 'react';

export interface CursorSyncBlueprint {
  fontFamily: string;
  fontSize?: string | number;
  lineHeight?: string | number;
  letterSpacing?: number;
  wordSpacing?: number;
  paddingX?: string | number;
  paddingY?: string | number;
  tabSize?: number;
  referenceElement?: HTMLElement | null;
}

export interface CursorSyncOutput {
  textareaStyles: React.CSSProperties;
  overlayStyles: React.CSSProperties;
}

/**
 * Resolve CSS variable or return value as-is
 */
function resolveCSSValue(value: string | number | undefined, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'number') return String(value);
  return value;
}

/**
 * Compile cursor sync blueprint to deterministic styles
 */
export function compileCursorSync(blueprint: CursorSyncBlueprint): CursorSyncOutput {
  const sharedStyles: React.CSSProperties = {
    fontFamily: resolveCSSValue(blueprint.fontFamily, '"JetBrains Mono", monospace'),
    fontSize: resolveCSSValue(blueprint.fontSize, 'inherit'),
    lineHeight: resolveCSSValue(blueprint.lineHeight, 'inherit'),
    letterSpacing: blueprint.letterSpacing ?? 0,
    wordSpacing: blueprint.wordSpacing ?? 0,
    paddingTop: resolveCSSValue(blueprint.paddingY, '1rem'),
    paddingRight: resolveCSSValue(blueprint.paddingX, '1.25rem'),
    paddingBottom: resolveCSSValue(blueprint.paddingY, '1rem'),
    paddingLeft: resolveCSSValue(blueprint.paddingX, '1.25rem'),
    tabSize: blueprint.tabSize ?? 2,
    MozTabSize: blueprint.tabSize ?? 2,
    boxSizing: 'border-box',
  };

  return {
    textareaStyles: {
      ...sharedStyles,
      WebkitTextFillColor: 'currentColor',
      resize: 'none',
      overflow: 'auto',
    },
    overlayStyles: {
      ...sharedStyles,
      overflow: 'hidden',
      pointerEvents: 'none',
    },
  };
}

/**
 * Hook to sync cursor alignment between textarea and overlay
 * 
 * Uses a reference element to compute actual pixel values for typography,
 * ensuring perfect alignment between native textarea caret and custom overlay.
 */
export function useCursorSync(blueprint: CursorSyncBlueprint): CursorSyncOutput {
  const { referenceElement, ...rest } = blueprint;
  
  // Compute actual typography values from reference element
  const computedStyles = useMemo(() => {
    if (!referenceElement) return null;
    
    const styles = window.getComputedStyle(referenceElement);
    return {
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      lineHeight: styles.lineHeight,
      letterSpacing: styles.letterSpacing,
      wordSpacing: styles.wordSpacing,
      paddingTop: styles.paddingTop,
      paddingRight: styles.paddingRight,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
    };
  }, [referenceElement]);

  // Use computed values if available, otherwise use blueprint values
  return useMemo(() => compileCursorSync({
    ...rest,
    fontFamily: computedStyles?.fontFamily || rest.fontFamily,
    fontSize: computedStyles?.fontSize || rest.fontSize,
    lineHeight: computedStyles?.lineHeight || rest.lineHeight,
    letterSpacing: parseFloat(computedStyles?.letterSpacing || '0') || rest.letterSpacing,
    wordSpacing: parseFloat(computedStyles?.wordSpacing || '0') || rest.wordSpacing,
    paddingX: computedStyles?.paddingRight || rest.paddingX,
    paddingY: computedStyles?.paddingTop || rest.paddingY,
  }), [rest, computedStyles]);
}
