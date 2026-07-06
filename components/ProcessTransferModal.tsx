
import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Package, CheckCircle2, ChevronRight, Loader2, AlertCircle, MapPin } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface ProcessTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  reqNo: string;
  onNavigate?: (viewId: string, params?: any) => void;
  isDarkMode?: boolean;
}

interface TransferItem {
  id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  received_quantity?: number; // How many are in warehouse/source
  delivered_quantity?: number; // How many were already transferred
  new_transfer_qty?: number; // What we are transferring now
  location?: string;
  status?: string;
}

const ProcessTransferModal: React.FC<ProcessTransferModalProps> = ({ 
  isOpen, 
  onClose, 
  reqNo, 
  onNavigate,
  isDarkMode = false 
}) => {
  const { showSuccess, showError } = useNotification();
  const [items, setItems] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<{ from: string; to: string; program: string } | null>(null);

  useEffect(() => {
    if (isOpen && reqNo) {
      fetchRequestItems();
    }
  }, [isOpen, reqNo]);

  const fetchRequestItems = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      // Try to fetch from internal transfers first
      const { data: internalData } = await supabase
        .from('transfer_requests')
        .select('*')
        .eq('req_no', reqNo);

      if (internalData && internalData.length > 0) {
        setSourceInfo({
          from: internalData[0].from_location,
          to: internalData[0].to_location,
          program: internalData[0].program
        });
        setItems(internalData.map(i => ({
          id: i.id,
          item_code: i.item_code,
          item_name: i.item_name,
          quantity: i.quantity,
          received_quantity: i.quantity, // For internal, assume fully received at source
          delivered_quantity: i.status === 'Completed' ? i.quantity : 0,
          new_transfer_qty: 0,
          status: i.status
        })));
      } else {
        // Try school requests
        const { data: schoolItems } = await supabase
          .from('request_items')
          .select(`
            *,
            item_requests:request_control_no (
              school_name,
              program
            )
          `)
          .eq('request_control_no', reqNo);

        if (schoolItems && schoolItems.length > 0) {
          setSourceInfo({
            from: 'IT Basement',
            to: schoolItems[0].item_requests.school_name,
            program: schoolItems[0].item_requests.program || 'General'
          });
          setItems(schoolItems.map(i => ({
            id: i.id,
            item_code: i.code,
            item_name: i.item,
            quantity: i.qty,
            received_quantity: i.received_quantity || 0,
            delivered_quantity: i.delivered_quantity || 0,
            new_transfer_qty: 0,
            status: i.status
          })));
        }
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (id: string, val: string) => {
    const num = parseInt(val) || 0;
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        // Can't transfer more than what's received at source, 
        // and can't exceed remaining quantity needed for school requests if applicable
        const maxAtSource = (item.received_quantity || 0) - (item.delivered_quantity || 0);
        const finalVal = Math.min(num, maxAtSource);
        return { ...item, new_transfer_qty: finalVal };
      }
      return item;
    }));
  };

  const handleProcess = async () => {
    const toProcess = items.filter(i => (i.new_transfer_qty || 0) > 0);
    if (toProcess.length === 0) {
      showError('Error', 'Please enter quantity to transfer for at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      // In a real app, this would involve complex inventory movements
      // For now, let's simulate the database updates
      const currentUser = localStorage.getItem('aralinks_user') || 'Admin';

      const itemsTransferred: any[] = [];

      for (const item of toProcess) {
        const qty = item.new_transfer_qty || 0;

        itemsTransferred.push({
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: qty
        });

        // 1. Log transaction
        await supabase.from('stock_transactions').insert([{
          item_code: item.item_code,
          from_location: sourceInfo?.from,
          to_location: sourceInfo?.to,
          quantity: qty,
          transaction_type: 'Delivery',
          reference_id: reqNo,
          created_by: currentUser,
          reason: `Transfer from ${reqNo}`
        }]);

        // 2. Update status/delivered quantity if it's a school request
        // Check if ID is from request_items
        const { data: isRequestItem } = await supabase.from('request_items').select('id').eq('id', item.id).maybeSingle();
        if (isRequestItem) {
          const newDelivered = (item.delivered_quantity || 0) + qty;
          const status = newDelivered >= item.quantity ? 'Delivered' : 'Partially Delivered';
          await supabase.from('request_items').update({
            delivered_quantity: newDelivered,
            status: status
          }).eq('id', item.id);
        } else {
          // If internal transfer, mark as completed if fully processed
          const newDelivered = (item.delivered_quantity || 0) + qty;
          if (newDelivered >= item.quantity) {
             await supabase.from('transfer_requests').update({ status: 'Completed' }).eq('id', item.id);
          }
        }
      }

      // 3. Create Transfer History record
      if (itemsTransferred.length > 0) {
        await supabase.from('transfer_history').insert([{
          req_no: reqNo,
          from_location: sourceInfo?.from,
          to_location: sourceInfo?.to,
          transferred_by: currentUser,
          items: itemsTransferred,
          program: items[0]?.program || 'General'
        }]);
      }

      showSuccess('Success', 'Inventory transfer processed successfully!');
      onClose();
    } catch (err) {
      console.error('Error processing transfer:', err);
      showError('Error', 'Failed to process transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-3xl rounded-[2.5rem] shadow-2xl border-2 border-brand-orange overflow-hidden animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand-orange/10 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-orange/10">
                <ArrowRightLeft size={28} className="text-brand-orange" />
              </div>
              <div>
                <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Transfer Details</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Request No: <span className="text-brand-orange">{reqNo}</span></p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
              <X size={24} />
            </button>
          </div>

          {/* Source/Dest Info */}
          {sourceInfo && (
            <div className={`grid grid-cols-2 gap-4 p-5 rounded-3xl border mb-6 ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">From (Source)</p>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-emerald-500" />
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{sourceInfo.from}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">To (Destination)</p>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-brand-orange" />
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{sourceInfo.to}</p>
                  </div>
                </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <table className="w-full text-left">
              <thead>
                <tr className={`${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-b divide-x divide-transparent rotate-0`}>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Item Name</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-center">Qty Received</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-center">Transferred</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-center w-40">Qty</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                      <Loader2 className="animate-spin mx-auto mb-4" size={32} />
                      Loading items...
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((item) => (
                    <tr key={item.id} className={`${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'} transition-colors`}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-orange/5 flex items-center justify-center">
                            <Package size={16} className="text-brand-orange" />
                          </div>
                          <div>
                            <p className={`text-sm font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.item_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.item_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {item.received_quantity || 0}
                        </span>
                        <p className="text-[9px] font-bold text-slate-400 italic">In IT Basement</p>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <div className="flex flex-col items-center gap-1">
                            <div className={`min-w-[80px] px-4 py-3 rounded-2xl border flex items-center justify-center font-black ${
                                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-400'
                            }`}>
                                {item.delivered_quantity || 0}
                            </div>
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-[0.1em] italic">
                                {item.delivered_quantity || 0} Already Transferred
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <div className="flex flex-col items-center gap-1">
                            <div className={`min-w-[80px] px-4 py-3 rounded-2xl border flex items-center justify-center font-black ${
                                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-400'
                            }`}>
                                {item.quantity || 0}
                            </div>
                         </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                      No items found for this request
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <button 
              onClick={() => {
                onClose();
                if (onNavigate) {
                  onNavigate('verified-transfer', { 
                    prefillFromLocation: sourceInfo?.from,
                    prefillToLocation: sourceInfo?.to
                  }); 
                }
              }}
              className="flex-1 py-4 bg-brand-orange/10 text-brand-orange rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-orange/20 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              Verified Items
            </button>
            <button 
              onClick={onClose}
              className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessTransferModal;
