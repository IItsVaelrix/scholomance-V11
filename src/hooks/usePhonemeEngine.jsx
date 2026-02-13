import { createContext, useContext } from "react";

const DEFAULT_ENGINE_STATE = Object.freeze({
  isReady: true,
  error: null,
  engine: null,
});

const PhonemeEngineContext = createContext(DEFAULT_ENGINE_STATE);

export function PhonemeEngineProvider({ children }) {
  return (
    <PhonemeEngineContext.Provider value={DEFAULT_ENGINE_STATE}>
      {children}
    </PhonemeEngineContext.Provider>
  );
}

export function usePhonemeEngine() {
  return useContext(PhonemeEngineContext);
}
