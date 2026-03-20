/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, MessageSquare, User, Send, ChevronRight } from 'lucide-react';
import { Escalation, EscalationResponse } from '../types';
import { StatusBadge } from './StatusBadge';
import { triggerHaptic } from './NativeInteractions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DecisionCardProps {
  escalation: Escalation;
  onRespond: (payload: EscalationResponse) => Promise<void>;
}

export function DecisionCard({ escalation, onRespond }: DecisionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedOption) return;
    
    setIsSubmitting(true);
    try {
      await onRespond({
        decision: selectedOption,
        comment,
        responder: 'android_app',
      });
      setIsSuccess(true);
    } catch (error) {
      console.error('Failed to submit decision:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container p-8 rounded-xl border border-primary/20 text-center space-y-4"
      >
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="text-primary w-8 h-8" />
        </div>
        <h3 className="font-headline text-xl font-bold">Decision Recorded</h3>
        <p className="text-on-surface-variant text-sm">
          Your response has been signed and transmitted to the Dev-Harness orchestrator.
        </p>
        <div className="pt-4">
          <StatusBadge status="RESOLVED" />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
      {/* Header */}
      <div className="bg-surface-container-high px-6 py-4 flex justify-between items-center border-b border-outline-variant/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-tertiary/10 flex items-center justify-center">
            <AlertCircle className="text-tertiary w-5 h-5" />
          </div>
          <div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant block">Escalation Required</span>
            <span className="font-headline font-bold text-sm">ID: {escalation.id}</span>
          </div>
        </div>
        <StatusBadge status={escalation.status} />
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Question</span>
          <p className="text-on-surface leading-relaxed font-medium text-lg">
            {escalation.question}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Select Decision</span>
          <div className="grid grid-cols-1 gap-2">
            {escalation.options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedOption(option);
                }}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-left",
                  selectedOption === option 
                    ? "bg-primary/10 border-primary text-primary" 
                    : "bg-surface-container-low border-outline-variant/10 text-on-surface-variant hover:border-outline-variant/30"
                )}
              >
                <span className="font-mono text-sm uppercase tracking-wider">{option}</span>
                {selectedOption === option && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-on-surface-variant" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Add Comment (Optional)</span>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Provide context for your decision..."
            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-lg p-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all resize-none h-24"
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <User className="w-3 h-3" />
            <span className="font-label text-[10px] uppercase tracking-widest">Responder: Android_App</span>
          </div>
          <button
            disabled={!selectedOption || isSubmitting}
            onClick={() => {
              triggerHaptic('medium');
              handleSubmit();
            }}
            className={cn(
              "w-full sm:w-auto px-8 py-4 sm:py-2.5 rounded-xl sm:rounded-lg font-label font-bold text-sm sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
              selectedOption && !isSubmitting
                ? "bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/10 active:scale-95"
                : "bg-surface-container-highest text-on-surface-variant cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <span className="animate-pulse">Transmitting...</span>
            ) : (
              <>
                <span>Sign & Submit</span>
                <Send className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-surface-container-low px-6 py-3 border-t border-outline-variant/5 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
        <span className="font-mono text-[9px] text-outline uppercase tracking-tighter">
          HMAC-SHA256 Signature Enabled • X-Harness-Signature Active
        </span>
      </div>
    </div>
  );
}
