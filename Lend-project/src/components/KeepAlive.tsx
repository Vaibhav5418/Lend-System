import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { pingHealth } from '../api/client';

/** Pings backend /api/health to avoid cold starts (e.g. Render sleep). */
const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function KeepAlive() {
  const [isWakingUp, setIsWakingUp] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutToken: ReturnType<typeof setTimeout> | null = null;

    const checkHealth = async () => {
      // If health check takes > 2s, it's likely a cold start
      timeoutToken = setTimeout(() => {
        if (isMounted) {
          setIsWakingUp(true);
        }
      }, 2000);

      try {
        await pingHealth();
      } catch {
        // Ping health error (e.g. offline/sleeping) - suppress silently
      } finally {
        if (timeoutToken) {
          clearTimeout(timeoutToken);
          timeoutToken = null;
        }
        if (isMounted) {
          setIsWakingUp(false);
        }
      }
    };

    void checkHealth();
    const interval = setInterval(() => {
      void checkHealth();
    }, KEEP_ALIVE_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (timeoutToken) {
        clearTimeout(timeoutToken);
      }
      clearInterval(interval);
    };
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
