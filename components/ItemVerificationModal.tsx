import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Trash2, 
  Hash, 
  Box, 
  History, 
  Calendar, 
  User, 
  Info, 
  ArrowRightLeft, 
  PackageCheck, 
  Pencil, 
  Check, 
  AlertTriangle,
  Save
} from 'lucide-react';
import { useNotification } from './NotificationProvider';

interface ItemVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onConfirm?: () => void;
  onNavigate?: (viewId: string, params?: Record<string, any>) => void;
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
  to_location?: string;
}

interface EditDeliverableState {
  id: string;
  code: string;
  name: string;
  qty: number;
  originalQty: number;
  reason: string;
  serials: string[];
  to_location: string;
  created_at: string;
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

  // Edit deliverable state
  const [editingDeliverable, setEditingDeliverable] = useState<EditDeliverableState | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Revert deliverable state
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<{
    id: string;
    name: string;
    code: string;
    qty: number;
    serials?: string[];
    to_location: string;
  } | null>(null);
  const [isReverting, setIsReverting] = useState<boolean>(false);

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
      onConfirm?.();
    } catch (err: any) {
      console.error('Error updating date received:', err);
      showError(err.message || 'Failed to update date received');
    } finally {
      setIsUpdatingDate(false);
    }
  };

  const handleStartEditDeliverable = (item: {
    id: string;
    name?: string;
    item_name?: string;
    code?: string;
    item_code?: string;
    qty?: number;
    quantity?: number;
    reason?: string;
    serials?: string[];
    to_location?: string;
    location?: string;
    created_at?: string;
  }) => {
    const itemCode = item.code || item.item_code || '';
    const itemName = item.name || item.item_name || itemCode;
    const itemQty = Number(item.qty ?? item.quantity) || 0;
    const loc = item.to_location || item.location || request?.location || 'IT Basement';

    setEditingDeliverable({
      id: item.id,
      code: itemCode,
      name: itemName,
      qty: itemQty,
      originalQty: itemQty,
      reason: (!item.reason || item.reason === 'No remarks') ? '' : item.reason,
      serials: item.serials ? [...item.serials] : [],
      to_location: loc,
      created_at: item.created_at || new Date().toISOString()
    });
  };

  const handleSaveEditDeliverable = async () => {
    if (!editingDeliverable || !request) return;
    setIsSavingEdit(true);
    try {
      const { id, code, name, qty, originalQty, reason, serials, to_location, created_at } = editingDeliverable;
      const itemCode = code || (editingDeliverable as any).item_code;
      const itemName = name || (editingDeliverable as any).item_name || itemCode;
      const qtyDiff = qty - originalQty;

      if (qty <= 0) {
        showError('Delivered quantity must be at least 1. If you wish to completely remove this delivery, please use Revert.');
        setIsSavingEdit(false);
        return;
      }

      const loc = to_location || request.location || 'IT Basement';

      // 1. Update stock if quantity changed
      if (qtyDiff !== 0) {
        const { data: currentStock } = await supabase
          .from('item_location_stocks')
          .select('id, quantity, brand_new_qty')
          .eq('item_code', itemCode)
          .eq('location', loc)
          .maybeSingle();

        if (currentStock) {
          const newTotal = Math.max(0, (currentStock.quantity || 0) + qtyDiff);
          const newBrandNew = Math.max(0, (currentStock.brand_new_qty || 0) + qtyDiff);
          const { error: stockErr } = await supabase
            .from('item_location_stocks')
            .update({
              quantity: newTotal,
              brand_new_qty: newBrandNew,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentStock.id);
          if (stockErr) throw stockErr;
        } else {
          const { error: stockInsErr } = await supabase
            .from('item_location_stocks')
            .insert([{
              item_code: itemCode,
              item_name: itemName,
              location: loc,
              quantity: Math.max(0, qtyDiff),
              brand_new_qty: Math.max(0, qtyDiff),
              updated_at: new Date().toISOString()
            }]);
          if (stockInsErr) throw stockInsErr;
        }

      }

      // 2. Handle Serials
      const filteredSerials = serials.map(s => s.trim()).filter(Boolean);
      const { data: existingSerials } = await supabase
        .from('item_serials')
        .select('*')
        .eq('request_id', request.id)
        .eq('item_code', itemCode)
        .order('created_at', { ascending: true });

      if (existingSerials && existingSerials.length > 0) {
        if (filteredSerials.length < existingSerials.length) {
          const toRemove = existingSerials.slice(filteredSerials.length);
          if (toRemove.length > 0) {
            await supabase
              .from('item_serials')
              .delete()
              .in('id', toRemove.map(s => s.id));
          }
        }
        for (let i = 0; i < Math.min(filteredSerials.length, existingSerials.length); i++) {
          if (filteredSerials[i] !== existingSerials[i].serial_number) {
            await supabase
              .from('item_serials')
              .update({ serial_number: filteredSerials[i] })
              .eq('id', existingSerials[i].id);
          }
        }
        if (filteredSerials.length > existingSerials.length) {
          const toAdd = filteredSerials.slice(existingSerials.length).map(sn => ({
            request_id: request.id,
            item_code: itemCode,
            serial_number: sn,
            location: loc,
            status: 'Available',
            created_at: created_at || new Date().toISOString()
          }));
          await supabase.from('item_serials').insert(toAdd);
        }
      } else if (filteredSerials.length > 0) {
        const toAdd = filteredSerials.map(sn => ({
          request_id: request.id,
          item_code: itemCode,
          serial_number: sn,
          location: loc,
          status: 'Available',
          created_at: created_at || new Date().toISOString()
        }));
        await supabase.from('item_serials').insert(toAdd);
      }

      // 3. Update transaction record in stock_transactions
      const { error: txErr } = await supabase
        .from('stock_transactions')
        .update({
          quantity: qty,
          reason: reason || null,
          created_at: created_at
        })
        .eq('id', id);
      if (txErr) throw txErr;

      // 4. Query all Delivery transactions for this item code to get EXACT received quantity
      const { data: allItemTxs } = await supabase
        .from('stock_transactions')
        .select('quantity')
        .eq('reference_id', request.id)
        .eq('item_code', itemCode)
        .eq('transaction_type', 'Delivery');

      const exactDeliveredForItem = (allItemTxs || []).reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);

      // Update request_items with the exact delivered quantity
      const { data: reqItems } = await supabase
        .from('request_items')
        .select('*')
        .eq('request_control_no', request.id)
        .eq('item_code', itemCode);

      if (reqItems && reqItems.length > 0) {
        for (const ri of reqItems) {
          const reqQty = parseInt(ri.qty) || 0;
          const newStatus = exactDeliveredForItem >= reqQty && reqQty > 0 ? 'Delivered' : (exactDeliveredForItem > 0 ? 'Partially Delivered' : 'Pending');

          const { error: riErr } = await supabase
            .from('request_items')
            .update({
              received_quantity: exactDeliveredForItem,
              status: newStatus
            })
            .eq('id', ri.id);
          if (riErr) throw riErr;
        }
      }

      // 5. Recalculate overall status & delivered_at of item_requests
      const { data: updatedReqItems } = await supabase
        .from('request_items')
        .select('received_quantity, qty')
        .eq('request_control_no', request.id);

      let finalRequestStatus = 'Pending';
      let totalReq = 0;
      let totalRec = 0;
      if (updatedReqItems && updatedReqItems.length > 0) {
        totalReq = updatedReqItems.reduce((s, i) => s + (parseInt(i.qty) || 0), 0);
        totalRec = updatedReqItems.reduce((s, i) => s + (parseInt(i.received_quantity) || 0), 0);
        const allDone = totalReq > 0 && totalRec >= totalReq;
        const anyDelivered = totalRec > 0;
        finalRequestStatus = allDone ? 'Delivered' : (anyDelivered ? 'Partially Delivered' : 'Pending');
      }

      const { data: remainingTxs } = await supabase
        .from('stock_transactions')
        .select('created_at')
        .eq('reference_id', request.id)
        .eq('transaction_type', 'Delivery')
        .order('created_at', { ascending: false })
        .limit(1);

      const latestDeliveryDate = remainingTxs && remainingTxs.length > 0 ? remainingTxs[0].created_at : null;

      await supabase
        .from('item_requests')
        .update({
          status: finalRequestStatus,
          delivered_at: finalRequestStatus === 'Delivered' ? (latestDeliveryDate || new Date().toISOString()) : (finalRequestStatus === 'Partially Delivered' ? latestDeliveryDate : null),
          updated_at: new Date().toISOString()
        })
        .eq('control_no', request.id);

      // Update local state (set both quantity and qty)
      setHistory(prev => prev.map(tx => {
        if (tx.id === id) {
          return {
            ...tx,
            quantity: qty,
            qty: qty,
            reason: reason,
            serials: filteredSerials,
            created_at: created_at
          };
        }
        return tx;
      }));

      showSuccess('Deliverable updated successfully. Stocks and completion percentage updated.');
      setEditingDeliverable(null);
      onConfirm?.();
    } catch (err: any) {
      console.error('Error updating deliverable:', err);
      showError(err.message || 'Failed to update deliverable');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRevertDelivery = async (item: {
    id: string;
    name?: string;
    item_name?: string;
    code?: string;
    item_code?: string;
    qty?: number;
    quantity?: number;
    serials?: string[];
    to_location?: string;
    location?: string;
  }) => {
    if (!request) return;
    setIsReverting(true);
    try {
      const itemCode = item.code || item.item_code;
      if (!itemCode) throw new Error('Item code is missing.');
      const itemQty = Number(item.qty ?? item.quantity) || 0;
      const loc = item.to_location || item.location || request.location || 'IT Basement';

      // 1. Deduct stock from item_location_stocks
      const { data: currentStock } = await supabase
        .from('item_location_stocks')
        .select('id, quantity, brand_new_qty')
        .eq('item_code', itemCode)
        .eq('location', loc)
        .maybeSingle();

      if (currentStock) {
        const newTotal = Math.max(0, (currentStock.quantity || 0) - itemQty);
        const newBrandNew = Math.max(0, (currentStock.brand_new_qty || 0) - itemQty);
        const { error: stockErr } = await supabase
          .from('item_location_stocks')
          .update({
            quantity: newTotal,
            brand_new_qty: newBrandNew,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentStock.id);
        if (stockErr) throw stockErr;
      }

      // 2. Delete serial numbers
      if (item.serials && item.serials.length > 0) {
        await supabase
          .from('item_serials')
          .delete()
          .eq('request_id', request.id)
          .in('serial_number', item.serials);
      } else {
        const { data: delSerials } = await supabase
          .from('item_serials')
          .select('id')
          .eq('request_id', request.id)
          .eq('item_code', itemCode)
          .order('created_at', { ascending: false })
          .limit(itemQty);

        if (delSerials && delSerials.length > 0) {
          await supabase
            .from('item_serials')
            .delete()
            .in('id', delSerials.map(s => s.id));
        }
      }

      // 3. Delete the stock_transaction
      const { error: delTxErr } = await supabase
        .from('stock_transactions')
        .delete()
        .eq('id', item.id);
      if (delTxErr) throw delTxErr;

      // 4. Query remaining delivery transactions to get EXACT received quantity for this item code
      const { data: allItemTxs } = await supabase
        .from('stock_transactions')
        .select('quantity')
        .eq('reference_id', request.id)
        .eq('item_code', itemCode)
        .eq('transaction_type', 'Delivery');

      const exactDeliveredForItem = (allItemTxs || []).reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);

      const { data: reqItems } = await supabase
        .from('request_items')
        .select('*')
        .eq('request_control_no', request.id)
        .eq('item_code', itemCode);

      if (reqItems && reqItems.length > 0) {
        for (const ri of reqItems) {
          const reqQty = parseInt(ri.qty) || 0;
          const newStatus = exactDeliveredForItem >= reqQty && reqQty > 0 ? 'Delivered' : (exactDeliveredForItem > 0 ? 'Partially Delivered' : 'Pending');

          const { error: riErr } = await supabase
            .from('request_items')
            .update({
              received_quantity: exactDeliveredForItem,
              status: newStatus
            })
            .eq('id', ri.id);
          if (riErr) throw riErr;
        }
      }

      // 5. Recalculate overall item_requests status and completion
      const { data: updatedReqItems } = await supabase
        .from('request_items')
        .select('received_quantity, qty')
        .eq('request_control_no', request.id);

      let finalRequestStatus = 'Pending';
      let totalReq = 0;
      let totalRec = 0;
      if (updatedReqItems && updatedReqItems.length > 0) {
        totalReq = updatedReqItems.reduce((s, i) => s + (parseInt(i.qty) || 0), 0);
        totalRec = updatedReqItems.reduce((s, i) => s + (parseInt(i.received_quantity) || 0), 0);
        const allDone = totalReq > 0 && totalRec >= totalReq;
        const anyDelivered = totalRec > 0;
        finalRequestStatus = allDone ? 'Delivered' : (anyDelivered ? 'Partially Delivered' : 'Pending');
      }

      const { data: remainingTxs } = await supabase
        .from('stock_transactions')
        .select('created_at')
        .eq('reference_id', request.id)
        .eq('transaction_type', 'Delivery')
        .order('created_at', { ascending: false })
        .limit(1);

      const latestDeliveryDate = remainingTxs && remainingTxs.length > 0 ? remainingTxs[0].created_at : null;

      await supabase
        .from('item_requests')
        .update({
          status: finalRequestStatus,
          delivered_at: finalRequestStatus === 'Delivered' ? (latestDeliveryDate || new Date().toISOString()) : (finalRequestStatus === 'Partially Delivered' ? latestDeliveryDate : null),
          updated_at: new Date().toISOString()
        })
        .eq('control_no', request.id);

      // Update local state
      setHistory(prev => prev.filter(tx => tx.id !== item.id));
      showSuccess('Delivery reverted successfully. Stocks and completion percentage updated.');
      setConfirmDeleteTx(null);
      onConfirm?.();
    } catch (err: any) {
      console.error('Error reverting delivery:', err);
      showError(err.message || 'Failed to revert delivery');
    } finally {
      setIsReverting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedPOIndex(null);
      setEditingDateGroup(null);
      setEditingDeliverable(null);
      setConfirmDeleteTx(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (isOpen && request && isSupabaseConfigured) {
        setLoading(true);
        try {
          // Fetch delivery transactions in ASCENDING order for chronological assignment
          const { data: transactions, error } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('reference_id', request.id)
            .eq('transaction_type', 'Delivery')
            .order('created_at', { ascending: true });

          if (error) throw error;

          if (transactions && transactions.length > 0) {
            // Fetch equipment details to get item names
            const itemCodes = Array.from(new Set(transactions.map(t => t.item_code)));
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

            const serialsQueue = JSON.parse(JSON.stringify(serialsByItem));
            
            const historyWithDetails = transactions.map(d => {
              const itemSerials = serialsQueue[d.item_code] 
                ? serialsQueue[d.item_code].splice(0, d.quantity)
                : [];
              const desc = itemsData?.find(i => i.item_code === d.item_code)?.description || d.item_code;

              return {
                ...d,
                code: d.item_code,
                name: desc,
                qty: Number(d.quantity) || 0,
                item_name: desc,
                serials: itemSerials,
                to_location: d.to_location || d.location || 'IT Basement'
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
        serials?: string[];
        to_location: string;
        created_at: string;
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
        serials: tx.serials,
        to_location: tx.to_location || 'IT Basement',
        created_at: tx.created_at
      });
    });
    
    return groups;
  }, [history]);

  if (!isOpen || !request) return null;

  const handleProceed = () => {
    let selectedPO = null;
    let poItems = null;

    if (poList.length > 0 && selectedPOIndex !== null) {
      selectedPO = poList[selectedPOIndex].poNum;
      poItems = poList[selectedPOIndex].items;
    }

    onClose();
    navigate(`/requests/${request.id}/serial-entry`, { 
      state: { 
        selectedPO,
        poItems 
      } 
    });
  };

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FE4E02]/10 text-[#FE4E02] flex items-center justify-center">
              <Box size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">
                {request.status === 'Delivered' 
                  ? toTitleCase('Delivery Records & Deliverables Management')
                  : toTitleCase('Verify Received Items')}
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Requisition #{request.control_no || request.id} • {request.office}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-8">
          {/* PO Selection Section - Accessible whether Delivered or not */}
          {poList.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <PackageCheck size={14} className="text-[#0081f1]" />
                Select PO to Process / Edit
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {poList.map((po, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPOIndex(idx)}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all group cursor-pointer ${
                      selectedPOIndex === idx 
                        ? 'border-[#FE4E02] bg-[#FE4E02]/5 shadow-lg shadow-[#FE4E02]/10 scale-[1.02]' 
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-black tracking-tight ${selectedPOIndex === idx ? 'text-[#FE4E02]' : 'text-slate-800 dark:text-white'}`}>
                        {po.poNum}
                      </span>
                      {po.isComplete ? (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                          <CheckCircle2 size={12} />
                          Delivered
                        </span>
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
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <History size={14} className="text-[#FE4E02]" />
              Delivery Records & Actions
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
                      <th className="w-[18%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Date Received</th>
                      <th className="w-[30%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Item</th>
                      <th className="w-[10%] px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Qty</th>
                      <th className="w-[15%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Received By</th>
                      <th className="w-[15%] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Remarks</th>
                      <th className="w-[12%] px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {groupedHistory.map((group) => {
                      const isEditingThisDate = editingDateGroup === group.groupKey;
                      const groupTxIds = group.items.map(i => i.id);

                      return group.items.map((item, itemIdx) => {
                        const isFirstInGroup = itemIdx === 0;
                        return (
                          <tr 
                            key={item.id} 
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group/row"
                          >
                            {/* Date Received Column */}
                            {isFirstInGroup && (
                              <td 
                                rowSpan={group.items.length} 
                                className="px-4 py-3 align-top border-r border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-800/10"
                              >
                                {isEditingThisDate ? (
                                  <div className="flex flex-col gap-2">
                                    <input 
                                      type="date"
                                      value={editingDateValue}
                                      onChange={(e) => setEditingDateValue(e.target.value)}
                                      className="px-2 py-1 text-[11px] font-medium rounded-lg border border-[#FE4E02] bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#FE4E02]"
                                    />
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={isUpdatingDate || !editingDateValue}
                                        onClick={() => handleSaveDate(group.groupKey, groupTxIds)}
                                        className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                        title="Save date"
                                      >
                                        {isUpdatingDate ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isUpdatingDate}
                                        onClick={() => setEditingDateGroup(null)}
                                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer"
                                        title="Cancel edit"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-1 group/date">
                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                      {group.date}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditDate(group.groupKey, group.firstCreatedAt)}
                                      className="opacity-0 group-hover/date:opacity-100 p-1 text-slate-400 hover:text-[#FE4E02] rounded-md transition-opacity cursor-pointer"
                                      title="Edit Date Received"
                                    >
                                      <Pencil size={11} />
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

                            {/* Actions Column */}
                            <td className="px-3 py-3 text-center align-middle">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDeliverable(item)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                                  title="Edit Deliverable"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTx(item)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Revert Delivery"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
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

        {/* Footer */}
        <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 shrink-0 justify-between">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
          
          <div className="flex items-center gap-3">
            {request.status === 'Delivered' && (
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
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer"
              >
                <ArrowRightLeft size={16} />
                <span>Proceed to Transfer</span>
              </button>
            )}

            <button 
              onClick={handleProceed}
              disabled={poList.length > 0 && selectedPOIndex === null}
              className={`px-8 py-2.5 rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer ${
                poList.length > 0 && selectedPOIndex === null
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#FE4E02] hover:bg-[#E04502] text-white shadow-[#FE4E02]/20'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>{request.status === 'Delivered' ? 'Receive / Edit Deliverables' : 'Check Items'}</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Edit Deliverable Modal */}
      {editingDeliverable && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white">Edit Deliverable</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider truncate max-w-[280px]">
                    {editingDeliverable.name} ({editingDeliverable.code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingDeliverable(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Info Banner */}
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-bold">Stock & Completion Impact</p>
                  <p className="text-[11px] opacity-90">
                    Modifying this delivered quantity directly recalculates inventory stock at <strong>{editingDeliverable.to_location}</strong> and updates requisition completion percentage automatically.
                  </p>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    Delivered Quantity
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Original: {editingDeliverable.originalQty} units
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={editingDeliverable.qty}
                    onChange={(e) => {
                      const newQ = parseInt(e.target.value) || 0;
                      setEditingDeliverable(prev => {
                        if (!prev) return null;
                        let newSerials = [...prev.serials];
                        if (newQ > prev.serials.length) {
                          const diff = newQ - prev.serials.length;
                          newSerials = [...newSerials, ...Array(diff).fill('')];
                        } else if (newQ < prev.serials.length) {
                          newSerials = newSerials.slice(0, newQ);
                        }
                        return { ...prev, qty: newQ, serials: newSerials };
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  {editingDeliverable.qty !== editingDeliverable.originalQty && (
                    <span className={`text-xs font-black uppercase px-2.5 py-1.5 rounded-lg shrink-0 ${
                      editingDeliverable.qty > editingDeliverable.originalQty
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {editingDeliverable.qty > editingDeliverable.originalQty
                        ? `+${editingDeliverable.qty - editingDeliverable.originalQty} Stock`
                        : `${editingDeliverable.qty - editingDeliverable.originalQty} Stock`}
                    </span>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Remarks / PO Reference
                </label>
                <input
                  type="text"
                  value={editingDeliverable.reason}
                  onChange={(e) => setEditingDeliverable(prev => prev ? { ...prev, reason: e.target.value } : null)}
                  placeholder="e.g. PO:12345 | Batch delivery"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Serial Numbers (if applicable) */}
              {editingDeliverable.serials.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Hash size={12} className="text-blue-500" />
                      Serial Numbers ({editingDeliverable.serials.length})
                    </label>
                    <span className="text-[10px] text-slate-400">Edit or assign serial tags</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    {editingDeliverable.serials.map((sn, snIdx) => (
                      <div key={snIdx} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                          #{snIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={sn}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingDeliverable(prev => {
                              if (!prev) return null;
                              const updated = [...prev.serials];
                              updated[snIdx] = val;
                              return { ...prev, serials: updated };
                            });
                          }}
                          placeholder={`Enter serial #${snIdx + 1}`}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setEditingDeliverable(null)}
                className="px-5 py-2.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit || editingDeliverable.qty <= 0}
                onClick={handleSaveEditDeliverable}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert / Delete Confirmation Modal */}
      {confirmDeleteTx && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">Revert Delivery Record</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Confirm Reversal & Stock Recalculation
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Are you sure you want to revert this delivery of <strong className="text-slate-800 dark:text-white">{confirmDeleteTx.name}</strong>?
              </p>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>Item Code:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{confirmDeleteTx.code}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>Quantity to Revert:</span>
                  <span className="font-mono font-black text-rose-500">-{confirmDeleteTx.qty} units</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>Location:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{confirmDeleteTx.to_location}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
                ⚠️ Inventory stock will be deducted by {confirmDeleteTx.qty} units, recorded serial numbers will be removed, and requisition completion percentage will update accordingly.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isReverting}
                onClick={() => setConfirmDeleteTx(null)}
                className="px-5 py-2.5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReverting}
                onClick={() => handleRevertDelivery(confirmDeleteTx)}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                {isReverting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Reverting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Revert</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemVerificationModal;
