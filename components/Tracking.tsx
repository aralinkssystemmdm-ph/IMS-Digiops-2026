
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, MapPin, Box, ArrowUp, Loader2, Filter, ChevronDown, Clock, Package, Activity, School, CalendarDays, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';

interface TrackingItem {
  id: string;
  date: string;
  requestNo: string;
  schoolName: string;
  itemName: string;
  requestedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  status: string;
  updatedBy: string;
  updatedAt: string;
}

interface TrackingProps {
  isDarkMode?: boolean;
}

const Tracking: React.FC<TrackingProps> = ({ isDarkMode = false }) => {
  const [trackingData, setTrackingData] = useState<TrackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const filterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollTop(containerRef.current.scrollTop > 300);
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const fetchTrackingData = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);

    try {
      // Note: This assumes the view 'view_item_tracking' has been created in Supabase
      const { data, error } = await supabase
        .from('view_item_tracking')
        .select('*')
        .order('last_updated_date', { ascending: false });

      if (error) throw error;
      
      if (data) {
        const mappedData: TrackingItem[] = data.map((row: any) => {
          const requested = Number(row.requested_quantity) || 0;
          const delivered = Number(row.delivered_quantity) || 0;
          const remaining = Math.max(0, requested - delivered);
          
          // Dynamic Status Calculation
          let status = row.status || 'Pending';
          if (delivered > 0 && delivered < requested) {
            status = 'Partially Delivered';
          } else if (delivered >= requested && requested > 0) {
            status = 'Completed';
          } else if (delivered === 0 && status !== 'Approved') {
            status = 'Pending';
          }

          return {
            id: row.id,
            date: row.created_at || row.date || row.last_updated_date,
            requestNo: row.control_no || row.request_control_no || 'N/A',
            schoolName: row.school_name,
            itemName: row.item_name,
            requestedQuantity: requested,
            deliveredQuantity: delivered,
            remainingQuantity: remaining,
            status: status,
            updatedBy: row.updated_by || row.requested_by || 'System',
            updatedAt: row.updated_at || row.created_at || row.last_updated_date
          };
        });
        setTrackingData(mappedData);
      }
    } catch (err) {
      console.error('Error fetching tracking data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrackingData(true);

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('tracking-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'request_items' },
          () => fetchTrackingData(false)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'item_requests' },
          () => fetchTrackingData(false)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchTrackingData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [sortConfig, setSortConfig] = useState<{ key: keyof TrackingItem; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });

  const statusOptions = ['All Statuses', 'Pending', 'Approved', 'Partially Delivered', 'Completed'];

  const counts = useMemo(() => {
    return {
      'All Statuses': trackingData.length,
      'Pending': trackingData.filter(item => item.status === 'Pending').length,
      'Approved': trackingData.filter(item => item.status === 'Approved').length,
      'Partially Delivered': trackingData.filter(item => item.status === 'Partially Delivered').length,
      'Completed': trackingData.filter(item => item.status === 'Completed').length,
    };
  }, [trackingData]);

  const filteredData = useMemo(() => {
    let result = trackingData.filter(item => {
      const matchesSearch = 
        item.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requestNo.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All Statuses' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [trackingData, searchQuery, statusFilter, sortConfig]);

  const handleSort = (key: keyof TrackingItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'delivered') return {
      label: 'Completed',
      style: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      icon: <CheckCircle2 size={14} />
    };
    if (s === 'partially delivered') return {
      label: 'Partial',
      style: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
      icon: <Activity size={14} />
    };
    if (s === 'approved') return {
      label: 'Approved',
      style: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
      icon: <CheckCircle2 size={14} />
    };
    return {
      label: 'Pending',
      style: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      icon: <Clock size={14} />
    };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric'
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative group flex-1 lg:flex-none">
            <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-brand-orange' : 'text-slate-400 group-focus-within:text-brand-orange'}`}>
              <Search size={18} className="group-hover:scale-110 transition-transform" />
            </div>
            <input 
              type="text" 
              placeholder="Search school or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-11 pr-4 py-2.5 w-full lg:w-80 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all font-medium text-sm ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>

          <div className="relative flex-1 lg:flex-none" ref={filterRef}>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`w-full px-4 py-2.5 rounded-lg border transition-all flex items-center justify-between lg:justify-start gap-3 text-xs font-bold uppercase tracking-wider ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-brand-orange" />
                {statusFilter === 'All Statuses' ? 'STATUS: ALL' : `STATUS: ${statusFilter.toUpperCase()}`}
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isFilterOpen && (
              <div className={`absolute top-full left-0 mt-2 w-full sm:w-64 rounded-lg shadow-xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 border ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}>
                {statusOptions.map((status) => {
                  const isActive = statusFilter === status;
                  let dotColor = 'bg-slate-400';
                  let textColor = isDarkMode ? 'text-slate-400' : 'text-slate-500';
                  let activeBg = isDarkMode ? 'bg-white/5' : 'bg-slate-50';
                  
                  if (status === 'Pending') dotColor = 'bg-amber-500';
                  if (status === 'Approved') dotColor = 'bg-blue-500';
                  if (status === 'Partially Delivered') dotColor = 'bg-orange-500';
                  if (status === 'Completed') dotColor = 'bg-emerald-500';
                  if (status === 'All Statuses') dotColor = 'bg-brand-orange';

                    return (
                      <button 
                        key={status}
                        onClick={() => { setStatusFilter(status); setIsFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-3 group
                          ${isActive ? `${activeBg} ${isDarkMode ? 'text-white' : 'text-slate-900'}` : `${textColor} hover:bg-white/5 hover:text-brand-orange`}
                        `}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125 ${dotColor} ${isActive ? 'ring-4 ring-current/20' : ''}`} />
                        <span className="flex-grow">{status}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${
                          isActive
                            ? 'bg-brand-orange text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {counts[status as keyof typeof counts]}
                        </span>
                        {isActive && <div className="ml-2 w-1.5 h-1.5 rounded-full bg-brand-orange" />}
                      </button>
                    );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
           <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-sm border w-full lg:w-auto justify-center ${
             isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
           }`}>
              <Package size={18} className="text-brand-orange" />
              <div className="flex flex-col">
                 <span className={`text-sm font-bold leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{filteredData.length}</span>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Tracks</span>
              </div>
           </div>
        </div>
      </div>

      <div className={`rounded-lg shadow-sm overflow-hidden border flex flex-col mb-10 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {loading ? (
          <div className="flex-grow flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-brand-orange" size={40} />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Tracks...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className={`${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <th 
                    className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-brand-orange transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Request No</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">School</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Item</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Requested</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Delivered</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Remaining</th>
                  <th 
                    className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center cursor-pointer hover:text-brand-orange transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Status
                      {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Updated By</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {filteredData.map((item, i) => {
                  const badge = getStatusBadge(item.status);
                  
                  return (
                    <tr 
                      key={item.id} 
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={`group animate-ease-in-down transition-all duration-200 border-l-4 border-transparent hover:border-brand-orange hover:-translate-y-[2px] hover:shadow-lg ${
                        isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-[#0081f1]" />
                          <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{formatDate(item.date)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 md:py-4">
                        <span className={`text-sm font-black tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.requestNo}</span>
                      </td>
                      <td className="px-6 py-3 md:py-4">
                        <div className="flex items-center gap-3">
                          <School size={16} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                          <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.schoolName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 md:py-4">
                        <div className="flex items-center gap-3">
                          <Box size={16} className="text-brand-orange" />
                          <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.itemName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 md:py-4 text-right">
                        <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.requestedQuantity}</span>
                      </td>
                      <td className="px-6 py-3 md:py-4 text-right">
                        <span className={`text-base font-bold text-emerald-500`}>{item.deliveredQuantity}</span>
                      </td>
                      <td className="px-6 py-3 md:py-4 text-right">
                        <span className={`text-base font-bold ${item.remainingQuantity > 0 ? 'text-orange-500' : 'text-slate-400'}`}>{item.remainingQuantity}</span>
                      </td>
                      <td className="px-6 py-3 md:py-4">
                        <div className="flex justify-center">
                          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full w-fit shadow-sm border transition-all duration-300 group-hover:scale-110 ${badge.style}`}>
                             {badge.icon}
                             <span className="text-[10px] font-bold tracking-widest">{badge.label}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 md:py-4 text-center">
                        <div className="relative group/tooltip inline-block">
                          <span className={`text-[11px] font-black uppercase tracking-widest cursor-help ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {item.updatedBy}
                          </span>
                          
                          {/* Tooltip */}
                          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-[110] shadow-xl border ${
                            isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-100 text-slate-600'
                          }`}>
                            Last updated on {formatDate(item.updatedAt)}
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent ${
                              isDarkMode ? 'border-t-slate-900' : 'border-t-white'
                            }`} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredData.length === 0 && !loading && (
              <div className={`flex-grow flex flex-col items-center justify-center py-40 px-6 text-center ${isDarkMode ? 'opacity-10' : 'opacity-20'}`}>
                 <Activity size={120} strokeWidth={1} className={`mb-8 ${isDarkMode ? 'text-white' : ''}`} />
                 <p className={`text-lg font-bold uppercase tracking-[0.5em] ${isDarkMode ? 'text-white' : ''}`}>{toTitleCase('No Tracking Records Found')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-20 z-[60] w-12 h-12 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-3xl hover:bg-brand-orange-hover transition-all hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default Tracking;
