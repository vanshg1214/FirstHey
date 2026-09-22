'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Zap,
  ChevronRight,
  Target,
  Bell,
  Settings,
  LogOut,
  BarChart2,
  Mail,
  User,
  Bot
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const NAV_ITEMS = [
  { href: '/leads', icon: LayoutDashboard, label: 'Dashboard', color: 'text-blue-600', hoverBg: 'hover:bg-blue-50', activeBg: 'bg-blue-50 border-blue-200' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics', color: 'text-purple-600', hoverBg: 'hover:bg-purple-50', activeBg: 'bg-purple-50 border-purple-200' },
  { href: '/exhibitions', icon: Target, label: 'Exhibitions', color: 'text-teal-600', hoverBg: 'hover:bg-teal-50', activeBg: 'bg-teal-50 border-teal-200' },
  { href: '/capture', icon: Zap, label: 'Capture', color: 'text-amber-600', hoverBg: 'hover:bg-amber-50', activeBg: 'bg-amber-50 border-amber-200' },
  { href: '/profile', icon: User, label: 'Profile', color: 'text-fuchsia-600', hoverBg: 'hover:bg-fuchsia-50', activeBg: 'bg-fuchsia-50 border-fuchsia-200' },
  { href: '/settings', icon: Settings, label: 'Settings', color: 'text-slate-600', hoverBg: 'hover:bg-slate-100', activeBg: 'bg-slate-100 border-slate-300' },
];

const ADMIN_NAV_ITEMS: any[] = [];

export default function Sidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const supabase = createClient();

  React.useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (data) setUserRole(data.role);
      }
    }
    fetchRole();
  }, [supabase]);

  // Hide sidebar on capture and login pages
  if (pathname?.startsWith('/capture') || pathname?.startsWith('/login')) return null;

  return (
    <>
      {/* ─── Desktop Sidebar ─── */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={`
          hidden md:flex fixed left-4 top-4 bottom-4 z-50
          flex-col items-start rounded-2xl
          bg-white/90 backdrop-blur-2xl border border-slate-200 shadow-xl shadow-slate-200/50
          transition-all duration-300 ease-out
          ${isExpanded ? 'w-56' : 'w-16'}
        `}
      >
        {/* Logo */}
        <div className="w-full flex items-center justify-center px-2 py-4 border-b border-slate-200 min-h-[64px]">
          {isExpanded ? (
            <div className="flex flex-shrink-0 items-center justify-center animate-in fade-in zoom-in-95 duration-200 translate-x-1">
              <span className="text-xl font-black text-slate-900 tracking-tight">FirstHey</span>
            </div>
          ) : (
            <div className="flex-shrink-0 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200 text-slate-900 font-black text-lg">
              FH
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 w-full px-2 py-3 space-y-0.5 overflow-hidden">
          {[...NAV_ITEMS, ...(userRole === 'superadmin' ? ADMIN_NAV_ITEMS : [])].map(({ href, icon: Icon, label, color, hoverBg, activeBg }) => {
            const isActive = pathname === href || (href !== '/leads' && pathname?.startsWith(href));
            return (
              <Link key={href} href={href}>
                <div className={`
                  flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer
                  border transition-all duration-200 group
                  ${isActive ? `${activeBg} border-opacity-100` : `border-transparent ${hoverBg} hover:border-slate-200`}
                `}>
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? color : `text-slate-500 group-hover:${color}`}`} />
                  <span className={`text-xs font-bold whitespace-nowrap transition-all duration-200 ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'} ${isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-900'}`}>
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Expand Hint */}
        <div className="w-full px-2 pb-4 mt-auto">
          <div className={`flex justify-center mt-2 transition-opacity ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </aside>

      {/* ─── Mobile Bottom Tab Bar ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200 safe-area-pb shadow-lg">
        <div className="flex items-center px-4 py-2 overflow-x-auto hide-scrollbar gap-6 snap-x">
          {[...NAV_ITEMS, ...(userRole === 'superadmin' ? ADMIN_NAV_ITEMS : [])].map(({ href, icon: Icon, label, color, activeBg }) => {
            const isActive = pathname === href || (href !== '/leads' && pathname?.startsWith(href));
            return (
              <Link key={href} href={href} className="shrink-0 min-w-[64px] snap-center">
                <div className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all ${isActive ? activeBg + ' shadow-sm' : ''}`}>
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? color : 'text-slate-500'}`} />
                  <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
