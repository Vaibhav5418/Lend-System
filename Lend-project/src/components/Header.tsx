import { useState } from 'react';
import { Bell, Plus, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

type HeaderProps = { onMenuClick: () => void };

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-0 md:left-64 z-10">
      <div className="h-full px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex-1 min-w-0" />

        <div className="relative flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
          <button
            onClick={() => navigate('/inquiries/new')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Inquiry</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setHasUnread(false);
            }}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </button>

          <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 md:pl-4 border-l border-gray-200">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm shrink-0"
              title={user?.email}
            >
              {user ? getInitials(user.name) : '?'}
            </div>
            <span className="hidden lg:inline text-sm font-medium text-gray-700 max-w-[100px] truncate">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {notificationsOpen && (
            <div className="absolute right-0 top-11 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-20">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Notifications</p>
              </div>
              <div className="px-3 py-3">
                <p className="text-sm text-slate-600">No new notifications right now.</p>
                <p className="mt-1 text-xs text-slate-400">This panel is ready for future alerts.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
