import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { triggerHaptic } from '../components/NativeInteractions';
import { buildEscalationRoute } from '../lib/routes';
import { initializePushNotifications } from '../services/pushNotifications';

interface UseAppShellOptions {
  onEscalationSeen: (escalationId: string) => void;
}

export function useAppShell({ onEscalationSeen }: UseAppShellOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDeepLinkSim, setShowDeepLinkSim] = useState(false);
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  useEffect(() => {
    void initializePushNotifications((route) => {
      const match = route.match(/\/escalation\/([^/?#]+)/);
      if (match?.[1]) {
        onEscalationSeen(match[1]);
      }
      navigate(route);
    });
  }, [navigate, onEscalationSeen]);

  const handleOpenEscalation = useCallback((target: string) => {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) {
      return;
    }
    navigate(
      normalizedTarget.startsWith('/escalation/')
        ? normalizedTarget
        : buildEscalationRoute(normalizedTarget),
    );
  }, [navigate]);

  const handleOpenRun = useCallback((runId: string) => {
    const normalizedId = runId.trim();
    if (!normalizedId) {
      return;
    }
    navigate(`/runs/${normalizedId}`);
  }, [navigate]);

  const handleHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleBottomNav = useCallback((target: string) => {
    triggerHaptic('light');
    navigate(target);
  }, [navigate]);

  const handleTriggerDeepLink = useCallback(() => {
    navigate('/escalation/esc_123');
    setShowDeepLinkSim(false);
  }, [navigate]);

  const toggleDeepLinkSim = useCallback(() => {
    setShowDeepLinkSim((current) => !current);
  }, []);

  const toggleMobilePreview = useCallback(() => {
    setIsMobilePreview((current) => !current);
  }, []);

  return {
    location,
    navigate,
    showDeepLinkSim,
    isMobilePreview,
    handleHome,
    handleOpenEscalation,
    handleOpenRun,
    handleBottomNav,
    handleTriggerDeepLink,
    toggleDeepLinkSim,
    toggleMobilePreview,
  };
}
