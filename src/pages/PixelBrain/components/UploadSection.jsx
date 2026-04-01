/**
 * UploadSection — Reference image upload with drag-and-drop
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadIcon, ImageIcon, CloseIcon } from "../../../components/Icons.jsx";

export function UploadSection({ onImageUpload, analysis, onClear, uploadError }) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState(null);
  const fileInputRef = useRef(null);

  // Sync parent error with local error
  useEffect(() => {
    if (uploadError) {
      setLocalError(uploadError);
    }
  }, [uploadError]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        setLocalError('File too large. Maximum size is 5MB.');
        return;
      }
      setLocalError(null);
      onImageUpload(file);
    } else {
      setLocalError('Please upload a valid image file (PNG, JPEG, BMP).');
    }
  }, [onImageUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setLocalError('File too large. Maximum size is 5MB.');
        return;
      }
      setLocalError(null);
      onImageUpload(file);
    }
  }, [onImageUpload]);

  const triggerFileInput = useCallback((e) => {
    // Prevent double-triggering if clicking the label
    if (e.target.tagName === 'LABEL' || e.target.closest('label')) {
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const clearError = useCallback((e) => {
    e.stopPropagation(); // Don't trigger file input when clearing error
    setLocalError(null);
  }, []);

  // Show parent error or local error
  const displayError = localError;

  return (
    <div className="upload-section">
      <AnimatePresence>
        {!analysis ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={triggerFileInput}
            style={{ cursor: 'pointer' }}
          >
            <input
              type="file"
              id="image-upload"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/bmp"
              onChange={handleFileInput}
              className="upload-input"
              aria-label="Upload reference image"
              onClick={(e) => e.stopPropagation()} // Important: prevent input click from bubbling back to parent
            />

            <div className="dropzone-content">
              <UploadIcon className="dropzone-icon" />
              <p className="dropzone-title">Offer your reference to the Void</p>
              <p className="dropzone-hint">PNG, JPEG, BMP — Max 5MB</p>

              {/* Using a div instead of label if parent handles click, or ensure label doesn't double trigger */}
              <div className="btn btn-secondary">
                <ImageIcon />
                Browse Files
              </div>
            </div>

            {displayError && (
              <div className="upload-error" role="alert">
                <CloseIcon />
                <span>{displayError}</span>
                <button
                  className="btn btn-icon btn-sm"
                  onClick={clearError}
                  aria-label="Dismiss error"
                >
                  <CloseIcon />
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="analysis-preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="upload-preview"
          >
            <div className="preview-header">
              <h4>Reference Offered</h4>
              <button
                className="btn btn-icon"
                onClick={onClear}
                aria-label="Clear reference image"
              >
                <CloseIcon />
              </button>
            </div>

            {analysis.preview && (
              <img
                src={analysis.preview}
                alt="Reference preview"
                className="preview-thumbnail"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UploadSection;
