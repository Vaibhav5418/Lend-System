import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  X,
  ChevronDown,
  Landmark,
  Wallet,
  TrendingUp,
  ClipboardList,
  CheckCircle2,
  CreditCard,
  Receipt,
} from 'lucide-react';

type MenuItem = {
  path: string;
  label: string;
  icon: React.ElementType;
};

type MenuSection = {
  label: string;
  icon: React.ElementType;
  children: MenuItem[];
  color: string;
};

const flatItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inquiries', label: 'Inquiries', icon: FileText },
];

const sections: MenuSection[] = [
  {
    label: 'Investor',
    icon: Landmark,
    color: 'text-violet-600',
    children: [
      { path: '/investor/inquiries', label: 'Inquiry', icon: ClipboardList },
      { path: '/investor/borrowed', label: 'Borrowed', icon: CheckCircle2 },
      { path: '/investor/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    label: 'Borrower',
    icon: Wallet,
    color: 'text-sky-600',
    children: [
      { path: '/borrower/inquiries', label: 'Inquiry', icon: ClipboardList },
      { path: '/borrower/lended', label: 'Lended', icon: CheckCircle2 },
      { path: '/borrower/collections', label: 'Collections', icon: Receipt },
    ],
  },
];

const bottomItems: MenuItem[] = [
  { path: '/profit', label: 'Profit Engine', icon: TrendingUp },
];

type SidebarProps = { mobileOpen: boolean; onClose: () => void };

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.children.some((c) => location.pathname.startsWith(c.path))) {
        initial[s.label] = true;
      }
    });
    return initial;
  });

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const renderLink = (item: MenuItem, indent = false) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <li key={item.path}>
        <Link
          to={item.path}
          onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 border-l-2 -ml-0.5 pl-[11px] ${indent ? 'ml-4 pl-[11px]' : ''
            } ${active
              ? 'border-sky-500 bg-sky-50 text-sky-700'
              : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
          <Icon className="w-[18px] h-[18px] flex-shrink-0 opacity-90" />
          <span className="text-sm font-medium">{item.label}</span>
        </Link>
      </li>
    );
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Branding */}
      <div className="p-5 flex items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 truncate leading-tight">
              Loanly
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Lending Platform
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="p-2.5 flex-1 overflow-y-auto">
        <ul className="space-y-0.5">
          {flatItems.map((item) => renderLink(item))}
        </ul>

        {/* Collapsible Sections */}
        {sections.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = !!openSections[section.label];
          const sectionActive = section.children.some((c) => isActive(c.path));

          return (
            <div key={section.label} className="mt-3">
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors duration-200 ${sectionActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <SectionIcon className={`w-5 h-5 flex-shrink-0 ${section.color}`} />
                  <span className="text-sm font-semibold">{section.label}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                  }`}
              >
                <ul className="mt-0.5 space-y-0.5">
                  {section.children.map((child) => renderLink(child, true))}
                </ul>
              </div>
            </div>
          );
        })}

        {/* Bottom items */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <ul className="space-y-0.5">
            {bottomItems.map((item) => renderLink(item))}
          </ul>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-30 transition-opacity md:hidden ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`w-64 h-screen fixed left-0 top-0 overflow-y-auto z-40 md:z-20
          border-r border-slate-200 bg-white
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {navContent}
      </aside>
    </>
  );
}
