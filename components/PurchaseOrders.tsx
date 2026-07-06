
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, ChevronDown, FileText, Plus, ExternalLink, Calendar, User, Package, Building2, Eye, Edit3, Loader2, ArrowUp, Tag, Clock } from 'lucide-react';
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
              totalQuantity: totalQty
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
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.('requests', { requestId: po.requestId, status: 'All', openPoModal: true });
                        }}
                        className={`p-2 rounded-xl transition-all active:scale-95 hover:bg-[#2563EB] hover:text-white ${
                          isDarkMode ? 'text-slate-500 bg-slate-800' : 'text-slate-400 bg-slate-100'
                        }`}
                      >
                        <Edit3 size={16} />
                      </button>
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
    </div>
  );
};

export default PurchaseOrders;
