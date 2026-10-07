import React, { useState } from 'react';
import { usePwa } from '../../context/PwaContext';
import { useToast } from '../../context/ToastContext';
import {
  Download,
  Smartphone,
  Monitor,
  X,
  Share,
  CheckCircle,
} from 'lucide-react';

export const InstallAppButton: React.FC<{ className?: string; isSidebar?: boolean }> = ({
  className = '',
  isSidebar = false,
}) => {
  const { isInstallable, isInstalled, platform, promptInstall } = usePwa();
  const { showToast } = useToast();
  const [showIosModal, setShowIosModal] = useState(false);

  if (isInstalled) {
    return isSidebar ? (
      <div className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200/60">
        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Installed App Mode</span>
      </div>
    ) : null;
  }

  const handleInstallClick = async () => {
    if (platform === 'ios') {
      setShowIosModal(true);
      return;
    }

    if (!isInstallable) {
      showToast('To install, open your browser menu (⋮) and select "Install App" or "Add to Home Screen".', 'info');
      return;
    }

    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      showToast('Cashbook PRO installed successfully!', 'success');
    }
  };

  const Icon = platform === 'windows' ? Monitor : Smartphone;
  const label =
    platform === 'windows'
      ? 'Install for Windows'
      : platform === 'android' || platform === 'ios'
      ? 'Install Mobile App'
      : 'Install App';

  return (
    <>
      <button
        onClick={handleInstallClick}
        title={label}
        className={
          className ||
          `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            isSidebar
              ? 'w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`
        }
      >
        <Icon className="w-4 h-4 shrink-0 text-white" />
        <span className="truncate">{label}</span>
        <Download className="w-3.5 h-3.5 ml-auto opacity-80" />
      </button>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Install on iOS / Safari</h3>
            <ol className="text-xs text-slate-600 space-y-2.5 list-decimal pl-4 mb-5">
              <li>
                Tap the <Share className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> <strong>Share</strong> button in Safari's bottom toolbar.
              </li>
              <li>Scroll down and select <strong>"Add to Home Screen"</strong>.</li>
              <li>Tap <strong>"Add"</strong> in the top right corner.</li>
            </ol>
            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const InstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, platform, promptInstall, isBannerDismissed, dismissBanner } = usePwa();
  const { showToast } = useToast();

  if (isInstalled || isBannerDismissed || (!isInstallable && platform !== 'ios')) {
    return null;
  }

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      showToast('Cashbook PRO installed to your device!', 'success');
    }
  };

  const deviceText =
    platform === 'windows'
      ? 'Install on Windows for fast desktop launch & native notifications'
      : 'Install on your mobile device for quick 1-tap ledger access';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-b border-blue-900/50 shadow-xs shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0">
          {platform === 'windows' ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
        </div>
        <p className="font-medium truncate text-slate-200">
          <strong className="text-white">Cashbook PRO App:</strong> {deviceText}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install Now</span>
        </button>
        <button
          onClick={dismissBanner}
          title="Dismiss"
          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
