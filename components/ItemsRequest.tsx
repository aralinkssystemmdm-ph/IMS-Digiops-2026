
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Search, Archive, Edit3, Loader2, FileText, Eye, ArrowUp, ArrowDown, CheckSquare, Square, Filter, ChevronDown, ChevronUp, Clock, MapPin, Tag, CheckCircle2, CalendarDays, X, Plus, Check, Calendar, Paperclip, Trash2, Box, History, Printer, ExternalLink, ArrowRightLeft, Notebook, TrendingUp } from 'lucide-react';
import { toTitleCase, cleanPONumber, getBundleColor, getProgramBadgeClass } from '../lib/utils';
import NewRequestModal from './NewRequestModal';
import RequestPreviewModal from './RequestPreviewModal';
import ItemVerificationModal from './ItemVerificationModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';
import PageHeader from './PageHeader';

interface ItemsRequestProps {
  onNavigate?: (viewId: string, params?: any) => void;
  highlightedId?: string;
  initialStatus?: StatusFilterType;
  openNewRequest?: boolean;
  openPoModal?: boolean;
  isDarkMode?: boolean;
  prefillItem?: string;
  prefillCode?: string;
  userRole?: string | null;
}

export interface RequestData {
  id: string; // control_no
  ticketNo?: string;
  schoolName: string;
  bufferSchool?: string;
  requestType: 'ARALINKS' | 'SMS-PROTRACK';
  date: string;
  requestedBy: string;
  archivedBy?: string; 
  archivedAt?: string;
  status: 'Pending' | 'Delivered' | 'Partially Delivered';
  purpose?: string;
  program?: string;
  poNumber?: string | null;
  remarks?: string;
  items?: any[];
  attachment?: string;
  deliveredAt?: string;
  school_monitoring_id?: string | null;
}

interface POEntry {
  id: string;
  poNumber: string;
  supplier?: string;
  itemQuantities: Record<string, number>;
}

type StatusFilterType = 'All' | 'Pending' | 'Partially' | 'Completed';
type ProgramFilterType = 'All' | 'NGS' | 'HUB' | 'TNL' | 'ACE' | 'NGS+ACE' | 'HUB+ACE' | 'PELS NGS' | 'PELS NGS+ACE' | 'ACE+PELS' | 'ABDL' | 'ACE+ABDL' | 'HUB+NGS' | 'ABDL (PELS)';
type DateFilterType = 'All' | 'Today' | 'This Week' | 'This Month' | 'Custom';

interface RequestDetailsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData;
  isDarkMode: boolean;
  onNavigate?: (viewId: string, params?: any) => void;
  onOpenPrint: () => void;
  onUpdateDelivery: () => void;
  userRole?: string | null;
  initialExpandedPoIndex?: number | null;
}

