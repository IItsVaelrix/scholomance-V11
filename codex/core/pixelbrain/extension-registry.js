const EXTENSION_TYPES = new Set(['PHYSICS', 'STYLE', 'CUSTOM_PROP']);
const HOOK_PROPERTY_TO_TYPE = Object.freeze({
  onCoordinateMap: 'coordinate-map',
  onColorByte: 'color-byte',
  onNoiseGen: 'noise-gen',
  onRender: 'render',
});

function normalizeExtensionType(type) {
  const normalized = String(type || '').trim().toUpperCase();
  if (!EXTENSION_TYPES.has(normalized)) {
    throw new Error(`Unsupported PixelBrain extension type: ${type}`);
  }
  return normalized;
}

function normalizeHookType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (!Object.values(HOOK_PROPERTY_TO_TYPE).includes(normalized)) {
    throw new Error(`Unsupported PixelBrain hook type: ${type}`);
  }
  return normalized;
}

function toPublicExtensionRecord(extension) {
  return Object.freeze({
    id: String(extension?.id || '').trim(),
    type: String(extension?.type || '').trim().toUpperCase(),
  });
}

function validateExtension(extension) {
  if (!extension || typeof extension !== 'object') {
    throw new Error('PixelBrain extension must be an object.');
  }

  const id = String(extension.id || '').trim();
  if (!id) {
    throw new Error('PixelBrain extension must expose a non-empty id.');
  }

  return Object.freeze({
    ...extension,
    id,
    type: normalizeExtensionType(extension.type),
    hooks: extension.hooks && typeof extension.hooks === 'object'
      ? { ...extension.hooks }
      : {},
    config: extension.config && typeof extension.config === 'object'
      ? { ...extension.config }
      : {},
  });
}

export function createExtensionRegistry(options = {}) {
  const extensions = new Map();
  const hooks = new Map([
    ['coordinate-map', []],
    ['color-byte', []],
    ['noise-gen', []],
    ['render', []],
  ]);
  let sequence = 0;

  function registerHookRecord(extension, type, hook) {
    const normalizedType = normalizeHookType(type);
    if (typeof hook !== 'function') {
      throw new Error(`PixelBrain extension hook for ${normalizedType} must be a function.`);
    }

    hooks.get(normalizedType).push({
      sequence: sequence += 1,
      extension,
      hook,
    });
  }

  function removeHooksForExtension(extensionId, type = null) {
    const targetTypes = type ? [normalizeHookType(type)] : [...hooks.keys()];
    targetTypes.forEach((hookType) => {
      hooks.set(
        hookType,
        hooks.get(hookType).filter((entry) => entry.extension.id !== extensionId)
      );
    });
  }

  function createContext(extension) {
    return Object.freeze({
      registerHook(type, hook) {
        registerHookRecord(extension, type, hook);
      },
      unregisterHook(type) {
        removeHooksForExtension(extension.id, type);
      },
    });
  }

  function register(extension) {
    const normalized = validateExtension(extension);
    if (extensions.has(normalized.id)) {
      throw new Error(`PixelBrain extension ${normalized.id} is already registered.`);
    }

    const context = createContext(normalized);
    extensions.set(normalized.id, {
      extension: normalized,
      context,
    });

    if (typeof normalized.activate === 'function') {
      normalized.activate(context);
    } else {
      Object.entries(HOOK_PROPERTY_TO_TYPE).forEach(([property, hookType]) => {
        const hook = normalized.hooks[property];
        if (typeof hook === 'function') {
          registerHookRecord(normalized, hookType, hook);
        }
      });
    }

    return toPublicExtensionRecord(normalized);
  }

  function unregister(extensionId) {
    const normalizedId = String(extensionId || '').trim();
    const record = extensions.get(normalizedId);
    if (!record) return false;

    if (typeof record.extension.deactivate === 'function') {
      record.extension.deactivate(record.context);
    }
    removeHooksForExtension(normalizedId);
    extensions.delete(normalizedId);
    return true;
  }

  function applyHooks(type, payload, context = {}) {
    const normalizedType = normalizeHookType(type);
    const queue = hooks.get(normalizedType)
      .slice()
      .sort((left, right) => left.sequence - right.sequence);

    return queue.reduce((currentPayload, entry) => {
      const nextPayload = entry.hook.call(entry.extension, currentPayload, Object.freeze({
        ...context,
        extensionId: entry.extension.id,
        extensionType: entry.extension.type,
      }));
      return nextPayload === undefined ? currentPayload : nextPayload;
    }, payload);
  }

  const initialExtensions = Array.isArray(options?.extensions) ? options.extensions : [];
  initialExtensions.forEach((extension) => {
    register(extension);
  });

  return Object.freeze({
    register,
    unregister,
    has(extensionId) {
      return extensions.has(String(extensionId || '').trim());
    },
    list() {
      return Object.freeze(
        [...extensions.values()]
          .map((record) => toPublicExtensionRecord(record.extension))
          .sort((left, right) => left.id.localeCompare(right.id))
      );
    },
    getHooks(type) {
      const normalizedType = normalizeHookType(type);
      return Object.freeze(
        hooks.get(normalizedType)
          .slice()
          .sort((left, right) => left.sequence - right.sequence)
          .map((entry) => Object.freeze({
            extensionId: entry.extension.id,
            type: normalizedType,
          }))
      );
    },
    applyHooks,
    clear() {
      [...extensions.keys()].forEach((extensionId) => {
        unregister(extensionId);
      });
    },
  });
}
