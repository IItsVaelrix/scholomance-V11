/**
 * combatBridge.js
 * Lightweight pub/sub bridge between the React layer and the Phaser scene.
 * Neither side imports the other — both only import this file.
 *
 * React → Phaser events:
 *   'combat:init'       { playerName, opponentName, playerHP, playerMP, opponentHP }
 *   'player:cast'       { damage, school, text }
 *   'opponent:cast'     { spell, damage }
 *   'state:update'      { state, playerHP, opponentHP, playerMP }
 *
 * Phaser → React events:
 *   'action:inscribe'   {}  — player clicked INSCRIBE SPELL
 *   'action:flee'       {}  — player clicked FLEE
 *   'anim:player:done'  {}  — player spell animation finished
 *   'anim:opponent:done'{}  — opponent animation finished
 */

const _listeners = new Map();

export const combatBridge = {
  on(event, fn) {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(fn);
    // Return unsubscribe function
    return () => _listeners.get(event)?.delete(fn);
  },

  emit(event, payload = {}) {
    _listeners.get(event)?.forEach((fn) => fn(payload));
  },

  off(event, fn) {
    _listeners.get(event)?.delete(fn);
  },

  /** Remove all listeners — call on scene destroy to prevent memory leaks. */
  clear() {
    _listeners.clear();
  },
};
