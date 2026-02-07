import { createContext, useContext, useState, useMemo } from "react";
import { LIBRARY } from "../data/library";

const SongContext = createContext(null);

export function SongProvider({ children }) {
  const [currentKey, setCurrentKey] = useState("lexiconic");

  const value = useMemo(
    () => ({
      currentKey,
      currentSong: LIBRARY[currentKey] || Object.values(LIBRARY)[0],
      setCurrentKey: (key) => {
        if (LIBRARY[key]) setCurrentKey(key);
      },
      library: LIBRARY,
    }),
    [currentKey]
  );

  return <SongContext.Provider value={value}>{children}</SongContext.Provider>;
}

export function useCurrentSong() {
  const context = useContext(SongContext);
  if (!context) {
    throw new Error("useCurrentSong must be used within SongProvider");
  }
  return context;
}
