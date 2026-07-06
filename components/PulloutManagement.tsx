import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  ArrowUpRight, 
  Building2, 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  X, 
  Filter, 
  ChevronDown, 
  Eye, 
  AlertTriangle, 
  Activity,
  Trash2,
  Lock,
  Box,
  FileCheck,
  RefreshCw,
  Notebook,
  Printer,
  PenTool
} from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import PageHeader from './PageHeader';
import { useNotification } from './NotificationProvider';

interface PulloutItem {
  name: string;
  qty: number;
  category: string;
}

interface PulloutRequest {
  id: string; // Pullout No.
  schoolName: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled';
  totalItems: number;
  items: PulloutItem[];
  initiatedBy: string;
  remarks?: string;
}

const SAMPLE_PULLOUT_DATA: PulloutRequest[] = [
  {
    id: 'PL-20260601-0812',
    schoolName: 'Ateneo de Manila University',
    date: '2026-06-01',
    status: 'Pending',
    totalItems: 12,
    initiatedBy: 'John Doe',
    remarks: 'Pullout of defective tablets for servicing.',
    items: [
      { name: 'Aralinks Tablet Book Lite', qty: 10, category: 'Tablets' },
      { name: 'Aralinks Access Point V2', qty: 2, category: 'Networking' }
    ]
  },
  {
    id: 'PL-20260528-0745',
    schoolName: 'De La Salle University',
    date: '2026-05-28',
    status: 'Approved',
    totalItems: 45,
    initiatedBy: 'Jane Smith',
    remarks: 'End of contract retrieval for upgrade.',
    items: [
      { name: 'Aralinks Laptop Pro V3', qty: 40, category: 'Laptops' },
      { name: 'Aralinks Smart Interactive Board 75"', qty: 5, category: 'Displays' }
    ]
  },
  {
    id: 'PL-20260524-0310',
    schoolName: 'University of Santo Tomas',
    date: '2026-05-24',
    status: 'Completed',
    totalItems: 25,
    initiatedBy: 'Robert Johnson',
    remarks: 'Retrieved obsolete networking units.',
    items: [
      { name: 'Aralinks VR Headset G2', qty: 20, category: 'VR Gear' },
      { name: 'Aralinks Tablet Book Lite', qty: 5, category: 'Tablets' }
    ]
  },
  {
    id: 'PL-20260520-0192',
    schoolName: 'Far Eastern University',
    date: '2026-05-20',
    status: 'Cancelled',
    totalItems: 8,
    initiatedBy: 'Sarah Connor',
    remarks: 'Request duplicate. Re-filed under PL-20260528.',
    items: [
      { name: 'Aralinks Smart Interactive Board 75"', qty: 8, category: 'Displays' }
    ]
  },
  {
    id: 'PL-20260515-0043',
    schoolName: 'Mapua University',
    date: '2026-05-15',
    status: 'Completed',
    totalItems: 18,
    initiatedBy: 'Michael Garibaldi',
    remarks: 'Excess demo units pullout request.',
    items: [
      { name: 'Aralinks Laptop Pro V3', qty: 15, category: 'Laptops' },
      { name: 'Aralinks Access Point V2', qty: 3, category: 'Networking' }
    ]
  }
];

interface PulloutManagementProps {
  isDarkMode?: boolean;
}

