import { useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { RefreshCw } from 'lucide-react';

/**
 * Haptic feedback simulation
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
  if (!window.navigator.vibrate) return;

  const patterns = {
    light: [10],
    medium: [20],
    heavy: [40],
    success: [10, 50, 10],
    warning: [50, 100, 50],
    error: [100, 50, 100],
  };

  window.navigator.vibrate(patterns[type]);
};

/**
 * Pull to refresh component
 */
export const PullToRefresh = ({ onRefresh }: { onRefresh: () => Promise<void> }) => {
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, 100], [0, 360]);
  const opacity = useTransform(y, [0, 50, 100], [0, 0.5, 1]);
  const scale = useTransform(y, [0, 100], [0.5, 1]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0) return;
    const startY = e.touches[0].pageY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentY = moveEvent.touches[0].pageY;
      const diff = currentY - startY;
      if (diff > 0 && window.scrollY === 0) {
        // Apply resistance
        const resistance = Math.max(0, diff * 0.4);
        y.set(Math.min(resistance, 120));
        
        // Trigger a tiny haptic when reaching threshold
        if (resistance >= 80 && y.get() < 80) {
          triggerHaptic('light');
        }
      }
    };

    const handleTouchEnd = async () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      if (y.get() >= 80) {
        triggerHaptic('medium');
        animate(y, 80, { type: 'spring', stiffness: 300, damping: 30 });
        
        await onRefresh();
        
        triggerHaptic('success');
        animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
      } else {
        animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  }, [y, onRefresh]);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart);
    return () => window.removeEventListener('touchstart', handleTouchStart);
  }, [handleTouchStart]);

  return (
    <motion.div 
      style={{ y, opacity, scale }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div className="bg-surface-container-highest p-3 rounded-full shadow-xl border border-primary/20 flex items-center justify-center">
        <motion.div
          style={{ rotate }}
        >
          <RefreshCw className="w-5 h-5 text-primary" />
        </motion.div>
      </div>
    </motion.div>
  );
};
