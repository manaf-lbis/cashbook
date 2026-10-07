import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  platform: 'windows' | 'android' | 'ios' | 'other';
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unsupported'>;
  isBannerDismissed: boolean;
  dismissBanner: () => void;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('cashbook_pwa_banner_dismissed') === 'true';
  });

  // Detect platform
  const [platform, setPlatform] = useState<'windows' | 'android' | 'ios' | 'other'>('other');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) {
      setPlatform('windows');
    } else if (ua.includes('android')) {
      setPlatform('android');
    } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      setPlatform('ios');
    } else {
      setPlatform('other');
    }

    // Listen for the standard browser API beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for successful app installation event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    if (!deferredPrompt) {
      return 'unsupported';
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
      return choiceResult.outcome;
    } catch (err) {
      console.warn('Installation prompt error:', err);
      return 'unsupported';
    }
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
    localStorage.setItem('cashbook_pwa_banner_dismissed', 'true');
  }, []);

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        platform,
        promptInstall,
        isBannerDismissed,
        dismissBanner,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = (): PwaContextType => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};
