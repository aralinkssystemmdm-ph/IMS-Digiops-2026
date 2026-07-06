
import React, { useState, useEffect } from 'react';
import { X, Box, History, ArrowRightLeft, TrendingUp, Loader2, User, Info, ChevronDown, Edit2, Trash2, AlertCircle, Check } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';

interface InventoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  item: {
    item_code: string;
    item_name: string;
    total_quantity: number;
    status: string;
  };
  isDarkMode?: boolean;
  userRole?: string | null;
}

interface Transaction {
  id: string;
  from_location: string | null;
  to_location: string;
  quantity: number;
  transaction_type: string;
  created_at: string;
  created_by: string;
  reference_id: string | null;
  reason?: string;
  serial_numbers?: string[];
}

const InventoryDetailsModal: React.FC<InventoryDetailsModalProps> = ({ isOpen, onClose, onUpdate, item, isDarkMode = false, userRole = 'Staff' }) => {
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSerials, setExpandedSerials] = useState<{ [key: string]: boolean }>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [editQty, setEditQty] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editSerials, setEditSerials] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const isSuperAdmin = userRole === 'Super admin';
  const isAdmin = userRole === 'Admin' || isSuperAdmin;

  const formatCreatedBy = (username: string) => {
    if (!username) return 'System';
    
    const currentUsername = localStorage.getItem('aralinks_user');
    const currentFullName = localStorage.getItem('aralinks_fullname');
    
    // If the transaction user matches the current logged in user, use their stored full name
    if (username.toLowerCase() === currentUsername?.toLowerCase() && currentFullName) {
      return currentFullName.split(' ')[0];
    }
    
    // Fallback: handle the 'admin' word specifically if it matches current user expectations
    if (username.toLowerCase() === 'admin' && !currentUsername) {
      return 'Admin';
    }

    // Return the first part of the username if no full name is available
    return username.split(/[._ ]/)[0];
  };

  const handleUpdateTransaction = async () => {
    if (!isSupabaseConfigured || !editingTx) return;
    
    const newQty = parseInt(editQty);
    if (isNaN(newQty) || newQty < 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid quantity.' });
      return;
    }

    // If serialized, quantity must match serial numbers count
    if (editingTx.serial_numbers && editingTx.serial_numbers.length > 0 && newQty !== editSerials.length) {
      setFeedback({ type: 'error', message: `The quantity (${newQty}) must match the number of serial numbers (${editSerials.length}).` });
      return;
    }

    setIsUpdating(true);
    setFeedback(null);
    try {
      const diff = newQty - editingTx.quantity;
      const oldSerials = editingTx.serial_numbers || [];
      const isInitial = editingTx.transaction_type === 'Initial' || editingTx.transaction_type === 'Replenishment';

      // 1. Update Serial Numbers
      if (editSerials.length > 0 || oldSerials.length > 0) {
        // Find serials to delete (in old but not in new)
        const toDelete = oldSerials.filter(s => !editSerials.includes(s));
        if (toDelete.length > 0) {
          const { error: delError } = await supabase
            .from('item_serials')
            .delete()
            .eq('item_code', item.item_code)
            .in('serial_number', toDelete);
          if (delError) throw delError;
        }

        // Handle updates and additions
        for (let i = 0; i < editSerials.length; i++) {
          const newSn = editSerials[i].trim();
          if (!newSn) continue;

          const oldSn = i < oldSerials.length ? oldSerials[i] : null;

          if (oldSn && oldSn !== newSn) {
            // Update existing
            const { error: updError } = await supabase
              .from('item_serials')
              .update({ serial_number: newSn })
              .eq('item_code', item.item_code)
              .eq('serial_number', oldSn);
            if (updError) {
              if (updError.message.includes('unique')) throw new Error(`Serial "${newSn}" already exists.`);
              throw updError;
            }
          } else if (!oldSn) {
            // Add new
            const { error: insError } = await supabase
              .from('item_serials')
              .insert({
                item_code: item.item_code,
                serial_number: newSn,
                location: editingTx.to_location,
                status: 'Available',
                condition: 'Brand New', // Default for initial
                request_id: editingTx.reference_id || null
              });
            if (insError) {
              if (insError.message.includes('unique')) throw new Error(`Serial "${newSn}" already exists.`);
              throw insError;
            }
          }
        }
      }

      if (diff !== 0) {
        // 2. Update stock in to_location (Destination)
        const { data: stockInfo, error: fetchStockError } = await supabase
          .from('item_location_stocks')
          .select('*')
          .eq('item_code', item.item_code)
          .eq('location', editingTx.to_location)
          .maybeSingle();

        if (fetchStockError) throw fetchStockError;

        if (stockInfo) {
          const newTotal = (stockInfo.quantity || 0) + diff;
          if (newTotal < 0) throw new Error(`Resulting stock at ${editingTx.to_location} cannot be negative.`);

          const updateFields: any = { quantity: newTotal };
          if (isInitial && stockInfo.brand_new_qty !== undefined) {
             updateFields.brand_new_qty = (stockInfo.brand_new_qty || 0) + diff;
          }

          const { error: stockError } = await supabase
            .from('item_location_stocks')
            .update(updateFields)
            .eq('id', stockInfo.id);

          if (stockError) throw stockError;
        }

        // 3. If it's a Transfer, update from_location (Source)
        if (editingTx.transaction_type === 'Transfer' && editingTx.from_location) {
          const { data: fromStockInfo, error: fetchFromError } = await supabase
            .from('item_location_stocks')
            .select('*')
            .eq('item_code', item.item_code)
            .eq('location', editingTx.from_location)
            .maybeSingle();

          if (fetchFromError) throw fetchFromError;

          if (fromStockInfo) {
            // Subtract diff from source
            const newFromTotal = (fromStockInfo.quantity || 0) - diff;
            if (newFromTotal < 0) throw new Error(`Resulting stock at ${editingTx.from_location} cannot be negative.`);

            const { error: fromStockError } = await supabase
              .from('item_location_stocks')
              .update({ quantity: newFromTotal })
              .eq('id', fromStockInfo.id);

            if (fromStockError) throw fromStockError;
          }
        }
      }

      // 3. Update transaction record
      const { error: updateError } = await supabase
        .from('stock_transactions')
        .update({ 
          quantity: newQty,
          reason: editReason 
        })
        .eq('id', editingTx.id);

      if (updateError) throw updateError;
      
      setFeedback({ type: 'success', message: 'Transaction updated successfully.' });
      if (onUpdate) onUpdate();
      setTimeout(() => {
        setEditingTx(null);
        setFeedback(null);
      }, 1500);
      fetchDetails();
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to update transaction.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!isSupabaseConfigured || !item) return;
    
    setIsDeleting(tx.id);
    console.log(`[Delete] Starting deletion for transaction ${tx.id} (${tx.transaction_type})`);
    
    try {
      const isInitial = tx.transaction_type === 'Initial' || tx.transaction_type === 'Replenishment';

      // 1. Revert stock in to_location (Destination)
      // Note: For additions (Initial/Restock/Adjustment > 0), we subtract.
      // For subtractions (Adjustment < 0), we add back (Subtracting a negative = adding).
      const { data: stockInfo, error: fetchStockError } = await supabase
        .from('item_location_stocks')
        .select('*')
        .eq('item_code', item.item_code)
        .eq('location', tx.to_location)
        .maybeSingle();

      if (fetchStockError) {
        console.error('[Delete] Fetch stock error:', fetchStockError);
        throw new Error(`Failed to fetch stock info for ${tx.to_location}`);
      }

      if (stockInfo) {
        const newTotal = (stockInfo.quantity || 0) - tx.quantity;
        
        if (newTotal < 0 && tx.quantity > 0) {
           throw new Error(`Cannot delete: Reverting this would result in negative stock (${newTotal}) at ${tx.to_location}.`);
        }

        const updateFields: any = { quantity: newTotal };
        
        // Breakdown Sync: Revert the quantity from specific condition fields
        // For additions (tx.quantity > 0), we subtract from the breakdown
        // For subtractions (tx.quantity < 0), we add back to the breakdown
        if (tx.quantity > 0) {
          let remainingToSubtract = tx.quantity;
          
          // Priority: brand_new -> used -> defective -> disposal
          const brandNew = stockInfo.brand_new_qty || 0;
          const subBrandNew = Math.min(brandNew, remainingToSubtract);
          updateFields.brand_new_qty = brandNew - subBrandNew;
          remainingToSubtract -= subBrandNew;
          
          if (remainingToSubtract > 0) {
            const used = stockInfo.used_qty || 0;
            const subUsed = Math.min(used, remainingToSubtract);
            updateFields.used_qty = used - subUsed;
            remainingToSubtract -= subUsed;
          }
          
          if (remainingToSubtract > 0) {
            const defective = stockInfo.defective_qty || 0;
            const subDefective = Math.min(defective, remainingToSubtract);
            updateFields.defective_qty = defective - subDefective;
            remainingToSubtract -= subDefective;
          }
          
          if (remainingToSubtract > 0) {
            const disposal = stockInfo.disposal_qty || 0;
            updateFields.disposal_qty = Math.max(0, disposal - remainingToSubtract);
          }
        } else if (tx.quantity < 0) {
          // Reverting a subtraction: Add back to brand_new_qty by default
          updateFields.brand_new_qty = (stockInfo.brand_new_qty || 0) + Math.abs(tx.quantity);
        }

        const { error: stockError } = await supabase
          .from('item_location_stocks')
          .update(updateFields)
          .eq('id', stockInfo.id);

        if (stockError) {
          console.error('[Delete] Stock update error:', stockError);
          throw new Error(`Failed to update stock at ${tx.to_location}`);
        }
        console.log(`[Delete] Reverted stock at ${tx.to_location}. New total: ${newTotal}`);
      } else {
        console.warn(`[Delete] No stock record found at ${tx.to_location} to revert. Proceeding.`);
      }

      // 2. If it was a Transfer, revert from_location (Source)
      if (tx.transaction_type === 'Transfer' && tx.from_location) {
        const { data: fromStockInfo, error: fetchFromError } = await supabase
          .from('item_location_stocks')
          .select('*')
          .eq('item_code', item.item_code)
          .eq('location', tx.from_location)
          .maybeSingle();

        if (fetchFromError) {
          console.error('[Delete] Fetch from-stock error:', fetchFromError);
          throw new Error(`Failed to fetch source stock info for ${tx.from_location}`);
        }

        if (fromStockInfo) {
          const newFromTotal = (fromStockInfo.quantity || 0) + tx.quantity;
          const { error: fromStockError } = await supabase
            .from('item_location_stocks')
            .update({ 
              quantity: newFromTotal,
              brand_new_qty: (fromStockInfo.brand_new_qty || 0) + tx.quantity // Adding back to source
            })
            .eq('id', fromStockInfo.id);

          if (fromStockError) {
            console.error('[Delete] From-stock update error:', fromStockError);
            throw new Error(`Failed to update source stock at ${tx.from_location}`);
          }
          console.log(`[Delete] Restored stock at ${tx.from_location}. New total: ${newFromTotal}`);
        }
      }

      // 3. Delete serials associated with this specific transaction
      if (tx.serial_numbers && tx.serial_numbers.length > 0) {
        console.log(`[Delete] Deleting ${tx.serial_numbers.length} serials by number...`);
        const { error: snDeleteError } = await supabase
          .from('item_serials')
          .delete()
          .eq('item_code', item.item_code)
          .in('serial_number', tx.serial_numbers);
        
        if (snDeleteError) {
          console.error('[Delete] Serial deletion by number error:', snDeleteError);
        }
      } else if (tx.reference_id) {
        console.log(`[Delete] No serial array, attempting deletion by reference_id ${tx.reference_id}...`);
        const { error: snRefDeleteError } = await supabase
          .from('item_serials')
          .delete()
          .eq('item_code', item.item_code)
          .eq('request_id', tx.reference_id);
        
        if (snRefDeleteError) {
          console.error('[Delete] Serial deletion by reference error:', snRefDeleteError);
        }
      }

      // 4. Delete the transaction record itself
      console.log(`[Delete] Final step: Deleting transaction record ${tx.id}...`);
      const { error: deleteError } = await supabase
        .from('stock_transactions')
        .delete()
        .eq('id', tx.id);

      if (deleteError) {
        console.error('[Delete] Transaction deletion error:', deleteError);
        throw new Error('Failed to delete the transaction record itself.');
      }

      console.log(`[Delete] Success for ${tx.id}`);
      setConfirmDeleteTx(null);
      if (onUpdate) onUpdate();
      fetchDetails();
    } catch (err: any) {
      console.error('[Delete] Final Catch Error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to delete transaction.' });
    } finally {
      setIsDeleting(null);
    }
  };

  useEffect(() => {
    if (isOpen && item.item_code) {
      fetchDetails();
    }
  }, [isOpen, item.item_code]);

  const fetchDetails = async () => {
    if (!isSupabaseConfigured || !item?.item_code) return;
    setLoading(true);
    try {
      const { data: txData, error: txError } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('item_code', item.item_code)
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      if (!txData || txData.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      // Fetch all serials for this item code
      // We filter by item_code which is indexed, making this reasonably efficient
      const { data: serialData, error: serialError } = await supabase
        .from('item_serials')
        .select('serial_number, request_id, location')
        .eq('item_code', item.item_code);

      if (serialError) {
        console.error('Error fetching serials:', serialError);
      }

      // Group serials by request_id
      const serialGroups: { [key: string]: string[] } = {};
      const nullRequestIdSerials: string[] = [];
      
      if (serialData) {
        serialData.forEach(s => {
          if (s.request_id) {
            if (!serialGroups[s.request_id]) serialGroups[s.request_id] = [];
            serialGroups[s.request_id].push(s.serial_number);
          } else {
            nullRequestIdSerials.push(s.serial_number);
          }
        });
      }

      // Track how many serials we've assigned for each group to handle split transactions
      const cursors: { [key: string]: number } = {};
      let initialNullCursor = 0;

      // Note: We process transactions in FETCHED order (most recent first)
      // If there are multiple transactions with NO reference_id (old data), 
      // they will take serials in whatever order serialData came in (usually creation order).
      
      const historyWithSerials = txData.map(tx => {
        const refId = tx.reference_id;
        const isInitialType = tx.transaction_type === 'Initial' || tx.transaction_type === 'Replenishment';
        const qty = Math.abs(tx.quantity);

        // 1. If we have a reference_id, try that first (Standard case for new data)
        if (refId && serialGroups[refId]) {
          const currentCursor = cursors[refId] || 0;
          const slice = serialGroups[refId].slice(currentCursor, currentCursor + qty);
          cursors[refId] = currentCursor + qty;
          return { ...tx, serial_numbers: slice };
        }

        // 2. If it's an Initial transaction and we have serials with null request_id
        if (isInitialType && nullRequestIdSerials.length > 0) {
          const slice = nullRequestIdSerials.slice(initialNullCursor, initialNullCursor + qty);
          initialNullCursor += qty;
          return { ...tx, serial_numbers: slice };
        }

        return { ...tx, serial_numbers: [] };
      });
      
      setHistory(historyWithSerials);
    } catch (err) {
      console.error('Error fetching Transaction History:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(tx => {
    if (!historySearchQuery.trim()) return true;
    const query = historySearchQuery.toLowerCase();
    return (
      tx.transaction_type.toLowerCase().includes(query) ||
      (tx.reason || '').toLowerCase().includes(query) ||
      (tx.reference_id || '').toLowerCase().includes(query) ||
      (tx.serial_numbers || []).some(s => s.toLowerCase().includes(query)) ||
      (tx.from_location || '').toLowerCase().includes(query) ||
      tx.to_location.toLowerCase().includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-2xl rounded-[2rem] shadow-2xl border-2 overflow-hidden animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`} style={{ borderColor: 'var(--brand-accent)' }}>
        {/* Header */}
        <div className="p-8 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)' }}>
              <Box size={28} style={{ color: 'var(--brand-accent)' }} />
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.item_name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.item_code}</span>
                <div className={`w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700`} />
                <span className={`text-[10px] font-black tracking-widest uppercase ${item.status === 'Critical' ? 'text-red-500' : 'text-emerald-500'}`}>
                  {item.status}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {!loading && (
            <div className="mb-6 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <History size={16} />
              </div>
              <input
                type="text"
                placeholder="Search history by PO, serial, or reason..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 rounded-2xl border-2 outline-none text-xs font-bold transition-all focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                }`}
              />
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="animate-spin text-[#FE4E02]" size={40} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading history...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((tx) => (
                  <div 
                    key={tx.id}
                    className={`p-5 rounded-2xl border flex items-start gap-4 transition-all hover:scale-[1.01] ${
                      isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.transaction_type === 'Delivery' ? 'bg-emerald-500/10 text-emerald-500' :
                      tx.transaction_type === 'Transfer' ? 'bg-blue-500/10 text-blue-500' :
                      tx.transaction_type === 'Adjustment' ? 'bg-amber-500/10 text-amber-500' :
                      ''
                    }`} style={tx.transaction_type !== 'Delivery' && tx.transaction_type !== 'Transfer' && tx.transaction_type !== 'Adjustment' ? { backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' } : undefined}>
                      {tx.transaction_type === 'Delivery' ? <TrendingUp size={20} /> :
                       tx.transaction_type === 'Transfer' ? <ArrowRightLeft size={20} /> :
                       tx.transaction_type === 'Adjustment' ? <Info size={20} /> :
                       <Box size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {(tx.transaction_type === 'Initial' || tx.transaction_type === 'Replenishment') ? 'Initial' : tx.transaction_type}
                          </span>
                          
                          {(isSuperAdmin || (userRole === 'Admin' && tx.transaction_type !== 'Initial' && tx.transaction_type !== 'Replenishment')) && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => {
                                  setEditingTx(tx);
                                  setEditQty(tx.quantity.toString());
                                  setEditReason(tx.reason || '');
                                  setEditSerials(tx.serial_numbers || []);
                                }}
                                className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-700'}`}
                                title="Edit Record"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteTx(tx)}
                                disabled={isDeleting === tx.id}
                                className={`p-1.5 rounded-lg transition-all ${
                                  isDeleting === tx.id ? 'opacity-50 cursor-not-allowed' :
                                  isDarkMode ? 'bg-slate-700 text-red-400 hover:text-red-300' : 'bg-white border text-red-500 hover:text-white hover:bg-red-500'
                                }`}
                                title="Delete Record"
                              >
                                {isDeleting === tx.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={`mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {tx.transaction_type === 'Transfer' ? (
                          <div className="space-y-2 py-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                Transfer <span className="text-red-500 font-black">(-) {tx.quantity}</span> from <span className="underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4">{tx.from_location}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                Transfer <span className="text-emerald-500 font-black">{tx.quantity} (units)</span> to <span className="underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4">{tx.to_location}</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-base font-bold">
                            {(tx.transaction_type === 'Initial' || tx.transaction_type === 'Replenishment') ? (
                              <>Initialized <span className="font-black" style={{ color: 'var(--brand-accent)' }}>{tx.quantity}</span> units at <span className="underline">{tx.to_location}</span></>
                            ) : tx.transaction_type === 'Adjustment' ? (
                              <>Adjusted stock by <span className="font-black" style={{ color: 'var(--brand-accent)' }}>{tx.quantity}</span> at <span className="underline">{tx.to_location}</span></>
                            ) : (
                              <>Delivered <span className="font-black" style={{ color: 'var(--brand-accent)' }}>{tx.quantity}</span> units to <span className="underline">{tx.to_location}</span></>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-6 mb-4">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {formatCreatedBy(tx.created_by)}
                          </span>
                        </div>
                        {tx.reference_id && (
                          <div className="flex items-center gap-2">
                            <History size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{tx.reference_id}</span>
                          </div>
                        )}
                      </div>

                      {tx.serial_numbers && tx.serial_numbers.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                          <button
                            onClick={() => setExpandedSerials(prev => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                            className="flex items-center justify-between w-full mb-3 group transition-all text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Box size={14} className="text-brand-orange" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-orange transition-colors">
                                Linked Serials ({tx.serial_numbers.length})
                              </span>
                            </div>
                            <div className={`p-1 rounded-md transition-all ${
                              expandedSerials[tx.id] 
                                ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20' 
                                : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                            }`}>
                              <ChevronDown size={12} className={`transition-transform duration-300 ${expandedSerials[tx.id] ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {expandedSerials[tx.id] && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 animate-in slide-in-from-top-2 duration-200">
                              {tx.serial_numbers.map((sn, idx) => (
                                <div 
                                  key={idx} 
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                                  }`}
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                                  <span className={`font-mono text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {sn}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {tx.reason && (
                        <div className={`mt-4 p-4 rounded-2xl border ${
                          isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
                        }`}>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Reason / Notes</p>
                          <p className="text-xs font-semibold italic">{tx.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 opacity-20">
                  <History size={64} className="mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-[0.3em]">No movement history</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-50 bg-slate-50/30'}`}>
          <button 
            onClick={onClose}
            className="w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
            style={{ 
              backgroundColor: 'var(--brand-accent)',
              boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)'
            }}
          >
            Close History
          </button>
        </div>

        {/* Edit Transaction Modal */}
        {editingTx && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setEditingTx(null); setFeedback(null); }} />
            <div className={`relative w-full max-w-md rounded-3xl shadow-3xl border animate-in zoom-in-95 duration-200 ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
            }`}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                    <Edit2 size={20} className="text-brand-orange" />
                  </div>
                  <h4 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Edit {editingTx.transaction_type === 'Replenishment' ? 'Initial' : editingTx.transaction_type}</h4>
                </div>
                <button onClick={() => { setEditingTx(null); setFeedback(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {feedback && (
                <div className={`mx-6 mt-4 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                  feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  {feedback.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  <span className="text-xs font-bold">{feedback.message}</span>
                </div>
              )}

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                    <input 
                      type="number"
                      value={editQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditQty(val);
                        // If quantity decreases, we might want to truncate serials, but it's risky
                        // If it increases, we add empty ones
                        const num = parseInt(val) || 0;
                        if (num > editSerials.length && editingTx.serial_numbers && editingTx.serial_numbers.length > 0) {
                          const newer = [...editSerials];
                          while (newer.length < num) newer.push('');
                          setEditSerials(newer);
                        } else if (num < editSerials.length) {
                          setEditSerials(editSerials.slice(0, num));
                        }
                      }}
                      className={`w-full px-5 py-4 rounded-xl border-2 outline-none font-bold text-sm transition-all focus:border-brand-orange ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                    />
                  </div>

                  {editingTx.serial_numbers && editingTx.serial_numbers.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial Numbers</label>
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {editSerials.map((sn, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={sn}
                            placeholder={`Serial # ${idx + 1}`}
                            onChange={(e) => {
                              const newer = [...editSerials];
                              newer[idx] = e.target.value;
                              setEditSerials(newer);
                            }}
                            className={`w-full px-4 py-2 rounded-lg border font-mono text-xs font-bold outline-none transition-all focus:border-brand-orange ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-1">
                        <AlertCircle size={10} />
                        Careful: Serial numbers must be unique across the system.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason / Notes</label>
                    <textarea 
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      rows={2}
                      placeholder="Enter reason for adjustment..."
                      className={`w-full px-5 py-4 rounded-xl border-2 outline-none font-bold text-sm transition-all focus:border-brand-orange resize-none ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-white/[0.02] flex gap-3">
                <button 
                  onClick={() => setEditingTx(null)}
                  className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  disabled={isUpdating}
                  onClick={handleUpdateTransaction}
                  className="flex-1 py-4 bg-brand-orange text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-orange/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isUpdating ? <Loader2 size={16} className="animate-spin" /> : 'Update Record'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {confirmDeleteTx && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!isDeleting) setConfirmDeleteTx(null); }} />
            <div className={`relative w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
              isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
            }`}>
              <div className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={40} />
                </div>
                <h3 className={`text-xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Delete {confirmDeleteTx.transaction_type === 'Replenishment' ? 'Initial' : confirmDeleteTx.transaction_type} Record?
                </h3>
                <p className={`text-xs font-semibold leading-relaxed mb-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  This will revert <span className="text-red-500 font-bold">{confirmDeleteTx.quantity} units</span> from <span className="underline">{confirmDeleteTx.to_location}</span> and permanently delete associated serial numbers.
                </p>

                {feedback && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-500 flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span className="text-[10px] font-bold text-left">{feedback.message}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleDeleteTransaction(confirmDeleteTx)}
                    disabled={!!isDeleting}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Deletion'}
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteTx(null); setFeedback(null); }}
                    disabled={!!isDeleting}
                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all ${
                      isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryDetailsModal;
