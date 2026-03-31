import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHapticPulse, UI_HAPTICS } from '../../lib/platform/haptics';
import { transmuteToSigil, generateSigilFile } from '../../lib/career/transmuter';
import './CareerPage.css';

/**
 * CareerPage — The Career Ignition Chamber.
 * Transmutes raw experience into ATS-optimized sigils.
 */
export default function CareerPage() {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'TRANSMUTING' | 'COMPLETE'>('IDLE');
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // -- Ripple Follower ---------------------------------------------
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      containerRef.current.style.setProperty('--mouse-x', `${x}%`);
      containerRef.current.style.setProperty('--mouse-y', `${y}%`);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  // -- Ignition Ritual ---------------------------------------------
  const handleIgnite = () => {
    if (!content.trim() || status !== 'IDLE') return;
    
    setStatus('TRANSMUTING');
    setProgress(0);
    triggerHapticPulse(UI_HAPTICS.HEAVY);

    const duration = 3000; // 3 seconds for the ritual
    const interval = 30;
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          finalizeRitual();
          return 100;
        }
        return next;
      });
    }, interval);
  };

  const finalizeRitual = useCallback(() => {
    // 1. Perform Transmutation
    const optimized = transmuteToSigil(content);
    
    // 2. Set complete state
    setStatus('COMPLETE');
    triggerHapticPulse(UI_HAPTICS.SUCCESS);
    
    // 3. Finalize payoff
    setTimeout(() => {
      // 4. Update text area with the 'Sigil'
      setContent(optimized);
      
      // 5. Generate and download the file
      generateSigilFile(optimized);
      
      // 6. Reset ritual to IDLE
      setStatus('IDLE');
      setProgress(0);
    }, 2500);
  }, [content]);

  // Interpolate health bar color (Green -> Red)
  const getHealthColor = (p: number) => {
    // 0% = #22c55e (Green), 100% = #ef4444 (Red)
    const r = Math.floor(34 + (239 - 34) * (p / 100));
    const g = Math.floor(197 - (197 - 68) * (p / 100));
    const b = Math.floor(94 - (94 - 68) * (p / 100));
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="career-ignition-chamber">
      <div className="career-bg-noise" />

      {/* -- Page Header ---------------------------------------------- */}
      <motion.header 
        className="career-hud-header"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="hud-logo">
          <span className="logo-eyebrow">Linguistic Particle Accelerator</span>
          <span className="logo-text arcade-glow">PROFESSIONAL SCRIBE MATRIX</span>
          <span className="logo-ver">V11.3 // CAREER_IGNITION_PROTOCOL</span>
        </div>
      </motion.header>
      
      <motion.div 
        className="void-parchment-container"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        ref={containerRef}
      >
        <header className="parchment-header">
          <span className="parchment-title">Career Ignition Matrix</span>
          <div className="parchment-status">
            {status === 'TRANSMUTING' ? '◈ CALIBRATING...' : '◈ READY'}
          </div>
        </header>

        <textarea 
          className="void-textarea"
          placeholder="Enter your experience or paste a Job Description to begin the transmutation..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={status !== 'IDLE'}
        />
        <div className="parchment-ripples" />
      </motion.div>

      <div className="ritual-ignitor-container">
        {status === 'TRANSMUTING' && (
          <div className="pixel-health-bar">
            <div 
              className="health-fill" 
              style={{ 
                width: `${progress}%`, 
                backgroundColor: getHealthColor(progress),
                boxShadow: `0 0 10px ${getHealthColor(progress)}`
              }} 
            />
          </div>
        )}

        <button 
          className="ignite-btn"
          onClick={handleIgnite}
          disabled={!content.trim() || status !== 'IDLE'}
        >
          {status === 'TRANSMUTING' ? 'Fusing Syntax...' : 'Ignite Transmutation'}
        </button>
      </div>

      <AnimatePresence>
        {status === 'COMPLETE' && (
          <motion.div 
            className="magical-affirmation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="sigil-glow-pulse" />
            <svg className="thumbs-up-sigil" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
