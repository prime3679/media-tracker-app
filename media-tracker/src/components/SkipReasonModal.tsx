/**
 * Skip Reason Modal
 *
 * Collects user feedback when skipping recommendations.
 * This data improves the algorithm over time.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalTransition, backdropTransition, smooth } from '../animations/transitions';
import './SkipReasonModal.css';

interface SkipReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, feedback?: string) => void;
  itemTitle: string;
}

const SKIP_REASONS = [
  { value: 'not_interested', label: '😐 Not interested', emoji: '😐' },
  { value: 'wrong_mood', label: '🎭 Wrong mood right now', emoji: '🎭' },
  { value: 'too_long', label: '⏱️ Too long', emoji: '⏱️' },
  { value: 'seen_it', label: '✅ Already seen it', emoji: '✅' },
  { value: 'bad_reviews', label: '⭐ Reviews aren\'t great', emoji: '⭐' },
  { value: 'other', label: '💭 Other reason', emoji: '💭' },
];

export default function SkipReasonModal({
  isOpen,
  onClose,
  onSubmit,
  itemTitle,
}: SkipReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    if (reason === 'other') {
      setShowFeedback(true);
    }
  };

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, feedback || undefined);
    handleClose();
  };

  const handleClose = () => {
    setSelectedReason(null);
    setFeedback('');
    setShowFeedback(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        variants={backdropTransition}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleClose}
      >
        <motion.div
          className="skip-reason-modal"
          variants={modalTransition}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2>Why skip "{itemTitle}"?</h2>
            <p className="modal-subtitle">Help us improve your recommendations</p>
          </div>

          <div className="modal-content">
            <div className="reason-options">
              {SKIP_REASONS.map((reason) => (
                <motion.button
                  key={reason.value}
                  className={`reason-option ${selectedReason === reason.value ? 'selected' : ''}`}
                  onClick={() => handleReasonSelect(reason.value)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={smooth}
                >
                  <span className="reason-emoji">{reason.emoji}</span>
                  <span className="reason-label">{reason.label}</span>
                  {selectedReason === reason.value && (
                    <span className="checkmark">✓</span>
                  )}
                </motion.button>
              ))}
            </div>

            {(showFeedback || selectedReason === 'other') && (
              <motion.div
                className="feedback-section"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={smooth}
              >
                <label htmlFor="feedback">Additional feedback (optional):</label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us more..."
                  rows={3}
                />
              </motion.div>
            )}
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!selectedReason}
            >
              Submit
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
