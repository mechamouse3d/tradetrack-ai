import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon, Settings, ChevronDown } from 'lucide-react';

interface UserMenuProps {
  onLoginClick: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onLoginClick }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button 
        onClick={onLoginClick}
        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        Sign In
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
      >
        <img 
            src={user.photoURL} 
            alt={user.name} 
            className="w-8 h-8 rounded-full border border-slate-200 object-cover"
        />
        <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-slate-700 leading-none">{user.name}</p>
        </div>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 transform origin-top-right transition-all">
          <div className="px-4 py-3 border-b border-slate-100 mb-1">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          
          <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <UserIcon size={16} className="text-slate-400" /> Profile
          </button>
          <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <Settings size={16} className="text-slate-400" /> Settings
          </button>
          
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button 
                onClick={() => {
                    logout();
                    setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
            >
                <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;