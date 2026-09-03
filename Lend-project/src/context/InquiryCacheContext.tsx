import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Inquiry } from '../types';

type InquiryCacheState = {
  inquiries: Inquiry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const InquiryCacheContext = createContext<InquiryCacheState | null>(null);
const CACHE_KEY = 'lend_inquiries_cache';

export function InquiryCacheProvider({ children }: { children: ReactNode }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => {
    // Rehydrate from localStorage on initial load
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(inquiries.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    // If we have cached data, don't show full loading screen
    if (inquiries.length === 0) setLoading(true);

    setError(null);
    try {
      const data = await api.getInquiries();
      setInquiries(data);
      // Save to localStorage for next time
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [inquiries.length]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const value: InquiryCacheState = {
    inquiries,
    loading,
    error,
    refetch,
  };

  return (
    <InquiryCacheContext.Provider value={value}>
      {children}
    </InquiryCacheContext.Provider>
  );
}

export function useInquiryCache(): InquiryCacheState {
  const ctx = useContext(InquiryCacheContext);
  if (!ctx) throw new Error('useInquiryCache must be used within InquiryCacheProvider');
  return ctx;
}
