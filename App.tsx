
import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, ClipboardList, PackageCheck, Truck, Box, Building2, MapPin, History, LogOut, Settings, Bell, Palette, Sun, Moon, FileText, ChevronDown, ChevronRight, Check, Users as UsersIcon, Boxes, Shuffle, ShieldCheck, ArrowUpRight, FileCheck, Briefcase, ArrowLeftRight, Activity } from 'lucide-react';
import { toTitleCase } from './lib/utils';
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom';
import SerialNumberEntryPage from './components/SerialNumberEntryPage';
import Features from './components/Features';
import ItemsRequest from './components/ItemsRequest';
import Catalog from './components/Catalog';
import Tracking from './components/Tracking';
import Inventory from './components/Inventory';
import VerifiedTransferPage from './components/VerifiedTransferPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import PurchaseOrders from './components/PurchaseOrders';
import Archived from './components/Archived';
import Users from './components/Users';
import PulloutManagement from './components/PulloutManagement';
import CreatePulloutPage from './components/CreatePulloutPage';
import DeliveryReceiptManagement from './components/DeliveryReceiptManagement';
import CreateDeliveryReceiptPage from './components/CreateDeliveryReceiptPage';
import AcknowledgementReceiptManagement from './components/AcknowledgementReceiptManagement';
import { useNotification } from './components/NotificationProvider';
import SchoolMonitoring from './components/SchoolMonitoring';

type AuthState = 'login' | 'signup' | 'authenticated';
type ViewType = 'dashboard' | 'requests' | 'inventory' | 'catalog' | 'equipment' | 'bundle' | 'school' | 'location' | 'tracking' | 'archived' | 'reports' | 'setup' | 'verified-transfer' | 'users' | 'purchase-orders' | 'pullout' | 'delivery-receipt' | 'fixed-assets' | 'school-monitoring';

