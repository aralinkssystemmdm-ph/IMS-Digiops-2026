
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Hash, Box, History, Calendar, User, Info, ArrowRightLeft, PackageCheck } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      setSelectedPOIndex(null);
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
      date: string; 
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
      const date = new Date(tx.created_at).toLocaleDateString();
      
      let existing = groups.find(g => g.date === date);
      if (!existing) {
        existing = { date, items: [] };
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
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Date Received</th>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Item</th>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Qty</th>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Received By</th>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {groupedHistory.map((group) => (
                          <React.Fragment key={group.date}>
                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors align-top">
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                {group.date}
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-3">
                                  {group.items.map((item, i) => (
                                    <div key={item.id} className={`${i > 0 ? 'pt-3 border-t border-slate-50 dark:border-slate-800/50' : ''}`}>
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight">{item.name}</span>
                                        {item.serials && item.serials.length > 0 && (
                                          <button 
                                            onClick={() => toggleSerials(item.id)}
                                            className="flex items-center gap-1 text-[#FE4E02] text-[9px] font-black uppercase tracking-widest hover:opacity-80 transition-all w-fit mt-1.5"
                                          >
                                            <Hash size={10} />
                                            {expandedSerials[item.id] ? 'Hide Serials' : `Show Serials (${item.serials.length})`}
                                          </button>
                                        )}
                                        {expandedSerials[item.id] && item.serials && item.serials.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 mt-2">
                                            {item.serials.map((sn, snIdx) => (
                                              <span key={snIdx} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 text-[8px] font-mono font-bold text-slate-500 dark:text-slate-400 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                                                {sn}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-3">
                                    {group.items.map((item, i) => (
                                      <div key={item.id} className={`text-[11px] font-black text-[#FE4E02] h-full flex flex-col justify-center ${i > 0 ? 'pt-3 border-t border-transparent translate-y-[-1px]' : ''}`}>
                                        {i > 0 && <div className="border-t border-transparent mb-3" />}
                                        {item.qty}
                                      </div>
                                    ))}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                <div className="space-y-3">
                                    {group.items.map((item, i) => (
                                      <div key={item.id} className={`flex flex-col justify-center ${i > 0 ? 'pt-3 border-t border-transparent' : ''}`}>
                                        {i > 0 && <div className="border-t border-transparent mb-3" />}
                                        {item.received_by}
                                      </div>
                                    ))}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
                                <div className="space-y-3">
                                    {group.items.map((item, i) => (
                                      <div key={item.id} className={`flex flex-col justify-center ${i > 0 ? 'pt-3 border-t border-transparent' : ''}`}>
                                        {i > 0 && <div className="border-t border-transparent mb-3" />}
                                        {item.reason}
                                      </div>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
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
