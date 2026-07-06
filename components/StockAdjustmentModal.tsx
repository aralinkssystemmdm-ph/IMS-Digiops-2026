
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, MapPin, Loader2, CheckCircle2, AlertCircle, ChevronDown, Info, Settings2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: {
    item_code: string;
    item_name: string;
  };
  mode: 'add' | 'adjust';
  isDarkMode?: boolean;
}

interface LocationItem {
  name: string;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ isOpen, onClose, onSuccess, item, mode, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotification();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && item.item_code) {
      fetchLocations();
      resetForm();
    }
  }, [isOpen, item.item_code]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchLocations = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('name')
        .order('name');
      if (data) setLocations(data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedLocation('');
    setQuantity('');
    setReason('');
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !quantity || (mode === 'adjust' && !reason)) {
      setError('Please fill in all required fields.');
      return;
    }

    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum) || (mode === 'add' && qtyNum <= 0)) {
      setError('Please enter a valid quantity.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const currentUser = localStorage.getItem('aralinks_user') || 'System';

      // 1. Record Transaction
      const { error: txError } = await supabase
        .from('stock_transactions')
        .insert([{
          item_code: item.item_code,
          to_location: selectedLocation,
          quantity: qtyNum,
          transaction_type: mode === 'add' ? 'Restock' : 'Adjustment',
          reason: mode === 'adjust' ? reason : undefined,
          created_by: currentUser
        }]);

      if (txError) throw txError;

      // 2. Update Stock
      const isMainSource = selectedLocation.toLowerCase().includes('warehouse') || selectedLocation === 'IT Basement';
      const finalQtyChange = (isMainSource && qtyNum < 0) ? 0 : qtyNum;

      const { data: existingStock } = await supabase
        .from('item_location_stocks')
        .select('id, quantity')
        .eq('item_code', item.item_code)
        .eq('location', selectedLocation)
        .maybeSingle();

      if (existingStock) {
        const { error: updateError } = await supabase
          .from('item_location_stocks')
          .update({ quantity: Math.max(0, existingStock.quantity + finalQtyChange) })
          .eq('id', existingStock.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('item_location_stocks')
          .insert([{
            item_code: item.item_code,
            item_name: item.item_name,
            location: selectedLocation,
            quantity: Math.max(0, finalQtyChange)
          }]);
        if (insertError) throw insertError;
      }

      showSuccess('Success', 'Stock updated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adjusting stock:', err);
      showError('Error', err.message || 'Failed to update stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-[2rem] shadow-2xl border-2 border-[#FE4E02] p-8 animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900' : 'bg-white'
      }`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              mode === 'add' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            }`}>
              {mode === 'add' ? <Plus size={24} /> : <Settings2 size={24} />}
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {mode === 'add' ? 'Add Stock' : 'Adjust Stock'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.item_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h4 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Stock Updated!</h4>
            <p className="text-slate-500 text-sm">Inventory levels have been adjusted.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location Selection */}
            <div className="space-y-2 relative" ref={locationDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isLocationDropdownOpen ? 'ring-2 ring-[#FE4E02] border-transparent' : ''}`}
                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MapPin size={18} className="text-[#FE4E02] shrink-0" />
                  <span className="font-bold truncate">{selectedLocation || 'Select location...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isLocationDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {locations.map((loc, idx) => (
                      <button
                        key={`${loc.name}-${idx}`}
                        type="button"
                        onClick={() => { setSelectedLocation(loc.name); setIsLocationDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-[#FE4E02]/5 hover:text-[#FE4E02] ${
                          selectedLocation === loc.name ? 'bg-[#FE4E02]/10 text-[#FE4E02]' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {mode === 'add' ? 'Quantity to Add' : 'Adjustment Quantity (+/-)'}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^-0-9]/g, ''))}
                  className={`w-full px-5 py-4 rounded-2xl border outline-none font-bold text-lg transition-all ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-[#FE4E02]' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-[#FE4E02]'
                  }`}
                />
                {mode === 'adjust' && (
                  <p className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Use negative numbers to subtract stock
                  </p>
                )}
              </div>
            </div>

            {/* Reason (Adjustment Only) */}
            {mode === 'adjust' && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Adjustment</label>
                <textarea 
                  placeholder="Explain why this adjustment is being made..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className={`w-full px-5 py-4 rounded-2xl border outline-none font-bold text-sm transition-all resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-[#FE4E02]' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-[#FE4E02]'
                  }`}
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-500">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-xs font-bold tracking-tight">{error}</p>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={onClose}
                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className={`flex-[2] py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${
                  mode === 'add' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-amber-500 shadow-amber-500/20'
                }`}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : mode === 'add' ? <Plus size={18} /> : <CheckCircle2 size={18} />}
                {mode === 'add' ? 'Add Stock' : 'Confirm Adjustment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StockAdjustmentModal;
