import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../DataProvider';

import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Clock, Calendar, FileText, Users, Building2,
  ClipboardList, FolderOpen, BarChart3, MessageSquare,
  Video, Menu, Briefcase, ListTodo, GitBranch,
  DollarSign, Settings, Search, Download,
  CheckSquare, FolderKanban, Coins, Building, MapPin, Circle,
  Home, Wallet, CalendarDays, Bot, Sparkles, ChevronsUpDown, Check, ChevronDown, ArrowDown } from
'lucide-react';
import GlobalSearch from './GlobalSearch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Avatar from '../Avatar';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';

const iconMap = {
  LayoutDashboard, Clock, Calendar, FileText, Users, Building2,
  ClipboardList, FolderOpen, BarChart3, MessageSquare,
  Video, Briefcase, ListTodo, GitBranch, DollarSign, Settings,
  CheckSquare, FolderKanban, Coins, Building, MapPin, Circle,
  Home, Wallet, CalendarDays, Bot, Sparkles, Download
};

export default function MainLayout({ children }) {
  const { currentUser, actualUser, viewAsUser, toggleViewAsUser, loading, currentCompany, setCurrentCompany, branches } = useData();
  const sidebarOpen = true; // Always open
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  useEffect(() => {
    console.log('🟦 [MainLayout] showGlobalSearch =>', showGlobalSearch);
  }, [showGlobalSearch]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const isActualAdmin = actualUser?.role === 'admin';

  const navigation = [
    {
      title: 'Admin',
      items: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: createPageUrl('Dashboard'), type: 'page', color: 'bg-indigo-100 text-indigo-600' },
        { name: 'Calendar', icon: 'CalendarDays', path: '/calendar', type: 'page', color: 'bg-purple-100 text-purple-600', customIconUrl: currentCompany?.calendar_tab_icon_url },
        { name: 'Forms', icon: 'FileText', path: '/forms', type: 'page', color: 'bg-cyan-100 text-cyan-600', customIconUrl: currentCompany?.forms_tab_icon_url },
      ]
    },
    {
      title: 'Working Flow',
      flowSection: true,
      items: [
        { name: 'Clients', icon: 'Building2', path: '/clients', type: 'page', color: 'bg-indigo-100 text-indigo-600', customIconUrl: currentCompany?.clients_tab_icon_url },
        { name: 'Assets', icon: 'FolderOpen', path: '/documents', type: 'page', color: 'bg-blue-100 text-blue-600', customIconUrl: currentCompany?.documents_assets_tab_icon_url },
        { name: 'Projects', icon: 'Briefcase', path: '/projects', type: 'page', color: 'bg-pink-100 text-pink-600', customIconUrl: currentCompany?.projects_tab_icon_url },
        { name: 'Orders', icon: 'FileText', path: '/job-orders', type: 'page', color: 'bg-teal-100 text-teal-600', customIconUrl: currentCompany?.orders_tab_icon_url },
        { name: 'Tasks', icon: 'FileText', path: '/timesheets', type: 'page', color: 'bg-blue-100 text-blue-600', customIconUrl: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/8017094dd_Gemini_Generated_Image_cn5utbcn5utbcn5u.png' },
      ]
    },
    {
      title: 'Operations',
      items: [
        { name: 'Planner', icon: 'ClipboardList', path: '/work-orders', type: 'page', color: 'bg-orange-100 text-orange-600', customIconUrl: currentCompany?.schedule_tab_icon_url },
        { name: 'Timer', icon: 'Clock', path: '/time-tracker', type: 'page', color: 'bg-blue-600 text-white', customIconUrl: currentCompany?.time_tracker_tab_icon_url }
      ]
    },
    {
      title: 'Sales',
      items: [
        { name: 'Sales Overview', icon: 'BarChart3', path: '/sales/overview', type: 'page', color: 'bg-green-100 text-green-600' },
        { name: 'Quotes', icon: 'FileText', path: '/sales/quotes', type: 'page', color: 'bg-blue-100 text-blue-600' },
        { name: 'Proformas', icon: 'FileText', path: '/sales/proformas', type: 'page', color: 'bg-indigo-100 text-indigo-600' },
        { name: 'Invoices', icon: 'FileText', path: '/sales/invoices', type: 'page', color: 'bg-purple-100 text-purple-600' },
        { name: 'Clients', icon: 'Building2', path: '/sales/clients', type: 'page', color: 'bg-rose-100 text-rose-600' },
        { name: 'Settings', icon: 'Settings', path: '/sales/settings', type: 'page', color: 'bg-slate-100 text-slate-600', adminOnly: true },
      ]
    },
    {
      title: 'Connection',
      items: [
        { name: 'AI Assistant', icon: 'Bot', path: '/ai-assistant', type: 'page', color: 'bg-violet-100 text-violet-600', customIconUrl: currentCompany?.ai_assistant_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/ddfcb84fc_Gemini_Generated_Image_8uh0068uh0068uh0.png' },
        { name: 'Chat', icon: 'MessageSquare', path: '/chat', type: 'page', color: 'bg-green-100 text-green-600', customIconUrl: currentCompany?.chat_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/5280bc6a8_Gemini_Generated_Image_lxhgu9lxhgu9lxhg.png' },
        { name: 'Wall', icon: 'MessageSquare', path: '/connections-wall', type: 'page', color: 'bg-sky-100 text-sky-600', customIconUrl: currentCompany?.connections_wall_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/53fc9b73a_Screenshot2026-01-23at84002AM.png' }
      ]
    },
    {
      title: 'HR',
      items: [
        { name: 'Users', icon: 'Users', path: '/users', type: 'page', adminOnly: true, color: 'bg-rose-100 text-rose-600', customIconUrl: currentCompany?.users_tab_icon_url },
        { name: 'Payroll', icon: 'DollarSign', path: '/payrolls', type: 'page', adminOnly: true, color: 'bg-yellow-100 text-yellow-600', customIconUrl: currentCompany?.payroll_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/e4658121a_payroll.png' },
        { name: 'Leave & Absences', icon: 'CalendarDays', path: '/leave-absences', type: 'page', color: 'bg-green-100 text-green-600', customIconUrl: currentCompany?.leave_absences_tab_icon_url },
        { name: 'Petty Cash', icon: 'Wallet', path: '/petty-cash', type: 'page', color: 'bg-amber-100 text-amber-600', customIconUrl: currentCompany?.petty_cash_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/69f93a109_Gemini_Generated_Image_hfvozihfvozihfvo.png' }
      ]
    },
    {
      title: 'Reports',
      items: [
        { name: 'Analytics', icon: 'BarChart3', path: '/analytics', type: 'page', color: 'bg-gray-100 text-gray-600', customIconUrl: currentCompany?.reports_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/095c34148_Gemini_Generated_Image_rrsmqzrrsmqzrrsm.png' },
        { name: 'QuickFiles', icon: 'Download', path: '/downloads', type: 'page', color: 'bg-gray-100 text-gray-600' },
        { name: 'Reports', icon: 'FileText', path: '/reports', type: 'page', color: 'bg-gray-100 text-gray-600' },
        { name: 'Timesheets Settings', icon: 'Settings', path: '/timesheets', type: 'page', color: 'bg-gray-100 text-gray-700' }
      ]
    }
  ];

  const allowedPaths = useMemo(() => {
    try { return navigation.flatMap(s => (s.items || []).map(i => (typeof i.path === 'string' ? i.path : createPageUrl('Dashboard')))); } catch { return []; }
  }, [navigation]);

  // Save current route to localStorage (only if valid)
  useEffect(() => {
    if (location.pathname !== '/' && currentUser) {
      if (allowedPaths.includes(location.pathname)) {
        localStorage.setItem('lastVisitedRoute', location.pathname);
      } else {
        localStorage.removeItem('lastVisitedRoute');
      }
    }
  }, [location.pathname, currentUser, allowedPaths]);

  // Redirect root to last visited valid route or default
  useEffect(() => {
    if (location.pathname === '/' && currentUser) {
      const lastRoute = localStorage.getItem('lastVisitedRoute');
      const target = (lastRoute && allowedPaths.includes(lastRoute)) ? lastRoute : createPageUrl('Dashboard');
      navigate(target);
    }
  }, [location.pathname, currentUser, navigate, allowedPaths]);

  const handleLogout = () => {
    base44.auth.logout();
    window.location.href = '/';
  };

  const getDynamicFullName = (user) => {
    if (!user) return 'User';
    if (user.nickname) return user.nickname;
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return `${firstName} ${lastName}`.trim() || user.full_name || user.email;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className="bg-white border-r border-slate-200 flex flex-col w-48">

        {/* Logo and Toggle */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 w-full min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start px-2 hover:bg-slate-100 h-14 -ml-2">
                     <div className="flex items-center gap-3 w-full text-left">
                        {currentCompany?.logo_url ? (
                           <img src={currentCompany.logo_url} alt={currentCompany.name} className="w-10 h-10 object-contain rounded-md bg-white border border-slate-200 p-1" />
                        ) : (
                           <Building2 className="w-10 h-10 text-slate-400" />
                        )}
                        <div className="flex-1 min-w-0">
                           <h1 className="text-sm font-bold text-slate-900 truncate">
                             {currentCompany?.short_name || currentCompany?.name || 'Select Company'}
                           </h1>
                           <p className="text-xs text-slate-500 truncate">{currentCompany?.business_type || 'Business Management'}</p>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                     </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start">

                  
                  {/* SELECTED COMPANY FIRST */}
                  {currentCompany && (
                    <div>
                      <DropdownMenuItem 
                        disabled
                        className="gap-2 p-3 bg-indigo-100 opacity-100 cursor-default border-b border-slate-200"
                      >
                        {currentCompany.logo_url ? (
                          <img src={currentCompany.logo_url} alt={currentCompany.name} className="w-8 h-8 object-contain rounded" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-indigo-200 flex items-center justify-center text-indigo-700 text-xs font-bold">
                            {currentCompany.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-bold flex-1 truncate text-slate-900">{currentCompany.name}</span>
                        <Check className="w-4 h-4 text-green-600" />
                      </DropdownMenuItem>
                    </div>
                  )}
                  
                  {/* OTHER COMPANIES */}
                  {Array.isArray(branches) && branches.filter(b => b.id !== currentCompany?.id).length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-semibold text-slate-600 px-2 py-2">
                        Switch Company
                      </DropdownMenuLabel>
                      {branches
                        .filter(branch => branch.id !== currentCompany?.id)
                        .filter(branch => {
                          const n = (branch.name || '').toLowerCase();
                          // Mostrar sólo las oficiales (con logo) para evitar duplicados sin logo
                          const isOfficial = (n.includes('redcrane') || n.includes('redline')) && branch.logo_url;
                          return isOfficial;
                        })
                        .map((branch) => (
                            <DropdownMenuItem 
                                key={branch.id} 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCurrentCompany(branch);
                                }} 
                                className="gap-2 p-2 hover:bg-slate-100 cursor-pointer"
                            >
                              {branch.logo_url ? (
                                <img src={branch.logo_url} alt={branch.name} className="w-8 h-8 object-contain rounded" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
                                  {branch.name.charAt(0)}
                                </div>
                              )}
                              <span className="font-medium flex-1 truncate">{branch.name}</span>
                            </DropdownMenuItem>
                        ))}
                    </>
                  )}
                  
                  {/* NO COMPANIES CASE */}
                  {(!branches || branches.length === 0) && (
                    <DropdownMenuItem disabled className="text-slate-500 text-xs">
                      No companies available
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                     <Link to="/admin" className="cursor-pointer flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span>Manage Companies</span>
                     </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </div>

        {/* Global Search Button */}
        <div className="px-2 py-3 border-b border-slate-200">
          <Button
            variant="outline"
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log('🟦 [MainLayout] Clic en lupa (abrir buscador)'); setShowGlobalSearch(true); }}
            className="w-full justify-start gap-2 border-slate-300 hover:bg-slate-100"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500 text-sm">Search...</span>
          </Button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto py-4 px-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}>

          {navigation.map((section, sectionIndex) => {
            const visibleItems = section.items.filter((item) => {
              if (item.adminOnly === true && !isAdmin) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={sectionIndex} className="mb-2">
                {section.title && (
                  <h3 className="px-3 mb-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}

                <div className="bg-slate-50 rounded-lg border-2 border-black p-2">
                  {visibleItems.map((item, itemIndex) => {
                    const Icon = iconMap[item.icon] || Circle;
                    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                    const isFlowSection = section.flowSection;
                    const isLast = itemIndex === visibleItems.length - 1;

                    return (
                      <div key={item.path}>
                        <Link
                          to={item.path}
                          className={cn(
                            "flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors relative group",
                            isActive ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                          )}>

                          {item.customIconUrl ? (
                            <div className="flex-shrink-0 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center w-12 h-12">
                              <img 
                                src={item.customIconUrl} 
                                alt={item.name} 
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className={cn(
                              "p-1.5 rounded-lg transition-all duration-200",
                              item.color || "bg-slate-100 text-slate-500",
                              isActive ? "ring-2 ring-offset-1 ring-slate-200 shadow-sm" : "opacity-90 hover:opacity-100"
                            )}>
                              <Icon className="w-5 h-5 flex-shrink-0" />
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-1">
                            <span className="flex-1 truncate text-sm font-light">{item.name}</span>
                          </div>
                        </Link>
                        {isFlowSection && !isLast && (
                          <div className="flex justify-center py-0.5">
                            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>);

          })}
        </nav>

        {/* User Profile Section */}
        {currentUser &&
        <div className="border-t border-slate-200 p-3">
          <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar
                user={currentUser}
                size="md"
                className="flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-normal text-slate-900 truncate">
                      {getDynamicFullName(currentUser)}
                    </p>
                    <p className="text-xs text-slate-500 capitalize truncate font-light">
                      {currentUser.role}
                    </p>
                  </div>
                </div>

                {/* ✅ Toggle View As User/Admin */}
                {isActualAdmin &&
            <button
              onClick={toggleViewAsUser}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between",
                viewAsUser ?
                "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}>

                    <span>{viewAsUser ? '👤 Viewing as User' : '👑 Viewing as Admin'}</span>
                    {viewAsUser &&
              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        Switch
                      </Badge>
              }
                  </button>
            }

                <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full text-xs h-7 text-red-600 hover:bg-red-50 font-light">
                  Logout
                </Button>
              </div>
          </div>
        }
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex-1 overflow-auto"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}>

          {children}
        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch 
        isOpen={showGlobalSearch} 
        onClose={() => setShowGlobalSearch(false)} 
      />
      {/* Captura global de errores para evitar pantallas genéricas */}
      <script dangerouslySetInnerHTML={{__html:`window.addEventListener('error',function(e){console.log('Global error:',e.message)})`}} />
    </div>);

}