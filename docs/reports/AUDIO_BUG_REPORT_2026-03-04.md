# Audio Bug Report: Cross-Origin Resource Sharing (CORS) Muting Incident
**Date:** March 4, 2026
**Component:** `AmbientPlayerService` (`src/lib/ambient/ambientPlayer.service.js`)

## 1. Description of the Incident
Users experienced a state where the ambient audio player produced no audible sound, despite the user interface indicating active playback. Concurrently, the visualizer modulations (e.g., orb pulsing) continued to animate, which paradoxically suggested that audio data was being actively processed or simulated.

## 2. Root Cause Analysis
The issue stemmed from an interaction between Cross-Origin Resource Sharing (CORS) policies and the browser's Web Audio API security sandbox.

### The Mechanism of Failure:
1. **Initial Request:** The `createTrackController` initialized an `HTMLAudioElement` with `crossOrigin = "anonymous"` to allow the `AnalyserNode` to read byte-time domain data for visualizer modulations.
2. **CORS Rejection:** The remote audio host rejected the anonymous request, triggering the `onerror` event listener.
3. **Flawed Fallback:** The previous fallback logic attempted to salvage playback by modifying the existing element: `audio.removeAttribute("crossOrigin")` (or setting it to `null`), followed by an `audio.load()`.
4. **Security Sandbox Muting:** Because the `HTMLAudioElement` had already been piped into the Web Audio API graph via `audioContext.createMediaElementSource(audio)`, the browser's security model permanently locked its state. When non-CORS (opaque) audio data was subsequently fed into an element bound to a Web Audio API graph, the browser intentionally muted the output of the graph to prevent unauthorized pixel/data extraction.
5. **Synthetic Visualization Trigger:** Because the audio graph output was mathematically zero (pure silence), the `AnalyserNode` returned flatline data. The player's signal monitor detected the flatline and gracefully fell back to the `_computeSyntheticSignalLevel()` function, producing the visual animation loop despite the absolute lack of audio output.

## 3. The Resolution
To successfully bypass the Web Audio API's security muting, the fallback mechanism required a complete teardown of the "tainted" DOM element.

### Implemented Fix:
The `handleAudioError` callback was rewritten to perform a complete swap of the audio element upon a CORS failure:
1. **Teardown:** Disconnect the Web Audio API graph (`mediaSource`, `analyser`, `outputGain`), clear all event listeners from the existing `HTMLAudioElement`, pause it, and `.remove()` it from the DOM.
2. **Re-instantiation:** Dynamically create a brand new `HTMLAudioElement` using `let audio = document.createElement("audio")`.
3. **Opaque Request:** The new element is explicitly *not* given a `crossOrigin` attribute and is *never* connected to `createMediaElementSource`.
4. **Degradation:** `capabilities.canAnalyze` is explicitly set to `false`.

### Outcome:
If a CORS error occurs, the browser now fetches the track as standard opaque media. It plays successfully through the browser's native audio stack rather than the Web Audio API graph, restoring audible playback while seamlessly allowing the UI to rely on the synthetic signal generator for visualizations.