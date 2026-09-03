import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { pingHealth } from '../api/client';

/** Pings backend /api/health to avoid cold starts (e.g. Render sleep). */
const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function KeepAlive() {
  const [isWakingUp, setIsWakingUp] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      // If health check takes > 2s, it's likely a cold start
      const timeoutToken = setTimeout(() => setIsWakingUp(true), 2000);
      try {
        await pingHealth();
      } finally {
        clearTimeout(timeoutToken);
        setIsWakingUp(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, KEEP_ALIVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!isWakingUp) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        <div>
          <p className="text-sm font-semibold">Server is waking up...</p>
          <p className="text-xs text-slate-400">Loading your data shortly</p>
        </div>
      </div>
    </div>
  );
}
