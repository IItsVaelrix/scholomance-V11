import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import PixelBrainTerminal from "./PixelBrainTerminal.jsx";
import "./PixelBrainPage.css";

const DEMO_VERSES = [
  {
    label: "SONIC Incantation",
    text: "The thunder rolls across the silent plain\nWhile echoes sing of sorrow and of pain\nThe rhythm beats within the hollow bone\nA symphony of whispers all alone",
  },
  {
    label: "PSYCHIC Vision",
    text: "Mind to mind the silent current flows\nThrough crystalline pathways where knowledge grows\nThe unseen threads connect the wandering soul\nTo depths where hidden fragments become whole",
  },
  {
    label: "ALCHEMY Transmutation",
    text: "Base metal turns to gold within the flame\nThe essence shifts yet never stays the same\nFrom darkness light from silence comes the sound\nIn sacred circles truth is finally found",
  },
  {
    label: "WILL Assertion",
    text: "I stand unmoving as the tempest rages\nMy spirit forged in fire through endless ages\nNo force on earth can break this iron vow\nThe present bends before my focused brow",
  },
  {
    label: "VOID Whisper",
    text: "In emptiness the answer hides away\nBetween the night and barely dawn of day\nThe nothing speaks in tongues we cannot hear\nYet feel its presence drawing ever near",
  },
];

const EXTENSION_OPTIONS = [
  { id: "none", label: "No Extensions", type: "none" },
  { id: "physics-stretch-squash", label: "Stretch & Squash", type: "PHYSICS" },
  { id: "physics-gravity", label: "Gravity", type: "PHYSICS" },
  { id: "style-gameboy", label: "GameBoy", type: "STYLE" },
  { id: "style-8bit", label: "8-Bit NES", type: "STYLE" },
  { id: "style-crt", label: "CRT Display", type: "STYLE" },
];

const INPUT_MODES = [
  { id: "verse", label: "Verse Analysis", description: "Analyze your verse text directly", icon: "📜" },
  { id: "nlu-direct", label: "NLU Direct", description: "Plain English → deterministic params", icon: "🎯" },
  { id: "nlu-generate", label: "NLU Generate", description: "Plain English → generated verse → analysis", icon: "✨" },
  { id: "reference-image", label: "Reference Image", description: "Upload an image + describe it", icon: "🖼️" },
];

/**
 * Generate coordinates from image analysis (client-side edge detection)
 */
function generateCoordinatesFromImage(imageAnalysis, canvasSize) {
  const { colors, composition, dimensions } = imageAnalysis;
  const { analyzed: { width: srcWidth, height: srcHeight } } = dimensions;
  const { width: canvasWidth, height: canvasHeight, gridSize } = canvasSize;
  
  // Calculate scale to fit image on canvas
  const scaleX = canvasWidth / srcWidth;
  const scaleY = canvasHeight / srcHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Offset to center
  const offsetX = (canvasWidth - srcWidth * scale) / 2;
  const offsetY = (canvasHeight - srcHeight * scale) / 2;
  
  const coordinates = [];
  const visited = new Set();
  
  // Use pixel data if available, otherwise generate from composition
  const pixelData = imageAnalysis.pixelData ? new Uint8ClampedArray(imageAnalysis.pixelData) : null;
  
  if (pixelData) {
    // Edge detection on pixel data
    const edgeThreshold = 30;
    
    for (let y = 1; y < srcHeight - 1; y++) {
      for (let x = 1; x < srcWidth - 1; x++) {
        const idx = (y * srcWidth + x) * 4;
        
        // Skip transparent pixels
        if (pixelData[idx + 3] < 128) continue;
        
        // Simple edge detection
        const leftIdx = (y * srcWidth + (x - 1)) * 4;
        const topIdx = ((y - 1) * srcWidth + x) * 4;
        
        const leftDiff = Math.abs(pixelData[idx] - pixelData[leftIdx]) +
                         Math.abs(pixelData[idx + 1] - pixelData[leftIdx + 1]) +
                         Math.abs(pixelData[idx + 2] - pixelData[leftIdx + 2]);
        
        const topDiff = Math.abs(pixelData[idx] - pixelData[topIdx]) +
                        Math.abs(pixelData[idx + 1] - pixelData[topIdx + 1]) +
                        Math.abs(pixelData[idx + 2] - pixelData[topIdx + 2]);
        
        const isEdge = leftDiff > edgeThreshold || topDiff > edgeThreshold;
        
        if (isEdge) {
          const canvasX = Math.round(x * scale + offsetX);
          const canvasY = Math.round(y * scale + offsetY);
          
          const key = `${canvasX},${canvasY}`;
          if (!visited.has(key)) {
            visited.add(key);
            
            const r = pixelData[idx];
            const g = pixelData[idx + 1];
            const b = pixelData[idx + 2];
            const emphasis = Math.min(1, (leftDiff + topDiff) / 510);
            
            coordinates.push({
              x: canvasX,
              y: canvasY,
              z: 0,
              color: rgbToHex(r, g, b),
              emphasis,
              source: 'image_edge',
              snappedX: Math.round(canvasX / gridSize) * gridSize,
              snappedY: Math.round(canvasY / gridSize) * gridSize,
            });
          }
        }
      }
    }
  }
  
  // Fallback: generate from composition if no edges found
  if (coordinates.length === 0) {
    return generateFallbackCoordinates(composition, canvasSize);
  }
  
  return coordinates;
}