const ProtectedRoute = ({ authState, children }: { authState: AuthState; children: React.ReactNode }) => {
  if (authState !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const SidebarContext = React.createContext<boolean>(false);

interface NavItemConfig {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  children?: { id: ViewType; label: string; icon: React.ReactNode; isPlaceholder?: boolean }[];
  isPlaceholder?: boolean;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isBottom?: boolean;
  isPlaceholder?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, isBottom, isPlaceholder }) => {
  const isSidebarHovered = React.useContext(SidebarContext);
  const iconWithStyle = React.isValidElement(icon) 
    ? React.cloneElement(icon as React.ReactElement<any>, { 
        strokeWidth: isActive ? 2.5 : 1.8,
        size: 18 
      }) 
    : icon;

  return (
    <div className={`relative w-full transition-all duration-300 ${isSidebarHovered ? 'px-3' : 'px-2'}`}>
      <button 
        onClick={onClick}
        title={label}
        className={`
          relative flex items-center w-full transition-all duration-300 group/item overflow-hidden rounded-xl h-11 flex-row border-none
          ${isActive 
            ? 'font-semibold bg-white/[0.04]' 
            : `text-slate-400 hover:text-white hover:bg-white/[0.08] ${isSidebarHovered ? 'text-slate-300' : 'text-slate-400'}`
          }
          ${isSidebarHovered ? 'justify-start px-3.5 gap-3.5' : 'justify-center px-0 gap-0'}
        `}
        style={isActive ? { 
          background: `linear-gradient(90deg, color-mix(in srgb, var(--brand-accent), transparent 85%) 0%, transparent 100%)`, 
          boxShadow: `inset 0 0 20px -10px color-mix(in srgb, var(--brand-accent), transparent 50%)`,
        } : {}}
      >
        {/* Active Indicator Left Bar */}
        {isActive && (
          <div 
            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full z-20" 
            style={{ 
              backgroundColor: 'var(--brand-accent)',
              boxShadow: '0 0 12px var(--brand-accent)'
            }}
          />
        )}

        {/* Hover subtle background pulse effect */}
        {!isActive && (
          <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
        )}

        <div 
          className={`w-5 h-5 shrink-0 flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : `opacity-60 group-hover/item:scale-110 group-hover/item:rotate-3 ${isSidebarHovered ? 'opacity-100' : 'opacity-60'}`}`}
          style={isActive ? { color: 'var(--brand-accent)' } : {}}
        >
          {iconWithStyle}
        </div>

        <span 
          className={`text-[13px] font-medium tracking-wide whitespace-nowrap transition-all duration-300 ${
            isSidebarHovered 
              ? 'opacity-100 w-auto' 
              : 'opacity-0 w-0 pointer-events-none'
          } ${isActive ? '' : 'text-slate-400 group-hover/item:text-slate-200'}`}
          style={isActive ? { color: 'var(--brand-accent)' } : {}}
        >
          {label}
        </span>

        {isPlaceholder && isSidebarHovered && (
          <span className="ml-auto mr-1 text-[8px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500 font-black tracking-wider uppercase scale-90">
            Soon
          </span>
        )}
      </button>
    </div>
  );
};

const NavCategory: React.FC<{ label: string }> = ({ label }) => {
  const isSidebarHovered = React.useContext(SidebarContext);
  return (
    <div className={`pl-[26px] pr-6 mb-2 mt-4 transition-all duration-500 overflow-hidden first:mt-2 ${
      isSidebarHovered 
        ? 'opacity-100 translate-y-0 pointer-events-auto' 
        : 'opacity-0 -translate-y-2 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:translate-y-0 group-hover/sidebar:pointer-events-auto'
    }`}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap opacity-40">
        {label}
      </span>
    </div>
  );
};

interface NavDropdownParentProps {
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  onClick: () => void;
  isActive?: boolean;
}

const NavDropdownParent: React.FC<NavDropdownParentProps> = ({ icon, label, isOpen, onClick, isActive }) => {
  const isSidebarHovered = React.useContext(SidebarContext);
  const iconWithStyle = React.isValidElement(icon) 
    ? React.cloneElement(icon as React.ReactElement<any>, { 
        strokeWidth: isActive ? 2.5 : 1.8,
        size: 18 
      }) 
    : icon;

  return (
    <div className={`relative w-full transition-all duration-300 ${isSidebarHovered ? 'px-3' : 'px-2'}`}>
      <button 
        onClick={onClick}
        title={label}
        className={`
          relative flex items-center w-full transition-all duration-300 group/item overflow-hidden rounded-xl h-11 flex-row border-none
          ${isActive 
            ? 'font-semibold bg-white/[0.04]' 
            : `text-slate-400 hover:text-white hover:bg-white/[0.08] ${isSidebarHovered ? 'text-slate-300' : 'text-slate-400'}`
          }
          ${isSidebarHovered ? 'justify-start px-3.5 gap-3.5' : 'justify-center px-0 gap-0'}
        `}
        style={isActive ? { 
          background: `linear-gradient(90deg, color-mix(in srgb, var(--brand-accent), transparent 85%) 0%, transparent 100%)`, 
          boxShadow: `inset 0 0 20px -10px color-mix(in srgb, var(--brand-accent), transparent 50%)`,
        } : {}}
      >
        {/* Active Indicator Left Bar */}
        {isActive && (
          <div 
            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full z-20" 
            style={{ 
              backgroundColor: 'var(--brand-accent)',
              boxShadow: '0 0 12px var(--brand-accent)'
            }}
          />
        )}

        <div 
          className={`w-5 h-5 shrink-0 flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : `opacity-60 group-hover/item:scale-110 ${isSidebarHovered ? 'opacity-100' : 'opacity-60'}`}`}
          style={isActive ? { color: 'var(--brand-accent)' } : {}}
        >
          {iconWithStyle}
        </div>

        <span 
          className={`text-[13px] font-medium tracking-wide whitespace-nowrap transition-all duration-300 ${
            isSidebarHovered 
              ? 'opacity-100 w-auto' 
              : 'opacity-0 w-0 pointer-events-none'
          } ${isActive ? '' : 'text-slate-400 group-hover/item:text-slate-200'}`}
          style={isActive ? { color: 'var(--brand-accent)' } : {}}
        >
          {label}
        </span>

        {/* Dropdown status chevron */}
        {isSidebarHovered && (
          <div className="ml-auto flex items-center text-slate-500 group-hover/item:text-slate-300 mr-1 transition-transform duration-300">
            <ChevronDown 
              size={14} 
              className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
            />
          </div>
        )}
      </button>
    </div>
  );
};

interface NavSubItemProps {
  label: string;
  onClick: () => void;
  isActive?: boolean;
  isPlaceholder?: boolean;
}

const NavSubItem: React.FC<NavSubItemProps> = ({ label, onClick, isActive, isPlaceholder }) => {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={`
        flex items-center w-full h-9 rounded-lg text-left pl-3 text-xs font-semibold tracking-wide transition-all duration-300 group/subitem relative
        ${isActive 
          ? 'text-white bg-white/[0.04]' 
          : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
        }
      `}
      style={isActive ? { 
        borderLeft: `2px solid var(--brand-accent)`,
        borderRadius: '0 8px 8px 0'
      } : {}}
    >
      <span className="truncate">{label}</span>
      {isPlaceholder && (
        <span className="ml-auto mr-2 text-[8px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500 font-black tracking-wider uppercase scale-90 group-hover/subitem:bg-slate-700/60 group-hover/subitem:text-slate-300 transition-all duration-300">
          Soon
        </span>
      )}
    </button>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showInfo } = useNotification();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const isSidebarOpen = isTransactionOpen || isManagementOpen;
  const isExpanded = isSidebarHovered || isSidebarOpen;

  const handleComingSoon = (featureName: string) => {
    showInfo(`${featureName} feature is coming soon!`, "We are working hard to build this view.");
  };

  const [authState, setAuthState] = useState<AuthState>('login');
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [activeRequestStatus, setActiveRequestStatus] = useState<'All' | 'Pending' | 'Partially' | 'Completed'>('All');
  const [shouldOpenNewRequest, setShouldOpenNewRequest] = useState(false);
  const [shouldOpenPoModal, setShouldOpenPoModal] = useState(false);
  const [activeInventoryTab, setActiveInventoryTab] = useState<'list' | 'transfer'>('list');
  const [shouldOpenTransferModal, setShouldOpenTransferModal] = useState(false);
  const [prefillFromLocation, setPrefillFromLocation] = useState<string | null>(null);
  const [prefillToLocation, setPrefillToLocation] = useState<string | null>(null);
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [fullUserName, setFullUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accentColor, setAccentColor] = useState('#FF6A00');
  const [prefillData, setPrefillData] = useState<{ item?: string; code?: string }>({});

  const DEFAULT_LIGHT_BG = '#FAF8F8';
  const DEFAULT_DARK_BG = '#0F172A';
  const DEFAULT_ACCENT = '#FF6A00';

  const rainbowColors = [
    { name: 'Red', hex: '#EF4444' },
    { name: 'Orange', hex: '#FF6A00' },
    { name: 'Yellow', hex: '#FACC15' },
    { name: 'Green', hex: '#22C55E' },
    { name: 'Blue', hex: '#3B82F6' },
    { name: 'Indigo', hex: '#6366F1' },
    { name: 'Violet', hex: '#A855F7' }
  ];

  useEffect(() => {
    // 1. Load Accent Color
    const savedAccent = localStorage.getItem('aralinks_accent_color') || '#FF6A00';
    setAccentColor(savedAccent);

    // 2. Load Theme (Dark/Light)
    const savedTheme = localStorage.getItem('aralinks_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDarkMode = savedTheme ? savedTheme === 'dark' : prefersDark;
    
    setIsDarkMode(initialDarkMode);
    if (initialDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 3. Update CSS Variables
    updateAccentCSS(savedAccent, initialDarkMode);

    const savedUser = localStorage.getItem('aralinks_user');
    const savedFullName = localStorage.getItem('aralinks_fullname');
    const savedRole = localStorage.getItem('aralinks_role');
    if (savedUser) {
      setCurrentUser(savedUser);
      if (savedFullName) setFullUserName(savedFullName);
      if (savedRole) setUserRole(savedRole);
      setAuthState('authenticated');
    }
  }, []);

  useEffect(() => {
    if (['equipment', 'bundle', 'school', 'location'].includes(activeView)) {
      setIsManagementOpen(true);
    }
    if (activeView === 'pullout' || activeView === 'delivery-receipt') {
      setIsTransactionOpen(true);
    }
  }, [activeView]);

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    localStorage.setItem('aralinks_theme', nextMode ? 'dark' : 'light');
    
    if (nextMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    updateAccentCSS(accentColor, nextMode);
  };

  const handleAccentColorChange = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('aralinks_accent_color', color);
    updateAccentCSS(color, isDarkMode);
    setIsColorMenuOpen(false);
  };

  const updateAccentCSS = (color: string, dark: boolean) => {
    const isWhite = color.toLowerCase() === '#ffffff';
    
    document.documentElement.style.setProperty('--brand-accent', color);
    document.documentElement.style.setProperty('--brand-accent-hover', color + 'CC');
    document.documentElement.style.setProperty('--brand-accent-subtle', color + '15');
    
    if (!dark) {
      // Light Mode
      document.documentElement.style.setProperty('--brand-header', isWhite ? '#1e293b' : color);
      // Stable background without tint
      document.documentElement.style.setProperty('--brand-offwhite', DEFAULT_LIGHT_BG);
    } else {
      // Dark Mode
      document.documentElement.style.setProperty('--brand-header', isWhite ? '#f8fafc' : `color-mix(in srgb, ${color}, white 85%)`);
      // Stable dark background without tint
      document.documentElement.style.setProperty('--brand-offwhite', DEFAULT_DARK_BG);
    }
    
    document.documentElement.style.setProperty('--selection-bg', color + '33');
  };


  const handleLogin = (username: string, fullName: string, role: string) => {
    setCurrentUser(username);
    setFullUserName(fullName);
    setUserRole(role);
    localStorage.setItem('aralinks_user', username);
    localStorage.setItem('aralinks_fullname', fullName);
    localStorage.setItem('aralinks_role', role);
    setAuthState('authenticated');
    navigate('/');
  };

  const handleNavigate = (viewId: string, params?: { 
    requestId?: string; 
    tab?: 'equipment' | 'bundle'; 
    status?: 'All' | 'Pending' | 'Partially' | 'Completed'; 
    openNewRequest?: boolean;
    openPoModal?: boolean;
    inventoryTab?: 'list' | 'transfer';
    openTransfer?: boolean;
    openVerifiedTransfer?: boolean;
    prefillFromLocation?: string;
    prefillToLocation?: string;
    prefillItem?: string; 
    prefillCode?: string 
  }) => {
    const v = viewId as ViewType;
    setActiveView(v);
    
    // Reset modal states when navigating away or normally
    if (v !== 'inventory') {
      setShouldOpenTransferModal(false);
    }
    if (v !== 'requests') {
      setShouldOpenNewRequest(false);
      setShouldOpenPoModal(false);
    }
    
    // Sync with react-router
    if (v === 'requests') {
      navigate('/requests');
    } else if (v === 'dashboard') {
      navigate('/');
    } else if (v === 'equipment') {
      navigate('/equipment');
    } else if (v === 'bundle') {
      navigate('/bundles');
    } else if (v === 'school') {
      navigate('/school');
    } else if (v === 'location') {
      navigate('/location');
    } else if (v === 'users') {
      navigate('/users');
    } else {
      navigate(`/${v}`);
    }

    if (params?.requestId) {
      setHighlightedRequestId(params.requestId);
      if (params.openPoModal !== undefined) {
        setShouldOpenPoModal(params.openPoModal);
      }
    } else {
      setHighlightedRequestId(null);
      setShouldOpenPoModal(false);
    }
    if (params?.status) {
      setActiveRequestStatus(params.status);
    } else if (viewId === 'requests') {
      // Default to All if navigating to requests without a specific status
      setActiveRequestStatus('All');
    }

    if (params?.openNewRequest !== undefined) {
      setShouldOpenNewRequest(params.openNewRequest);
    } else if (viewId === 'requests') {
      setShouldOpenNewRequest(false);
    }

    if (params?.inventoryTab) {
      setActiveInventoryTab(params.inventoryTab);
    } else if (viewId === 'inventory') {
      setActiveInventoryTab('list');
    }

    if (params?.openTransfer !== undefined) {
      setShouldOpenTransferModal(params.openTransfer);
    } else if (viewId === 'inventory') {
      setShouldOpenTransferModal(false);
    }

    if (viewId === 'verified-transfer') {
      if (params?.prefillToLocation) setPrefillToLocation(params.prefillToLocation);
      if (params?.prefillFromLocation) setPrefillFromLocation(params.prefillFromLocation);
    } else if (v !== 'inventory') {
      if (viewId !== 'inventory') {
        setPrefillToLocation(null);
        setPrefillFromLocation(null);
      }
    }

    if (params?.prefillItem || params?.prefillCode) {
      setPrefillData({ item: params.prefillItem, code: params.prefillCode });
    } else {
      setPrefillData({});
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setFullUserName(null);
    setUserRole(null);
    localStorage.removeItem('aralinks_user');
    localStorage.removeItem('aralinks_fullname');
    localStorage.removeItem('aralinks_role');
    setAuthState('login');
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const userInitials = (() => {
    if (!fullUserName) return '??';
    const parts = fullUserName.trim().split(' ');
    if (parts.length >= 2) {
      const firstInitial = parts[0].charAt(0);
      const lastInitial = parts[parts.length - 1].charAt(0);
      return (firstInitial + lastInitial).toUpperCase();
    }
    return fullUserName.substring(0, 2).toUpperCase();
  })();

  const navItems: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid size={18} /> },
    { id: 'inventory', label: 'Inventory', icon: <Box size={18} /> },
    { id: 'requests', label: 'Request', icon: <ClipboardList size={18} /> },
    { 
      id: 'school-monitoring' as any, 
      label: 'School monitoring', 
      icon: <Activity size={18} />
    },
    { 
      id: 'transaction' as any, 
      label: 'Transaction', 
      icon: <Shuffle size={18} />,
      children: [
        { id: 'warranty' as any, label: 'Warranty', icon: <ShieldCheck size={16} />, isPlaceholder: true },
        { id: 'pullout', label: 'Pullout Management', icon: <ArrowUpRight size={16} /> },
        { id: 'delivery-receipt', label: 'Delivery Receipt', icon: <FileCheck size={16} /> },
        { id: 'fixed-assets', label: 'Fixed Assets', icon: <Briefcase size={16} /> },
        { id: 'borrowing' as any, label: 'Borrowing', icon: <ArrowLeftRight size={16} />, isPlaceholder: true },
      ]
    },
    { 
      id: 'catalog', 
      label: 'Management', 
      icon: <Settings size={18} />,
      children: [
        { id: 'equipment', label: 'Equipment', icon: <PackageCheck size={16} /> },
        { id: 'bundle', label: 'Bundles', icon: <Boxes size={16} /> },
        { id: 'school', label: 'Schools', icon: <Building2 size={16} /> },
        { id: 'location', label: 'Location / Suppliers', icon: <MapPin size={16} /> },
      ]
    },
    ...(userRole === 'Super admin' ? [{ id: 'users' as ViewType, label: 'Users', icon: <UsersIcon size={18} /> }] : []),
  ];

  return (
    <Routes>
      <Route path="/login" element={
        authState === 'authenticated' ? <Navigate to="/" replace /> : 
        <LoginPage 
          onLogin={handleLogin} 
          onGoToSignUp={() => navigate('/signup')}
        />
      } />
      <Route path="/signup" element={
        authState === 'authenticated' ? <Navigate to="/" replace /> : 
        <SignUpPage 
          onSignUpSuccess={() => navigate('/login')} 
          onGoToLogin={() => navigate('/login')}
        />
      } />
      
      <Route path="/" element={
        <ProtectedRoute authState={authState}>
          <div 
            className={`h-screen w-screen flex selection:bg-brand-orange/10 overflow-hidden transition-colors duration-500`}
            style={{ 
              backgroundColor: 'var(--brand-offwhite)',
              /* @ts-ignore -- setting custom properties for CSS */
              '--content-bg': 'var(--brand-offwhite)',
              '--selection-bg': 'var(--brand-accent)'
            } as React.CSSProperties}
          >
            {/* 
              DESKTOP SIDEBAR
            */}
            <SidebarContext.Provider value={isExpanded}>
              <aside 
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
                className={`hidden lg:flex flex-col h-full sidebar-gradient border-r border-white/5 shadow-2xl transition-all duration-300 z-[100] relative group/sidebar shrink-0 bg-slate-950/80 hover:bg-slate-950 ${
                  isExpanded ? 'sidebar-open w-[280px] bg-slate-950' : 'w-[88px] hover:w-[280px]'
                }`}
              >
                {/* Logo Section */}
                <div className={`h-[88px] flex items-center shrink-0 overflow-hidden transition-all duration-300 border-b border-white/[0.03] ${
                  isExpanded 
                    ? 'px-7 justify-start gap-4' 
                    : 'px-0 justify-center group-hover/sidebar:px-7 group-hover/sidebar:justify-start group-hover/sidebar:gap-4'
                }`}>
                  <div 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0 group/logo relative transition-transform duration-500 ${
                      isExpanded ? 'scale-110' : 'group-hover/sidebar:scale-110'
                    }`}
                    style={{ 
                      backgroundColor: 'var(--brand-accent)',
                      boxShadow: `0 8px 16px -4px ${accentColor}40`
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                    <img 
                      src="https://dev-true-lovers-of-god.pantheonsite.io/wp-content/uploads/2026/01/aralinksfront.png" 
                      alt="Logo" 
                      className="w-6 h-6 object-contain relative z-10 group-hover/logo:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <h2 className={`text-white font-bold text-lg tracking-tight leading-none font-poppins transition-all duration-300 whitespace-nowrap ${
                    isExpanded 
                      ? 'opacity-100 w-auto translate-x-0' 
                      : 'opacity-0 w-0 -translate-x-4 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto group-hover/sidebar:translate-x-0 group-hover/sidebar:pointer-events-auto'
                  }`}>
                    Aralinks <span style={{ color: 'var(--brand-accent)' }}>Inventory</span>
                  </h2>
                </div>

                {/* Navigation Section */}
                <div className="flex-grow flex flex-col pt-2 no-scrollbar overflow-x-hidden overflow-y-auto">
                  <div className="flex flex-col gap-1">
                    {/* MAIN SECTION */}
                    <NavCategory label="Main" />
                    <NavItem 
                      icon={<LayoutGrid />} 
                      label="Dashboard" 
                      isActive={activeView === 'dashboard'} 
                      onClick={() => handleNavigate('dashboard')} 
                    />
                    <NavItem 
                      icon={<Box />} 
                      label="Inventory" 
                      isActive={activeView === 'inventory'} 
                      onClick={() => handleNavigate('inventory')} 
                    />
                    <NavItem 
                      icon={<ClipboardList />} 
                      label="Request" 
                      isActive={activeView === 'requests'} 
                      onClick={() => handleNavigate('requests')} 
                    />

                    {/* Standalone School monitoring */}
                    <NavItem
                      icon={<Activity />}
                      label="School monitoring"
                      isActive={activeView === 'school-monitoring'}
                      onClick={() => handleNavigate('school-monitoring')}
                    />

                    {/* TRANSACTION SECTION */}
                    <NavDropdownParent
                      icon={<Shuffle />}
                      label="Transaction"
                      isOpen={isTransactionOpen}
                      onClick={() => setIsTransactionOpen(!isTransactionOpen)}
                    />
                    {isTransactionOpen && (
                      <div className={`pl-6 mt-1 border-l border-white/10 ml-6 font-poppins text-xs ${
                        isExpanded ? 'flex flex-col gap-1' : 'hidden group-hover/sidebar:flex flex-col gap-1'
                      }`}>
                        <NavSubItem label="Warranty" onClick={() => handleComingSoon('Warranty')} isPlaceholder />
                        <NavSubItem 
                          label="Pullout Management" 
                          onClick={() => handleNavigate('pullout')} 
                          isActive={activeView === 'pullout'} 
                        />
                        <NavSubItem 
                          label="Delivery Receipt" 
                          onClick={() => handleNavigate('delivery-receipt')} 
                          isActive={activeView === 'delivery-receipt'} 
                        />
                        <NavSubItem 
                          label="Fixed Assets" 
                          onClick={() => handleNavigate('fixed-assets')} 
                          isActive={activeView === 'fixed-assets'} 
                        />
                        <NavSubItem label="Borrowing" onClick={() => handleComingSoon('Borrowing')} isPlaceholder />
                      </div>
                    )}

                    {/* MANAGEMENT SECTION */}
                    <NavDropdownParent
                      icon={<Settings />}
                      label="Management"
                      isOpen={isManagementOpen}
                      onClick={() => setIsManagementOpen(!isManagementOpen)}
                      isActive={['equipment', 'bundle', 'school', 'location'].includes(activeView)}
                    />
                    {isManagementOpen && (
                      <div className={`pl-6 mt-1 border-l border-white/10 ml-6 ${
                        isExpanded ? 'flex flex-col gap-1' : 'hidden group-hover/sidebar:flex flex-col gap-1'
                      }`}>
                        <NavSubItem 
                          label="Equipment" 
                          onClick={() => handleNavigate('equipment')} 
                          isActive={activeView === 'equipment'} 
                        />
                        <NavSubItem 
                          label="Bundles" 
                          onClick={() => handleNavigate('bundle')} 
                          isActive={activeView === 'bundle'} 
                        />
                        <NavSubItem 
                          label="Schools" 
                          onClick={() => handleNavigate('school')} 
                          isActive={activeView === 'school'} 
                        />
                        <NavSubItem 
                          label="Location / Suppliers" 
                          onClick={() => handleNavigate('location')} 
                          isActive={activeView === 'location'} 
                        />
                      </div>
                    )}

                    {/* SYSTEM SECTION */}
                    <NavCategory label="System" />
                    {userRole === 'Super admin' && (
                      <NavItem 
                        icon={<UsersIcon />} 
                        label="Users" 
                        isActive={activeView === 'users'} 
                        onClick={() => handleNavigate('users')} 
                      />
                    )}
                  </div>
                </div>

                {/* User Info / Logout Section */}
                <div className="px-4 py-6 border-t border-white/5 shrink-0 bg-black/20">
                  <div className={`flex items-center w-full p-2 rounded-xl transition-all duration-300 relative group/profile ${
                    isExpanded 
                      ? 'justify-start gap-3 bg-white/[0.04] cursor-pointer' 
                      : 'justify-center group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:bg-white/[0.04] group-hover/sidebar:cursor-pointer'
                  }`}>
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg border border-white/5 shrink-0 group-hover/profile:scale-105 transition-transform relative overflow-hidden"
                      style={{ 
                        backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)',
                        color: 'var(--brand-accent)'
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                      <span className="relative z-10">{userInitials}</span>
                    </div>
                    <div className={`flex flex-col min-w-0 flex-1 transition-all duration-300 ${
                      isExpanded 
                        ? 'opacity-100 w-auto font-medium ml-3' 
                        : 'opacity-0 w-0 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto group-hover/sidebar:pointer-events-auto group-hover/sidebar:ml-3'
                    }`}>
                      <p className="text-[13px] font-semibold text-white truncate leading-tight flex flex-row items-center gap-1">
                        {fullUserName}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">{userRole || 'ADMIN'}</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className={`ml-auto p-2 text-slate-500 hover:text-red-400 transition-all hover:bg-red-500/10 rounded-lg ${
                        isExpanded 
                          ? 'opacity-100 pointer-events-auto' 
                          : 'opacity-0 group-hover/sidebar:opacity-100 pointer-events-none group-hover/sidebar:pointer-events-auto'
                      }`}
                      title="Logout"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                </div>
              </aside>
            </SidebarContext.Provider>

            {/* 
              MAIN CONTENT AREA
            */}
            <div className="flex-grow flex flex-col min-w-0 h-full overflow-hidden relative">
              {/* MOBILE TOP BAR */}
              <nav className="w-full h-[64px] px-4 flex lg:hidden items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-[50]">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-slate-600 dark:text-slate-400 transition-colors"
                    style={{ '--hover-color': 'var(--brand-accent)' } as any}
                  >
                    <LayoutGrid size={22} />
                  </button>
                  <h2 className="font-bold text-lg lg:text-xl tracking-tight font-poppins" style={{ color: '#FFFFFF' }}>Aralinks <span style={{ color: 'var(--brand-accent)' }}>Inventory</span></h2>
                </div>
                <div className="flex items-center gap-3">
                   <button title="Notifications" className="w-9 h-9 text-slate-400 transition-colors" style={{ '--hover-color': 'var(--brand-accent)' } as any}>
                    <Bell size={20} />
                  </button>
                  <div 
                    className="w-8 h-8 text-white rounded-lg flex items-center justify-center font-bold text-[10px]"
                    style={{ backgroundColor: 'var(--brand-accent)' }}
                  >
                    {userInitials}
                  </div>
                </div>
              </nav>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[150] lg:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 shadow-2xl z-[160] lg:hidden animate-in slide-in-from-left duration-300 flex flex-col">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg overflow-hidden border-2 border-white"
                        style={{ backgroundColor: 'var(--brand-accent)' }}
                      >
                        <img 
                          src="https://dev-true-lovers-of-god.pantheonsite.io/wp-content/uploads/2026/01/aralinksfront.png" 
                          alt="Logo" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h2 className="text-slate-800 dark:text-white font-black text-lg tracking-tighter leading-none font-poppins">{toTitleCase('Aralinks')} <span style={{ color: 'var(--brand-accent)' }}>Inventory</span></h2>
                    </div>
                    <button 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      className="text-slate-400"
                      style={{ '--hover-color': 'var(--brand-accent)' } as any}
                    >
                      <LogOut size={20} className="rotate-180" />
                    </button>
                  </div>
                  <div className="flex-grow p-4 flex flex-col gap-1 overflow-y-auto">
                    {navItems.filter(item => item.id !== 'users' || userRole === 'Super admin').map((item) => (
                      <div key={item.label}>
                        {item.children ? (
                          <div className="flex flex-col gap-1">
                            <div className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                              {toTitleCase(item.label)}
                            </div>
                            {item.children.map((child) => (
                              <button
                                key={child.id + child.label}
                                onClick={() => {
                                  if (child.isPlaceholder) {
                                    handleComingSoon(child.label);
                                  } else {
                                    handleNavigate(child.id);
                                    setIsMobileMenuOpen(false);
                                  }
                                }}
                                className={`flex items-center justify-between w-full px-6 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                                  activeView === child.id
                                     ? '' 
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                                style={activeView === child.id
                                  ? { backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' } 
                                  : {}
                                }
                              >
                                <div className="flex items-center gap-4">
                                  {child.icon}
                                  {toTitleCase(child.label)}
                                </div>
                                {child.isPlaceholder && (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-black tracking-wider uppercase scale-90">
                                    Soon
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (item.isPlaceholder) {
                                handleComingSoon(item.label);
                              } else {
                                handleNavigate(item.id);
                                setIsMobileMenuOpen(false);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${
                              activeView === item.id
                                ? 'text-white' 
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                            style={activeView === item.id ? { backgroundColor: 'var(--brand-accent)', boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)' } : {}}
                          >
                            <div className="flex items-center gap-4">
                              {item.icon}
                              {toTitleCase(item.label)}
                            </div>
                            {item.isPlaceholder && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider uppercase scale-90 ${activeView === item.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                Soon
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-6">
                      <div 
                        className="w-10 h-10 text-white rounded-full flex items-center justify-center font-black text-xs shadow-md border-2 border-white"
                        style={{ backgroundColor: 'var(--brand-accent)' }}
                      >
                        {userInitials}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white leading-none">{fullUserName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{toTitleCase(userRole || '')}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl font-bold uppercase tracking-widest text-xs"
                    >
                      <LogOut size={16} />
                      {toTitleCase("Logout")}
                    </button>
                  </div>
                </div>
              </>
            )}
            
            {/* 
              MAIN CONTENT
            */}
            <main className="flex-grow p-4 lg:p-8 flex flex-col h-full overflow-hidden">
              <div className="w-full flex-grow overflow-hidden min-h-0 flex flex-col">
                <Outlet />
              </div>
            </main>

            {/* Floating Theme Selector */}
            <div className="fixed bottom-6 right-6 z-[40] group/color-floating">
              {/* Tooltip label */}
              <span className={`
                absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 
                rounded-xl text-[10px] font-black uppercase tracking-[0.15em]
                transition-all duration-300 pointer-events-none whitespace-nowrap
                opacity-0 -translate-x-2 group-hover/color-floating:opacity-100 group-hover/color-floating:translate-x-0
                shadow-xl border backdrop-blur-md
                ${isDarkMode 
                  ? 'bg-slate-900/90 text-slate-100 border-slate-700' 
                  : 'bg-white/90 text-slate-900 border-slate-100'
                }
              `}
              style={{ borderColor: accentColor + '30' }}>
                Accent Color
              </span>

              <button 
                onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-2xl border backdrop-blur-md active:scale-95 group-hover/color-floating:rotate-12 relative ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800' 
                    : 'bg-white/80 border-slate-200'
                }`}
                style={{ borderColor: accentColor + '40' }}
              >
                {/* Subtle recognition icon */}
                <div className="absolute top-2 right-2 opacity-20 group-hover/color-floating:opacity-100 transition-opacity duration-300">
                  <Palette size={10} style={{ color: accentColor }} />
                </div>

                <div 
                  className="w-4 h-4 rounded-full ring-2 ring-white/20 shadow-lg relative" 
                  style={{ backgroundColor: accentColor }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/30 to-transparent pointer-events-none" />
                </div>
              </button>
                
              {isColorMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsColorMenuOpen(false)} />
                  <div className="absolute bottom-full right-0 mb-4 p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 z-[200] w-[240px] animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Appearance</p>
                      <button 
                        onClick={toggleDarkMode}
                        className="p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400"
                        title={isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
                      >
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {rainbowColors.map((color) => {
                        const isWhite = color.hex.toLowerCase() === '#ffffff';
                        const isSelected = accentColor.toLowerCase() === color.hex.toLowerCase();
                        return (
                          <button
                            key={color.hex}
                            onClick={() => handleAccentColorChange(color.hex)}
                            className={`
                              w-full aspect-square rounded-full transition-all duration-300 relative group/swatch flex items-center justify-center
                              hover:scale-110 active:scale-95 shadow-sm cursor-pointer
                              ${isSelected ? 'ring-4' : 'hover:ring-4 ring-slate-100 dark:ring-white/10'}
                            `}
                            style={{ 
                              backgroundColor: color.hex,
                              ringColor: isSelected ? color.hex + '60' : 'transparent',
                              border: isWhite ? '1px solid #e2e8f0' : 'none'
                            }}
                          >
                            {isSelected && <Check size={14} className={isWhite ? 'text-slate-900' : 'text-white'} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    }>
        <Route index element={<Features onNavigate={handleNavigate} userName={fullUserName || 'User'} isDarkMode={isDarkMode} />} />
        <Route path="dashboard" element={<Features onNavigate={handleNavigate} userName={fullUserName || 'User'} isDarkMode={isDarkMode} />} />
        <Route path="requests" element={
          <ItemsRequest 
            onNavigate={handleNavigate} 
            highlightedId={highlightedRequestId || undefined} 
            initialStatus={activeRequestStatus} 
            openNewRequest={shouldOpenNewRequest}
            openPoModal={shouldOpenPoModal}
            isDarkMode={isDarkMode} 
            prefillItem={prefillData.item}
            prefillCode={prefillData.code}
            userRole={userRole}
          />
        } />
        <Route path="requests/:requestId/serial-entry" element={<SerialNumberEntryPage />} />
        <Route path="purchase-orders" element={<PurchaseOrders isDarkMode={isDarkMode} userRole={userRole} onNavigate={handleNavigate} />} />
        <Route path="inventory" element={
          <Inventory 
            onNavigate={handleNavigate} 
            initialView={activeInventoryTab} 
            autoOpenTransfer={shouldOpenTransferModal} 
            isDarkMode={isDarkMode} 
            userRole={userRole}
          />
        } />
        <Route path="catalog" element={<Catalog initialTab="equipment" isDarkMode={isDarkMode} userRole={userRole} currentUsername={currentUser} />} />
        <Route path="equipment" element={<Catalog initialTab="equipment" isDarkMode={isDarkMode} userRole={userRole} currentUsername={currentUser} />} />
        <Route path="bundles" element={<Catalog initialTab="bundle" isDarkMode={isDarkMode} userRole={userRole} currentUsername={currentUser} />} />
        <Route path="school" element={<Catalog initialTab="school" isDarkMode={isDarkMode} userRole={userRole} currentUsername={currentUser} />} />
        <Route path="location" element={<Catalog initialTab="location" isDarkMode={isDarkMode} userRole={userRole} currentUsername={currentUser} />} />
        <Route path="tracking" element={<Tracking isDarkMode={isDarkMode} />} />
        <Route path="school-monitoring" element={<SchoolMonitoring isDarkMode={isDarkMode} />} />
        <Route path="pullout" element={<PulloutManagement isDarkMode={isDarkMode} />} />
        <Route path="pullout/create" element={<CreatePulloutPage isDarkMode={isDarkMode} />} />
        <Route path="pullout/edit/:pulloutId" element={<CreatePulloutPage isDarkMode={isDarkMode} />} />
        <Route path="delivery-receipt" element={<DeliveryReceiptManagement isDarkMode={isDarkMode} />} />
        <Route path="delivery-receipt/create" element={<CreateDeliveryReceiptPage isDarkMode={isDarkMode} />} />
        <Route path="delivery-receipt/edit/:drId" element={<CreateDeliveryReceiptPage isDarkMode={isDarkMode} />} />
        <Route path="fixed-assets" element={<AcknowledgementReceiptManagement isDarkMode={isDarkMode} />} />
        <Route path="archived" element={<Archived isDarkMode={isDarkMode} />} />
        <Route path="users" element={<Users isDarkMode={isDarkMode} userRole={userRole} />} />
        <Route path="verified-transfer" element={
          <VerifiedTransferPage 
            onNavigate={handleNavigate} 
            initialFromLocation={prefillFromLocation}
            initialToLocation={prefillToLocation}
            isDarkMode={isDarkMode}
          />
        } />
        <Route path="reports" element={
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)' }}
            >
              <FileText size={40} style={{ color: 'var(--brand-accent)' }} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reports Module</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
              The comprehensive reporting and analytics module is currently under development. 
              Check back soon for detailed insights and data visualizations.
            </p>
          </div>
        } />
      </Route>
    </Routes>
  );
};

export default App;
