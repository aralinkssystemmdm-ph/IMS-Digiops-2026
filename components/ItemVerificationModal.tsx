
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Hash, Box, History, Calendar, User, Info, ArrowRightLeft, PackageCheck, Pencil, Check } from 'lucide-react';
import { toTitleCase, cleanPONumber } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface ItemVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData | null;
  onConfirm: () => void;
  onNavigate?: (viewId: string, params?: any) => void;
  isDarkMode?: boolean;
}

interface DeliveryHistory {
  id: string;
  created_at: string;
  item_code: string;
  quantity: number;
  created_by: string;
  reason?: string;
  item_name?: string;
  serials?: string[];
}

const ItemVerificationModal: React.FC<ItemVerificationModalProps> = ({ 
  isOpen, 
  onClose, 
  request, 
  onConfirm,
  onNavigate,
  isDarkMode = false 
}) => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [history, setHistory] = useState<DeliveryHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSerials, setExpandedSerials] = useState<Record<string, boolean>>({});

  const [selectedPOIndex, setSelectedPOIndex] = useState<number | null>(null);
  const [editingDateGroup, setEditingDateGroup] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>('');
  const [isUpdatingDate, setIsUpdatingDate] = useState<boolean>(false);

  const poList = useMemo(() => {
    if (!request?.poNumber) return [];

    // Calculate received per PO from history to determine completion status
    const receivedPerPO: Record<string, Record<string, number>> = {};
    history.forEach(tx => {
      if (tx.reason?.includes('PO:')) {
        const poMatch = tx.reason.match(/PO:([^|]+)/);
        if (poMatch) {
          const poNum = poMatch[1].trim();
          if (!receivedPerPO[poNum]) receivedPerPO[poNum] = {};
          receivedPerPO[poNum][tx.item_code] = (receivedPerPO[poNum][tx.item_code] || 0) + (parseInt(tx.quantity as any) || 0);
        }
      }
    });

    const parts = request.poNumber.split(';').map(p => p.trim()).filter(Boolean);
    return parts.map(part => {
      // Regex to match: PO_NUMBER [SUPPLIER] {CODE:QTY,...}
      const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
      
      let poNum = '';
      let qtiesRaw = '';
      let supplier = '';

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
      
      const items: Record<string, number> = {};
      if (qtiesRaw) {
        qtiesRaw.split(',').forEach(q => {
          const [code, qty] = q.split(':').map(s => s.trim());
          if (code && qty) items[code] = parseInt(qty) || 0;
        });
      }

      // Check if all items in this PO are complete
      let isComplete = true;
      let hasItems = false;
      Object.entries(items).forEach(([code, targetQty]) => {
        hasItems = true;
        const received = receivedPerPO[poNum]?.[code] || 0;
        if (received < targetQty) isComplete = false;
      });

      return { poNum, items, supplier, isComplete: hasItems && isComplete };
    });
  }, [request?.poNumber, history]);

  const toggleSerials = (id: string) => {
    setExpandedSerials(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEditDate = (groupKey: string, currentIsoDate: string) => {
    try {
      const d = new Date(currentIsoDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setEditingDateGroup(groupKey);
      setEditingDateValue(`${yyyy}-${mm}-${dd}`);
    } catch {
      setEditingDateGroup(groupKey);
      setEditingDateValue('');
    }
  };

  const handleSaveDate = async (groupKey: string, txIds: string[]) => {
    if (!editingDateValue) return;
    setIsUpdatingDate(true);
    try {
      const [year, month, day] = editingDateValue.split('-').map(Number);
      const newDateObj = new Date(year, month - 1, day, 12, 0, 0);
      const newIso = newDateObj.toISOString();

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('stock_transactions')
          .update({ created_at: newIso })
          .in('id', txIds);
        if (error) throw error;

        if (request?.id) {
          await supabase
            .from('item_requests')
            .update({ delivered_at: newIso })
            .eq('control_no', request.id);
        }
      }

      setHistory(prev =>
        prev.map(tx => {
          if (txIds.includes(tx.id)) {
            return { ...tx, created_at: newIso };
          }
          return tx;
        })
      );

      setEditingDateGroup(null);
      showSuccess('Date received updated successfully');
    } catch (err: any) {
      console.error('Error updating date received:', err);
      showError(err.message || 'Failed to update date received');
    } finally {
      setIsUpdatingDate(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedPOIndex(null);
      setEditingDateGroup(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (isOpen && request && isSupabaseConfigured) {
        setLoading(true);
        try {
          // Fetch transactions sorted by date ASC (to help with serial assignment)
          const { data: transactions, error } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('reference_id', request.id)
            .eq('transaction_type', 'Delivery')
            .order('created_at', { ascending: true });

          if (error) throw error;
          
          if (transactions && transactions.length > 0) {
            const itemCodes = Array.from(new Set(transactions.map(d => d.item_code)));
            
            // Fetch item descriptions
            const { data: itemsData } = await supabase
              .from('equipment')
              .select('item_code, description')
              .in('item_code', itemCodes);
            
            // Fetch serials for this request
            const { data: serialsData } = await supabase
              .from('item_serials')
              .select('item_code, serial_number, created_at')
              .eq('request_id', request.id)
              .order('created_at', { ascending: true });

            // Group serials by item_code to distribute them across transactions
            const serialsByItem: Record<string, string[]> = {};
            if (serialsData) {
              serialsData.forEach(s => {
                if (!serialsByItem[s.item_code]) serialsByItem[s.item_code] = [];
                serialsByItem[s.item_code].push(s.serial_number);
              });
            }

            // Assign serials to transactions in chronological order
            // We use a copy of serialsByItem so we can shift/splice them
            const serialsQueue = JSON.parse(JSON.stringify(serialsByItem));
            
            const historyWithDetails = transactions.map(d => {
              const itemSerials = serialsQueue[d.item_code] 
                ? serialsQueue[d.item_code].splice(0, d.quantity)
                : [];

              return {
                ...d,
                item_name: itemsData?.find(i => i.item_code === d.item_code)?.description || d.item_code,
                serials: itemSerials
              };
            });

            // Set state (reversing back to DESC for display)
            setHistory([...historyWithDetails].reverse());
          } else {
            setHistory([]);
          }
        } catch (err) {
          console.error('Error fetching delivery history:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchHistory();
  }, [isOpen, request]);

  const groupedHistory = useMemo(() => {
    const groups: { 
      groupKey: string;
      date: string; 
      firstCreatedAt: string;
      items: { 
        id: string; 
        name: string; 
        code: string; 
        qty: number; 
        received_by: string; 
        reason: string; 
        serials?: string[] 
      }[] 
    }[] = [];
    
    history.forEach(tx => {
      const txDate = new Date(tx.created_at);
      const date = txDate.toLocaleDateString();
      const groupKey = `${txDate.getFullYear()}-${txDate.getMonth() + 1}-${txDate.getDate()}`;
      
      let existing = groups.find(g => g.groupKey === groupKey || g.date === date);
      if (!existing) {
        existing = { groupKey, date, firstCreatedAt: tx.created_at, items: [] };
        groups.push(existing);
      }

      existing.items.push({
        id: tx.id,
        name: tx.item_name || tx.item_code,
        code: tx.item_code,
        qty: tx.quantity,
        received_by: tx.created_by,
        reason: tx.reason || 'No remarks',
        serials: tx.serials
      });
    });
    
    return groups;
  }, [history]);

  if (!isOpen || !request) return null;

  const handleProceed = () => {
    const selectedPO = selectedPOIndex !== null ? poList[selectedPOIndex] : null;
    const hasItems = selectedPO?.items && Object.keys(selectedPO.items).length > 0;
    
    navigate(`/requests/${request.id}/serial-entry`, { 
      state: { 
        selectedPO: selectedPO?.poNum || null,
        poItems: hasItems ? selectedPO.items : null
      } 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
              {request.status === 'Delivered' ? toTitleCase('Delivery Records') : toTitleCase('Verify Received Items')}
            </h2>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 tracking-wider uppercase flex flex-wrap gap-x-4">
              <span>Control No: <span className="text-[#FE4E02]">{request.id}</span></span>
              {request.ticketNo && (
                 <span>Ticket No: <span className="text-[#FE4E02]">{request.ticketNo}</span></span>
              )}
              {request.poNumber && (
                <span>PO No: <span className="text-[#0081f1]">{cleanPONumber(request.poNumber)}</span></span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-8">
          {/* PO Selection Section - Only if there are POs and it's not fully delivered */}
          {request.status !== 'Delivered' && poList.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <PackageCheck size={14} className="text-[#0081f1]" />
                Select PO to Process
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {poList.map((po, idx) => (
                  <button
                    key={idx}
                    onClick={() => !po.isComplete && setSelectedPOIndex(idx)}
                    disabled={po.isComplete}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all group ${
                      po.isComplete 
                        ? 'opacity-50 cursor-not-allowed grayscale' 
                        : selectedPOIndex === idx 
                          ? 'border-[#FE4E02] bg-[#FE4E02]/5 shadow-lg shadow-[#FE4E02]/10 scale-[1.02]' 
                          : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-black tracking-tight ${selectedPOIndex === idx ? 'text-[#FE4E02]' : 'text-slate-800 dark:text-white'}`}>
                        {po.poNum}
                      </span>
                      {po.isComplete ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : selectedPOIndex === idx ? (
                        <div className="w-4 h-4 rounded-full border-4 border-[#FE4E02]" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 pointer-events-none" />
                      )}
                    </div>
                    {po.supplier && (
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <User size={10} />
                        {po.supplier}
                      </div>
                    )}
                    {po.isComplete && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50/20 dark:bg-slate-900/10 backdrop-blur-[1px] rounded-2xl">
                         <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">Complete</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <History size={14} className="text-[#FE4E02]" />
              Delivery Records
            </h3>

                {loading ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <Loader2 className="animate-spin text-[#FE4E02]" size={32} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fetching history...</p>
                  </div>
                ) : history.length > 0 ? (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                          <th className="w-[20%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Date Received</th>
                          <th className="w-[35%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Item</th>
                          <th className="w-[10%] px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Qty</th>
                          <th className="w-[17%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Received By</th>
                          <th className="w-[18%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {groupedHistory.map((group, groupIdx) => {
                          const isEditingThisDate = editingDateGroup === group.groupKey;
                          return group.items.map((item, itemIdx) => {
                            const isFirstInGroup = itemIdx === 0;
                            return (
                              <tr 
                                key={item.id} 
                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                                  isFirstInGroup && groupIdx > 0 ? 'border-t-2 border-slate-200 dark:border-slate-700' : ''
                                }`}
                              >
                                {/* Date Received Column with rowSpan across all items of this date */}
                                {isFirstInGroup && (
                                  <td 
                                    rowSpan={group.items.length} 
                                    className="px-4 py-3.5 align-top border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30"
                                  >
                                    {isEditingThisDate ? (
                                      <div className="flex flex-col gap-2">
                                        <input
                                          type="date"
                                          value={editingDateValue}
                                          onChange={(e) => setEditingDateValue(e.target.value)}
                                          className="px-2 py-1 text-xs font-bold rounded-lg border border-[#FE4E02] bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm focus:outline-none w-full"
                                        />
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            disabled={isUpdatingDate}
                                            onClick={() => handleSaveDate(group.groupKey, group.items.map(it => it.id))}
                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                            title="Save Date"
                                          >
                                            {isUpdatingDate ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingDateGroup(null)}
                                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold uppercase transition-all cursor-pointer"
                                            title="Cancel"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between gap-1 group/date">
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                          {group.date}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditDate(group.groupKey, group.firstCreatedAt)}
                                          className="p-1 rounded text-slate-400 hover:text-[#FE4E02] hover:bg-[#FE4E02]/10 transition-colors cursor-pointer"
                                          title="Edit Date Received"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                )}

                                {/* Item Column */}
                                <td className="px-4 py-3 align-middle">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-white leading-snug">
                                      {item.name}
                                    </span>
                                    {item.serials && item.serials.length > 0 && (
                                      <div className="flex flex-col gap-1.5 mt-0.5">
                                        <button 
                                          type="button"
                                          onClick={() => toggleSerials(item.id)}
                                          className="flex items-center gap-1 text-[#FE4E02] text-[9px] font-black uppercase tracking-widest hover:opacity-80 transition-all w-fit cursor-pointer"
                                        >
                                          <Hash size={10} />
                                          {expandedSerials[item.id] ? 'Hide Serials' : `Show Serials (${item.serials.length})`}
                                        </button>
                                        {expandedSerials[item.id] && (
                                          <div className="flex flex-wrap gap-1 mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                            {item.serials.map((sn, snIdx) => (
                                              <span key={snIdx} className="px-1.5 py-0.5 bg-white dark:bg-slate-900 text-[8.5px] font-mono font-bold text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 shadow-xs">
                                                {sn}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Qty Column */}
                                <td className="px-4 py-3 text-center align-middle">
                                  <span className="inline-flex items-center justify-center font-mono font-black text-xs text-[#FE4E02]">
                                    {item.qty}
                                  </span>
                                </td>

                                {/* Received By Column */}
                                <td className="px-4 py-3 align-middle text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate" title={item.received_by}>
                                  {item.received_by || '------'}
                                </td>

                                {/* Remarks Column */}
                                <td className="px-4 py-3 align-middle text-[11px] text-slate-500 dark:text-slate-400 italic">
                                  {item.reason ? (
                                    <span className="font-mono text-[10.5px] not-italic text-slate-600 dark:text-slate-400">
                                      {item.reason}
                                    </span>
                                  ) : (
                                    '------'
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <History size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">No delivery history yet</p>
                  </div>
                )}
              </div>
          </div>

        <footer className={`px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 shrink-0 justify-between`}>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            {request.status === 'Delivered' ? 'Close' : 'Cancel'}
          </button>
          
          {request.status === 'Delivered' ? (
            <button 
              onClick={() => {
                onClose();
                onConfirm?.();
                if (onNavigate) {
                  onNavigate('inventory', { inventoryTab: 'transfer', openTransfer: true });
                } else {
                  navigate('/inventory');
                }
              }}
              className="bg-[#FE4E02] hover:bg-[#E04502] text-white px-8 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-[#FE4E02]/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <ArrowRightLeft size={16} />
              <span>Proceed to Transfer</span>
            </button>
          ) : (
            <button 
              onClick={handleProceed}
              disabled={poList.length > 0 && selectedPOIndex === null}
              className={`px-8 py-2.5 rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest ${
                poList.length > 0 && selectedPOIndex === null
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#FE4E02] hover:bg-[#E04502] text-white shadow-[#FE4E02]/20'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>Check Items</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ItemVerificationModal;
