import {
  buildInspectableEntity,
  buildRoomSnapshot,
  DEFAULT_WORLD_ROOM_ID,
} from '../../core/world.entity.js';

function extractDefinition(adapter, entry) {
  if (!entry) return null;
  if (typeof adapter?.extractGloss === 'function') {
    const gloss = adapter.extractGloss(entry.senses);
    if (typeof gloss === 'string' && gloss.trim()) {
      return {
        text: gloss.trim(),
        partOfSpeech: entry.pos || '',
        source: entry.source || 'scholomance',
      };
    }
  }
  return null;
}

function lookupLexicalData(adapter, lexeme) {
  const normalizedLexeme = typeof lexeme === 'string' ? lexeme.trim().toLowerCase() : '';
  if (!normalizedLexeme) {
    return {
      word: null,
      entry: null,
      entries: [],
      definition: null,
      synonyms: [],
      antonyms: [],
      rhymes: [],
      rhymeFamily: null,
    };
  }

  const entries = typeof adapter?.lookupWord === 'function'
    ? adapter.lookupWord(normalizedLexeme, 5)
    : [];
  const entry = entries[0] || null;
  const definition = extractDefinition(adapter, entry);
  const synonyms = typeof adapter?.lookupSynonyms === 'function'
    ? adapter.lookupSynonyms(normalizedLexeme, 12)
    : [];
  const antonyms = typeof adapter?.lookupAntonyms === 'function'
    ? adapter.lookupAntonyms(normalizedLexeme, 12)
    : [];
  const rhymeData = typeof adapter?.lookupRhymes === 'function'
    ? adapter.lookupRhymes(normalizedLexeme, 16)
    : { family: null, words: [] };

  return {
    word: normalizedLexeme,
    entry,
    entries,
    definition,
    synonyms,
    antonyms,
    rhymes: Array.isArray(rhymeData?.words) ? rhymeData.words : [],
    rhymeFamily: rhymeData?.family || null,
  };
}

export function createWorldService(options = {}) {
  const adapter = options.adapter;
  const persistence = options.persistence;
  if (!persistence?.world) {
    throw new Error('createWorldService requires persistence.world accessors');
  }

  async function getRoomSnapshot(roomId = DEFAULT_WORLD_ROOM_ID) {
    const room = persistence.world.getRoom(roomId);
    if (!room) return null;

    const entities = persistence.world.getEntitiesByRoom(room.id);
    const lexicalByEntityId = {};
    for (const entity of entities) {
      lexicalByEntityId[entity.id] = lookupLexicalData(adapter, entity.lexeme);
    }

    return buildRoomSnapshot({
      room,
      entities,
      lexicalByEntityId,
    });
  }

  async function getEntityView(entityId) {
    const entity = persistence.world.getEntity(entityId);
    if (!entity) return null;
    const room = entity.roomId ? persistence.world.getRoom(entity.roomId) : null;
    const lexicalData = lookupLexicalData(adapter, entity.lexeme);

    return buildInspectableEntity({
      entity,
      room,
      lexicalData,
    });
  }

  async function inspectEntity(entityId, options = {}) {
    const existing = persistence.world.getEntity(entityId);
    if (!existing) return null;
    if (options.roomId && existing.roomId && options.roomId !== existing.roomId) {
      return {
        conflict: true,
        entity: existing,
      };
    }

    const entity = persistence.world.recordInspect(entityId);
    if (!entity) return null;
    const room = entity.roomId ? persistence.world.getRoom(entity.roomId) : null;
    const lexicalData = lookupLexicalData(adapter, entity.lexeme);

    return buildInspectableEntity({
      entity,
      room,
      lexicalData,
    });
  }

  return {
    getRoomSnapshot,
    getEntityView,
    inspectEntity,
  };
}