const RequestDetailsSidebar: React.FC<RequestDetailsSidebarProps> = ({ 
  isOpen, 
  onClose, 
  request, 
  isDarkMode,
  onNavigate,
  onOpenPrint,
  onUpdateDelivery,
  userRole = 'Staff',
  initialExpandedPoIndex = null
}) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedTimelineKeys, setExpandedTimelineKeys] = useState<Set<string>>(new Set());

  const groupedTimeline = useMemo(() => {
    const groups: {
      key: string;
      created_at: string;
      poNumbers: string[];
      isCompleted: boolean;
      items: { name: string; qty: number; code: string }[];
    }[] = [];

    history.forEach(tx => {
      const reason = tx.reason || '';
      const poPart = reason.includes('PO:') ? reason.split('PO:')[1].split('|')[0].trim() : cleanPONumber(request.poNumber || '');
      // Separate multiple POs if they are comma separated in one transaction
      const currentPOs = poPart.split(',').map((p: string) => p.trim());
      
      // Batch grouping by created_at and reason
      const key = `${tx.created_at}-${reason}`;
      let group = groups.find(g => g.key === key);
      
      if (!group) {
        group = {
          key,
          created_at: tx.created_at,
          poNumbers: currentPOs,
          isCompleted: false,
          items: []
        };
        groups.push(group);
      }

      group.items.push({
        name: tx.item_name || tx.item_code,
        code: tx.item_code,
        qty: tx.quantity
      });
    });

    // Sort by date ASC
    groups.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Mark the last delivery as completed if the overall request status is Delivered
    if (groups.length > 0 && request.status === 'Delivered') {
      groups[groups.length - 1].isCompleted = true;
    }

    return groups;
  }, [history, request.id, request.status, request.poNumber]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isSupabaseConfigured || !request.id) return;
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('stock_transactions')
          .select('*')
          .eq('reference_id', request.id)
          .eq('transaction_type', 'Delivery')
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // Enrich with descriptions if missing
        if (data && data.length > 0) {
          const itemCodes = Array.from(new Set(data.map(d => d.item_code)));
          const { data: itemsData } = await supabase
            .from('equipment')
            .select('item_code, description')
            .in('item_code', itemCodes);
            
          const enrichedData = data.map(tx => ({
            ...tx,
            item_name: tx.item_name || itemsData?.find(i => i.item_code === tx.item_code)?.description || tx.item_code
          }));
          setHistory(enrichedData);
        } else {
          setHistory(data || []);
        }
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    if (isOpen) {
      fetchHistory();
    }
  }, [request.id, isOpen, request.items]); // Re-fetch when items change or sidebar opens

  const totalItemsCount = useMemo(() => {
    return request.items?.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0) || 0;
  }, [request.items]);

  const deliveredItemsCount = useMemo(() => {
    return request.items?.reduce((sum, item) => sum + (parseInt(item.received_quantity) || 0), 0) || 0;
  }, [request.items]);

  const remainingItemsCount = Math.max(0, totalItemsCount - deliveredItemsCount);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = async () => {
    if (!isSupabaseConfigured || !request.id || isRecalculating) return;
    setIsRecalculating(true);
    try {
      // 1. Fetch all delivery transactions for this request
      const { data: txs, error: txError } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('reference_id', request.id)
        .eq('transaction_type', 'Delivery');
      
      if (txError) throw txError;

      // 2. Sum by item_code
      const counts: Record<string, number> = {};
      txs?.forEach(tx => {
        counts[tx.item_code] = (counts[tx.item_code] || 0) + (parseInt(tx.quantity) || 0);
      });

      // 3. Update each request_item
      for (const item of request.items || []) {
        const actualReceived = counts[item.item_code] || 0;
        if (actualReceived !== (parseInt(item.received_quantity) || 0)) {
          const { error: updError } = await supabase
            .from('request_items')
            .update({ received_quantity: actualReceived })
            .eq('id', item.id);
          if (updError) throw updError;
        }
      }

      // 4. Update overall status
      const totalReq = request.items?.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0) || 0;
      const totalRec = Object.values(counts).reduce((a, b) => a + b, 0);
      const newStatus = totalRec >= totalReq && totalReq > 0 ? 'Delivered' : totalRec > 0 ? 'Partially Delivered' : 'Pending';
      
      if (newStatus !== request.status) {
        await supabase.from('item_requests').update({ status: newStatus }).eq('control_no', request.id);
      }

      // Re-trigger global fetch
      onUpdateDelivery(); // This usually triggers a refresh via VerificationModal's onConfirm approach?
      // Actually onUpdateDelivery opens the modal. We just want to refresh data.
      // So let's use the onNavigate or similar if available, or just rely on realtime.
      
    } catch (err) {
      console.error('Failed to recalculate:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const remainingItems = useMemo(() => {
    return request.items?.filter(item => {
      const requested = parseInt(item.qty) || 0;
      const delivered = parseInt(item.received_quantity) || 0;
      return requested > delivered;
    }).map(item => ({
      name: item.item,
      code: item.item_code,
      requested: parseInt(item.qty) || 0,
      delivered: parseInt(item.received_quantity) || 0,
      remaining: (parseInt(item.qty) || 0) - (parseInt(item.received_quantity) || 0)
    })) || [];
  }, [request.items]);

  // Group items by PO Number from the structured poNumber string
  const [visiblePoBreakdown, setVisiblePoBreakdown] = useState<Record<number, boolean>>({});
  const [visiblePoItems, setVisiblePoItems] = useState<Record<string, boolean>>({});
  const [visiblePoHistory, setVisiblePoHistory] = useState<Record<string, boolean>>({});
  const [showRemainingItems, setShowRemainingItems] = useState(false);

  // Requirement: default hide the dropdown in remaining and all PO
  useEffect(() => {
    if (!isOpen) {
      setVisiblePoBreakdown({});
      setShowRemainingItems(false);
    }
  }, [isOpen]);

  const togglePoBreakdown = (index: number) => {
    setVisiblePoBreakdown(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const poBreakdown = useMemo(() => {
    if (!request.poNumber || !request.items) return [];
    
    // First, extract all quantities from history that are explicitly tagged with a PO
    const taggedReceived: Record<string, Record<string, number>> = {};
    history.forEach(tx => {
      if (tx.reason?.includes('PO:')) {
        const poMatch = tx.reason.match(/PO:([^|]+)/);
        if (poMatch) {
          const poNum = poMatch[1].trim();
          if (!taggedReceived[poNum]) taggedReceived[poNum] = {};
          taggedReceived[poNum][tx.item_code] = (taggedReceived[poNum][tx.item_code] || 0) + (parseInt(tx.quantity) || 0);
        }
      }
    });

    // Create a tracker for "unattributed" received items (legacy or untagged)
    const totalReceived: Record<string, number> = {};
    request.items.forEach(item => {
      totalReceived[item.item_code] = parseInt(item.received_quantity as any) || 0;
    });

    // Subtract tagged from total to see what's left for sequential "fill-in"
    const unattributedTracker: Record<string, number> = { ...totalReceived };
    Object.keys(taggedReceived).forEach(poNum => {
      Object.keys(taggedReceived[poNum]).forEach(code => {
        unattributedTracker[code] = Math.max(0, unattributedTracker[code] - taggedReceived[poNum][code]);
      });
    });

    const parts = request.poNumber.split(';').map(p => p.trim()).filter(Boolean);
    return parts.map(part => {
      // Regex to match: PO_NUMBER [SUPPLIER] {CODE:QTY,...}
      const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
      
      let poNum = '';
      let supplier = '';
      let qtiesRaw = '';

      if (match) {
        if (match[1] !== undefined) {
          poNum = match[1].trim();
          supplier = match[2]?.trim() || '';
          qtiesRaw = match[3].trim();
        } else if (match[4] !== undefined) {
          poNum = match[4].trim();
          supplier = match[5]?.trim() || '';
        } else {
          poNum = match[6].trim();
        }
      } else {
        poNum = part.trim();
      }
      
      const items: { name: string; code: string; requested: number; delivered: number; status: string }[] = [];
      let poTotalReq = 0;
      let poTotalDel = 0;

      if (qtiesRaw) {
        qtiesRaw.split(',').forEach(q => {
          const [code, qty] = q.split(':').map(s => s.trim());
          const reqItem = request.items?.find(i => i.item_code === code);
          if (reqItem) {
            const requested = parseInt(qty) || 0;
            
            // Delivered quantity for THIS PO is strictly based on tagged transactions
            // Sequential fill-in is ONLY a fallback for legacy untagged data
            const taggedAmount = taggedReceived[poNum]?.[code] || 0;
            
            // LOGIC: If an item has explicit tagging in the history, we DO NOT use sequential fallback.
            // This ensures strict PO-specific rendering as requested.
            const hasAnyTaggedForThisItem = Object.values(taggedReceived).some(poGroup => (poGroup[code] || 0) > 0);
            
            let delivered = taggedAmount;
            
            // Only use sequential fill-in if there are NO tagged transactions for this item at all (Legacy Support)
            if (!hasAnyTaggedForThisItem) {
              const remainingToFill = Math.max(0, requested - delivered);
              const fillIn = Math.min(remainingToFill, unattributedTracker[code] || 0);
              delivered += fillIn;
              
              if (unattributedTracker[code] !== undefined) {
                unattributedTracker[code] = Math.max(0, unattributedTracker[code] - fillIn);
              }
            }
            
            const status = delivered >= requested ? 'Complete' : delivered > 0 ? 'Partial' : 'Pending';
            
            items.push({
              name: reqItem.item,
              code: reqItem.item_code,
              requested,
              delivered,
              status
            });
            poTotalReq += requested;
            poTotalDel += delivered;
          }
        });
      }

      // Extract history for this specific PO
      const poHistory = history.filter(tx => {
        if (tx.reason?.includes('PO:')) {
          const poMatch = tx.reason.match(/PO:([^|]+)/);
          return poMatch && poMatch[1].trim() === poNum;
        }
        return false;
      });

      // Group PO history by transaction type/date
      const groupedPoHistory: any[] = [];
      poHistory.forEach(tx => {
        const key = `${tx.created_at}-${tx.reason}`;
        let group = groupedPoHistory.find(g => g.key === key);
        if (!group) {
          group = {
            key,
            created_at: tx.created_at,
            items: []
          };
          groupedPoHistory.push(group);
        }
        group.items.push({
          name: tx.item_name || tx.item_code,
          qty: tx.quantity
        });
      });

      return {
        poNum,
        supplier,
        items,
        history: groupedPoHistory,
        totalReq: poTotalReq,
        totalDel: poTotalDel,
        isDelivered: poTotalDel >= poTotalReq && poTotalReq > 0
      };
    });
  }, [request.poNumber, request.items, history]);

  useEffect(() => {
    if (!isOpen) {
      setVisiblePoBreakdown({});
      setShowRemainingItems(false);
    }
  }, [isOpen]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={`fixed inset-0 m-auto z-[200] w-full max-w-5xl h-fit max-h-[95vh] shadow-2xl flex flex-col overflow-hidden rounded-[2.5rem] border ${
        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#F8FAFC] border-slate-200'
      }`}
    >
      {/* Header */}
      <div className="p-8 pb-4 flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Request Details</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 space-y-8 custom-scrollbar pb-24">
        {/* Info Area */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <h1 className="text-4xl font-black tracking-tighter uppercase" style={{ color: 'var(--brand-accent)' }}>{request.id}</h1>
               <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/10 ${
                 request.status === 'Delivered' ? 'bg-emerald-500 text-white' : 
                 request.status === 'Partially Delivered' ? 'bg-amber-500 text-white' : 
                 'bg-[#2563EB] text-white'
               }`}>
                 {request.status === 'Delivered' ? 'DELIVERED' : request.status === 'Partially Delivered' ? 'PARTIAL' : 'PENDING'}
               </span>
            </div>
            {/* Tally Fix Button */}
            {(deliveredItemsCount !== poBreakdown.reduce((s, p) => s + p.totalDel, 0)) && (
              <button 
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest animate-pulse border border-red-500/20"
              >
                {isRecalculating ? <Loader2 size={12} className="animate-spin" /> : <History size={12} />}
                <span>Fix Tally Discrepancy</span>
              </button>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{request.schoolName}</p>
            {request.bufferSchool && (
              <p className="text-sm font-medium text-slate-500 italic">via {request.bufferSchool}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Program:</span>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                (request.program || 'GENERAL').toUpperCase() === 'ACE' ? 'bg-orange-100 text-orange-600' :
                (request.program || 'GENERAL').toUpperCase() === 'HUB' ? 'bg-blue-100 text-blue-600' :
                'bg-slate-200 text-slate-600'
              }`}>
                {request.program || 'OTHER'}
              </span>
            </div>
            {request.requestType && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type:</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100/50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                  {request.requestType}
                </span>
              </div>
            )}
            {request.ticketNo && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket:</span>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono">#{request.ticketNo}</span>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
         <div className="grid grid-cols-4 gap-2">
           <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Total</span>
                <span className="text-lg font-black text-[#2563EB] leading-none">{totalItemsCount}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-[#2563EB] flex items-center justify-center shrink-0">
                <Box size={14} />
              </div>
           </div>
           <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Del.</span>
                <span className="text-lg font-black text-emerald-500 leading-none">{deliveredItemsCount}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center shrink-0">
                <Check size={14} />
              </div>
           </div>
           <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Rem.</span>
                <span className="text-lg font-black leading-none" style={{ color: 'var(--brand-accent)' }}>{remainingItemsCount}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0" style={{ color: 'var(--brand-accent)' }}>
                <Clock size={14} />
              </div>
           </div>
           <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Comp. %</span>
                <span className={`text-lg font-black leading-none ${deliveredItemsCount === totalItemsCount && totalItemsCount > 0 ? 'text-emerald-500' : 'text-[#2563EB]'}`}>
                  {totalItemsCount > 0 ? Math.round((deliveredItemsCount / totalItemsCount) * 100) : 0}%
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center shrink-0 text-slate-400">
                <TrendingUp size={14} />
              </div>
           </div>
        </div>

        {/* Remaining Items List - NEW */}
        {remainingItems.length > 0 && (
          <div className="space-y-3">
            <button 
              onClick={() => setShowRemainingItems(!showRemainingItems)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-2xl border bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-orange-500 flex items-center justify-center">
                  <Clock size={14} />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">Remaining items for delivery</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">{remainingItems.length} items still pending</span>
                </div>
              </div>
              <ChevronDown 
                size={16} 
                className={`text-slate-400 transition-transform duration-300 ${showRemainingItems ? 'rotate-180' : ''}`} 
              />
            </button>

            <AnimatePresence>
              {showRemainingItems && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="text-left py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                          <th className="text-center py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Req.</th>
                          <th className="text-center py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Del.</th>
                          <th className="text-right py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Rem.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {remainingItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 pr-2">
                              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{item.name}</p>
                            </td>
                            <td className="text-center py-2.5 text-[10px] font-black text-slate-500">{item.requested}</td>
                            <td className="text-center py-2.5 text-[10px] font-black text-emerald-500">{item.delivered}</td>
                            <td className="text-right py-2.5 text-[10px] font-black text-orange-500">{item.remaining}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* PO Breakdown */}
        <div className="space-y-3">
          <div className="flex flex-col">
             <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">PO Breakdown</h3>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Items received per Purchase Order</p>
          </div>

          <div className="space-y-4">
            {poBreakdown.map((po, index) => {
              const deliveryPercentage = po.totalReq > 0 ? Math.round((po.totalDel / po.totalReq) * 100) : 0;
              const isVisible = visiblePoBreakdown[index] || false;

              return (
                <div key={index} className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                  <div 
                    className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => togglePoBreakdown(index)}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        PO: {po.poNum}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                      {!po.isDelivered && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const hasItems = po.items && po.items.length > 0;
                            const poItemsMap: Record<string, number> = {};
                            if (hasItems) {
                              po.items.forEach((it: any) => {
                                poItemsMap[it.code || it.item_code] = it.requested;
                              });
                            }
                            
                            navigate(`/requests/${request.id}/serial-entry`, { 
                              state: { 
                                selectedPO: po.poNum || null,
                                poItems: Object.keys(poItemsMap).length > 0 ? poItemsMap : null
                              } 
                            });
                            onClose();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                          title="Process Deliverables for this PO"
                        >
                          <Edit3 size={12} />
                          <span>Process</span>
                        </button>
                      )}
                      
                      <div 
                        className="flex items-center gap-4 cursor-pointer"
                        onClick={() => togglePoBreakdown(index)}
                      >
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  deliveryPercentage === 100 ? 'bg-emerald-500' : 'bg-[#2563EB]'
                                }`}
                                style={{ width: `${deliveryPercentage}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-black ${deliveryPercentage === 100 ? 'text-emerald-500' : 'text-[#2563EB]'}`}>
                              {deliveryPercentage}%
                            </span>
                          </div>
                          <div className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest mt-0.5 ${
                            po.isDelivered ? 'text-emerald-500' : 'text-amber-500'
                          }`}>
                            {po.isDelivered ? <Check size={10} /> : <Clock size={10} />}
                            {po.isDelivered ? 'Delivered' : 'Partial'}
                          </div>
                        </div>
                        <ChevronDown 
                          size={16} 
                          className={`text-slate-400 transition-transform duration-300 ${isVisible ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isVisible && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-2">
                           <div className="mb-4">
                             <button 
                               onClick={() => setVisiblePoItems(prev => ({ ...prev, [po.poNum]: !prev[po.poNum] }))}
                               className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
                             >
                                <div className="flex items-center gap-2">
                                  <Box size={14} />
                                  Breakdown of Equipment
                                </div>
                                <ChevronDown size={14} className={`transition-transform duration-300 ${visiblePoItems[po.poNum] ? 'rotate-180' : ''}`} />
                             </button>

                             <AnimatePresence>
                               {visiblePoItems[po.poNum] && (
                                 <motion.div
                                   initial={{ height: 0, opacity: 0 }}
                                   animate={{ height: 'auto', opacity: 1 }}
                                   exit={{ height: 0, opacity: 0 }}
                                   className="overflow-hidden mt-3"
                                 >
                                   <table className="w-full">
                                     <thead>
                                       <tr className="border-b border-slate-50 dark:border-slate-800">
                                         <th className="text-left py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                                         <th className="text-center py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Req.</th>
                                         <th className="text-center py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Del.</th>
                                         <th className="text-right py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                       </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {po.items.map((item, idx) => (
                                          <tr key={idx}>
                                             <td className="py-2.5">
                                               <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{item.name}</p>
                                             </td>
                                             <td className="text-center py-2.5 text-[11px] font-black text-slate-500">{item.requested}</td>
                                             <td className="text-center py-2.5 text-[11px] font-black text-slate-800 dark:text-white">{item.delivered}</td>
                                             <td className="text-right py-2.5">
                                               <div className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                 item.status === 'Complete' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' :
                                                 item.status === 'Partial' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' :
                                                 'text-slate-400 bg-slate-50 dark:bg-slate-800'
                                               }`}>
                                                 {item.status === 'Complete' && <Check size={8} />}
                                                 {item.status === 'Partial' && <Clock size={8} />}
                                                 {item.status}
                                               </div>
                                             </td>
                                          </tr>
                                        ))}
                                     </tbody>
                                     <tfoot>
                                        <tr className="border-t border-slate-100 dark:border-slate-800">
                                           <td className="py-2 text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Total</td>
                                           <td className="text-center py-2 text-[11px] font-black text-slate-800 dark:text-white">{po.totalReq}</td>
                                           <td className="text-center py-2 text-[11px] font-black" style={{ color: 'var(--brand-accent)' }}>{po.totalDel}</td>
                                           <td></td>
                                        </tr>
                                     </tfoot>
                                   </table>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                           </div>

                           {/* PO Specific History Section */}
                           {po.history && po.history.length > 0 && (
                             <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
                               <button 
                                 onClick={() => setVisiblePoHistory(prev => ({ ...prev, [po.poNum]: !prev[po.poNum] }))}
                                 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 hover:text-blue-500 transition-colors"
                               >
                                 <History size={12} />
                                 Delivery Records
                                 <ChevronDown size={12} className={`transition-transform duration-200 ${visiblePoHistory[po.poNum] ? 'rotate-180' : ''}`} />
                               </button>

                               <AnimatePresence>
                                 {visiblePoHistory[po.poNum] && (
                                   <motion.div
                                     initial={{ height: 0, opacity: 0 }}
                                     animate={{ height: 'auto', opacity: 1 }}
                                     exit={{ height: 0, opacity: 0 }}
                                     className="overflow-hidden pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-1"
                                   >
                                     <div className="space-y-6">
                                       {po.history.map((h: any, hIdx: number) => (
                                         <div key={hIdx} className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {new Date(h.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                                              </span>
                                              <span className="text-[10px] font-bold text-slate-400">
                                                {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            </div>
                                            
                                            <table className="w-full">
                                              <thead>
                                                <tr className="border-b border-slate-50 dark:border-slate-800">
                                                  <th className="text-left py-1 text-[8px] font-black text-slate-300 uppercase tracking-widest">Item Description</th>
                                                  <th className="text-right py-1 text-[8px] font-black text-slate-300 uppercase tracking-widest">Qty Del.</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-50/50 dark:divide-slate-800/50">
                                                {h.items.map((it: any, iIdx: number) => (
                                                  <tr key={iIdx}>
                                                    <td className="py-1.5 pr-2">
                                                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{it.name}</span>
                                                    </td>
                                                    <td className="py-1.5 text-right">
                                                      <span className="text-[10px] font-black text-blue-500">{it.qty}</span>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                         </div>
                                       ))}
                                     </div>
                                   </motion.div>
                                 )}
                               </AnimatePresence>
                             </div>
                           )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {poBreakdown.length === 0 && (
              <div className="py-8 text-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No PO info assigned yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className={`p-6 border-t shrink-0 flex flex-col-reverse gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
         {userRole !== 'Staff' && (
           <button 
             onClick={onUpdateDelivery}
             className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
               isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
             }`}
           >
             <Edit3 size={12} /> Update Delivery
           </button>
         )}
         <button 
           onClick={onOpenPrint}
           className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
           style={{ 
             backgroundColor: 'var(--brand-accent)',
             boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)'
           }}
         >
           <Printer size={12} /> Print / Export
         </button>
      </div>
    </motion.div>
  );
};

const ItemsRequest: React.FC<ItemsRequestProps> = ({ 
  onNavigate,
  highlightedId, 
  initialStatus, 
  openNewRequest = false,
  openPoModal = false,
  isDarkMode = false,
  prefillItem,
  prefillCode,
  userRole = 'Staff'
}) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedItemCodeForPo, setSelectedItemCodeForPo] = useState<string | null>(null);
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RequestData | null>(null);
  const [poModalRequest, setPoModalRequest] = useState<RequestData | null>(null);
  const [focusedPoId, setFocusedPoId] = useState<string | null>(null);
  const [previewRequest, setPreviewRequest] = useState<RequestData | null>(null);
  const [selectedDetailsRequest, setSelectedDetailsRequest] = useState<RequestData | null>(null);
  const [verificationRequest, setVerificationRequest] = useState<RequestData | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<RequestData | null>(null);
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(20);
  const [programFilter, setProgramFilter] = useState<ProgramFilterType>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('All');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [suppliers, setSuppliers] = useState<{ id: string; supplier_name: string }[]>([]);
  
  const [sortField, setSortField] = useState<'control_no' | 'school_name' | 'program' | 'date' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [initialExpandedPoIndex, setInitialExpandedPoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus);
    }
  }, [initialStatus]);
  const [tempHighlightId, setTempHighlightId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [tempPoValue, setTempPoValue] = useState('');
  const [isSavingPo, setIsSavingPo] = useState(false);
  const isCancelingPo = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<{[key: string]: HTMLTableRowElement | null}>({});

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
      if (programRef.current && !programRef.current.contains(event.target as Node)) {
        setIsProgramDropdownOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (prefillItem || prefillCode || openNewRequest) {
      setIsModalOpen(true);
    }
  }, [prefillItem, prefillCode, openNewRequest]);

  useEffect(() => {
    if (openPoModal && highlightedId && !loading && requests.length > 0 && !hasAutoOpened) {
      const targetRequest = requests.find(r => r.id === highlightedId);
      if (targetRequest) {
        const entries = parsePOString(targetRequest.poNumber, targetRequest.items || []);
        setPoEntries(entries.length > 0 ? entries : [{ id: Math.random().toString(36).substr(2, 9), poNumber: '', supplier: '', itemQuantities: {} }]);
        setPoModalRequest(targetRequest);
        setIsPoModalOpen(true);
        setHasAutoOpened(true);
      }
    }
  }, [openPoModal, highlightedId, loading, requests, hasAutoOpened]);

  // Reset auto-open flag when highlightedId changes (new navigation)
  useEffect(() => {
    setHasAutoOpened(false);
  }, [highlightedId, openPoModal, openNewRequest]);

  const fetchSuppliers = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSuppliers([
        { id: '1', supplier_name: 'Supplier Alpha' },
        { id: '2', supplier_name: 'Global Tech Solutions' },
        { id: '3', supplier_name: 'Metro Supply Co.' }
      ]);
      return;
    }
    try {
      const { data, error } = await supabase.from('supplier').select('id, supplier_name').order('supplier_name', { ascending: true });
      if (error) {
        if (error.code !== 'PGRST116') console.error('Error fetching suppliers:', error);
      } else if (data) {
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  }, []);

  const fetchRequests = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    if (showLoading) setLoading(true);
    
    try {
      const { data: bundleData } = await supabase
        .from('bundle_items')
        .select('item_code, bundle, program');

      const { data, error } = await supabase
        .from('item_requests')
        .select(`
          *,
          request_items (*)
        `)
        .not('status', 'in', '("Deleted","Rejected")')
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching requests:', error);
      } else if (data) {
        const mapped = data.map((req: any) => {
          let status: 'Pending' | 'Delivered' | 'Partially Delivered' = 'Pending';
          
          if (req.status === 'Delivered' || req.status === 'Partially Delivered') {
            status = req.status;
          } else if (req.status === 'Complete' || req.delivered_at) {
            status = 'Delivered';
          }
          
          return {
            id: req.control_no,
            ticketNo: req.ticket_no,
            schoolName: req.school_name,
            bufferSchool: req.buffer_school,
            requestType: (req.request_type || 'ARALINKS') as 'ARALINKS' | 'SMS-PROTRACK',
            date: req.date, 
            requestedBy: req.requested_by,
            status,
            purpose: req.purpose,
            program: req.program,
            poNumber: req.po_number,
            remarks: req.remarks,
            attachment: req.attachment,
            deliveredAt: req.delivered_at,
            school_monitoring_id: req.school_monitoring_id,
            items: req.request_items.map((item: any) => {
              return {
                id: item.id,
                qty: item.qty,
                uom: item.uom,
                item: item.item,
                item_code: item.item_code,
                bundle_name: item.bundle_name,
                isSerialized: item.is_serialized,
                received_quantity: item.received_quantity,
                serials: item.serials || []
              };
            })
          } as RequestData;
        });
        setRequests(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(true);
    fetchSuppliers();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('item-requests-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'item_requests' },
          () => fetchRequests(false)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'request_items' },
          () => fetchRequests(false)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'stock_transactions' },
          () => fetchRequests(false)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchRequests]);

  useEffect(() => {
    if (highlightedId && !loading && requests.length > 0) {
      setSearchQuery('');
      
      const targetRequest = requests.find(r => r.id === highlightedId);
      if (targetRequest) {
        setStatusFilter(targetRequest.status);
        setTempHighlightId(highlightedId);
        
        setTimeout(() => {
          const targetRow = rowRefs.current[highlightedId];
          if (targetRow) {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);

        const timer = setTimeout(() => {
          setTempHighlightId(null);
        }, 10000);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedId, loading, requests]);

  const counts = useMemo(() => {
    const list = ['NGS', 'HUB', 'TNL', 'ACE', 'NGS+ACE', 'HUB+ACE', 'PELS NGS', 'PELS NGS+ACE', 'ACE+PELS', 'ABDL', 'ACE+ABDL', 'HUB+NGS', 'ABDL (PELS)'];
    const res: Record<string, number> = {
      All: requests.length,
      Pending: requests.filter(r => r.status === 'Pending').length,
      Partially: requests.filter(r => r.status === 'Partially Delivered').length,
      Completed: requests.filter(r => r.status === 'Delivered').length,
    };
    list.forEach(p => {
      res[p] = requests.filter(r => (r.program || 'GENERAL').toUpperCase() === p.toUpperCase()).length;
    });
    return res;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let result = requests.filter(req => {
      const matchesSearch = searchQuery.trim() === '' || 
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (req.ticketNo && req.ticketNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (req.poNumber && req.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        req.schoolName.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter !== 'All') {
        const internalStatus = 
          statusFilter === 'Pending' ? 'Pending' :
          statusFilter === 'Partially' ? 'Partially Delivered' :
          'Delivered';
        if (req.status !== internalStatus) return false;
      }

      // Program Filter
      if (programFilter !== 'All') {
        if ((req.program || 'GENERAL').toUpperCase() !== programFilter) return false;
      }

      // Date Filter
      if (dateFilter !== 'All') {
        // Helper to get local date components for consistent comparison
        const getLocalDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        
        // Parse req.date correctly. If it's YYYY-MM-DD, parse as local.
        let parsedDate: Date;
        if (typeof req.date === 'string' && req.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [y, m, d] = req.date.split('-').map(Number);
          parsedDate = new Date(y, m - 1, d);
        } else {
          parsedDate = new Date(req.date);
        }
        
        const reqDateVal = getLocalDate(parsedDate);
        const now = new Date();
        const todayVal = getLocalDate(now);

        if (dateFilter === 'Today') {
          if (reqDateVal !== todayVal) return false;
        } else if (dateFilter === 'This Week') {
          // Get Sunday of current week
          const sunday = new Date(now);
          sunday.setDate(now.getDate() - now.getDay());
          const sundayVal = getLocalDate(sunday);
          
          // Get Saturday of current week
          const saturday = new Date(sunday);
          saturday.setDate(sunday.getDate() + 6);
          const saturdayVal = getLocalDate(saturday);
          
          if (reqDateVal < sundayVal || reqDateVal > saturdayVal) return false;
        } else if (dateFilter === 'This Month') {
          if (parsedDate.getMonth() !== now.getMonth() || parsedDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'Custom') {
          if (customDateRange.start) {
            const start = new Date(customDateRange.start);
            const startVal = getLocalDate(start);
            if (reqDateVal < startVal) return false;
          }
          if (customDateRange.end) {
            const end = new Date(customDateRange.end);
            const endVal = getLocalDate(end);
            if (reqDateVal > endVal) return false;
          }
        }
      }
      
      return true;
    });

    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'control_no':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'school_name':
          comparison = a.schoolName.localeCompare(b.schoolName);
          break;
        case 'program':
          comparison = (a.program || '').localeCompare(b.program || '');
          break;
        case 'status':
          const statusPriority: Record<string, number> = {
            'Pending': 1,
            'Partially Delivered': 2,
            'Delivered': 3
          };
          comparison = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
          break;
        case 'date':
        default:
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          comparison = dateA - dateB;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [requests, searchQuery, statusFilter, programFilter, dateFilter, customDateRange, sortDirection, sortField]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, programFilter, dateFilter, customDateRange]);

  const paginatedRequests = useMemo(() => {
    const effectiveItemsPerPage = itemsPerPage === 'all' ? filteredRequests.length : itemsPerPage;
    const startIndex = (currentPage - 1) * effectiveItemsPerPage;
    return filteredRequests.slice(startIndex, startIndex + effectiveItemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === 'all') return 1;
    return Math.ceil(filteredRequests.length / itemsPerPage);
  }, [filteredRequests.length, itemsPerPage]);

  const getStatusLabel = (status: string) => {
    if (status === 'Pending') return 'Pending';
    if (status === 'Partially Delivered') return 'Partially';
    if (status === 'Delivered') return 'Completed';
    return status;
  };

  const renderRequestRow = (req: RequestData, i: number) => {
    const isSelected = selectedIds.has(req.id);
    const isDelivered = req.status === 'Delivered';
    const isPartial = req.status === 'Partially Delivered';
    const isFinalized = isDelivered || isPartial;
    const isCompleting = completingId === req.id;
    const isHighlighted = tempHighlightId === req.id;
    
    const totalItemsCount = req.items?.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0) || 0;
    const deliveredItemsCount = req.items?.reduce((sum, item) => sum + (parseInt(item.received_quantity) || 0), 0) || 0;
    const percentage = totalItemsCount > 0 ? Math.round((deliveredItemsCount / totalItemsCount) * 100) : 0;

    const renderPODisplay = (poString: string | null | undefined) => {
      if (!poString) return null;
      
      const parts = poString.split(';').map(p => p.trim()).filter(Boolean);

      return (
        <div className="flex flex-wrap gap-1.5 items-center justify-center">
          {parts.map((part, idx) => {
            // Regex to match: PO_NUMBER [SUPPLIER] {CODE:QTY,...}
            const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
            let poNum = '';
            let supplier = '';
            if (match) {
              if (match[1] !== undefined) {
                poNum = match[1].trim();
                supplier = match[2]?.trim() || '';
              } else if (match[4] !== undefined) {
                poNum = match[4].trim();
                supplier = match[5]?.trim() || '';
              } else {
                poNum = match[6].trim();
              }
            } else {
              poNum = part.trim();
            }

            return (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  const entries = parsePOString(req.poNumber, req.items || []);
                  // Requirement: Redirect specifically to the selected PO
                  const targetEntry = entries.find(e => e.poNumber === poNum);
                  setFocusedPoId(targetEntry ? targetEntry.id : null);
                  setPoEntries(entries);
                  setPoModalRequest(req);
                  setIsPoModalOpen(true);
                }}
                className="text-[10px] font-black text-white bg-[#2563EB] px-3 py-1.5 rounded-lg tracking-tight uppercase shadow-md shadow-[#2563EB]/20 transform transition-all hover:scale-105 active:scale-95 hover:bg-[#1d4ed8] whitespace-nowrap border border-white/10"
              >
                {poNum}
              </button>
            );
          })}
        </div>
      );
    };

    return (
        <div 
          key={`${req.id}-${i}`}
          ref={el => { if (el) rowRefs.current[req.id] = el as any; }}
          style={{ animationDelay: `${i * 50}ms` }}
          className={`group animate-ease-in-down transition-all duration-200 border-l-4 hover:border-l-orange-500 cursor-pointer flex items-center px-6 py-3 min-w-[1000px] lg:min-w-full ${
            i % 2 === 0 ? (isDarkMode ? 'bg-slate-900' : 'bg-white') : (isDarkMode ? 'bg-slate-800/30' : 'bg-gray-50/50')
          } ${
            deletingId === req.id ? 'opacity-50 grayscale pointer-events-none' : ''
          } ${isHighlighted ? 'highlight-entry-focus' : ''} ${isSelected ? (isDarkMode ? 'bg-[#2563EB]/10 border-l-[#2563EB]' : 'bg-[#EFF6FF] border-l-[#2563EB]') : 'border-l-transparent'} ${selectedDetailsRequest?.id === req.id ? (isDarkMode ? 'bg-[#2563EB]/10 border-l-orange-500 shadow-inner' : 'bg-orange-50 border-l-orange-500 shadow-inner') : ''} hover:bg-orange-50 dark:hover:bg-slate-800 mb-[1px] last:mb-0 transition-colors`}
          onClick={() => isMultiSelect ? toggleSelection(req.id) : (setSelectedDetailsRequest(req), setIsSidebarOpen(true))}
        >
        {isMultiSelect && (
          <div className="w-8 flex-shrink-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => toggleSelection(req.id)}
              className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-slate-200 dark:border-slate-700 text-slate-200 dark:text-slate-700 hover:border-[#2563EB]'}`}
            >
              {isSelected ? <CheckSquare size={10} /> : <Square size={10} />}
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0 px-2 whitespace-nowrap">
          <div className="flex flex-col leading-tight relative group/info">
             <div className="flex items-center gap-1.5">
               <span className="text-xs font-bold text-slate-800 dark:text-white tracking-tight transition-colors whitespace-nowrap group-hover:text-[var(--brand-accent)]">{req.id}</span>
               {req.attachment && (
                 <div className="text-slate-400 group-hover/info:text-orange-500 transition-colors" title={`${req.attachment.split(',').length} Attachment(s)`}>
                   <Paperclip size={10} />
                 </div>
               )}
             </div>
             <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase whitespace-nowrap">{req.requestType}</span>
          </div>
        </div>

        <div className="flex-[1.8] min-w-0 px-2 flex flex-col">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight group-hover:text-slate-900 dark:group-hover:text-white transition-colors block">{req.schoolName}</span>
          {req.school_monitoring_id && (
            <span className="text-[10px] font-mono font-bold text-brand-orange mt-0.5">
              ID: {req.school_monitoring_id}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 px-2 flex flex-col items-start gap-1">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border border-[rgba(0,0,0,0.05)] transition hover:opacity-90 whitespace-nowrap uppercase ${getProgramBadgeClass(req.program)}`}>
            {req.program || 'GENERAL'}
          </span>
          {req.items && Array.from(new Set(req.items.map(item => item.bundle_name).filter(Boolean))).map((bundleName: any) => {
            const colors = getBundleColor(bundleName);
            return (
              <div 
                key={bundleName}
                className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter"
                style={{ 
                  backgroundColor: colors?.bg ? colors.bg + '15' : '#f1f5f9',
                  color: colors?.bg || '#64748b',
                  border: `1px solid ${colors?.bg ? colors.bg + '30' : '#e2e8f0'}`
                }}
              >
                {bundleName}
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 tracking-wider whitespace-nowrap">
            {formatDate(req.date)}
          </span>
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap flex justify-center">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full w-fit border transition-all duration-300 group-hover:scale-105 whitespace-nowrap ${
            isDelivered ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' : 
            isPartial ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20' :
            'bg-[#EFF6FF] dark:bg-[#2563EB]/10 text-[#2563EB] dark:text-[#3B82F6] border-[#2563EB]/5'
          }`}>
             {isFinalized ? <CheckCircle2 size={12} strokeWidth={2} className="shrink-0" /> : <Clock size={12} strokeWidth={2} className="shrink-0" />}
             <span className="text-xs font-bold tracking-wide whitespace-nowrap">{getStatusLabel(req.status)}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 px-2 whitespace-nowrap flex flex-col items-center justify-center">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black ${percentage === 100 ? 'text-emerald-500' : percentage > 0 ? 'text-[#2563EB]' : 'text-slate-400'}`}>
              {percentage}%
            </span>
          </div>
          <div className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full transition-all duration-700 rounded-full" 
              style={{ 
                width: `${percentage}%`,
                backgroundColor: percentage === 100 ? '#10b981' : percentage > 0 ? '#2563EB' : '#94a3b8'
              } as any}
            />
          </div>
        </div>

        <div className="flex-[2] min-w-0 px-2" onClick={(e) => e.stopPropagation()}>
          <div 
            className="px-2 py-1 flex items-center gap-2 w-fit mx-auto"
            title="Click a PO Number to manage it"
          >
            {req.poNumber ? (
              renderPODisplay(req.poNumber)
            ) : (
              <button 
                onClick={() => {
                  const existingEntries = parsePOString(req.poNumber, req.items || []);
                  const newEntry = { id: Math.random().toString(36).substr(2, 9), poNumber: '', supplier: '', itemQuantities: {} };
                  setPoEntries([...existingEntries, newEntry]);
                  setFocusedPoId(newEntry.id);
                  setPoModalRequest(req);
                  setIsPoModalOpen(true);
                }}
                className="text-[10px] text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-md font-semibold tracking-wide block transition-all hover:scale-105 border border-[#2563EB]/10"
              >
                Assign PO
              </button>
            )}
          </div>
        </div>


        <div className="flex-1 min-w-0 px-2 whitespace-nowrap flex items-center justify-center gap-1 opacity-100 group-hover:opacity-100 transition-all duration-200" onClick={(e) => e.stopPropagation()}>
          {userRole !== 'Staff' ? (
            isDelivered ? (
              <button 
                onClick={() => { setVerificationRequest(req); setIsVerificationModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-[#EFF6FF] cursor-pointer text-xs font-bold transition-all"
              >
                <History size={14} />
                <span>View History</span>
              </button>
            ) : (
              <>
                {(() => {
                  const poEntries = parsePOString(req.poNumber, req.items || []);
                  const totalRequested = (req.items || []).reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
                  const totalAllocated = poEntries.reduce((sum, entry) => 
                    sum + Object.values(entry.itemQuantities).reduce((a, b) => a + (b as number), 0), 
                  0);
                  const isFullyAllocated = totalAllocated >= totalRequested && totalRequested > 0;

                  return (
                    <>
                      {!isFinalized && (
                        <button 
                          onClick={() => { setEditingRequest(req); setIsModalOpen(true); }}
                          disabled={!!req.poNumber}
                          className={`p-2 transition-all active:scale-95 rounded-md ${
                            req.poNumber 
                              ? 'text-gray-300 dark:text-slate-700 cursor-not-allowed opacity-50' 
                              : 'text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:text-slate-600 dark:hover:bg-orange-500/10'
                          }`}
                          title={req.poNumber ? "Locked: Cannot edit request with assigned PO" : "Edit Entry"}
                        >
                          <Edit3 size={18} />
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          const existingEntries = parsePOString(req.poNumber, req.items || []);
                          const newEntry = { id: Math.random().toString(36).substr(2, 9), poNumber: '', supplier: '', itemQuantities: {} };
                          setPoEntries([...existingEntries, newEntry]);
                          setFocusedPoId(newEntry.id);
                          setPoModalRequest(req);
                          setIsPoModalOpen(true);
                        }}
                        disabled={isFullyAllocated}
                        className={`p-2 rounded-md transition-all active:scale-95 ${
                          isFullyAllocated 
                            ? 'text-gray-300 dark:text-slate-700 cursor-not-allowed opacity-50' 
                            : 'text-gray-500 hover:text-[#2563EB] hover:bg-[#EFF6FF] dark:text-slate-600 dark:hover:bg-[#2563EB]/10'
                        }`}
                        title={isFullyAllocated ? "All items fully allocated to PO(s)" : "Assign/Add PO Number"}
                      >
                        <Plus size={20} />
                      </button>

                      {/* Deliverables processing icon - Active when PO exists and completion < 100% */}
                      {!isDelivered && (
                        <button 
                          onClick={() => req.poNumber && percentage < 100 && handleCheckItems(req)}
                          disabled={isCompleting || !req.poNumber || percentage === 100}
                          className={`p-2 rounded-md transition-all active:scale-95 ${
                            (!req.poNumber || percentage === 100) 
                              ? 'text-gray-300 dark:text-slate-700 cursor-not-allowed opacity-50' 
                              : isPartial 
                                ? 'text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-500/20' 
                                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                          }`}
                          title={!req.poNumber 
                            ? 'Assign PO number first to process deliverables' 
                            : percentage === 100
                              ? 'Deliverables 100% complete'
                              : isPartial ? 'Continue Processing Deliverables' : 'Start Processing Deliverables'}
                        >
                          {isCompleting ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Box size={18} className={req.poNumber && percentage < 100 ? "group-hover:scale-110 transition-transform" : ""} />
                          )}
                        </button>
                      )}
                    </>
                  );
                })()}
                
                <button 
                  onClick={() => { setIsBulkDeleting(false); setRequestToDelete(req); setIsDeleteModalOpen(true); }}
                  disabled={!!req.poNumber}
                  className={`p-2 transition-all active:scale-95 rounded-md ${
                    req.poNumber 
                      ? 'text-gray-300 dark:text-slate-700 cursor-not-allowed opacity-50' 
                      : 'text-gray-500 hover:text-red-500 hover:bg-red-50 dark:text-slate-600 dark:hover:bg-red-500/10'
                  }`}
                  title={req.poNumber ? "Locked: Cannot delete request with assigned PO" : "Delete"}
                >
                  <Trash2 size={18} />
                </button>
              </>
            )
          ) : (
            <button 
              onClick={() => { setSelectedDetailsRequest(req); setIsSidebarOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-[#EFF6FF] cursor-pointer text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Eye size={14} />
              <span>Details</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleCheckItems = (request: RequestData) => {
    if (!request.poNumber) return;
    setVerificationRequest(request);
    setIsVerificationModalOpen(true);
  };

  const handleSavePo = async (id: string) => {
    if (!isSupabaseConfigured || isSavingPo) return;
    
    setIsSavingPo(true);
    try {
      // Check for duplicate PO
      const newPoTrimmed = tempPoValue.trim().toLowerCase();
      if (newPoTrimmed) {
        const tempPoRawList = tempPoValue.split(';').map(p => p.trim().toLowerCase()).filter(Boolean);
        const uniquePoSet = new Set<string>();
        for (const po of tempPoRawList) {
          if (uniquePoSet.has(po)) {
            throw new Error(`PO Number "${po}" is listed more than once in this request.`);
          }
          uniquePoSet.add(po);
        }

        const { data: existingPos, error: poCheckError } = { data: [] as any[], error: null as any };

        if (poCheckError) throw poCheckError;

        const currentReq = requests.find(r => r.id === id);
        const currentSchool = currentReq?.schoolName || '';
        const currentSchoolList = currentSchool.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        for (const req of existingPos || []) {
          if (req.po_number && req.school_name) {
             const existingEntries = parsePOString(req.po_number, []);
             if (existingEntries.some(e => e.poNumber.trim().toLowerCase() === newPoTrimmed)) {
               const reqSchoolList = req.school_name.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
               const isSameSchool = reqSchoolList.some((s: string) => currentSchoolList.includes(s));
               if (isSameSchool) {
                 throw new Error("PO Number already exists for this school.");
               }
             }
          }
        }
      }

      const { error } = await supabase
        .from('item_requests')
        .update({ po_number: tempPoValue.trim() || null })
        .eq('control_no', id);
      
      if (error) throw error;
      
      showSuccess('PO Updated', 'Purchase Order number saved successfully.');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, poNumber: tempPoValue.trim() || null } : r));
      setEditingPoId(null);
    } catch (err: any) {
      console.error('Failed to save PO:', err);
      showError('Error', err.message || 'Failed to save PO number');
    } finally {
      setIsSavingPo(false);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (filteredRequests.length === 0) return;
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set<string>();
      filteredRequests.forEach(req => newSelected.add(req.id));
      setSelectedIds(newSelected);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isSupabaseConfigured) return;

    if (isBulkDeleting) {
      if (selectedIds.size === 0) return;
      setLoading(true);
      try {
        const idsArray = Array.from(selectedIds);
        
        for (const controlNo of idsArray) {
          // 1. Get all transactions for this request to reverse inventory
          const { data: transactions } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('reference_id', controlNo);

          if (transactions && transactions.length > 0) {
            for (const tx of transactions) {
              // Only reverse Deliveries for inventory cleanup
              if (tx.transaction_type === 'Delivery') {
                const { data: stock } = await supabase
                  .from('item_location_stocks')
                  .select('id, quantity, brand_new_qty')
                  .eq('item_code', tx.item_code)
                  .eq('location', tx.to_location)
                  .maybeSingle();

                if (stock) {
                  await supabase
                    .from('item_location_stocks')
                    .update({
                      quantity: Math.max(0, stock.quantity - tx.quantity),
                      brand_new_qty: Math.max(0, (stock.brand_new_qty || 0) - tx.quantity)
                    })
                    .eq('id', stock.id);
                }
              }
            }
            
            // Delete related transactions
            await supabase.from('stock_transactions').delete().eq('reference_id', controlNo);
          }

          // 2. Delete related serial numbers
          await supabase.from('item_serials').delete().eq('request_id', controlNo);

          // 3. Delete related request items
          await supabase.from('request_items').delete().eq('request_control_no', controlNo);

          // 4. Delete the main request
          await supabase.from('item_requests').delete().eq('control_no', controlNo);
        }
        
        showDelete('Permanently Deleted', `${selectedIds.size} requisitions and their associated inventory records have been removed.`);
        setSelectedIds(new Set());
        await fetchRequests(false);
        setIsDeleteModalOpen(false);
      } catch (err: any) {
        showError('Error', err.message || 'Failed to delete selected requests.');
      } finally {
        setLoading(false);
        setIsBulkDeleting(false);
      }
      return;
    }

    if (!requestToDelete) return;
    const controlNo = requestToDelete.id;

    setDeletingId(controlNo);
    try {
      // 1. Revert Inventory Stocks
      const { data: transactions } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('reference_id', controlNo);

      if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
          if (tx.transaction_type === 'Delivery') {
            const { data: stock } = await supabase
              .from('item_location_stocks')
              .select('id, quantity, brand_new_qty')
              .eq('item_code', tx.item_code)
              .eq('location', tx.to_location)
              .maybeSingle();

            if (stock) {
              await supabase
                .from('item_location_stocks')
                .update({
                  quantity: Math.max(0, stock.quantity - tx.quantity),
                  brand_new_qty: Math.max(0, (stock.brand_new_qty || 0) - tx.quantity)
                })
                .eq('id', stock.id);
            }
          }
        }
        // Delete transactions
        await supabase.from('stock_transactions').delete().eq('reference_id', controlNo);
      }

      // 2. Delete item serials
      await supabase.from('item_serials').delete().eq('request_id', controlNo);

      // 3. Delete request items
      await supabase.from('request_items').delete().eq('request_control_no', controlNo);

      // 4. Delete the request itself
      const { error } = await supabase
        .from('item_requests')
        .delete()
        .eq('control_no', controlNo);

      if (error) {
        showError('Error', error.message || 'Error deleting request.');
      } else {
        showDelete('Permanently Deleted', 'Requisition and associated inventory records have been removed.');
        setRequests(prev => prev.filter(r => r.id !== controlNo));
        const nextSelected = new Set(selectedIds);
        nextSelected.delete(controlNo);
        setSelectedIds(nextSelected);
        setIsDeleteModalOpen(false);
      }
    } catch (err: any) {
      console.error('Deletion error:', err);
      showError('Error', err.message || 'Failed to delete requisition.');
    } finally {
      setDeletingId(null);
    }
  };

  const [poEntries, setPoEntries] = useState<POEntry[]>([]);

  const parsePOString = (poString: string | null | undefined, requestItems: any[]): POEntry[] => {
    if (!poString) return [{ id: Math.random().toString(36).substr(2, 9), poNumber: '', supplier: '', itemQuantities: {} }];
    
    // Attempt to parse structured format: PO1 [SUPPLIER] {CODE: QTY, ...}, PO2 ...
    try {
      const parts = poString.split(';').map(p => p.trim()).filter(Boolean);
      const entries: POEntry[] = [];
      
      parts.forEach(part => {
        // Regex to match: PO_NUMBER [SUPPLIER] {CODE:QTY,...}
        // Group 1: PO Number, Group 2: Supplier, Group 3: Items
        const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
        
        if (match) {
          let poNumber = '';
          let supplier = '';
          let qtiesRaw = '';
          
          if (match[1] !== undefined) {
            // First pattern: PO {ITEMS} or PO [SUPPLIER] {ITEMS}
            poNumber = match[1].trim();
            supplier = match[2]?.trim() || '';
            qtiesRaw = match[3].trim();
          } else if (match[4] !== undefined) {
            // Second pattern: PO [SUPPLIER]
            poNumber = match[4].trim();
            supplier = match[5]?.trim() || '';
          } else {
            // Third pattern: Just PO
            poNumber = match[6].trim();
          }

          const itemQuantities: Record<string, number> = {};
          if (qtiesRaw) {
            qtiesRaw.split(',').forEach(q => {
              const pair = q.split(':').map(s => s.trim());
              if (pair.length === 2) {
                const [code, qty] = pair;
                itemQuantities[code] = parseInt(qty) || 0;
              }
            });
          }
          
          entries.push({
            id: Math.random().toString(36).substr(2, 9),
            poNumber,
            supplier,
            itemQuantities
          });
        }
      });
      
      return entries.length > 0 ? entries : [{ id: Math.random().toString(36).substr(2, 9), poNumber: '', supplier: '', itemQuantities: {} }];
    } catch (e) {
      return [{ id: Math.random().toString(36).substr(2, 9), poNumber: poString, supplier: '', itemQuantities: {} }];
    }
  };

  const formatPOString = (entries: POEntry[]): string => {
    return entries
      .filter(e => e.poNumber.trim())
      .map(e => {
        const qties = Object.entries(e.itemQuantities)
          .filter(([_, qty]) => qty > 0)
          .map(([code, qty]) => `${code}:${qty}`)
          .join(',');
        
        const suppString = e.supplier?.trim() ? ` [${e.supplier.trim()}]` : '';
        const itemsString = qties ? ` {${qties}}` : '';
        
        return `${e.poNumber.trim()}${suppString}${itemsString}`;
      })
      .join('; ');
  };

  const handleAddPoEntry = () => {
    setPoEntries(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), poNumber: '', supplier: '', itemQuantities: {} }]);
  };

  const handleRemovePoEntry = (id: string) => {
    setPoEntries(prev => prev.filter(e => e.id !== id));
  };

  const handlePoEntryChange = (id: string, poNumber: string) => {
    setPoEntries(prev => prev.map(e => e.id === id ? { ...e, poNumber } : e));
  };

  const handleSupplierChange = (id: string, supplier: string) => {
    setPoEntries(prev => prev.map(e => e.id === id ? { ...e, supplier } : e));
  };

  const handleItemQtyChange = (poId: string, itemCode: string, qty: number, maxQty: number) => {
    setPoEntries(prev => {
      // Calculate current total allocated for this item across other POs
      const otherAllocated = prev
        .filter(e => e.id !== poId)
        .reduce((sum, e) => sum + (e.itemQuantities[itemCode] || 0), 0);
      
      const allowedQty = Math.min(qty, maxQty - otherAllocated);
      const safeQty = Math.max(0, allowedQty);
      
      return prev.map(e => {
        if (e.id === poId) {
          return {
            ...e,
            itemQuantities: {
              ...e.itemQuantities,
              [itemCode]: safeQty
            }
          };
        }
        return e;
      });
    });
  };

  const handleSavePoFromModal = async () => {
    if (!isSupabaseConfigured || isSavingPo || !poModalRequest) return;
    
    setIsSavingPo(true);
    try {
      // 1. Check for internal duplicates within the same request (unique in Request no.)
      const poNumSet = new Set<string>();
      for (const entry of poEntries) {
        const trimmed = entry.poNumber.trim().toLowerCase();
        if (trimmed) {
          if (poNumSet.has(trimmed)) {
            throw new Error(`PO Number "${entry.poNumber}" is listed more than once in this request.`);
          }
          poNumSet.add(trimmed);
        }
      }

      const currentPoNumbers = Array.from(poNumSet);

      // --- REVERT LOGIC FOR DELETED POS ---
      const oldPoEntries = parsePOString(poModalRequest.poNumber, poModalRequest.items || []);
      const deletedPos = oldPoEntries.filter(old => 
        old.poNumber && !currentPoNumbers.includes(old.poNumber.trim().toLowerCase())
      );

      if (deletedPos.length > 0) {
        console.log(`[PO Revert] Found ${deletedPos.length} deleted POs. Reverting transactions...`);
        for (const dpo of deletedPos) {
          const poNum = dpo.poNumber.trim();
          
          // Find transactions associated with this PO
          const { data: txs, error: txFetchError } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('reference_id', poModalRequest.id)
            .ilike('reason', `%PO:${poNum}%`);

          if (txFetchError) {
            console.error(`[PO Revert] Error fetching transactions for PO ${poNum}:`, txFetchError);
            continue;
          }

          if (txs && txs.length > 0) {
            for (const tx of txs) {
              console.log(`[PO Revert] Reverting tx ${tx.id} for item ${tx.item_code} (Qty: ${tx.quantity})`);
              
              // a. Update Inventory
              const loc = tx.to_location || tx.location;
              const { data: stocks } = await supabase
                .from('item_location_stocks')
                .select('*')
                .eq('item_code', tx.item_code)
                .eq('location', loc);

              if (stocks && stocks.length > 0) {
                const stock = stocks[0];
                await supabase
                  .from('item_location_stocks')
                  .update({
                    quantity: Math.max(0, stock.quantity - tx.quantity),
                    brand_new_qty: Math.max(0, (stock.brand_new_qty || 0) - tx.quantity)
                  })
                  .eq('id', stock.id);
              }

              // b. Revert request_items received_quantity
              const { data: reqItems } = await supabase
                .from('request_items')
                .select('*')
                .eq('request_control_no', poModalRequest.id)
                .eq('item_code', tx.item_code);

              if (reqItems && reqItems.length > 0) {
                const ri = reqItems[0];
                const newRecQty = Math.max(0, (ri.received_quantity || 0) - tx.quantity);
                await supabase
                  .from('request_items')
                  .update({
                    received_quantity: newRecQty,
                    status: newRecQty >= ri.qty ? 'Delivered' : (newRecQty > 0 ? 'Partially Delivered' : 'Pending')
                  })
                  .eq('id', ri.id);
              }

              // c. Delete Serials
              const { data: itemSerials } = await supabase
                .from('item_serials')
                .select('id')
                .eq('request_id', poModalRequest.id)
                .eq('item_code', tx.item_code)
                .order('created_at', { ascending: false })
                .limit(Math.abs(tx.quantity));

              if (itemSerials && itemSerials.length > 0) {
                await supabase
                  .from('item_serials')
                  .delete()
                  .in('id', itemSerials.map(s => s.id));
              }

              // d. Delete Transaction
              await supabase.from('stock_transactions').delete().eq('id', tx.id);
            }
          }
        }
      }

      // Recalculate Overall Request Status
      const { data: updatedReqItems } = await supabase
        .from('request_items')
        .select('received_quantity, qty')
        .eq('request_control_no', poModalRequest.id);

      let finalRequestStatus = 'Pending';
      if (updatedReqItems && updatedReqItems.length > 0) {
        const allDone = updatedReqItems.every(i => i.received_quantity >= i.qty);
        const someDone = updatedReqItems.some(i => i.received_quantity > 0);
        finalRequestStatus = allDone ? 'Delivered' : (someDone ? 'Partially Delivered' : 'Pending');
      }

      const formattedPo = formatPOString(poEntries);
      const { error } = await supabase
        .from('item_requests')
        .update({ 
          po_number: formattedPo || null,
          status: finalRequestStatus
        })
        .eq('control_no', poModalRequest.id);
      
      if (error) throw error;
      
      showSuccess('PO Updated', 'Purchase Order details saved successfully.');
      setRequests(prev => prev.map(r => r.id === poModalRequest.id ? { 
        ...r, 
        poNumber: formattedPo || null,
        status: finalRequestStatus
      } : r));
      setIsPoModalOpen(false);
      setPoModalRequest(null);
      setPoSearchQuery('');
    } catch (err: any) {
      console.error('Failed to save PO:', err);
      showError('Error', err.message || 'Failed to save PO details');
    } finally {
      setIsSavingPo(false);
    }
  };

  const triggerBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setRequestToDelete(null); 
    setIsDeleteModalOpen(true);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const formatDeliveredDate = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative transition-colors duration-300">
      <style>{`
        .highlight-entry-focus {
          background-color: ${isDarkMode ? '#1e293b' : '#fff9f7'} !important;
          border-left: 10px solid var(--brand-accent) !important;
          position: relative;
          z-index: 20;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand-accent), transparent 90%), 0 10px 40px -10px color-mix(in srgb, var(--brand-accent), transparent 85%) !important;
        }
      `}</style>

      <div className="mx-6 lg:mx-12 pt-0 pb-0">
        <PageHeader 
          title="Item Requests" 
          description="View, manage, and track all item requisitions" 
          isDarkMode={isDarkMode} 
        />
      </div>
      
      <div className="mx-6 lg:mx-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 mt-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {(['All', 'Pending', 'Partially', 'Completed'] as StatusFilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${
                statusFilter === filter 
                  ? 'text-white' 
                  : isDarkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' 
                    : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
              }`}
              style={{ 
                backgroundColor: statusFilter === filter ? 'var(--brand-accent)' : undefined,
                borderColor: statusFilter === filter ? 'var(--brand-accent)' : undefined,
                boxShadow: statusFilter === filter ? '0 8px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)' : undefined
              }}
            >
              <span>{filter === 'Partially' ? 'PARTIAL' : filter === 'Completed' ? 'DELIVERED' : filter}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                statusFilter === filter 
                  ? 'bg-white/20 text-white' 
                  : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
              }`}>
                {counts[filter]}
              </span>
            </button>
          ))}

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden lg:block" />

          <div className="relative group flex-1 lg:flex-none">
            <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} style={{ color: searchQuery ? 'var(--brand-accent)' : undefined }}>
              <Search size={18} className="group-hover:scale-110 transition-transform" />
            </div>
            <input 
              type="text" 
              placeholder="Search Requests..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-2.5 w-full lg:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium shadow-sm text-sm"
              style={{ '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)', borderColor: searchQuery ? 'var(--brand-accent)' : undefined } as any}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={programRef}>
            <button
              onClick={() => setIsProgramDropdownOpen(!isProgramDropdownOpen)}
              className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all shadow-sm active:scale-95 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
              style={programFilter !== 'All' ? { 
                backgroundColor: isDarkMode ? 'color-mix(in srgb, var(--brand-accent), transparent 90%)' : 'color-mix(in srgb, var(--brand-accent), transparent 95%)',
                borderColor: 'var(--brand-accent)',
                color: 'var(--brand-accent)'
              } : {}}
              title="Filter by Program"
            >
              <Tag size={18} style={{ color: 'var(--brand-accent)' }} />
              <span className="text-[13px] font-medium leading-none">
                Program: {programFilter === 'All' ? 'All' : programFilter}
              </span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProgramDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProgramDropdownOpen && (
              <div className={`absolute top-full left-0 mt-2 w-52 rounded-2xl shadow-2xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
              }`}>
                <div className="max-h-60 overflow-y-auto">
                  {(['All', 'NGS', 'HUB', 'TNL', 'ACE', 'NGS+ACE', 'HUB+ACE', 'PELS NGS', 'PELS NGS+ACE', 'ACE+PELS', 'ABDL', 'ACE+ABDL', 'HUB+NGS', 'ABDL (PELS)'] as ProgramFilterType[]).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setProgramFilter(filter);
                        setIsProgramDropdownOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${
                        programFilter === filter 
                          ? 'bg-[#FE4E02]/10 text-[#FE4E02]' 
                          : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span>{filter}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                        programFilter === filter ? 'text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`} style={{ backgroundColor: programFilter === filter ? 'var(--brand-accent)' : undefined }}>
                        {filter === 'All' ? requests.length : (counts[filter] || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={dateRef}>
            <button
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all shadow-sm active:scale-95 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
              style={dateFilter !== 'All' ? { 
                backgroundColor: isDarkMode ? 'color-mix(in srgb, var(--brand-accent), transparent 90%)' : 'color-mix(in srgb, var(--brand-accent), transparent 95%)',
                borderColor: 'var(--brand-accent)',
                color: 'var(--brand-accent)'
              } : {}}
              title="Filter by Date"
            >
              <Calendar size={18} style={{ color: 'var(--brand-accent)' }} />
              <span className="text-[13px] font-medium leading-none">
                Date: {dateFilter === 'All' ? 'All time' : (dateFilter === 'Custom' ? 'Custom Range' : dateFilter)}
              </span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDateDropdownOpen && (
              <div className={`absolute top-full left-0 mt-2 w-64 rounded-2xl shadow-2xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
              }`}>
                {(['All', 'Today', 'This Week', 'This Month', 'Custom'] as DateFilterType[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      if (filter !== 'Custom') {
                        setDateFilter(filter);
                        setIsDateDropdownOpen(false);
                      } else {
                        setDateFilter('Custom');
                      }
                    }}
                    className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${
                      dateFilter === filter 
                        ? 'bg-[#FE4E02]/10 text-[#FE4E02]' 
                        : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span>{filter === 'All' ? 'All Time' : filter}</span>
                    {dateFilter === filter && <Check size={14} />}
                  </button>
                ))}
                
                {dateFilter === 'Custom' && (
                  <div className={`p-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} space-y-3`}>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Start Date</label>
                      <input 
                        type="date" 
                        value={customDateRange.start}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition-all ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-slate-700'
                        }`}
                        style={{ '--tw-ring-color': 'var(--brand-accent)', borderColor: customDateRange.start ? 'var(--brand-accent)' : undefined } as any}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">End Date</label>
                      <input 
                        type="date" 
                        value={customDateRange.end}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition-all ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-slate-700'
                        }`}
                        style={{ '--tw-ring-color': 'var(--brand-accent)', borderColor: customDateRange.end ? 'var(--brand-accent)' : undefined } as any}
                      />
                    </div>
                    <button 
                      onClick={() => setIsDateDropdownOpen(false)}
                      className="w-full py-2 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                      style={{ backgroundColor: 'var(--brand-accent)' }}
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center w-full lg:w-auto gap-3">
          {userRole !== 'Staff' && (
            <button 
              onClick={() => {
                setIsMultiSelect(!isMultiSelect);
                if (isMultiSelect) setSelectedIds(new Set());
              }}
              className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs border shadow-sm ${
                isMultiSelect 
                  ? 'text-white' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              style={{ 
                backgroundColor: isMultiSelect ? 'var(--brand-accent)' : undefined,
                borderColor: isMultiSelect ? 'var(--brand-accent)' : undefined,
                boxShadow: isMultiSelect ? '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)' : undefined
              }}
              title="Toggle Multi-select"
            >
              {isMultiSelect ? <CheckSquare size={16} /> : <Square size={16} />}
              <span>Select</span>
            </button>
          )}

          {userRole !== 'Staff' && (
            <button 
              disabled={!isSupabaseConfigured}
              onClick={() => {
                setEditingRequest(null);
                setIsModalOpen(true);
              }}
              className="w-full lg:w-auto text-white px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ 
                backgroundColor: 'var(--brand-accent)',
                boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)'
              }}
            >
              <Plus size={16} />
              {toTitleCase("New Requisition")}
            </button>
          )}
        </div>
      </div>

      <div className="mx-6 lg:mx-12 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[400px] md:min-h-[600px] flex flex-col mb-10 transition-colors duration-300 custom-scrollbar">
        {loading ? (
          <div className="flex-grow flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2" style={{ borderColor: 'var(--brand-accent)' }}></div>
              <p className="text-[10px] md:text-[12px] font-bold tracking-[0.2em] text-slate-400 dark:text-slate-500 animate-pulse">{toTitleCase("Syncing Requisitions")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full">
            {/* Header */}
            <div className="bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-800 flex items-center px-6 py-3 min-w-[1000px] lg:min-w-full sticky top-0 z-20">
              {isMultiSelect && (
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <button 
                    onClick={handleSelectAll}
                    className="w-4 h-4 rounded-md border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {selectedIds.size === filteredRequests.length && filteredRequests.length > 0 ? <CheckSquare size={12} style={{ color: 'var(--brand-accent)' }} /> : <Square size={12} className="text-slate-200 dark:text-slate-700" />}
                  </button>
                </div>
              )}
              <div 
                className="flex-1 min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1 group"
                onClick={() => handleSort('control_no')}
              >
                {toTitleCase("Req No.")}
                <div className={`transition-all duration-300 ${sortField === 'control_no' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                  {sortField === 'control_no' && sortDirection === 'desc' ? <ArrowDown size={10} style={{ color: 'var(--brand-accent)' }} /> : <ArrowUp size={10} style={{ color: 'var(--brand-accent)' }} />}
                </div>
              </div>
              <div 
                className="flex-[1.8] min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1 group"
                onClick={() => handleSort('school_name')}
              >
                {toTitleCase("School Name")}
                <div className={`transition-all duration-300 ${sortField === 'school_name' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                  {sortField === 'school_name' && sortDirection === 'desc' ? <ArrowDown size={10} style={{ color: 'var(--brand-accent)' }} /> : <ArrowUp size={10} style={{ color: 'var(--brand-accent)' }} />}
                </div>
              </div>
              <div 
                className="flex-1 min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1 group"
                onClick={() => handleSort('program')}
              >
                {toTitleCase("Program")}
                <div className={`transition-all duration-300 ${sortField === 'program' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                  {sortField === 'program' && sortDirection === 'desc' ? <ArrowDown size={10} style={{ color: 'var(--brand-accent)' }} /> : <ArrowUp size={10} style={{ color: 'var(--brand-accent)' }} />}
                </div>
              </div>
              <div 
                className="flex-1 min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1 group"
                onClick={() => handleSort('date')}
              >
                {toTitleCase("Date")}
                <div className={`transition-all duration-300 ${sortField === 'date' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                  {sortField === 'date' && sortDirection === 'desc' ? <ArrowDown size={10} style={{ color: 'var(--brand-accent)' }} /> : <ArrowUp size={10} style={{ color: 'var(--brand-accent)' }} />}
                </div>
              </div>
              <div 
                className="flex-1 min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 text-center whitespace-nowrap uppercase cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1 group"
                onClick={() => handleSort('status')}
              >
                {toTitleCase("Status")}
                <div className={`transition-all duration-300 ${sortField === 'status' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                  {sortField === 'status' && sortDirection === 'desc' ? <ArrowDown size={10} style={{ color: 'var(--brand-accent)' }} /> : <ArrowUp size={10} style={{ color: 'var(--brand-accent)' }} />}
                </div>
              </div>
              <div className="flex-1 min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 text-center whitespace-nowrap uppercase">{toTitleCase("Comp. %")}</div>
              <div className="flex-[2] min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 text-center whitespace-nowrap uppercase">{toTitleCase("Deliverables")}</div>
              <div className="flex-1 min-w-0 px-2 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 text-center whitespace-nowrap uppercase">{toTitleCase("Actions")}</div>
            </div>

            {/* Body */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRequests.map((req, i) => renderRequestRow(req, i))}
              
              {filteredRequests.length === 0 && !loading && (
                <div className="flex-grow flex flex-col items-center justify-center py-40 opacity-20">
                   <FileText size={120} strokeWidth={1} className="mb-8" />
                   <p className="text-xl font-bold tracking-[0.5em]">{toTitleCase("No Requests Found")}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 mt-4 gap-4">
            <div className="flex items-center gap-4">
              <div className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {itemsPerPage === 'all' ? (
                  `Showing all ${filteredRequests.length} records`
                ) : (
                  `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, filteredRequests.length)} of ${filteredRequests.length} records`
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Display:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
                    setItemsPerPage(val as number | 'all');
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-slate-800 border-slate-700 text-slate-300 focus:border-[#FE4E02]' 
                      : 'bg-white border-slate-200 text-slate-600 focus:border-[#FE4E02]'
                  }`}
                >
                  {[20, 50, 100, 300, 500].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && itemsPerPage !== 'all' && (
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(prev => prev - 1);
                    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`p-2 rounded-lg border transition-all ${
                    currentPage === 1 
                      ? 'opacity-30 cursor-not-allowed' 
                      : (isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
                  }`}
                >
                  <ChevronDown size={18} className="rotate-90" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            currentPage === pageNum
                              ? 'text-white shadow-lg'
                              : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')
                          }`}
                          style={currentPage === pageNum ? { backgroundColor: 'var(--brand-accent)' } : {}}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if ((pageNum === 2 && currentPage > 3) || (pageNum === totalPages - 1 && currentPage < totalPages - 2)) {
                      return <span key={pageNum} className="text-slate-400">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage(prev => prev + 1);
                    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`p-2 rounded-lg border transition-all ${
                    currentPage === totalPages 
                      ? 'opacity-30 cursor-not-allowed' 
                      : (isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
                  }`}
                >
                  <ChevronDown size={18} className="-rotate-90" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
      </div>

      <NewRequestModal 
        isOpen={isModalOpen} 
        onClose={() => { 
          setIsModalOpen(false); 
          setEditingRequest(null); 
          onNavigate('requests', { openNewRequest: false });
        }} 
        onSubmit={(newId) => {
          fetchRequests(false);
          if (!editingRequest && newId) {
            // Find the new request in the current list or wait for fetch
            // But fetchRequests(false) is async. 
            // We can search for it after it completes or just trigger a side effect.
            // Simplified: we'll handle this in fetchRequests callback or a separate useEffect
            // For now, let's just trigger the open by looking for the ID after fetch.
            setTimeout(() => {
              const findAndOpen = async () => {
                const { data } = await supabase.from('item_requests').select('*').eq('control_no', newId).single();
                if (data) {
                  const req = {
                    id: data.control_no,
                    schoolName: data.school_name,
                    date: data.date,
                    status: data.status,
                    program: data.program,
                    po_number: data.po_number,
                    requestType: data.request_type,
                    items: [] // fetch items too?
                  } as any;
                  
                  // Need items for parsePOString
                  const { data: items } = await supabase.from('item_request_items').select('*').eq('request_id', newId);
                  req.items = items || [];
                  req.poNumber = data.po_number;
                  
                  const entries = parsePOString(req.poNumber, req.items);
                  setPoEntries(entries.length > 0 ? entries : [{ id: 1, poNumber: '', supplier: '', itemQuantities: {} }]);
                  setPoModalRequest(req);
                  setIsPoModalOpen(true);
                }
              };
              findAndOpen();
            }, 1000);
          }
        }}
        initialData={editingRequest || undefined}
        isDarkMode={isDarkMode}
        prefillItem={prefillItem}
        prefillCode={prefillCode}
      />

      <RequestPreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setPreviewRequest(null); }}
        request={previewRequest}
      />

      <AnimatePresence>
        {isSidebarOpen && selectedDetailsRequest && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => { setIsSidebarOpen(false); setSelectedDetailsRequest(null); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[190] transform-gpu"
            />
            <RequestDetailsSidebar 
              isOpen={isSidebarOpen}
              onClose={() => {
                setIsSidebarOpen(false);
                setInitialExpandedPoIndex(null);
                setSelectedDetailsRequest(null);
              }}
              request={selectedDetailsRequest}
              isDarkMode={isDarkMode}
              onNavigate={onNavigate}
              userRole={userRole}
              initialExpandedPoIndex={initialExpandedPoIndex}
              onOpenPrint={() => {
                setPreviewRequest(selectedDetailsRequest);
                setIsPreviewOpen(true);
              }}
              onUpdateDelivery={() => {
                setVerificationRequest(selectedDetailsRequest);
                setIsVerificationModalOpen(true);
              }}
            />
          </>
        )}
      </AnimatePresence>

      <ItemVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => { setIsVerificationModalOpen(false); setVerificationRequest(null); }}
        request={verificationRequest}
        onConfirm={() => {
          fetchRequests(false);
        }}
        onNavigate={onNavigate}
        isDarkMode={isDarkMode}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setRequestToDelete(null); setIsBulkDeleting(false); }}
        onConfirm={handleConfirmDelete}
        controlNo={requestToDelete?.id || ''}
        schoolName={requestToDelete?.schoolName || ''}
        isDeleting={!!deletingId || (isBulkDeleting && loading)}
        itemCount={isBulkDeleting ? selectedIds.size : undefined}
        isDarkMode={isDarkMode}
        type="request"
      />

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 md:bottom-12 left-4 right-4 md:left-1/2 md:-translate-x-1/2 z-[80] bg-[#1a1a1a] px-6 md:px-12 py-4 md:py-6 rounded-[2rem] md:rounded-[3rem] shadow-3xl border border-white/10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 animate-in slide-in-from-bottom-10 duration-500">
           <div className="flex flex-col items-center text-center">
              <span className="text-[9px] md:text-[10px] font-bold text-white/40 tracking-[0.25em]">{toTitleCase('Selection Queue')}</span>
              <span className="text-lg md:text-xl font-bold text-white tracking-tight">{selectedIds.size} {toTitleCase('Requests')}</span>
           </div>
           <div className="hidden md:block w-[1px] h-10 bg-white/10"></div>
           <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
              <button 
                onClick={triggerBulkDelete}
                className="flex-grow md:flex-none px-6 md:px-8 py-3 md:py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center gap-3 text-[10px] md:text-[11px] font-bold uppercase tracking-widest shadow-2xl shadow-red-500/30 transition-all active:scale-95"
              >
                <Trash2 size={16} md:size={18} />
                {toTitleCase("Delete")}
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="flex-grow md:flex-none px-6 md:px-8 py-3 md:py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all"
              >
                {toTitleCase("Dismiss")}
              </button>
           </div>
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-20 z-[60] w-12 h-12 text-white rounded-full flex items-center justify-center shadow-3xl hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300 transition-all font-unbounded font-black"
          style={{ 
            backgroundColor: 'var(--brand-accent)',
            boxShadow: '0 10px 25px -5px color-mix(in srgb, var(--brand-accent), transparent 60%)'
          }}
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}

      {/* PO Management Modal */}
      {isPoModalOpen && poModalRequest && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <div className={`p-6 md:p-8 pb-4 shrink-0 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-xl md:text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {poModalRequest.poNumber ? 'Manage Purchase Order' : 'Assign PO Number'}
                  </h3>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                      Req No: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-600'}>{poModalRequest.id}</span>
                    </p>
                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                      Items: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-600'}>{(poModalRequest.items || []).length}</span>
                    </p>
                  </div>
                </div>
                <button 
                   onClick={() => { setIsPoModalOpen(false); setPoModalRequest(null); setFocusedPoId(null); }}
                   className={`p-3 rounded-2xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                 >
                   <X size={20} />
                 </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
              <div className="space-y-8">
              {poEntries
                .filter(entry => !focusedPoId || entry.id === focusedPoId)
                .length > 0 ? (
                poEntries
                  .filter(entry => !focusedPoId || entry.id === focusedPoId)
                  .map((entry, entryIndex) => {
                    const poTotalQty = (Object.values(entry.itemQuantities) as number[]).reduce((a, b) => a + b, 0);
                    const poItemCount = (Object.values(entry.itemQuantities) as number[]).filter(q => q > 0).length;
                    
                    const availableItems = (poModalRequest.items || []).filter((item: any) => {
                      const totalRequested = parseInt(item.qty) || 0;
                      const totalAllocated = poEntries.reduce((sum, e) => sum + (e.itemQuantities[item.item_code] || 0), 0);
                      const remaining = totalRequested - totalAllocated;
                      return remaining > 0 || (entry.itemQuantities[item.item_code] || 0) > 0;
                    });

                    return (
                      <div key={entry.id} className={`rounded-[2rem] border-2 transition-all overflow-hidden ${
                        isDarkMode ? 'bg-slate-800/20 border-slate-700/50' : 'bg-slate-50/30 border-slate-100'
                      }`}>
                        {/* PO Header Section */}
                        <div className={`p-6 border-b-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/80 border-slate-100'}`}>
                          <div className="flex flex-col lg:flex-row lg:items-end gap-6">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB] shrink-0 shadow-inner">
                                <FileText size={24} />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block px-1">PO Number</label>
                                <input
                                  type="text"
                                  value={entry.poNumber}
                                  onChange={(e) => handlePoEntryChange(entry.id, e.target.value)}
                                  placeholder="e.g. PO-2024-001"
                                  className={`w-full px-5 py-3 rounded-xl border-2 transition-all outline-none font-bold text-sm tracking-tight ${
                                    isDarkMode 
                                      ? 'bg-slate-900 border-slate-700 text-white focus:border-[#2563EB]' 
                                      : 'bg-white border-slate-200 text-slate-900 focus:border-[#2563EB]'
                                  }`}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
                                <Tag size={22} />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block px-1">Supplier / Brand</label>
                                <select
                                  value={entry.supplier || ''}
                                  onChange={(e) => handleSupplierChange(entry.id, e.target.value)}
                                  className={`w-full px-5 py-3 rounded-xl border-2 transition-all outline-none font-bold text-sm tracking-tight appearance-none cursor-pointer ${
                                    isDarkMode 
                                      ? 'bg-slate-900 border-slate-700 text-white focus:border-orange-500' 
                                      : 'bg-white border-slate-200 text-slate-900 focus:border-orange-500'
                                  }`}
                                >
                                  <option value="">Select Supplier...</option>
                                  {suppliers.map(sup => (
                                    <option key={sup.id} value={sup.supplier_name}>{sup.supplier_name}</option>
                                  ))}
                                  {!suppliers.length && <option disabled>No suppliers configured</option>}
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center justify-end lg:pb-1">
                              <button 
                                onClick={() => handleRemovePoEntry(entry.id)}
                                className="group flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
                              >
                                <Trash2 size={16} />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Item Selection Dropdown */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block px-1">Add Items to Purchase Order</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                              className={`w-full px-5 py-4 rounded-2xl border-2 flex items-center justify-between font-bold text-sm transition-all ${
                                isDarkMode 
                                  ? 'bg-slate-900 border-slate-700 text-slate-400' 
                                  : 'bg-white border-slate-200 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Box size={16} className="text-[#2563EB]" />
                                <span>
                                  {poItemCount > 0 
                                    ? `${poItemCount} items selected` 
                                    : 'Select items to add...'}
                                </span>
                              </div>
                              <ChevronDown size={20} className={`transition-transform duration-300 ${isPoDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                              {isPoDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-[305]" onClick={() => setIsPoDropdownOpen(false)} />
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={`absolute z-[310] left-0 right-0 mt-2 rounded-2xl border shadow-2xl overflow-hidden max-h-96 flex flex-col ${
                                      isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                       <div className="relative">
                                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                          <input 
                                            type="text"
                                            placeholder="Search items..."
                                            value={poSearchQuery}
                                            onChange={(e) => setPoSearchQuery(e.target.value)}
                                            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-bold transition-all outline-none ${
                                              isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-[#2563EB]' : 'bg-white border-slate-200 text-slate-900 focus:border-[#2563EB]'
                                            }`}
                                          />
                                       </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto max-h-64">
                                      {(() => {
                                        const matchedItems = availableItems.filter(item => 
                                          item.item.toLowerCase().includes(poSearchQuery.toLowerCase()) || 
                                          item.item_code.toLowerCase().includes(poSearchQuery.toLowerCase())
                                        );

                                        if (matchedItems.length === 0) {
                                          return (
                                            <div className="p-8 text-center">
                                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No matching items found</p>
                                            </div>
                                          );
                                        }

                                        const matchedSelectedCount = matchedItems.filter(item => (entry.itemQuantities[item.item_code] || 0) > 0).length;
                                        const isAllSelected = matchedItems.length > 0 && matchedSelectedCount === matchedItems.length;
                                        const isSomeSelected = matchedSelectedCount > 0 && matchedSelectedCount < matchedItems.length;

                                        const toggleSelectAll = () => {
                                          setPoEntries(prev => {
                                            return prev.map(e => {
                                              if (e.id === entry.id) {
                                                const updatedQuantities = { ...e.itemQuantities };
                                                matchedItems.forEach(item => {
                                                  if (isAllSelected) {
                                                    updatedQuantities[item.item_code] = 0;
                                                  } else {
                                                    const totalRequested = parseInt(item.qty) || 0;
                                                    const totalAllocated = prev.reduce((sum, poEntry) => sum + (poEntry.itemQuantities[item.item_code] || 0), 0);
                                                    const otherAllocated = totalAllocated - (e.itemQuantities[item.item_code] || 0);
                                                    const remainingQuantity = Math.max(0, totalRequested - otherAllocated);
                                                    updatedQuantities[item.item_code] = remainingQuantity;
                                                  }
                                                });
                                                return {
                                                  ...e,
                                                  itemQuantities: updatedQuantities
                                                };
                                              }
                                              return e;
                                            });
                                          });
                                        };

                                        return (
                                          <>
                                            {/* Select All Row */}
                                            <div
                                              onClick={toggleSelectAll}
                                              className={`px-6 py-3 cursor-pointer transition-colors border-b flex items-center gap-4 group bg-slate-50/50 dark:bg-slate-800/30 sticky top-0 z-10 ${
                                                isDarkMode ? 'border-slate-800 text-slate-200 hover:bg-slate-800' : 'border-slate-100 text-slate-700 hover:bg-slate-100'
                                              }`}
                                            >
                                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                isAllSelected 
                                                  ? 'bg-[#2563EB] border-[#2563EB]' 
                                                  : isSomeSelected 
                                                    ? 'border-[#2563EB] bg-[#2563EB]/10' 
                                                    : 'border-slate-300 dark:border-slate-600'
                                              }`}>
                                                {isAllSelected && <Check size={14} className="text-white" strokeWidth={4} />}
                                                {isSomeSelected && !isAllSelected && (
                                                  <div className="w-2.5 h-0.5 bg-[#2563EB] rounded-sm" />
                                                )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                                                  Select All ({matchedSelectedCount} / {matchedItems.length} Selected)
                                                </p>
                                              </div>
                                            </div>

                                            {matchedItems.map((item: any) => {
                                              const totalRequested = parseInt(item.qty) || 0;
                                              const totalAllocated = poEntries.reduce((sum, e) => sum + (e.itemQuantities[item.item_code] || 0), 0);
                                              const otherAllocated = totalAllocated - (entry.itemQuantities[item.item_code] || 0);
                                              const remainingQuantity = totalRequested - otherAllocated;
                                              const isSelected = (entry.itemQuantities[item.item_code] || 0) > 0;
                                              
                                              return (
                                                <div
                                                  key={item.item_code}
                                                  onClick={() => {
                                                    if (isSelected) {
                                                      handleItemQtyChange(entry.id, item.item_code, 0, totalRequested);
                                                    } else {
                                                      handleItemQtyChange(entry.id, item.item_code, remainingQuantity, totalRequested);
                                                    }
                                                  }}
                                                  className={`px-6 py-4 cursor-pointer transition-colors border-b last:border-0 flex items-center gap-4 group ${
                                                    isSelected
                                                      ? (isDarkMode ? 'bg-[#2563EB]/10' : 'bg-[#2563EB]/5')
                                                      : (isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50')
                                                  } ${isDarkMode ? 'border-slate-800 text-slate-200' : 'border-slate-100 text-slate-700'}`}
                                                >
                                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                    isSelected 
                                                      ? 'bg-[#2563EB] border-[#2563EB]' 
                                                      : 'border-slate-300 dark:border-slate-600'
                                                  }`}>
                                                    {isSelected && <Check size={14} className="text-white" strokeWidth={4} />}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold leading-tight ${isSelected ? 'text-[#2563EB]' : ''}`}>{item.item}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                      {item.item_code} • {remainingQuantity} Remaining 
                                                      {isSelected && <span className="ml-2 text-emerald-500">• SELECTED</span>}
                                                    </p>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Allocated Items List */}
                        <div className="p-6">
                           <div className="flex items-center justify-between mb-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-1">Allocated Equipment</label>
                              <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">{poItemCount} Items Selected</span>
                           </div>
                           <div className="space-y-3">
                              {(poModalRequest.items || []).filter((item: any) => (entry.itemQuantities[item.item_code] || 0) > 0).map((item: any) => {
                                 const totalRequested = parseInt(item.qty) || 0;
                                 const totalAllocated = poEntries.reduce((sum, e) => sum + (e.itemQuantities[item.item_code] || 0), 0);
                                 const otherAllocated = totalAllocated - (entry.itemQuantities[item.item_code] || 0);
                                 const remainingForThisPo = totalRequested - otherAllocated;
                                 const currentVal = entry.itemQuantities[item.item_code] || 0;

                                 return (
                                   <div key={item.item_code} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 animate-in slide-in-from-left-2 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                      <div className="flex items-center gap-3 min-w-0">
                                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                            <Box size={18} className="text-[#2563EB]" />
                                         </div>
                                         <div className="min-w-0">
                                            <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.item}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.item_code}</span>
                                               <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                                               <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{remainingForThisPo} Available</span>
                                            </div>
                                         </div>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0">
                                         <div className="flex flex-col items-end">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Allocated Qty</label>
                                            <input 
                                              type="number"
                                              min="0"
                                              max={remainingForThisPo}
                                              value={currentVal || ''}
                                              onChange={(e) => handleItemQtyChange(entry.id, item.item_code, parseInt(e.target.value) || 0, totalRequested)}
                                              className={`w-20 px-3 py-2 rounded-xl border focus:border-[#2563EB] outline-none text-center text-xs font-black transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                            />
                                         </div>
                                         <button onClick={() => handleItemQtyChange(entry.id, item.item_code, 0, totalRequested)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                            <X size={18} />
                                         </button>
                                      </div>
                                   </div>
                                 );
                              })}
                              {poItemCount === 0 && (
                                <div className="py-12 border-2 border-dashed border-slate-100 dark:border-slate-800/50 rounded-2xl flex flex-col items-center justify-center text-center opacity-50">
                                   <Plus size={32} className="text-slate-300 mb-2" />
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No items allocated to this PO</p>
                                   <p className="text-[9px] font-bold text-slate-400 lowercase mt-1 italic">Use the dropdown above to add items</p>
                                </div>
                              )}
                           </div>
                        </div>

                        {/* PO Summary Section */}
                        <div className={`px-8 py-4 border-t-2 flex items-center justify-between ${isDarkMode ? 'bg-slate-900/40 border-slate-700/50' : 'bg-white/80 border-slate-100'}`}>
                          <div className="flex items-center gap-6">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selected Items</span>
                              <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{poItemCount} SKU(s)</span>
                            </div>
                            <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700" />
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Quantity</span>
                              <span className="text-sm font-black text-[#2563EB]">{poTotalQty} Units</span>
                            </div>
                          </div>
                          {entry.poNumber && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle2 size={14} className="text-emerald-500" />
                              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">PO Validated</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className={`p-20 text-center rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 ${
                  isDarkMode ? 'bg-slate-800/10 border-slate-800 text-slate-500' : 'bg-slate-50/50 border-slate-100 text-slate-400 shadow-inner'
                }`}>
                  <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800/50' : 'bg-white shadow-sm'}`}>
                    <FileText className="opacity-20" size={48} />
                  </div>
                  <h4 className={`text-lg font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    {focusedPoId ? 'Purchase Order Not Found' : 'No Purchase Orders Assigned'}
                  </h4>
                  <p className="text-[11px] font-bold max-w-[200px] leading-relaxed uppercase tracking-widest opacity-60">
                    {focusedPoId ? `Could not find the requested PO entry.` : 'Click the button below to start assigning a new PO to this request'}
                  </p>
                  {focusedPoId && (
                    <button 
                      onClick={() => setFocusedPoId(null)}
                      className="mt-6 text-[10px] font-black text-[#2563EB] uppercase tracking-widest hover:underline"
                    >
                      Show All Purchase Orders
                    </button>
                  )}
                </div>
              )}
              </div>

              {!focusedPoId && (
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleAddPoEntry}
                    className={`w-full py-8 rounded-[2rem] border-2 border-dashed flex items-center justify-center gap-3 transition-all group ${
                      isDarkMode 
                        ? 'border-slate-800 text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#2563EB]/5' 
                        : 'border-slate-200 text-slate-400 hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isDarkMode ? 'bg-slate-800 group-hover:bg-[#2563EB]/20' : 'bg-slate-100 group-hover:bg-[#2563EB]/10'
                    }`}>
                      <Plus size={20} className="group-hover:scale-125 transition-transform" />
                    </div>
                    <span className="text-sm font-black uppercase tracking-[0.1em]">
                      {poEntries.length > 0 ? 'Add Another Purchase Order' : 'Add Purchase Order'}
                    </span>
                  </button>

                  {poEntries.length > 0 && (
                    <button 
                      onClick={() => {
                        setPoEntries([]);
                        setSelectedItemCodeForPo(null);
                        setIsPoDropdownOpen(false);
                      }}
                      className={`w-full py-4 rounded-[2rem] border-2 border-dashed flex items-center justify-center gap-3 transition-all group ${
                        isDarkMode 
                          ? 'border-red-900/30 text-red-500/70 hover:border-red-500 hover:text-red-500 hover:bg-red-500/5' 
                          : 'border-red-100 text-red-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-black uppercase tracking-widest group-hover:text-red-500">Remove All Purchase Orders</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={`p-8 pt-6 border-t shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.5)]' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex flex-col">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Global Summary</span>
                   <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                     Assigning <span className="text-[#2563EB]">{poEntries.reduce((acc, entry) => acc + (Object.values(entry.itemQuantities) as number[]).reduce((a, b) => a + b, 0), 0)}</span> units across <span className="text-[#2563EB]">{poEntries.length}</span> Purchase Order(s)
                     {focusedPoId && poEntries.find(e => e.id === focusedPoId)?.poNumber && (
                       <span className="ml-2 text-orange-500">(Managing PO: {poEntries.find(e => e.id === focusedPoId)?.poNumber})</span>
                     )}
                     {focusedPoId && !poEntries.find(e => e.id === focusedPoId)?.poNumber && (
                       <span className="ml-2 text-emerald-500">(Assigning New PO)</span>
                     )}
                   </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => { 
                    setIsPoModalOpen(false); 
                    setPoModalRequest(null); 
                    setSelectedItemCodeForPo(null); 
                    setIsPoDropdownOpen(false); 
                    setPoSearchQuery(''); 
                  }}
                  className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border-2 ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600' 
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  Discard Changes
                </button>
                <button
                  onClick={handleSavePoFromModal}
                  disabled={isSavingPo || (poEntries.length > 0 && poEntries.every(e => !e.poNumber.trim()))}
                  className="flex-[2] py-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-[#2563EB]/40 transition-all flex items-center justify-center gap-3 group active:scale-95 disabled:opacity-50 disabled:shadow-none"
                >
                  {isSavingPo ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />}
                  {poModalRequest.poNumber ? 'Update Purchase Order' : 'Finalize PO Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsRequest;