/**
 * Generate fallback coordinates based on composition analysis
 */
function generateFallbackCoordinates(composition, canvasSize) {
  const { width, height, gridSize } = canvasSize;
  const coordinates = [];
  
  // Generate grid based on complexity
  const density = 8 + Math.round((composition.complexity || 0.5) * 20);
  const step = Math.floor(Math.min(width, height) / density);
  
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      coordinates.push({
        x,
        y,
        z: 0,
        color: '#808080',
        emphasis: 0.5,
        source: 'fallback',
        snappedX: Math.round(x / gridSize) * gridSize,
        snappedY: Math.round(y / gridSize) * gridSize,
      });
    }
  }
  
  return coordinates;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

export default function PixelBrainPage() {
  const [inputText, setInputText] = useState("");
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [terminalMode, setTerminalMode] = useState("input");
  const [selectedExtension, setSelectedExtension] = useState("none");
  const [phase3Enabled, setPhase3Enabled] = useState(true);
  const [inputMode, setInputMode] = useState("verse"); // 'verse' | 'nlu-direct' | 'nlu-generate' | 'reference-image'
  const [parsedIntent, setParsedIntent] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null); // { file, preview, analysis }
  const [imageWeight, setImageWeight] = useState(0.6); // Image vs text blend weight
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleDemoSelect = useCallback((demo) => {
    setSelectedDemo(demo.label);
    setInputText(demo.text);
    setAnalysisResult(null);
    setParsedIntent(null);
    setTerminalMode("input");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleImageUpload = useCallback(async (file) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      alert('Unsupported image format. Please use PNG, JPEG, or BMP.');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Maximum size is 5MB.');
      return;
    }
    
    // Create preview
    const preview = URL.createObjectURL(file);
    setReferenceImage({ file, preview, analysis: null });
    
    // Upload and analyze
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('description', inputText || '');
      
      const response = await fetch('/api/image/analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }
      
      const data = await response.json();
      setReferenceImage(prev => ({ ...prev, analysis: data.analysis }));
    } catch (error) {
      console.error('Image analysis failed:', error);
      alert(`Image analysis failed: ${error.message}`);
      setReferenceImage(null);
    }
  }, [inputText]);
  
  const handleImageDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);
  
  const handleImageSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);
  
  const handleClearImage = useCallback(() => {
    if (referenceImage?.preview) {
      URL.revokeObjectURL(referenceImage.preview);
    }
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [referenceImage]);

  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim() && !referenceImage) return;

    setIsAnalyzing(true);
    setTerminalMode("analyzing");

    try {
      // Reference image mode
      if (inputMode === 'reference-image') {
        if (!referenceImage?.analysis) {
          throw new Error('Please upload an image first');
        }
        
        // Use image analysis directly
        const imageAnalysis = referenceImage.analysis;
        const semanticParams = imageAnalysis.semanticParams;
        
        // Generate pixel art coordinates from image
        const canvasSize = { width: 160, height: 144, gridSize: 1 };
        const extension = semanticParams?.extension || selectedExtension !== 'none' ? selectedExtension : null;
        
        // Build coordinates from image edges
        const coordinates = generateCoordinatesFromImage(imageAnalysis, canvasSize);
        
        // Build palettes from image colors
        const palettes = imageAnalysis.colors?.map(c => ({
          hex: c.hex,
          weight: c.percentage / 100,
        })) || [];
        
        setParsedIntent({
          intent: `Image-driven: ${imageAnalysis.colors?.[0]?.hex || 'unknown'} dominant`,
          confidence: 0.85,
          mathConstraints: {
            coordinateDensity: imageAnalysis.composition?.complexity || 0.5,
            latticeConnections: Math.round((imageAnalysis.composition?.edgeDensity || 0.1) * 100),
            surface: {
              material: semanticParams?.surface?.material || 'metal',
            },
            ditherMethod: semanticParams?.ditherMethod || 'ordered',
            extension: semanticParams?.extension,
          },
          semanticParams,
          imageAnalysis,
        });
        
        setAnalysisResult({
          version: "1.1.0",
          tokenCount: coordinates.length,
          activeTokenCount: coordinates.filter(c => c.emphasis > 0.3).length,
          paletteCount: imageAnalysis.colors?.length || 0,
          dominantAxis: imageAnalysis.composition?.dominantAxis || 'horizontal',
          dominantSymmetry: imageAnalysis.composition?.hasSymmetry ? imageAnalysis.composition?.symmetryType : 'none',
          canvas: canvasSize,
          palettes: [{
            key: 'image_palette',
            colors: imageAnalysis.colors?.map(c => c.hex) || [],
            weights: imageAnalysis.colors?.map(c => c.percentage / 100) || [],
          }],
          coordinates: coordinates.map(c => ({
            ...c,
            token: `img_${c.x}_${c.y}`,
            paletteKey: 'image_palette',
          })),
          phase3Enabled,
          selectedExtension,
          inputMode,
          referenceImage: {
            preview: referenceImage.preview,
            analysis: imageAnalysis,
          },
        });
        
        setIsAnalyzing(false);
        setTerminalMode("result");
        return;
      }
      
      // Determine if we need to use NLU or direct verse analysis
      const useNLU = inputMode === 'nlu-direct' || inputMode === 'nlu-generate';
      const nluMode = inputMode === 'nlu-direct' ? 'direct' : 'generate';

      // Call the panel analysis API
      const response = await fetch("/api/analysis/panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          nluMode: useNLU ? nluMode : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract NLU payload if using NLU mode
      let nluPayload = null;
      if (useNLU) {
        nluPayload = data?.verseIRAmplifier?.amplifiers?.find(
          (amp) => amp?.id === 'natural_language_amp'
        )?.payload;

        if (nluPayload) {
          setParsedIntent(nluPayload);
        }
      } else {
        setParsedIntent(null);
      }

      // Extract PixelBrain payload
      const pixelBrain = data?.verseIRAmplifier?.pixelBrain;
      
      if (!pixelBrain || !pixelBrain.coordinates || pixelBrain.coordinates.length === 0) {
        // If NLU generate mode and we have a generated verse, retry with it
        if (inputMode === 'nlu-generate' && nluPayload?.generatedVerse && nluPayload.generatedVerse !== inputText) {
          const retryResponse = await fetch("/api/analysis/panels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              text: nluPayload.generatedVerse,
              nluMode: 'generate', // Retry with generate mode for the generated verse
            }),
          });
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const retryPixelBrain = retryData?.verseIRAmplifier?.pixelBrain;
            
            if (retryPixelBrain && retryPixelBrain.coordinates && retryPixelBrain.coordinates.length > 0) {
              setAnalysisResult({
                version: retryPixelBrain.version,
                tokenCount: retryPixelBrain.tokenCount,
                activeTokenCount: retryPixelBrain.activeTokenCount,
                paletteCount: retryPixelBrain.paletteCount,
                dominantAxis: retryPixelBrain.dominantAxis,
                dominantSymmetry: retryPixelBrain.dominantSymmetry,
                canvas: retryPixelBrain.canvas,
                palettes: retryPixelBrain.palettes || [],
                coordinates: retryPixelBrain.coordinates || [],
                phase3Enabled,
                selectedExtension,
                nluData: nluPayload,
                usedGeneratedVerse: true,
                inputMode,
              });
              setIsAnalyzing(false);
              setTerminalMode("result");
              return;
            }
          }
        }
        
        // Fallback: show message
        setAnalysisResult({
          version: pixelBrain?.version || "1.1.0",
          tokenCount: pixelBrain?.tokenCount || 0,
          activeTokenCount: pixelBrain?.activeTokenCount || 0,
          paletteCount: 0,
          dominantAxis: "horizontal",
          dominantSymmetry: "none",
          canvas: pixelBrain?.canvas || {
            width: 160,
            height: 144,
            gridSize: 1,
            goldenPoint: { x: 98.88, y: 88.99 },
          },
          palettes: [],
          coordinates: [],
          message: useNLU && nluPayload
            ? `Parsed: "${nluPayload.intent}" - ${nluPayload.semanticParams?.surface?.material || 'default'} material. Try: "dragon with fire" or "crystal castle"`
            : "No phonetic lattice detected. Try verse with stronger rhyme/stress patterns or switch to NLU mode.",
          phase3Enabled,
          selectedExtension,
          nluData: nluPayload,
          inputMode,
        });
      } else {
        setAnalysisResult({
          version: pixelBrain.version,
          tokenCount: pixelBrain.tokenCount,
          activeTokenCount: pixelBrain.activeTokenCount,
          paletteCount: pixelBrain.paletteCount,
          dominantAxis: pixelBrain.dominantAxis,
          dominantSymmetry: pixelBrain.dominantSymmetry,
          canvas: pixelBrain.canvas,
          palettes: pixelBrain.palettes || [],
          coordinates: pixelBrain.coordinates || [],
          phase3Enabled,
          selectedExtension,
          nluData: nluPayload,
          inputMode,
        });
      }
      
      setIsAnalyzing(false);
      setTerminalMode("result");
    } catch (error) {
      console.error("PixelBrain analysis failed:", error);
      setIsAnalyzing(false);
      setTerminalMode("result");
      setAnalysisResult({
        version: "1.1.0",
        tokenCount: 0,
        activeTokenCount: 0,
        paletteCount: 0,
        dominantAxis: "horizontal",
        dominantSymmetry: "none",
        canvas: { width: 160, height: 144, gridSize: 1, goldenPoint: { x: 98.88, y: 88.99 } },
        palettes: [],
        coordinates: [],
        error: `Analysis failed: ${error.message}`,
        phase3Enabled,
        selectedExtension,
        inputMode,
      });
    }
  }, [inputText, inputMode, phase3Enabled, selectedExtension]);

  const handleReset = useCallback(() => {
    setInputText("");
    setSelectedDemo(null);
    setParsedIntent(null);
    setAnalysisResult(null);
    setTerminalMode("input");
    if (referenceImage?.preview) {
      URL.revokeObjectURL(referenceImage.preview);
    }
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [referenceImage]);

  return (
    <div className="pixelbrain-page">
      <motion.header
        className="pixelbrain-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="header-glyph" aria-hidden="true">
          <span className="glyph-bracket-left">[</span>
          <span className="glyph-symbol">&#x25EC;</span>
          <span className="glyph-bracket-right">]</span>
        </div>
        <h1 className="page-title">
          <span className="title-prefix">PIXELBRAIN</span>
          <span className="title-suffix">AMP VISUALIZER</span>
        </h1>
        <p className="page-subtitle">
          Phonetic lattice synthesis terminal
        </p>
      </motion.header>

      <div className="pixelbrain-content">
        <motion.section
          className="demo-selector"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="section-label">
            <span className="label-icon">&#x2318;</span>
            SELECT INCANTATION
          </h2>
          <div className="demo-buttons">
            {DEMO_VERSES.map((demo, index) => (
              <button
                key={demo.label}
                className={`demo-button ${selectedDemo === demo.label ? "active" : ""}`}
                onClick={() => handleDemoSelect(demo)}
                aria-pressed={selectedDemo === demo.label}
                style={{ "--delay": index * 0.05 }}
              >
                <span className="button-glyph" aria-hidden="true">
                  {["&#x266A;", "&#x25EC;", "&#x2697;", "&#x26A1;", "&#x2205;"][index]}
                </span>
                <span className="button-label">{demo.label}</span>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="input-mode-selector"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
        >
          <h2 className="section-label">
            <span className="label-icon">&#x23F1;</span>
            INPUT MODE
          </h2>
          <div className="mode-buttons-vertical">
            {INPUT_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`mode-button-vertical ${inputMode === mode.id ? "active" : ""}`}
                onClick={() => setInputMode(mode.id)}
                disabled={isAnalyzing}
                title={mode.description}
              >
                <span className="mode-icon">{mode.icon}</span>
                <span className="mode-text">
                  <span className="mode-name">{mode.label}</span>
                  <span className="mode-desc">{mode.description}</span>
                </span>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="extension-selector"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h2 className="section-label">
            <span className="label-icon">&#x2699;</span>
            PHASE 3 EXTENSIONS
          </h2>
          <div className="extension-controls">
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={phase3Enabled}
                onChange={(e) => setPhase3Enabled(e.target.checked)}
                disabled={isAnalyzing}
              />
              <span className="toggle-label">Enable Layer 3</span>
            </label>
            <select
              className="extension-select"
              value={selectedExtension}
              onChange={(e) => setSelectedExtension(e.target.value)}
              disabled={!phase3Enabled || isAnalyzing}
            >
              {EXTENSION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="extension-info">
            <span className="info-icon" aria-hidden="true">ℹ</span>
            <span className="info-text">
              {phase3Enabled 
                ? `Active: ${EXTENSION_OPTIONS.find(e => e.id === selectedExtension)?.label || 'None'}`
                : 'Layer 3 disabled'}
            </span>
          </div>
        </motion.section>

        {inputMode === 'reference-image' && (
          <motion.section
            className="reference-image-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <h2 className="section-label">
              <span className="label-icon">&#x1F5BC;</span>
              REFERENCE IMAGE
            </h2>
            <div
              className={`image-upload-zone ${referenceImage ? 'has-image' : ''}`}
              onDrop={handleImageDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {referenceImage?.preview ? (
                <div className="image-preview-container">
                  <img
                    src={referenceImage.preview}
                    alt="Reference"
                    className="reference-preview"
                  />
                  <button
                    className="clear-image-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearImage();
                    }}
                    title="Remove image"
                  >
                    ✕
                  </button>
                  {referenceImage.analysis && (
                    <div className="image-analysis-badge">
                      ✓ Analyzed
                    </div>
                  )}
                </div>
              ) : (
                <div className="image-upload-prompt">
                  <span className="upload-icon">&#x1F4E4;</span>
                  <p>Drop an image here or click to upload</p>
                  <p className="upload-hint">PNG, JPEG, BMP (max 5MB)</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/bmp"
                onChange={handleImageSelect}
                className="hidden-file-input"
                disabled={isAnalyzing}
              />
            </div>
            
            {referenceImage && (
              <div className="image-description-section">
                <label className="description-label">
                  <span className="label-icon">&#x270E;</span>
                  Describe this image (optional):
                </label>
                <textarea
                  className="image-description-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Add context about what you want to create from this image..."
                  disabled={isAnalyzing}
                  rows={3}
                />
              </div>
            )}
            
            {referenceImage?.analysis && (
              <div className="image-analysis-summary">
                <div className="analysis-row">
                  <span className="analysis-key">Colors:</span>
                  <div className="color-swatch-row">
                    {referenceImage.analysis.colors?.slice(0, 5).map((color, i) => (
                      <div
                        key={i}
                        className="color-swatch"
                        style={{ backgroundColor: color.hex }}
                        title={`${color.hex} (${color.percentage}%)`}
                      />
                    ))}
                  </div>
                </div>
                <div className="analysis-row">
                  <span className="analysis-key">Composition:</span>
                  <span className="analysis-value">
                    {referenceImage.analysis.composition?.dominantAxis} axis,
                    {referenceImage.analysis.composition?.hasSymmetry ? ' symmetric' : ' asymmetric'}
                  </span>
                </div>
                <div className="analysis-row">
                  <span className="analysis-key">Material:</span>
                  <span className="analysis-value">
                    {referenceImage.analysis.semanticParams?.surface?.material || 'auto'}
                  </span>
                </div>
              </div>
            )}
          </motion.section>
        )}

        {parsedIntent && (
          <motion.div
            className="parsed-intent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="intent-header">
              <span className="intent-label">BRIDGE OUTPUT:</span>
              <span className="intent-value">{parsedIntent.intent}</span>
            </div>
            <div className="intent-details">
              <span className="confidence">
                Confidence: {Math.round(parsedIntent.confidence * 100)}%
              </span>
              {parsedIntent.mathConstraints && (
                <>
                  <span className="constraint">
                    Density: {parsedIntent.mathConstraints.coordinateDensity}
                  </span>
                  <span className="constraint">
                    Connections: {parsedIntent.mathConstraints.latticeConnections}
                  </span>
                  <span className="constraint">
                    Material: {parsedIntent.mathConstraints.surface?.material}
                  </span>
                  <span className="constraint">
                    Dither: {parsedIntent.mathConstraints.ditherMethod}
                  </span>
                  {parsedIntent.mathConstraints.extension && (
                    <span className="constraint">
                      Extension: {parsedIntent.mathConstraints.extension}
                    </span>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        <motion.section
          className="input-terminal"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="terminal-chrome">
            <div className="terminal-header">
              <span className="terminal-title">INPUT_BUFFER</span>
              <div className="terminal-indicators">
                <span className="indicator led-red" aria-label="Recording"></span>
                <span className="indicator led-green" aria-label="Active"></span>
                <span className="indicator led-amber" aria-label="Standby"></span>
              </div>
            </div>
            <div className="terminal-body">
              <textarea
                ref={textareaRef}
                className="verse-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  inputMode === 'verse'
                    ? "Enter your verse text for phonetic analysis...\n\nExample:\nThe thunder rolls across the silent plain\nWhile echoes sing of sorrow and of pain"
                    : inputMode === 'nlu-direct'
                    ? "Describe what you want to see...\n\nExample: crystal dragon with fire effects"
                    : inputMode === 'nlu-generate'
                    ? "Describe what you want to see (verse will be generated)...\n\nExample: dark knight in a haunted castle"
                    : inputMode === 'reference-image'
                    ? "Describe what you want to create from this image...\n\nExample: a pixel art character based on this reference"
                    : "Enter text..."
                }
                aria-label="Verse input for PixelBrain analysis"
                disabled={isAnalyzing}
              />
              <div className="terminal-controls">
                <button
                  className="control-button analyze-btn"
                  onClick={handleAnalyze}
                  disabled={!inputText.trim() || isAnalyzing}
                  aria-busy={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <span className="spinner" aria-hidden="true"></span>
                      <span>ANALYZING...</span>
                    </>
                  ) : (
                    <>
                      <span className="button-icon">&#x25B6;</span>
                      <span>INITIATE SCAN</span>
                    </>
                  )}
                </button>
                <button
                  className="control-button reset-btn"
                  onClick={handleReset}
                  disabled={isAnalyzing || (!inputText && !analysisResult)}
                >
                  <span className="button-icon">&#x21BA;</span>
                  <span>CLEAR BUFFER</span>
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="visualization-stage"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <PixelBrainTerminal
            mode={terminalMode}
            analysisResult={analysisResult}
            isAnalyzing={isAnalyzing}
          />
        </motion.section>
      </div>

      <footer className="pixelbrain-footer">
        <div className="footer-status">
          <span className="status-label">SYSTEM:</span>
          <span className={`status-value ${isAnalyzing ? "busy" : "ready"}`}>
            {isAnalyzing ? "PROCESSING" : "ONLINE"}
          </span>
        </div>
        <div className="footer-version">
          <span className="version-label">AMP CORE:</span>
          <span className="version-value">v1.1.0</span>
        </div>
      </footer>
    </div>
  );
}
