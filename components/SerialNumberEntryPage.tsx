
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, Hash, Box, ArrowLeft, Clipboard, Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface SerialEntryItem {
  id: string;
  item_code: string;
  description: string;
  quantity: number;
  location: string;
}

interface SerialEntry {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  location: string;
  serials: string[];
  requestedQty?: number;
  previousReceivedQty?: number;
  globalRequestedQty?: number;
  globalReceivedQty?: number;
  remarks?: string;
}

const SerialNumberEntryPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess, showWarning } = useNotification();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [entries, setEntries] = useState<SerialEntry[]>([]);
  const [revealedSerials, setRevealedSerials] = useState<{ [key: string]: boolean }>({});
  const [nonSerializedItems, setNonSerializedItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deliveredDate, setDeliveredDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Calculate Summary Stats
  const stats = useMemo(() => {
    const totalItems = entries.length + nonSerializedItems.length;
    const totalRequested = [...entries, ...nonSerializedItems].reduce((sum, item) => sum + (item.requestedQty || 0), 0);
    const totalReceived = [...entries, ...nonSerializedItems].reduce((sum, item) => 
      sum + (item.previousReceivedQty || 0) + (item.quantity || item.newDeliveryQty || 0), 0
    );
    const remaining = totalRequested - totalReceived;
    
    const totalSerialsNeeded = entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
    const totalSerialsEntered = entries.reduce((sum, entry) => 
      sum + entry.serials.filter(s => s.trim() !== '').length, 0
    );

    return {
      totalItems,
      totalRequested,
      totalReceived,
      remaining,
      totalSerialsNeeded,
      totalSerialsEntered,
      serialProgress: totalSerialsNeeded > 0 ? (totalSerialsEntered / totalSerialsNeeded) * 100 : 0
    };
  }, [entries, nonSerializedItems]);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        if (scrollTop > 60) {
          setIsScrolled(true);
        } else if (scrollTop < 20) {
          setIsScrolled(false);
        }
      }
    };

    const container = scrollContainerRef.current;
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
    const savedDarkMode = localStorage.getItem('aralinks_dark_mode') === 'true';
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }

    const fetchData = async () => {
      if (!requestId || !isSupabaseConfigured) return;
      
      setLoading(true);
      try {
        const { selectedPO, poItems } = location.state || {};

        // Fetch request details and items
        const { data: requestData, error: reqError } = await supabase
          .from('item_requests')
          .select('*, request_items(*)')
          .eq('control_no', requestId)
          .single();

        if (reqError) throw reqError;

        // Fetch latest serialization status from equipment table
        const itemCodes = requestData.request_items.map((i: any) => i.item_code);
        const { data: equipmentData } = await supabase
          .from('equipment')
          .select('item_code, is_serialized')
          .in('item_code', itemCodes);

        // Fetch stock transactions to calculate correct previously received qty for this specific PO
        const { data: poTransactions } = await supabase
          .from('stock_transactions')
          .select('item_code, quantity, reason')
          .eq('reference_id', requestId)
          .eq('transaction_type', 'Delivery');

        const taggedHistory: Record<string, number> = {};
        if (poTransactions && selectedPO) {
          poTransactions.forEach(tx => {
            if (tx.reason?.includes(`PO:${selectedPO}`)) {
              taggedHistory[tx.item_code] = (taggedHistory[tx.item_code] || 0) + (parseInt(tx.quantity) || 0);
            }
          });
        }

        const allItems = requestData.request_items
          .filter((item: any) => {
            if (!poItems) return true;
            return poItems.hasOwnProperty(item.item_code);
          })
          .map((item: any) => {
            const equip = equipmentData?.find(e => e.item_code === item.item_code);
            const isSerialized = equip ? (equip.is_serialized === true || equip.is_serialized === 'YES') : item.is_serialized;
            
            const requestedTotal = parseInt(item.qty) || 0;
            const previousTotal = parseInt(item.received_quantity) || 0;
            
            // If we have poItems, we use the quantity from the PO breakdown as the target
            const targetQty = poItems ? (poItems[item.item_code] || 0) : requestedTotal;
            
            // Calculate how many of THIS PO's target have already been received
            const alreadyReceivedForThisPO = taggedHistory[item.item_code] || 0;
            const batchRemaining = Math.max(0, targetQty - alreadyReceivedForThisPO);

            return {
              id: item.id,
              itemCode: item.item_code,
              description: item.item,
              requestedQty: targetQty,
              previousReceivedQty: alreadyReceivedForThisPO,
              globalRequestedQty: requestedTotal,
              globalReceivedQty: previousTotal,
              newDeliveryQty: Math.min(batchRemaining, Math.max(0, requestedTotal - previousTotal)),
              isSerialized: isSerialized,
              location: requestData.location || 'IT Basement',
              remarks: ''
            };
          });

        // Separate serialized and non-serialized
        const serialized = allItems.filter((i: any) => i.isSerialized);
        const nonSerialized = allItems.filter((i: any) => !i.isSerialized);

        setEntries(serialized.map((item: any) => ({
          id: item.id,
          itemCode: item.itemCode,
          description: item.description,
          quantity: item.newDeliveryQty,
          location: item.location,
          serials: Array(item.newDeliveryQty).fill(''),
          requestedQty: item.requestedQty,
          previousReceivedQty: item.previousReceivedQty,
          globalRequestedQty: item.globalRequestedQty,
          globalReceivedQty: item.globalReceivedQty,
          remarks: ''
        })));

        setNonSerializedItems(nonSerialized);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        showError('Error', 'Failed to load request items.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId, navigate]);

  const handleQtyChange = (id: string, value: string, isSerialized: boolean) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    const numericValue = parseInt(cleanValue) || 0;

    if (isSerialized) {
      setEntries(prev => prev.map(entry => {
        if (entry.id === id) {
          const poRemaining = (entry.requestedQty || 0) - (entry.previousReceivedQty || 0);
          const globalRemaining = (entry.globalRequestedQty || 0) - (entry.globalReceivedQty || 0);
          const maxAllowed = Math.min(poRemaining, globalRemaining);
          const finalValue = Math.min(numericValue, maxAllowed);
          return {
            ...entry,
            quantity: finalValue,
            serials: Array(finalValue).fill('').map((_, i) => entry.serials[i] || '')
          };
        }
        return entry;
      }));
    } else {
      setNonSerializedItems(prev => prev.map(item => {
        if (item.id === id) {
          const poRemaining = (item.requestedQty || 0) - (item.previousReceivedQty || 0);
          const globalRemaining = (item.globalRequestedQty || 0) - (item.globalReceivedQty || 0);
          const maxAllowed = Math.min(poRemaining, globalRemaining);
          const finalValue = Math.min(numericValue, maxAllowed);
          return { ...item, newDeliveryQty: finalValue };
        }
        return item;
      }));
    }
  };

  const handleRemarkChange = (id: string, value: string, isSerialized: boolean) => {
    if (isSerialized) {
      setEntries(prev => prev.map(entry => {
        if (entry.id === id) return { ...entry, remarks: value };
        return entry;
      }));
    } else {
      setNonSerializedItems(prev => prev.map(item => {
        if (item.id === id) return { ...item, remarks: value };
        return item;
      }));
    }
  };

  const handleSerialChange = (itemIdx: number, serialIdx: number, value: string) => {
    setEntries(prev => {
      const newEntries = [...prev];
      newEntries[itemIdx].serials[serialIdx] = value;
      return newEntries;
    });
  };

  const handleKeyDown = (itemIdx: number, serialIdx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextId = `${itemIdx}-${serialIdx + 1}`;
      const nextItemFirstId = `${itemIdx + 1}-0`;
      
      if (inputRefs.current[nextId]) {
        inputRefs.current[nextId]?.focus();
      } else if (inputRefs.current[nextItemFirstId]) {
        inputRefs.current[nextItemFirstId]?.focus();
      }
    }
  };

  const handlePaste = (itemIdx: number, serialIdx: number, e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const serials = pastedData.split(/\r?\n|,|\t/).map(s => s.trim()).filter(s => s !== '');
    
    if (serials.length > 0) {
      setEntries(prev => {
        const newEntries = [...prev];
        let currentSerialIdx = serialIdx;
        let currentItemIdx = itemIdx;

        for (const serial of serials) {
          if (currentItemIdx >= newEntries.length) break;
          
          const targetItem = newEntries[currentItemIdx];
          targetItem.serials[currentSerialIdx] = serial;
          
          currentSerialIdx++;
          if (currentSerialIdx >= targetItem.quantity) {
            currentSerialIdx = 0;
            currentItemIdx++;
          }
        }
        return newEntries;
      });

      // Focus the last filled input or the one after it
      const lastFilledItemIdx = Math.min(itemIdx + Math.floor((serialIdx + serials.length - 1) / entries[itemIdx].quantity), entries.length - 1);
      const lastFilledSerialIdx = (serialIdx + serials.length - 1) % entries[itemIdx].quantity;
      const nextId = `${lastFilledItemIdx}-${lastFilledSerialIdx + 1}`;
      const nextItemFirstId = `${lastFilledItemIdx + 1}-0`;

      setTimeout(() => {
        if (inputRefs.current[nextId]) {
          inputRefs.current[nextId]?.focus();
        } else if (inputRefs.current[nextItemFirstId]) {
          inputRefs.current[nextItemFirstId]?.focus();
        }
      }, 0);
    }
  };

  const validate = async () => {
    if (!deliveredDate) {
      showWarning('Missing Date', 'Date Delivered is required.');
      return false;
    }
    const allSerials: string[] = [];
    for (const entry of entries) {
      const filledSerials = entry.serials.filter(s => s.trim() !== '');
      if (filledSerials.length !== entry.quantity) {
        showWarning('Incomplete Entry', `Please provide all serial numbers for ${entry.description}.`);
        return false;
      }
      
      // Check for duplicates within this entry
      const uniqueInEntry = new Set(filledSerials);
      if (uniqueInEntry.size !== filledSerials.length) {
        showWarning('Duplicate Entry', `Duplicate serial numbers found for ${entry.description}.`);
        return false;
      }
      
      allSerials.push(...filledSerials);
    }

    // Check for duplicates across all entries
    const uniqueAll = new Set(allSerials);
    if (uniqueAll.size !== allSerials.length) {
      showWarning('Duplicate Serials', 'Duplicate serial numbers found across different items.');
      return false;
    }

    // Check against database for global uniqueness
    const { data: existingSerials, error: dbError } = await supabase
      .from('item_serials')
      .select('serial_number')
      .in('serial_number', allSerials);

    if (dbError) {
      console.error('Supabase Error:', dbError);
      if (dbError.message.includes('relation "item_serials" does not exist')) {
        showError('Database Error', 'The serial numbers table (item_serials) is missing from the database. Please ensure the database migrations have been applied.');
      } else {
        showError('Validation Error', `Error validating serial numbers against database: ${dbError.message}`);
      }
      return false;
    }

    if (existingSerials && existingSerials.length > 0) {
      const duplicates = existingSerials.map(s => s.serial_number).join(', ');
      showError('Database Conflict', `The following serial numbers are already registered in the system: ${duplicates}`);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    const isValid = await validate();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const currentUser = localStorage.getItem('aralinks_user') || 'System';
      const now = new Date().toISOString();
      const timePart = now.split('T')[1] || '12:00:00.000Z';
      const resolvedDeliveredAt = `${deliveredDate}T${timePart}`;

      // 1. Process Non-Serialized Items
      for (const item of nonSerializedItems) {
        if (item.newDeliveryQty > 0) {
          const totalReceived = (item.globalReceivedQty || 0) + item.newDeliveryQty;
          const itemStatus = totalReceived >= (item.globalRequestedQty || 0) ? 'Delivered' : 'Partially Delivered';

          // Update request_items
          const { error: itemError } = await supabase
            .from('request_items')
            .update({
              received_quantity: totalReceived,
              status: itemStatus
            })
            .eq('id', item.id);
          if (itemError) throw itemError;

          // Record Transaction
          const { error: txError } = await supabase.from('stock_transactions').insert([{
            item_code: item.itemCode,
            to_location: item.location,
            quantity: item.newDeliveryQty,
            transaction_type: 'Delivery',
            reference_id: requestId,
            created_by: currentUser,
            reason: location.state?.selectedPO ? `PO:${location.state.selectedPO} | ${item.remarks || ''}` : item.remarks,
            created_at: resolvedDeliveredAt
          }]);
          if (txError) throw txError;

          // Update Inventory
          const { data: destStock } = await supabase
            .from('item_location_stocks')
            .select('id, quantity, brand_new_qty')
            .eq('item_code', item.itemCode)
            .eq('location', item.location)
            .maybeSingle();

          if (destStock) {
            const { error: destUpdateError } = await supabase.from('item_location_stocks')
              .update({ 
                quantity: destStock.quantity + item.newDeliveryQty,
                brand_new_qty: (destStock.brand_new_qty || 0) + item.newDeliveryQty
              })
              .eq('id', destStock.id);
            if (destUpdateError) throw destUpdateError;
          } else {
            const { error: destInsertError } = await supabase.from('item_location_stocks').insert([{
              item_code: item.itemCode,
              item_name: item.description,
              location: item.location,
              quantity: item.newDeliveryQty,
              brand_new_qty: item.newDeliveryQty
            }]);
            if (destInsertError) throw destInsertError;
          }
        }
      }

      // 2. Process Serialized Items
      for (const entry of entries) {
        if (entry.quantity > 0) {
          // Insert into item_serials
          const serialsToInsert = entry.serials.map(sn => ({
            item_code: entry.itemCode,
            serial_number: sn.trim(),
            location: entry.location,
            status: 'Available',
            condition: 'brand_new',
            request_id: requestId,
            created_at: resolvedDeliveredAt
          }));

          const { error: serialError } = await supabase
            .from('item_serials')
            .insert(serialsToInsert);
          if (serialError) throw serialError;

          // Update request_items
          const totalReceived = (entry.globalReceivedQty || 0) + entry.quantity;
          const itemStatus = totalReceived >= (entry.globalRequestedQty || 0) ? 'Delivered' : 'Partially Delivered';

          const { error: updateItemError } = await supabase
            .from('request_items')
            .update({
              received_quantity: totalReceived,
              status: itemStatus
            })
            .eq('id', entry.id);
          if (updateItemError) throw updateItemError;

          // Update Inventory
          const { data: existingStock } = await supabase
            .from('item_location_stocks')
            .select('id, quantity, brand_new_qty')
            .eq('item_code', entry.itemCode)
            .eq('location', entry.location)
            .maybeSingle();

          if (existingStock) {
            const { error: stockError } = await supabase
              .from('item_location_stocks')
              .update({ 
                quantity: existingStock.quantity + entry.quantity,
                brand_new_qty: (existingStock.brand_new_qty || 0) + entry.quantity
              })
              .eq('id', existingStock.id);
            if (stockError) throw stockError;
          } else {
            const { error: stockError } = await supabase
              .from('item_location_stocks')
              .insert([{
                item_code: entry.itemCode,
                item_name: entry.description,
                location: entry.location,
                quantity: entry.quantity,
                brand_new_qty: entry.quantity
              }]);
            if (stockError) throw stockError;
          }

          // Record Stock Transaction
          const { error: txError } = await supabase
            .from('stock_transactions')
            .insert([{
              item_code: entry.itemCode,
              to_location: entry.location,
              quantity: entry.quantity,
              transaction_type: 'Delivery',
              reference_id: requestId,
              created_by: currentUser,
              reason: location.state?.selectedPO ? `PO:${location.state.selectedPO} | ${entry.remarks || ''}` : entry.remarks,
              created_at: resolvedDeliveredAt
            }]);
          if (txError) throw txError;
        }
      }

      // 3. Update overall request status
      const { data: allItems, error: allItemsError } = await supabase
        .from('request_items')
        .select('received_quantity, qty')
        .eq('request_control_no', requestId);

      if (allItemsError) throw allItemsError;

      const allDelivered = allItems.every(item => item.received_quantity >= item.qty);
      const requestStatus = allDelivered ? 'Delivered' : 'Partially Delivered';

      const { error: requestError } = await supabase
        .from('item_requests')
        .update({ 
          status: requestStatus,
          delivered_at: resolvedDeliveredAt,
          updated_by: currentUser,
          updated_at: now
        })
        .eq('control_no', requestId);

      if (requestError) throw requestError;

      showSuccess('Success', 'Delivery recorded successfully.');
      setTimeout(() => {
        navigate('/requests');
      }, 2000);
    } catch (err: any) {
      console.error('Submission Error:', err);
      showError('Submission Failed', err.message || 'Failed to record delivery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSerialsNeeded = entries.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalSerialsEntered = entries.reduce((acc, curr) => acc + curr.serials.filter(s => s.trim() !== '').length, 0);
  const progressPercent = totalSerialsNeeded > 0 ? (totalSerialsEntered / totalSerialsNeeded) * 100 : 0;

  if (success) {
    return (
      <div className="min-h-screen bg-brand-offwhite dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center animate-in zoom-in-95 duration-300">
          <div className="w-24 h-24 bg-green-50 dark:bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/20">
            <CheckCircle2 size={56} />
          </div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Entry Complete!</h2>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-sm">Redirecting back to requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      className="h-full overflow-y-auto bg-brand-offwhite dark:bg-slate-950 flex flex-col transition-colors duration-300 [overflow-anchor:none]"
    >
      {/* Sticky Header & Summary Container */}
      <div className={`sticky top-0 z-50 border-b border-slate-100 dark:border-slate-800 transition-[background-color,backdrop-filter,box-shadow] duration-500 ${
        isScrolled 
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-lg' 
          : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md'
      }`}>
        {/* Header */}
        <header className={`px-6 lg:px-12 flex flex-col sm:flex-row sm:items-center justify-between gap-1 transition-[padding] duration-500 ease-in-out ${
          isScrolled ? 'py-2' : 'py-4'
        }`}>
          <div className="flex items-center gap-4 lg:gap-6">
            <button 
              onClick={() => navigate('/requests')}
              className={`hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400 dark:text-slate-500 hover:text-brand-orange ${
                isScrolled ? 'p-2' : 'p-3'
              }`}
            >
              <ArrowLeft size={isScrolled ? 18 : 24} />
            </button>
            <div>
              <h1 className={`font-black text-slate-800 dark:text-white tracking-tight uppercase font-poppins transition-all duration-300 ${
                isScrolled ? 'text-lg' : 'text-2xl'
              }`}>
                Receive Items & Assign Serials
              </h1>
              <div className={`flex items-center gap-4 transition-all duration-300 ${isScrolled ? 'mt-0' : 'mt-1'}`}>
                <span className={`font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-all duration-300 ${
                  isScrolled ? 'text-[8px]' : 'text-xs'
                }`}>
                  Request ID: <span className="text-brand-orange">{requestId}</span>
                  {location.state?.selectedPO && (
                    <span className="ml-4">
                      PO NO: <span className="text-[#2563EB]">{location.state.selectedPO}</span>
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="text-right hidden sm:block">
              <p className={`font-black text-slate-400 uppercase tracking-widest transition-all duration-300 ${
                isScrolled ? 'text-[8px] mb-0' : 'text-[10px] mb-1'
              }`}>Overall Progress</p>
              <div className="flex items-center gap-3">
                <div className={`bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden transition-all duration-300 ${
                  isScrolled ? 'w-24 h-1.5' : 'w-32 h-2'
                }`}>
                  <div 
                    className="h-full bg-[#FE4E02] transition-all duration-500" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className={`font-black text-slate-700 dark:text-white transition-all duration-300 ${
                  isScrolled ? 'text-xs' : 'text-sm'
                }`}>{totalSerialsEntered} / {totalSerialsNeeded}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/requests')}
                className={`text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all ${
                  isScrolled ? 'text-xs px-4 py-1.5' : 'text-sm px-6 py-3'
                }`}
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || totalSerialsEntered < totalSerialsNeeded || [...entries, ...nonSerializedItems].some(item => (item.quantity || item.newDeliveryQty || 0) > (item.requestedQty - item.previousReceivedQty)) || [...entries, ...nonSerializedItems].every(item => (item.quantity || item.newDeliveryQty || 0) === 0)}
                className={`bg-[#FE4E02] hover:bg-[#E04502] text-white rounded-2xl font-black shadow-xl shadow-[#FE4E02]/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 uppercase tracking-widest ${
                  isScrolled ? 'text-xs px-5 py-2' : 'text-sm px-8 py-3.5'
                }`}
              >
                {isSubmitting ? <Loader2 size={isScrolled ? 16 : 20} className="animate-spin" /> : <CheckCircle2 size={isScrolled ? 16 : 20} />}
                <span className="hidden sm:inline">Complete Entry</span>
                <span className="sm:hidden">Done</span>
              </button>
            </div>
          </div>
        </header>

        {/* Summary Bar Integrated */}
        {!loading && (
          <div className={`px-6 lg:px-12 border-t border-slate-100 dark:border-white/5 transition-[padding] duration-500 ease-in-out ${
            isScrolled ? 'py-1' : 'py-2'
          }`}>
            <div className={`grid grid-cols-2 md:grid-cols-5 max-w-7xl mx-auto transition-[gap] duration-500 ${
              isScrolled ? 'gap-1.5' : 'gap-2'
            }`}>
              <div className={`bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm transition-[padding] duration-500 ${
                isScrolled ? 'p-1.5 px-3' : 'p-4'
              }`}>
                <div className={`flex items-center gap-2 transition-[margin] duration-500 ${isScrolled ? 'mb-0' : 'mb-1'}`}>
                  <div className={`rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 transition-[width,height] duration-500 ${
                    isScrolled ? 'w-5 h-5' : 'w-8 h-8'
                  }`}>
                    <Box size={isScrolled ? 10 : 16} />
                  </div>
                  <p className={`font-black text-slate-400 uppercase tracking-widest transition-all duration-300 ${
                    isScrolled ? 'text-[8px]' : 'text-[10px]'
                  }`}>Total Items</p>
                </div>
                <p className={`font-black text-slate-800 dark:text-white transition-all duration-300 ${
                  isScrolled ? 'text-sm' : 'text-lg'
                }`}>{stats.totalItems}</p>
              </div>

              <div className={`bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm transition-[padding] duration-500 ${
                isScrolled ? 'p-1.5 px-3' : 'p-4'
              }`}>
                <div className={`flex items-center gap-2 transition-[margin] duration-500 ${isScrolled ? 'mb-0' : 'mb-1'}`}>
                  <div className={`rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 transition-[width,height] duration-500 ${
                    isScrolled ? 'w-5 h-5' : 'w-8 h-8'
                  }`}>
                    <Clipboard size={isScrolled ? 10 : 16} />
                  </div>
                  <p className={`font-black text-slate-400 uppercase tracking-widest transition-all duration-300 ${
                    isScrolled ? 'text-[8px]' : 'text-[10px]'
                  }`}>Requested</p>
                </div>
                <p className={`font-black text-slate-800 dark:text-white transition-all duration-300 ${
                  isScrolled ? 'text-sm' : 'text-lg'
                }`}>{stats.totalRequested}</p>
              </div>

              <div className={`bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm transition-[padding] duration-500 ${
                isScrolled ? 'p-1.5 px-3' : 'p-4'
              }`}>
                <div className={`flex items-center gap-2 transition-[margin] duration-500 ${isScrolled ? 'mb-0' : 'mb-1'}`}>
                  <div className={`rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 transition-[width,height] duration-500 ${
                    isScrolled ? 'w-5 h-5' : 'w-8 h-8'
                  }`}>
                    <CheckCircle2 size={isScrolled ? 10 : 16} />
                  </div>
                  <p className={`font-black text-slate-400 uppercase tracking-widest transition-all duration-300 ${
                    isScrolled ? 'text-[8px]' : 'text-[10px]'
                  }`}>Received</p>
                </div>
                <p className={`font-black text-emerald-500 transition-all duration-300 ${
                  isScrolled ? 'text-sm' : 'text-lg'
                }`}>{stats.totalReceived}</p>
              </div>

              <div className={`bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm transition-[padding] duration-500 ${
                isScrolled ? 'p-1.5 px-3' : 'p-4'
              }`}>
                <div className={`flex items-center gap-2 transition-[margin] duration-500 ${isScrolled ? 'mb-0' : 'mb-1'}`}>
                  <div className={`rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500 transition-[width,height] duration-500 ${
                    isScrolled ? 'w-5 h-5' : 'w-8 h-8'
                  }`}>
                    <AlertCircle size={isScrolled ? 10 : 16} />
                  </div>
                  <p className={`font-black text-slate-400 uppercase tracking-widest transition-all duration-300 ${
                    isScrolled ? 'text-[8px]' : 'text-[10px]'
                  }`}>Remaining</p>
                </div>
                <p className={`font-black text-orange-500 transition-all duration-300 ${
                  isScrolled ? 'text-sm' : 'text-lg'
                }`}>{stats.remaining}</p>
              </div>

              <div className={`bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm col-span-2 md:col-span-1 transition-[padding] duration-500 ${
                isScrolled ? 'p-1.5 px-3' : 'p-4'
              }`}>
                <div className={`flex items-center gap-2 transition-[margin] duration-500 ${isScrolled ? 'mb-0' : 'mb-1'}`}>
                  <div className={`rounded-lg bg-[#EFF6FF] dark:bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB] transition-[width,height] duration-500 ${
                    isScrolled ? 'w-5 h-5' : 'w-8 h-8'
                  }`}>
                    <Hash size={isScrolled ? 10 : 16} />
                  </div>
                  <p className={`font-black text-slate-400 uppercase tracking-widest transition-all duration-300 ${
                    isScrolled ? 'text-[8px]' : 'text-[10px]'
                  }`}>Serials</p>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-end justify-between">
                    <p className={`font-black text-[#2563EB] transition-all duration-300 ${
                      isScrolled ? 'text-xs' : 'text-lg'
                    }`}>{stats.totalSerialsEntered} / {stats.totalSerialsNeeded}</p>
                    <span className={`font-black text-slate-400 uppercase transition-all duration-300 ${
                      isScrolled ? 'text-[6px]' : 'text-[9px]'
                    }`}>{Math.round(stats.serialProgress)}%</span>
                  </div>
                  <div className={`w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden transition-all duration-300 ${
                    isScrolled ? 'h-0.5' : 'h-1.5'
                  }`}>
                    <div 
                      className="h-full bg-[#2563EB] transition-all duration-500" 
                      style={{ width: `${stats.serialProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-grow p-3 lg:p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Loader2 className="animate-spin text-brand-orange" size={40} />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading items...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Delivery Details Card - Date Delivered Picker */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FE4E02]/10 flex items-center justify-center text-[#FE4E02] shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Delivery Details</h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Specify delivery timestamp</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Date Delivered <span className="text-[#FE4E02]">*</span>
                  </label>
                  <input 
                    type="date"
                    required
                    value={deliveredDate}
                    onChange={(e) => setDeliveredDate(e.target.value)}
                    className="w-full h-11 px-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-[#FE4E02] focus:ring-4 focus:ring-[#FE4E02]/5 transition-all"
                  />
                  <p className="text-[10px] text-gray-400 font-medium px-1">Required: Enter the actual date of delivery (default is today).</p>
                </div>
              </div>
            </div>

            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Items to Process</h2>
            
            {/* Non-Serialized Items Section */}
            {nonSerializedItems.length > 0 && (
              <div className="space-y-4">
                {nonSerializedItems.map((item, idx) => {
                  const remaining = item.requestedQty - item.previousReceivedQty;
                  const isInvalid = item.newDeliveryQty > remaining;
                   return (
                    <div key={`${item.id}-${idx}`} className="p-5 bg-white dark:bg-slate-900 border border-white/10 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-brand-orange/30 transition-all duration-300 space-y-4">
                      {/* Item Header */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-[#FE4E02]/10 rounded-lg flex items-center justify-center text-[#FE4E02]">
                          <Box size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{item.description}</h2>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] rounded-md border border-slate-200 dark:border-slate-700">
                              Non-Serialized
                            </span>
                          </div>
                          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">{item.code}</p>
                        </div>
                      </div>

                      {/* Info Boxes */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                        <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100/50 dark:border-slate-700/50">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Requested</p>
                          <p className="text-base font-black text-slate-700 dark:text-white">{item.requestedQty}</p>
                        </div>
                        <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100/50 dark:border-slate-700/50">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Received</p>
                          <p className="text-base font-black text-emerald-500">{item.previousReceivedQty}</p>
                        </div>
                        <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100/50 dark:border-slate-700/50">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Remaining</p>
                          <p className="text-base font-black text-[#FE4E02]">{remaining}</p>
                        </div>
                      </div>
                      
                      {/* Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">New Delivery Qty</label>
                          <input 
                            type="number"
                            min="0"
                            max={remaining}
                            disabled={remaining === 0}
                            placeholder={remaining === 0 ? "0" : remaining.toString()}
                            value={item.newDeliveryQty || ''}
                            onChange={(e) => handleQtyChange(item.id, e.target.value, false)}
                            className={`w-full h-10 px-4 bg-slate-50/50 dark:bg-slate-800/50 border ${isInvalid ? 'border-red-400' : 'border-slate-100 dark:border-slate-700'} rounded-lg text-sm font-bold text-slate-700 dark:text-white focus:border-[#FE4E02] focus:ring-4 focus:ring-[#FE4E02]/5 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-900/50`}
                          />
                          <p className="text-[9px] text-gray-400 mt-1 px-1">Enter quantity, then assign serial numbers if required.</p>
                          {isInvalid && <p className="text-red-400 text-[8px] font-bold uppercase tracking-widest mt-1 px-1">Quantity exceeds remaining amount</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Remarks</label>
                          <input 
                            type="text"
                            placeholder="Optional notes..."
                            value={item.remarks || ''}
                            onChange={(e) => handleRemarkChange(item.id, e.target.value, false)}
                            className="w-full h-10 px-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none focus:border-[#FE4E02] transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Serialized Items Section */}
            {entries.length > 0 && (
              <div className="space-y-4">
                {entries.map((entry, itemIdx) => {
                  const remaining = entry.requestedQty! - entry.previousReceivedQty!;
                  const isInvalid = entry.quantity > remaining;
                  const filledSerialsCount = entry.serials.filter(s => s.trim() !== '').length;
                  const isZero = filledSerialsCount === 0;
                  const isPartial = filledSerialsCount > 0 && filledSerialsCount < entry.quantity;
                  const isComplete = entry.quantity > 0 && filledSerialsCount === entry.quantity;
                  const isIncomplete = entry.quantity > 0 && filledSerialsCount < entry.quantity;
                  
                   return (
                    <div key={`${entry.itemCode}-${itemIdx}`} className="p-5 bg-white dark:bg-slate-900 border border-white/10 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-[#FE4E02]/30 transition-all duration-300 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Item Header */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-[#FE4E02]/10 rounded-lg flex items-center justify-center text-[#FE4E02]">
                          <Box size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{entry.description}</h2>
                            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.1em] rounded-md border border-amber-200 dark:border-amber-500/30">
                              Serialized
                            </span>
                          </div>
                          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">{entry.itemCode}</p>
                        </div>
                      </div>

                      {/* Info Boxes */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                        <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100/50 dark:border-slate-700/50">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Requested</p>
                          <p className="text-base font-black text-slate-700 dark:text-white">{entry.requestedQty}</p>
                        </div>
                        <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100/50 dark:border-slate-700/50">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Received</p>
                          <p className="text-base font-black text-emerald-500">{entry.previousReceivedQty}</p>
                        </div>
                        <div className="p-2.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100/50 dark:border-slate-700/50">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Remaining</p>
                          <p className="text-base font-black text-[#FE4E02]">{remaining}</p>
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Select quantity to assign serial numbers</label>
                          <div className="space-y-1.5">
                            <input 
                              type="number"
                              min="0"
                              max={remaining}
                              disabled={remaining === 0}
                              placeholder={remaining === 0 ? "0" : remaining.toString()}
                              value={entry.quantity || ''}
                              onChange={(e) => handleQtyChange(entry.id, e.target.value, true)}
                              className={`w-full h-10 px-4 bg-slate-50/50 dark:bg-slate-800/50 border ${isInvalid ? 'border-red-400' : 'border-slate-100 dark:border-slate-700'} rounded-lg text-sm font-bold text-slate-700 dark:text-white focus:border-[#FE4E02] focus:ring-4 focus:ring-[#FE4E02]/5 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-900/50`}
                            />
                            <p className="text-[9px] text-gray-400 mt-0.5 px-1">Enter quantity, then assign serial numbers if required.</p>
                            {isInvalid && <p className="text-red-400 text-[8px] font-bold uppercase tracking-widest mt-0.5 px-1">Quantity exceeds remaining amount</p>}
                            
                            <div 
                              onClick={() => setRevealedSerials(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                              className="flex items-center gap-1 text-[#FE4E02] cursor-pointer hover:opacity-80 transition-all px-1 py-0.5 w-fit"
                            >
                              <Hash size={10} />
                              <span className="text-[10px] font-bold">{revealedSerials[entry.id] ? 'Hide Serials' : 'Assign Serials'}</span>
                              {revealedSerials[entry.id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Remarks</label>
                          <input 
                            type="text"
                            placeholder="Optional notes..."
                            value={entry.remarks || ''}
                            onChange={(e) => handleRemarkChange(entry.id, e.target.value, true)}
                            className="w-full h-10 px-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none focus:border-[#FE4E02] transition-all"
                          />
                        </div>
                      </div>

                      {/* Serial Inputs Section */}
                      {revealedSerials[entry.id] && entry.quantity > 0 && (
                        <div className="space-y-3 bg-white/5 border border-white/10 rounded-lg p-3 pt-6 animate-in fade-in slide-in-from-top-2 duration-200 transition-all">
                          <div className="flex flex-col gap-1.5 px-1">
                            <div className="flex items-center justify-between">
                              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign Serial Numbers</h3>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${isComplete ? 'text-green-400' : isPartial ? 'text-orange-400' : 'text-gray-400'}`}>
                                {filledSerialsCount} / {entry.quantity} Entered
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500 transition-all duration-300" 
                                style={{ width: `${(filledSerialsCount / entry.quantity) * 100}%` }}
                              />
                            </div>
                            {isIncomplete && <p className="text-red-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Missing serial numbers</p>}
                          </div>
                          
                          <div className="max-h-48 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {entry.serials.map((serial, serialIdx) => {
                              const inputId = `${itemIdx}-${serialIdx}`;
                              return (
                                <div key={serialIdx} className="flex items-center gap-3 group">
                                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 w-28 shrink-0 truncate uppercase tracking-widest">
                                    {entry.description} {serialIdx + 1}
                                  </label>
                                  <div className="relative flex-1">
                                    <input 
                                      ref={el => inputRefs.current[inputId] = el}
                                      type="text"
                                      placeholder={`Enter serial ${serialIdx + 1}...`}
                                      value={serial}
                                      onChange={(e) => handleSerialChange(itemIdx, serialIdx, e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(itemIdx, serialIdx, e)}
                                      onPaste={(e) => handlePaste(itemIdx, serialIdx, e)}
                                      className="w-full h-9 px-4 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-white focus:border-[#FE4E02] focus:ring-4 focus:ring-[#FE4E02]/5 outline-none transition-all"
                                    />
                                    {serial.trim() !== '' && (
                                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                        <CheckCircle2 size={14} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
            <Clipboard size={14} />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              Tip: You can paste multiple serial numbers (separated by lines or commas) to bulk fill.
            </p>
          </div>
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
            Inventory stocks and transactions will be recorded upon completion.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SerialNumberEntryPage;