const PulloutManagement: React.FC<PulloutManagementProps> = ({ isDarkMode = false }) => {
  const navigate = useNavigate();
  const { showInfo, showSuccess } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Completed' | 'Cancelled'>('All');
  const [selectedPullout, setSelectedPullout] = useState<PulloutRequest | null>(null);

  const [pullouts, setPullouts] = useState<PulloutRequest[]>(() => {
    const saved = localStorage.getItem('aralinks_pullout_requests');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing stored pullouts:', e);
      }
    }
    localStorage.setItem('aralinks_pullout_requests', JSON.stringify(SAMPLE_PULLOUT_DATA));
    return SAMPLE_PULLOUT_DATA;
  });

  useEffect(() => {
    const saved = localStorage.getItem('aralinks_pullout_requests');
    if (saved) {
      try {
        setPullouts(JSON.parse(saved));
      } catch (e) {
        console.error('Error syncing dynamic states:', e);
      }
    }
  }, []);

  const statusCounts = useMemo(() => {
    return {
      All: pullouts.length,
      Pending: pullouts.filter(p => p.status === 'Pending').length,
      Approved: pullouts.filter(p => p.status === 'Approved').length,
      Completed: pullouts.filter(p => p.status === 'Completed').length,
      Cancelled: pullouts.filter(p => p.status === 'Cancelled').length
    };
  }, [pullouts]);

  const filteredData = useMemo(() => {
    return pullouts.filter(p => {
      const matchesSearch = 
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.schoolName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [pullouts, searchQuery, statusFilter]);

  const handleCreatePullout = () => {
    navigate('/pullout/create');
  };

  const handleViewDetails = (pullout: PulloutRequest) => {
    setSelectedPullout(pullout);
  };

  const notifyPlaceholder = (actionName: string) => {
    showInfo(
      `${actionName} action triggered`, 
      'Operational actions represent the next phase of this transaction module.'
    );
  };

  const getStatusBadge = (status: PulloutRequest['status']) => {
    switch (status) {
      case 'Completed':
        return {
          label: 'Completed',
          style: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
          icon: <CheckCircle2 size={13} />
        };
      case 'Approved':
        return {
          label: 'Approved',
          style: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
          icon: <FileCheck size={13} />
        };
      case 'Cancelled':
        return {
          label: 'Cancelled',
          style: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
          icon: <X size={13} />
        };
      case 'Pending':
      default:
        return {
          label: 'Pending',
          style: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
          icon: <Clock size={13} />
        };
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric'
    });
  };

  const displayRows = useMemo(() => {
    if (!selectedPullout) return [];
    if (selectedPullout.itemRows && selectedPullout.itemRows.length > 0) {
      return selectedPullout.itemRows.map((r: any) => ({
        qty: r.qty,
        unit: r.unit || 'PCS',
        description: r.description,
        serialNumber: r.serial_number || '------',
        status: r.status || 'Defective Under Warranty',
        remarks: r.remarks || '------'
      }));
    } else if (selectedPullout.items && selectedPullout.items.length > 0) {
      return selectedPullout.items.map((it: any) => ({
        qty: it.qty,
        unit: 'PCS',
        description: it.name,
        serialNumber: '------',
        status: it.category || 'Pending Referral',
        remarks: '------'
      }));
    }
    return [];
  }, [selectedPullout]);

  const signatoriesList = useMemo(() => {
    if (!selectedPullout) return null;
    const sigs = selectedPullout.signatories || {};
    return {
      prepared: sigs.prepared || { name: selectedPullout.initiatedBy || 'Authorized User', date_signed: selectedPullout.date },
      approved: sigs.approved || { name: 'JERALD DELA CRUZ', date_signed: selectedPullout.date },
      checked: sigs.checked || { name: 'JOHN ROBERT PAGALA', date_signed: selectedPullout.date },
      pulled_out: sigs.pulled_out || { name: 'Awaiting Personnel Signature', date_signed: selectedPullout.date },
    };
  }, [selectedPullout]);

  const handlePrintPullout = (pulloutId: string) => {
    showInfo(
      'Print spooler loaded',
      `Preparing high-contrast printer layout margins for active pullout request ${pulloutId}.`
    );
    window.print();
  };

  return (
    <div className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative no-scrollbar">
      {/* Dynamic Header */}
      <div className="mx-2 lg:mx-4 mt-2">
        <PageHeader 
          title="Pullout Management" 
          description="Manage equipment and asset pullout requests" 
          isDarkMode={isDarkMode}
          actions={
            <button
              onClick={handleCreatePullout}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--brand-accent)',
                boxShadow: '0 4px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 60%)'
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Create Pullout
            </button>
          }
        />
      </div>

      {/* Tabs and Searching Bar */}
      <div className="mx-2 lg:mx-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 mt-6">
        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {(['All', 'Pending', 'Approved', 'Completed', 'Cancelled'] as const).map((filter) => {
            const isActive = statusFilter === filter;
            const count = statusCounts[filter];
            
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border shadow-sm active:scale-95 cursor-pointer ${
                  isActive 
                    ? 'text-white' 
                    : isDarkMode 
                      ? 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800' 
                      : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                }`}
                style={{ 
                  backgroundColor: isActive ? 'var(--brand-accent)' : undefined,
                  borderColor: isActive ? 'var(--brand-accent)' : undefined,
                  boxShadow: isActive ? '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)' : undefined
                }}
              >
                <span>{filter}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-normal z-10 transition-all ${
                  isActive 
                    ? 'bg-white/25 text-white' 
                    : isDarkMode 
                      ? 'bg-slate-900 text-slate-400' 
                      : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input and Summary Stats */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative group flex-1 lg:flex-none">
            <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${
              isDarkMode ? 'text-slate-500 group-focus-within:text-brand-orange' : 'text-slate-400 group-focus-within:text-brand-orange'
            }`}>
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Search by pullout no. or school..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-11 pr-4 py-2.5 w-full lg:w-72 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all font-medium text-sm ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-sm border justify-center ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <Box size={16} className="text-brand-orange animate-pulse" />
            <div className="flex flex-col">
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{filteredData.length}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Found Rows</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card Grid structure */}
      <div className={`mx-2 lg:mx-4 rounded-xl shadow-sm overflow-hidden border flex flex-col mb-10 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-100'}`}>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pullout No.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">School Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total Items</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {filteredData.map((pullout, index) => {
                const badge = getStatusBadge(pullout.status);
                return (
                  <tr 
                    key={pullout.id}
                    className={`group transition-all duration-200 border-l-4 border-transparent hover:border-brand-orange ${
                      isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight size={14} className="text-brand-orange" />
                        <span className={`text-sm font-black tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {pullout.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3">
                        <Building2 size={16} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                        <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {pullout.schoolName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-[#0081f1]" />
                        <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {formatDate(pullout.date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-center">
                      <div className="flex justify-center">
                        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full w-fit shadow-sm border transition-all duration-300 group-hover:scale-105 ${badge.style}`}>
                          {badge.icon}
                          <span className="text-[9px] font-black tracking-widest uppercase">{badge.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-right">
                      <span className={`text-base font-black pr-2 ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                        {pullout.totalItems}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(pullout)}
                          className={`p-2 rounded-lg border transition-all hover:scale-110 cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-brand-orange hover:bg-slate-800' 
                              : 'bg-white border-slate-100 text-slate-600 hover:text-brand-orange hover:bg-slate-50'
                          }`}
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/pullout/edit/${pullout.id}`)}
                          className={`p-2 rounded-lg border transition-all hover:scale-110 cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-blue-400 hover:bg-slate-800' 
                              : 'bg-white border-slate-100 text-slate-600 hover:text-blue-500 hover:bg-slate-50'
                          }`}
                          title="Edit Pullout Request"
                        >
                          <Notebook size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className={`p-16 flex flex-col items-center justify-center text-center ${isDarkMode ? 'opacity-15' : 'opacity-25'}`}>
              <Activity size={80} strokeWidth={1} className="text-brand-orange mb-4" />
              <p className="text-base font-black tracking-[0.4em] uppercase">No Pullout Requests Listed</p>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 max-w-sm">No requests match your current search queries or status filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pullout Details Slideover Modal */}
      <AnimatePresence>
        {selectedPullout && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedPullout(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[1000] print:hidden"
            />

            {/* Centered Modal Container */}
            <div className="fixed inset-0 z-[1001] flex items-center justify-center p-2 sm:p-4 md:p-6 print:relative print:p-0 overflow-y-auto">
              <style>{`
                @media print {
                  aside, nav, header, .print\\:hidden, [class*="sidebar"], [class*="navbar"] {
                    display: none !important;
                  }
                  body {
                    background-color: white !important;
                    color: black !important;
                  }
                }
              `}</style>
              
              {/* Centered Modal Dialog */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className={`w-full max-w-4xl max-h-[92vh] print:max-h-none shadow-2xl rounded-2xl flex flex-col border font-sans print:w-full print:border-none print:shadow-none print:p-0 print:relative ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
                }`}
              >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 print:hidden">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-[9px] font-black uppercase text-brand-orange tracking-widest font-mono">
                    PHOENIX PUBLIC HOUSE PULLOUT PREVIEW
                  </span>
                  <div className="flex items-center gap-2">
                    <FileCheck size={18} className="text-brand-orange" />
                    <h3 className="text-lg font-black tracking-normal leading-tight">
                      {selectedPullout.id}
                    </h3>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedPullout(null)}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-white' : 'bg-slate-50 border-slate-205 text-slate-505 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                  title="Close panel"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Receipt Form Sheet Body */}
              <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-slate-100 dark:bg-slate-950 custom-scrollbar print:p-0 print:bg-white space-y-4">
                
                {/* Paper sheet */}
                <div className="border border-slate-200 dark:border-slate-800 bg-white text-zinc-900 p-6 md:p-8 shadow-md rounded-2xl relative select-none print:shadow-none print:border-none print:p-0 max-w-3xl mx-auto font-sans">
                  
                  {/* Header Branded Logo Section */}
                  <div className="flex items-center justify-center mb-1 pb-1">
                    <img 
                      src="https://www.phoenix.com.ph/wp-content/uploads/2026/06/Screenshot-2026-06-04-093703.png"
                      alt="Phoenix Publishing House Logo Header"
                      className="w-full object-contain max-h-[85px]"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Document Title & Top Date Box */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2.5">
                    <div className="w-full sm:w-1/4" />
                    <div className="w-full sm:w-2/4 text-center">
                      <h2 className="text-[14px] font-black tracking-widest text-zinc-900 uppercase font-sans">
                        PULLOUT AUTHORIZATION
                      </h2>
                    </div>

                    {/* Box container for Date and Pullout No. */}
                    <div className="w-full sm:w-1/4 flex justify-center sm:justify-end">
                      <div className="border border-zinc-500 rounded-sm overflow-hidden shrink-0 text-center text-[10px] w-[165px] leading-tight bg-white">
                        <div className="border-b border-zinc-500 p-1 flex items-center justify-between px-2 bg-zinc-50">
                           <span className="font-bold text-zinc-500 uppercase">Date:</span>
                           <span className="font-mono font-bold text-zinc-805">
                             {selectedPullout.date ? formatDate(selectedPullout.date) : '--/--/----'}
                           </span>
                        </div>
                        <div className="p-1 flex items-center justify-between px-2 bg-zinc-100/50">
                           <span className="font-bold text-zinc-500 uppercase">PL No.</span>
                           <span className="font-mono font-bold text-zinc-909 tracking-wider">
                             {selectedPullout.id}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Information Field Grid */}
                  <div className="grid grid-cols-12 gap-y-2 text-[10px] text-left mt-4 pb-4 border-b border-zinc-300">
                     
                     <div className="col-span-12 sm:col-span-7 flex items-end pr-0 sm:pr-4">
                       <span className="w-24 shrink-0 font-bold text-zinc-700">Pullout from</span>
                       <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                       <span className="font-black text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1 font-sans">
                         {selectedPullout.schoolName}
                       </span>
                     </div>
                     <div className="col-span-12 sm:col-span-5 flex items-end">
                       <span className="w-20 shrink-0 font-bold text-zinc-700">Client Code</span>
                       <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                       <span className="font-mono font-bold text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                         {selectedPullout.customerCode || 'C00000010'}
                       </span>
                     </div>

                     <div className="col-span-12 sm:col-span-7 flex items-end pr-0 sm:pr-4">
                       <span className="w-24 shrink-0 font-bold text-zinc-700">Address</span>
                       <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                       <span className="font-medium text-zinc-805 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1">
                         {selectedPullout.address || 'Katipunan Ave, Quezon City, 1108 Metro Manila'}
                       </span>
                     </div>
                     <div className="col-span-12 sm:col-span-5 flex items-end">
                       <span className="w-20 shrink-0 font-bold text-zinc-700">Agent</span>
                       <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                       <span className="font-semibold text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                         {selectedPullout.agent || 'Team Phoenix'}
                       </span>
                     </div>

                     <div className="col-span-12 sm:col-span-7 flex items-end pr-0 sm:pr-4">
                       <span className="w-24 shrink-0 font-bold text-zinc-700">Contact Person</span>
                       <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                       <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                         {selectedPullout.contactPerson || '__________________________________________'}
                       </span>
                     </div>
                     <div className="col-span-12 sm:col-span-5 flex items-end">
                       <span className="w-20 shrink-0 font-bold text-zinc-700">Project / Prog</span>
                       <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                       <span className="font-bold text-zinc-950 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                         {selectedPullout.project || 'ACE'}
                       </span>
                     </div>

                     <div className="col-span-12 sm:col-span-7 flex items-end pr-0 sm:pr-4">
                       <span className="w-24 shrink-0 font-bold text-zinc-700">Contact No.</span>
                       <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                       <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                         {selectedPullout.contactNo || '__________________________________________'}
                       </span>
                     </div>
                     <div className="col-span-12 sm:col-span-5 flex items-end">
                       <span className="w-20 shrink-0 font-bold text-zinc-700">School Year</span>
                       <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                       <span className="font-semibold text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                         {selectedPullout.schoolYear || '2026-2027'}
                       </span>
                     </div>

                     {selectedPullout.ticketNo && (
                       <div className="col-span-12 sm:col-span-12 flex items-end">
                         <span className="w-24 shrink-0 font-bold text-zinc-700">Ticket No.</span>
                         <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                         <span className="font-mono font-bold text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                           {selectedPullout.ticketNo}
                         </span>
                       </div>
                     )}
                  </div>

                  {/* ITEMS TABLE */}
                  <div className="mt-4 text-[9.5px] text-left overflow-x-auto">
                    <table className="w-full border-collapse border border-zinc-400 min-w-[500px]">
                      <thead>
                        <tr className="bg-zinc-100 text-[8.5px] font-black uppercase text-zinc-650 border-b border-zinc-400">
                          <th className="border-r border-zinc-400 px-2.5 py-1.5 text-center w-14">Quantity</th>
                          <th className="border-r border-zinc-400 px-2.5 py-1.5 text-center w-14">Unit</th>
                          <th className="border-r border-zinc-400 px-3 py-1.5 text-left w-2/5">Description</th>
                          <th className="border-r border-zinc-400 px-3 py-1.5 text-left w-1/4">Serial Number</th>
                          <th className="border-r border-zinc-400 px-3 py-1.5 text-left w-1/4">Status / Category</th>
                          <th className="px-3 py-1.5 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="text-[9.5px]">
                        {displayRows.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b border-zinc-200 transition-all">
                            <td className="border-r border-zinc-300 px-2.5 py-1 text-center font-bold font-mono text-zinc-800">
                              {row.qty}
                            </td>
                            <td className="border-r border-zinc-300 px-2.5 py-1 text-center text-zinc-500 font-sans">{row.unit}</td>
                            <td className="border-r border-zinc-300 px-3 py-1 font-black text-zinc-900 truncate" title={row.description}>
                              {row.description || '------'}
                            </td>
                            <td className="border-r border-zinc-300 px-3 py-1 font-mono text-[9px] text-zinc-500 truncate" title={row.serialNumber}>{row.serialNumber}</td>
                            <td className="border-r border-zinc-300 px-3 py-1 text-zinc-650 truncate" title={row.status}>{row.status}</td>
                            <td className="px-3 py-1 text-zinc-650 truncate" title={row.remarks}>{row.remarks}</td>
                          </tr>
                        ))}
                        {/* Fill empty lines up to 6 rows */}
                        {Array.from({ length: Math.max(0, 6 - displayRows.length) }).map((_, i) => (
                          <tr key={`empty-pl-${i}`} className="h-[21px] border-b border-zinc-200">
                            <td className="border-r border-zinc-400"></td>
                            <td className="border-r border-zinc-400"></td>
                            <td className="border-r border-zinc-400"></td>
                            <td className="border-r border-zinc-400"></td>
                            <td className="border-r border-zinc-400"></td>
                            <td></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Document Remarks */}
                  {selectedPullout.remarks && (
                    <div className="mt-3.5 p-2 rounded border border-zinc-200 text-left text-[8.5px] leading-relaxed text-zinc-500 font-sans">
                      <span className="font-extrabold text-[#FF6A00] uppercase block mb-0.5">Remarks / Request Purpose:</span>
                      {selectedPullout.remarks}
                    </div>
                  )}

                  {/* SIGNATURE FIELDS AT THE BOTTOM */}
                  {signatoriesList && (
                    <div className="mt-6 pt-4 border-t border-zinc-300 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-5 text-left leading-snug text-[10px]">
                      
                      {/* Prepared by */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-600 block">Prepared by / Date:</span>
                        </div>
                        <div className="h-14 border border-dashed border-zinc-200 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                          {signatoriesList.prepared.signature_image ? (
                            <img src={signatoriesList.prepared.signature_image} alt="Prepared Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                          ) : (
                            <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                              <PenTool size={10} className="text-zinc-400" />
                              <span className="text-[7.5px] font-bold uppercase">SIGNED ELECTRONICALLY</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none">
                            {signatoriesList.prepared.name}
                          </span>
                          <span className="text-[8px] text-zinc-404 font-bold uppercase tracking-wider mt-1 block">Prepared By</span>
                        </div>
                      </div>

                      {/* Checked by */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-600 block">Checked by / Date:</span>
                        </div>
                        <div className="h-14 border border-dashed border-zinc-200 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                          {signatoriesList.checked.signature_image ? (
                            <img src={signatoriesList.checked.signature_image} alt="Checked Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                          ) : (
                            <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                              <PenTool size={10} className="text-zinc-405" />
                              <span className="text-[7.5px] font-bold uppercase">SIGNED ELECTRONICALLY</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none">
                            {signatoriesList.checked.name}
                          </span>
                          <span className="text-[8px] text-zinc-405 font-bold uppercase tracking-wider mt-1 block">Checked By</span>
                        </div>
                      </div>

                      {/* Approved by */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-600 block">Approved by / Date:</span>
                        </div>
                        <div className="h-14 border border-dashed border-zinc-200 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                          {signatoriesList.approved.signature_image ? (
                            <img src={signatoriesList.approved.signature_image} alt="Approved Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                          ) : (
                            <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                              <PenTool size={10} className="text-zinc-405" />
                              <span className="text-[7.5px] font-bold uppercase">SIGNED ELECTRONICALLY</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none">
                            {signatoriesList.approved.name}
                          </span>
                          <span className="text-[8px] text-zinc-405 font-bold uppercase tracking-wider mt-1 block">Approved By</span>
                        </div>
                      </div>

                      {/* Pulled out by */}
                      <div className="space-y-1.5 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-zinc-650 block">Pulled Out By / Date:</span>
                        </div>
                        <div className="h-14 border border-dashed border-zinc-205 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                          {signatoriesList.pulled_out.signature_image ? (
                            <img src={signatoriesList.pulled_out.signature_image} alt="Pulled Out Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                          ) : (
                            <span className="text-zinc-400 text-[8px] uppercase font-bold">{signatoriesList.pulled_out.name}</span>
                          )}
                        </div>
                        <div className="text-center font-sans">
                          <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none text-brand-orange">
                            {signatoriesList.pulled_out.name}
                          </span>
                          <span className="text-[8px] text-zinc-405 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </div>

              {/* Action footer */}
              <div className={`p-4 border-t flex items-center justify-between gap-3 shrink-0 print:hidden ${
                isDarkMode ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-150'
              }`}>
                <button
                  onClick={() => setSelectedPullout(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Close Detail
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handlePrintPullout(selectedPullout.id)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0081f1] hover:bg-blue-600 text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer text-left font-sans"
                  >
                    <Printer size={14} />
                    Print
                  </button>

                  <button
                    onClick={() => notifyPlaceholder('Authorize Pullout')}
                    disabled={selectedPullout.status === 'Cancelled' || selectedPullout.status === 'Completed'}
                    className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none`}
                    style={{
                      backgroundColor: 'var(--brand-accent)',
                    }}
                  >
                    <FileCheck size={14} />
                    Authorize Pullout
                  </button>
                </div>
              </div>

              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PulloutManagement;
