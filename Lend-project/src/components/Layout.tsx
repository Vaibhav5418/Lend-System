import { ReactNode, useState } from 'react';
import { InquiryCacheProvider } from '../context/InquiryCacheContext';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <InquiryCacheProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="md:ml-64 pt-14 sm:pt-16 min-h-screen">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </InquiryCacheProvider>
  );
}
