
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, ChevronDown, FileText, Plus, ExternalLink, Calendar, User, Package, Building2, Eye, Edit3, Loader2, ArrowUp, Tag, Clock, Trash2, AlertTriangle, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase, cleanPONumber } from '../lib/utils';
import PageHeader from './PageHeader';

interface PurchaseOrder {
  id: string; // Composite ID or unique PO Number
  poNumber: string;
  requestId: string;
  schoolName: string;
  supplier: string;
  date: string;
  status: string;
  itemCount: number;
  totalQuantity: number;
  hasDeliverables: boolean;
}

interface PurchaseOrdersProps {
  isDarkMode: boolean;
  userRole?: string | null;
  onNavigate?: (viewId: string, params?: any) => void;
}

const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({ 
  isDarkMode, 
  userRole, 
  onNavigate 
}) => {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof PurchaseOrder; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ title: string; desc: string; isError?: boolean } | null>(null);

  // Parsing logic to flatten POs from item_requests
  const fetchPurchaseOrders = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from('item_requests')
        .select('control_no, school_name, date, po_number, status, item_request_items(*)');
      
      if (error) throw error;

      const flattenedPos: PurchaseOrder[] = [];

      requests?.forEach(req => {
        if (!req.po_number) return;

        const reqHasDeliverables = (req.item_request_items || []).some((item: any) => (parseInt(item.received_quantity) || 0) > 0) ||
          req.status === 'Delivered' || req.status === 'Partially Delivered';

        // Use same parsing logic as ItemsRequest.tsx
        const parts = req.po_number.split(';').map((p: string) => p.trim()).filter(Boolean);
        
        parts.forEach((part: string, idx: number) => {
          const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
          
          if (match) {
            let poNumber = '';
            let supplier = '';
            let qtiesRaw = '';
            
            if (match[1] !== undefined) {
              poNumber = match[1].trim();
              supplier = match[2]?.trim() || '';
              qtiesRaw = match[3].trim();
            } else if (match[4] !== undefined) {
              poNumber = match[4].trim();
              supplier = match[5]?.trim() || '';
            } else {
              poNumber = match[6].trim();
            }

            const itemQuantities: Record<string, number> = {};
            let totalQty = 0;
            let itemCount = 0;

            if (qtiesRaw) {
              qtiesRaw.split(',').forEach(q => {
                const pair = q.split(':').map(s => s.trim());
                if (pair.length === 2) {
                  const [code, qtyStr] = pair;
                  const qty = parseInt(qtyStr) || 0;
                  itemQuantities[code] = qty;
                  totalQty += qty;
                  itemCount++;
                }
              });
            }

            flattenedPos.push({
              id: `${req.control_no}-${poNumber}-${idx}`,
              poNumber: poNumber,
              requestId: req.control_no,
              schoolName: req.school_name,
              supplier: supplier || 'N/A',
              date: req.date,
              status: req.status,
              itemCount,
              totalQuantity: totalQty,
              hasDeliverables: reqHasDeliverables
            });
          }
        });
      });

      setPos(flattenedPos);
    } catch (err) {
      console.error("Error fetching purchase orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeletePo = async () => {
    if (!poToDelete || !isSupabaseConfigured) return;

    if (poToDelete.hasDeliverables) {
      setAlertMessage({
        title: 'Delete Disabled',
        desc: `Cannot delete PO "${poToDelete.poNumber}" because deliverables have already been encoded. Revert/delete the deliverables first.`,
        isError: true
      });
      setPoToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Fetch request to get full po_number string
      const { data: req, error: fetchErr } = await supabase
        .from('item_requests')
        .select('po_number, items:item_request_items(*)')
        .eq('control_no', poToDelete.requestId)
        .single();

      if (fetchErr) throw fetchErr;

      // 2. Check if deliverables exist in transactions or received_quantity
      const { data: txs } = await supabase
        .from('stock_transactions')
        .select('id')
        .eq('reference_id', poToDelete.requestId)
        .ilike('reason', `%PO:${poToDelete.poNumber}%`);

      const itemsHasDelivered = (req?.items || []).some((i: any) => (parseInt(i.received_quantity) || 0) > 0);

      if ((txs && txs.length > 0) || itemsHasDelivered) {
        setAlertMessage({
          title: 'Delete Blocked',
          desc: `Cannot delete PO "${poToDelete.poNumber}" because deliverables have already been encoded. Revert deliverables first.`,
          isError: true
        });
        setPoToDelete(null);
        return;
      }

      // 3. Remove PO entry from po_number string
      if (req?.po_number) {
        const parts = req.po_number.split(';').map((p: string) => p.trim()).filter(Boolean);
        const remainingParts = parts.filter((part: string) => {
          const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
          let pNum = '';
          if (match) {
            pNum = (match[1] || match[4] || match[6] || '').trim();
          }
          return pNum.toLowerCase() !== poToDelete.poNumber.toLowerCase();
        });

        const newPoString = remainingParts.length > 0 ? remainingParts.join(' ; ') : null;

        const { error: updateErr } = await supabase
          .from('item_requests')
          .update({ po_number: newPoString })
          .eq('control_no', poToDelete.requestId);

        if (updateErr) throw updateErr;

        setAlertMessage({
          title: 'PO Deleted',
          desc: `Purchase Order "${poToDelete.poNumber}" has been successfully deleted.`,
          isError: false
        });
        await fetchPurchaseOrders();
      }
    } catch (err: any) {
      console.error('Failed to delete PO:', err);
      setAlertMessage({
        title: 'Error',
        desc: err.message || 'Failed to delete Purchase Order.',
        isError: true
      });
    } finally {
      setIsDeleting(false);
      setPoToDelete(null);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const filteredAndSortedPos = useMemo(() => {
    return pos
      .filter(po => {
        const matchesSearch = 
          po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.supplier.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === 'All' || po.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [pos, searchQuery, statusFilter, sortConfig]);

  const toggleSort = (key: keyof PurchaseOrder) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Purchase Orders...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader 
        title="Purchase Orders"
        description="Monitor and manage all purchase orders across item requests"
        isDarkMode={isDarkMode}
      />

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2563EB] transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search by PO Number, School, or Supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-4 rounded-[1.5rem] border-2 transition-all outline-none text-sm font-bold ${
              isDarkMode 
                ? 'bg-slate-900/50 border-slate-800 text-white focus:border-[#2563EB] focus:bg-slate-900' 
                : 'bg-white border-slate-100 text-slate-900 focus:border-[#2563EB] shadow-sm'
            }`}
          />
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`pl-10 pr-10 py-4 rounded-[1.5rem] border-2 appearance-none outline-none text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                isDarkMode 
                  ? 'bg-slate-900/50 border-slate-800 text-white focus:border-[#2563EB]' 
                  : 'bg-white border-slate-100 text-slate-900 focus:border-[#2563EB] shadow-sm'
              }`}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Delivered">Partially</option>
              <option value="Delivered">Completed</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          <button 
            onClick={() => onNavigate?.('requests', { openNewRequest: true })}
            className="flex items-center gap-3 px-8 py-4 bg-[#2563EB] text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-[#1D4ED8] transition-all shadow-[0_10px_20px_-5px_rgba(37,99,235,0.3)] active:scale-95 whitespace-nowrap"
          >
            <Plus size={18} />
            Assign New PO
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className={`flex-1 overflow-hidden rounded-[2rem] border-2 flex flex-col ${
        isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'
      }`}>
        <div className="overflow-x-auto flex-1 no-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className={`border-b text-left sticky top-0 z-10 ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-100'}`}>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-[#2563EB] transition-colors" onClick={() => toggleSort('poNumber')}>PO Number</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-[#2563EB] transition-colors" onClick={() => toggleSort('schoolName')}>School</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-[#2563EB] transition-colors" onClick={() => toggleSort('supplier')}>Supplier</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-[#2563EB] transition-colors text-center" onClick={() => toggleSort('itemCount')}>Items</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-[#2563EB] transition-colors" onClick={() => toggleSort('date')}>Date</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-[#2563EB] transition-colors" onClick={() => toggleSort('status')}>Status</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <AnimatePresence mode='popLayout'>
                {filteredAndSortedPos.map((po) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={po.id}
                    className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer`}
                    onClick={() => onNavigate?.('requests', { requestId: po.requestId, status: 'All', openPoModal: true })}
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          isDarkMode ? 'bg-slate-800 group-hover:bg-[#2563EB]/20' : 'bg-slate-100 group-hover:bg-[#2563EB]/10'
                        }`}>
                          <FileText size={18} className={isDarkMode ? 'text-slate-400 group-hover:text-[#2563EB]' : 'text-slate-500 group-hover:text-[#2563EB]'} />
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white tracking-widest">{po.poNumber}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{po.schoolName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{po.requestId}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{po.supplier}</span>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{po.totalQuantity}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{po.itemCount} Unique</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                        {new Date(po.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="p-6">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        po.status === 'Delivered' 
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                          : po.status === 'Partially Delivered'
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                            : 'bg-blue-100 text-[#2563EB] dark:bg-[#2563EB]/10 dark:text-[#2563EB]'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate?.('requests', { requestId: po.requestId, status: 'All', openPoModal: true });
                          }}
                          className={`p-2 rounded-xl transition-all active:scale-95 hover:bg-[#2563EB] hover:text-white ${
                            isDarkMode ? 'text-slate-500 bg-slate-800' : 'text-slate-400 bg-slate-100'
                          }`}
                          title="Edit Purchase Order"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (po.hasDeliverables) {
                              setAlertMessage({
                                title: 'Delete Disabled',
                                desc: `Cannot delete PO "${po.poNumber}" because deliverables have already been encoded. Please revert/delete deliverables first.`,
                                isError: true
                              });
                              return;
                            }
                            setPoToDelete(po);
                          }}
                          disabled={po.hasDeliverables}
                          className={`p-2 rounded-xl transition-all active:scale-95 ${
                            po.hasDeliverables
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
                              : isDarkMode
                                ? 'text-slate-400 bg-slate-800 hover:text-red-500 hover:bg-red-500/10'
                                : 'text-slate-400 bg-slate-100 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={po.hasDeliverables ? "Delete disabled: Deliverables have already been encoded" : "Delete Purchase Order"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredAndSortedPos.length === 0 && (
            <div className="p-20 flex flex-col items-center justify-center text-center">
                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <FileText size={40} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">No Purchase Orders Found</h3>
                <p className="text-slate-500 text-sm max-w-xs font-medium">Try adjusting your search or filters to find what you're looking for.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {poToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Delete Purchase Order</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{poToDelete.poNumber}</p>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Are you sure you want to delete PO <strong className="text-slate-900 dark:text-white">{poToDelete.poNumber}</strong> for requisition <strong className="text-slate-900 dark:text-white">{poToDelete.requestId}</strong>? This action will remove the PO assignment from the request.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setPoToDelete(null)}
                disabled={isDeleting}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDeletePo}
                disabled={isDeleting}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                <span>Delete PO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert / Notification Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                alertMessage.isError ? 'bg-red-100 dark:bg-red-500/10 text-red-500' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-500'
              }`}>
                {alertMessage.isError ? <AlertTriangle size={24} /> : <FileText size={24} />}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black tracking-tight">{alertMessage.title}</h3>
              </div>
              <button 
                onClick={() => setAlertMessage(null)}
                className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              {alertMessage.desc}
            </p>

            <div className="flex justify-end">
              <button 
                onClick={() => setAlertMessage(null)}
                className="px-6 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
