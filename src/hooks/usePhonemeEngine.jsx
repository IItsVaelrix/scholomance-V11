import { createContext, useContext, useState, useEffect } from "react";
import { PhonemeEngine } from "../lib/phoneme.engine";

const PhonemeEngineContext = createContext(null);

export function PhonemeEngineProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    PhonemeEngine.init()
      .then(() => mounted && setIsReady(true))
      .catch((err) => mounted && setError(err));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PhonemeEngineContext.Provider value={{ isReady, error, engine: PhonemeEngine }}>
      {children}
    </PhonemeEngineContext.Provider>
  );
}

export function usePhonemeEngine() {
  const context = useContext(PhonemeEngineContext);
  if (!context) {
    throw new Error("usePhonemeEngine must be used within PhonemeEngineProvider");
  }
  return context;
}
