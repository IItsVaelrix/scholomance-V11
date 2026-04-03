/**
 * MANDATORY STACKING TIERS (VAELRIX LAW 10)
 * 
 * Central definition of z-index layers.
 * Hardcoded z-indexes > 1 are prohibited.
 */

export const Z_BASE    = 0;    // Standard page content, static backgrounds
export const Z_ABOVE   = 10;   // Elements floating above content (tooltips, small menus)
export const Z_OVERLAY = 100;  // Full-screen overlays, modals, intrusive selection screens
export const Z_SYSTEM  = 1000; // Critical system elements (toasts, debug badges, errors)

export const STACKING_TIERS = {
  BASE: Z_BASE,
  ABOVE: Z_ABOVE,
  OVERLAY: Z_OVERLAY,
  SYSTEM: Z_SYSTEM,
};
