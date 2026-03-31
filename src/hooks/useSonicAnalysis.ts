import { useState, useEffect, useRef } from 'react';
import { SCHOOLS } from '../data/schools';

/**
 * useSonicAnalysis — Centralized real-time audio detection.
 * Maps spectral energy to the 5 Schools of Scholomance.
 */
import { useState, useEffect, useRef } from 'react';
import { getAmbientPlayerService } from '../lib/ambient/ambientPlayer.service.js';

/**
 * useSonicAnalysis — Centralized real-time audio detection.
 * Consumes the authoritative analysis from AmbientPlayerService.
 */
export function useSonicAnalysis(getByteFrequencyData: (array: Uint8Array) => void, isPlaying: boolean) {
  const [detectedSchoolId, setDetectedSchoolId] = useState<string | null>(null);
  const rafIdRef = useRef<number>();

  useEffect(() => {
    if (!isPlaying) {
      setDetectedSchoolId(null);
      return;
    }

    const service = getAmbientPlayerService();

    const analyze = async () => {
      //authoritative detection from service (locked fingerprint)
      const id = await service.getDetectedSchoolId();
      if (id !== detectedSchoolId) {
        setDetectedSchoolId(id);
      }
      
      rafIdRef.current = requestAnimationFrame(analyze);
    };

    analyze();
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPlaying, detectedSchoolId]);

  return { detectedSchoolId };
}
