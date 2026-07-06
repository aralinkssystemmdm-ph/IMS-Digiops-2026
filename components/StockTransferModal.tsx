
import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, MapPin, Loader2, CheckCircle2, AlertCircle, ChevronDown, Search, Box } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: {
    item_code: string;
    item_name: string;
    total_quantity: number;
  };
  isDarkMode?: boolean;
  isEmbedded?: boolean;
}

interface LocationStock {
  location: string;
  quantity: number;
  conditions: {
    brand_new: number;
    used: number;
    defective: number;
    disposal: number;
  };
}

interface LocationItem {
  name: string;
}

interface CatalogItem {
  code: string;
  description: string;
  is_serialized?: boolean | string;
}

interface StockCondition {
  brand_new: string;
  used: string;
  defective: string;
  disposal: string;
}

interface SerialState {
  brand_new: string[];
  used: string[];
  defective: string[];
  disposal: string[];
}

const INITIAL_CONDITION = {
  brand_new: '',
  used: '',
  defective: '',
  disposal: ''
};

const INITIAL_SERIALS = {
  brand_new: [],
  used: [],
  defective: [],
  disposal: []
};

const StockTransferModal: React.FC<StockTransferModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  item, 
  isDarkMode = false,
  isEmbedded = false
}) => {
  const { showSuccess, showError } = useNotification();
  const [locations, setLocations] = useState<LocationStock[]>([]);
  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fromLocation, setFromLocation] = useState<string>('IT Basement');
  const [toLocation, setToLocation] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [program, setProgram] = useState<string>('General');
  
  const [conditions, setConditions] = useState<StockCondition>({ ...INITIAL_CONDITION });
  const [serials, setSerials] = useState<SerialState>({ ...INITIAL_SERIALS });
  const [showSerials, setShowSerials] = useState(false);

  const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);
  const itemDropdownRef = useRef<HTMLDivElement>(null);
  const programDropdownRef = useRef<HTMLDivElement>(null);

  const programs = ['General', 'Junior High', 'Senior High', 'Elementary', 'Special Program'];

  const isSerializedItem = selectedItem && (
    selectedItem.is_serialized === true || 
    selectedItem.is_serialized === 'YES' || 
    String(selectedItem.is_serialized).toUpperCase() === 'TRUE'
  );

  const totalTransferQty = (parseInt(conditions.brand_new) || 0) + 
                           (parseInt(conditions.used) || 0) + 
                           (parseInt(conditions.defective) || 0) + 
                           (parseInt(conditions.disposal) || 0);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        // Fetch is_serialized for the specific item if it's not provided in the prop
        const fetchItemInfo = async () => {
          const { data } = await supabase
            .from('equipment')
            .select('is_serialized')
            .eq('item_code', item.item_code)
            .maybeSingle();
            
          setSelectedItem({ 
            code: item.item_code, 
            description: item.item_name,
            is_serialized: data?.is_serialized
          });
        };
        fetchItemInfo();
      } else {
        fetchAvailableItems();
      }
      fetchLocations();
      resetForm();
    }
  }, [isOpen, item]);

  useEffect(() => {
    if (selectedItem?.code) {
      fetchItemStocks(selectedItem.code);
      // Reset conditions and serials when item changes
      setConditions({ ...INITIAL_CONDITION });
      setSerials({ ...INITIAL_SERIALS });
      setShowSerials(false);
    }
  }, [selectedItem?.code]);

  const fetchAvailableItems = async () => {
    if (!isSupabaseConfigured) return;
    try {
      // Fetch items that have stock > 0
      const { data } = await supabase
        .from('view_inventory_summary')
        .select('item_code, item_name, is_serialized')
        .gt('total_quantity', 0)
        .order('item_name');
      
      if (data) {
        setCatalogItems(data.map(d => ({ 
          code: d.item_code, 
          description: d.item_name,
          is_serialized: d.is_serialized
        })));
      }
    } catch (err) {
      console.error('Error fetching available items:', err);
    }
  };

  const fetchLocations = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data } = await supabase.from('locations').select('name').order('name');
      if (data) setAllLocations(data);
    } catch (err) {
      console.error('Error fetching all locations:', err);
    }
  };

  const fetchItemStocks = async (code: string) => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('item_location_stocks')
        .select('location, quantity, brand_new_qty, used_qty, defective_qty, disposal_qty')
        .eq('item_code', code)
        .gt('quantity', 0)
        .order('quantity', { ascending: false });

      if (data) {
        setLocations(data.map(d => ({
          location: d.location,
          quantity: d.quantity,
          conditions: {
            brand_new: d.brand_new_qty || 0,
            used: d.used_qty || 0,
            defective: d.defective_qty || 0,
            disposal: d.disposal_qty || 0
          }
        })));
      } else {
        setLocations([]);
      }
    } catch (err) {
      console.error('Error fetching item stocks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target as Node)) {
        setIsFromDropdownOpen(false);
      }
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target as Node)) {
        setIsToDropdownOpen(false);
      }
      if (programDropdownRef.current && !programDropdownRef.current.contains(event.target as Node)) {
        setIsProgramDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetForm = () => {
    if (!item) setSelectedItem(null);
    setFromLocation('IT Basement');
    setToLocation('');
    setConditions({ ...INITIAL_CONDITION });
    setSerials({ ...INITIAL_SERIALS });
    setShowSerials(false);
    setRemarks('');
    setProgram('General');
    setError(null);
    setSuccess(false);
  };

  const updateConditionValue = (condition: keyof StockCondition, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const count = parseInt(numericValue) || 0;
    
    // Update serials array size to match count
    const currentSerials = serials[condition];
    const newSerials = [...currentSerials];
    
    if (count > currentSerials.length) {
      for (let i = currentSerials.length; i < count; i++) {
        newSerials.push('');
      }
    } else if (count < currentSerials.length) {
      newSerials.length = count;
    }

    setConditions(prev => ({ ...prev, [condition]: numericValue }));
    setSerials(prev => ({ ...prev, [condition]: newSerials }));
  };

  const handleSerialChange = (condition: keyof StockCondition, index: number, value: string) => {
    setSerials(prev => {
      const newSerials = [...prev[condition]];
      newSerials[index] = value;
      return { ...prev, [condition]: newSerials };
    });
  };

  const handleSerialPaste = (condition: keyof StockCondition, index: number, e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const rows = pastedData.split(/[\r\n\t]+/).map(row => row.trim()).filter(row => row.length > 0);
    
    if (rows.length === 0) return;

    setSerials(prev => {
      const newSerials = [...prev[condition]];
      const qty = parseInt(conditions[condition]) || 0;
      for (let i = 0; i < rows.length && (index + i) < qty; i++) {
        newSerials[index + i] = rows[i];
      }
      return { ...prev, [condition]: newSerials };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !fromLocation || !toLocation || totalTransferQty <= 0) {
      setError('Please fill in all fields and enter quantities.');
      return;
    }

    if (fromLocation === toLocation) {
      setError('Source and destination locations must be different.');
      return;
    }

    const sourceStock = locations.find(l => l.location === fromLocation);
    if (!sourceStock) {
      setError(`No stock found at ${fromLocation}.`);
      return;
    }

    // Check individual condition availability
    const sourceConditions = sourceStock.conditions || { brand_new: 0, used: 0, defective: 0, disposal: 0 };
    const transferConditions = {
      brand_new: parseInt(conditions.brand_new) || 0,
      used: parseInt(conditions.used) || 0,
      defective: parseInt(conditions.defective) || 0,
      disposal: parseInt(conditions.disposal) || 0
    };

    if (transferConditions.brand_new > sourceConditions.brand_new) {
      setError(`Insufficient Brand New stock at ${fromLocation}. Available: ${sourceConditions.brand_new}`);
      return;
    }
    if (transferConditions.used > sourceConditions.used) {
      setError(`Insufficient Used stock at ${fromLocation}. Available: ${sourceConditions.used}`);
      return;
    }
    if (transferConditions.defective > sourceConditions.defective) {
      setError(`Insufficient Defective stock at ${fromLocation}. Available: ${sourceConditions.defective}`);
      return;
    }
    if (transferConditions.disposal > sourceConditions.disposal) {
      setError(`Insufficient Disposal stock at ${fromLocation}. Available: ${sourceConditions.disposal}`);
      return;
    }

    if (isSerializedItem) {
      // Ensure all serials are filled
      for (const cond of (['brand_new', 'used', 'defective', 'disposal'] as const)) {
        const qty = transferConditions[cond];
        const sers = serials[cond];
        if (sers.length !== qty || sers.some(s => !s.trim())) {
          setError(`Please fill all serial numbers for ${cond.replace('_', ' ')}.`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const currentUser = localStorage.getItem('aralinks_user') || 'System';
      const reqNo = `TRF-${Math.floor(100000 + Math.random() * 900000)}`;

      // 1. Save Transfer Record (transfer_requests)
      const { error: trError } = await supabase
        .from('transfer_requests')
        .insert([{
          req_no: reqNo,
          item_code: selectedItem.code,
          item_name: selectedItem.description,
          from_location: fromLocation,
          to_location: toLocation,
          program: program,
          quantity: totalTransferQty,
          status: 'Completed',
          remarks: remarks,
          created_by: currentUser,
          // Store condition quantities if columns exist
          brand_new_qty: transferConditions.brand_new,
          used_qty: transferConditions.used,
          defective_qty: transferConditions.defective,
          disposal_qty: transferConditions.disposal
        }]);

      if (trError) throw trError;

      // 2. Subtract from Source
      const { error: subError } = await supabase
        .from('item_location_stocks')
        .update({ 
          quantity: sourceStock.quantity - totalTransferQty,
          brand_new_qty: sourceConditions.brand_new - transferConditions.brand_new,
          used_qty: sourceConditions.used - transferConditions.used,
          defective_qty: sourceConditions.defective - transferConditions.defective,
          disposal_qty: sourceConditions.disposal - transferConditions.disposal
        })
        .eq('item_code', selectedItem.code)
        .eq('location', fromLocation);

      if (subError) throw subError;

      // 3. Add to Destination
      const { data: destStock } = await supabase
        .from('item_location_stocks')
        .select('id, quantity, brand_new_qty, used_qty, defective_qty, disposal_qty')
        .eq('item_code', selectedItem.code)
        .eq('location', toLocation)
        .maybeSingle();

      if (destStock) {
        await supabase
          .from('item_location_stocks')
          .update({ 
            quantity: destStock.quantity + totalTransferQty,
            brand_new_qty: (destStock.brand_new_qty || 0) + transferConditions.brand_new,
            used_qty: (destStock.used_qty || 0) + transferConditions.used,
            defective_qty: (destStock.defective_qty || 0) + transferConditions.defective,
            disposal_qty: (destStock.disposal_qty || 0) + transferConditions.disposal
          })
          .eq('id', destStock.id);
      } else {
        await supabase
          .from('item_location_stocks')
          .insert([{
            item_code: selectedItem.code,
            item_name: selectedItem.description,
            location: toLocation,
            quantity: totalTransferQty,
            brand_new_qty: transferConditions.brand_new,
            used_qty: transferConditions.used,
            defective_qty: transferConditions.defective,
            disposal_qty: transferConditions.disposal
          }]);
      }

      // 4. Update Serials location if serialized
      if (isSerializedItem) {
        for (const cond of (['brand_new', 'used', 'defective', 'disposal'] as const)) {
          const sers = serials[cond];
          if (sers.length > 0) {
            const { error: serUpdateError } = await supabase
              .from('item_serials')
              .update({ location: toLocation })
              .eq('item_code', selectedItem.code)
              .in('serial_number', sers);
            
            if (serUpdateError) {
              console.warn(`Could not update serials for ${cond}:`, serUpdateError);
            }
          }
        }
      }

      // 5. Create Transfer History record
      await supabase.from('transfer_history').insert([{
        req_no: reqNo,
        from_location: fromLocation,
        to_location: toLocation,
        transferred_by: currentUser,
        items: [{
          item_code: selectedItem.code,
          item_name: selectedItem.description,
          quantity: totalTransferQty,
          conditions: transferConditions
        }],
        program: program,
        remarks: remarks
      }]);

      setSuccess(true);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error transferring stock:', err);
      setError(err.message || 'Failed to transfer stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen && !isEmbedded) return null;

  const content = (
    <div className={`${!isEmbedded ? `relative w-full max-w-lg rounded-[2rem] shadow-2xl border-2 border-brand-orange p-8 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}` : ''}`}>
      {!isEmbedded && (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-orange/10 rounded-2xl flex items-center justify-center">
              <ArrowRightLeft size={24} className="text-brand-orange" />
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Transfer Stock</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedItem?.description || 'Select Item'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>
      )}

      {success ? (
        <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={48} className="text-emerald-500" />
          </div>
          <h4 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Transfer Successful!</h4>
          <p className="text-slate-500 text-sm">Stock has been moved between locations.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Item Selection (Visible if not provided) */}
          {!item && (
            <div className="space-y-2 relative" ref={itemDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Item to Transfer</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isItemDropdownOpen ? 'ring-2 ring-brand-orange border-transparent' : ''}`}
                onClick={() => setIsItemDropdownOpen(!isItemDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Box size={18} className="text-brand-orange shrink-0" />
                  <span className="font-bold truncate">{selectedItem?.description || 'Pick an item...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isItemDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="p-3 border-b border-inherit">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="text"
                        placeholder="Search items..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border-none text-xs outline-none"
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {catalogItems
                      .filter(i => i.description.toLowerCase().includes(itemSearch.toLowerCase()) || i.code.toLowerCase().includes(itemSearch.toLowerCase()))
                      .map((i, idx) => (
                        <button
                          key={`${i.code}-${idx}`}
                          type="button"
                          onClick={() => { setSelectedItem(i); setIsItemDropdownOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-brand-orange/5 hover:text-brand-orange ${
                            selectedItem?.code === i.code ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span>{i.description}</span>
                            <span className="text-[9px] opacity-40 font-mono tracking-tighter">{i.code}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

            {/* From Location */}
            <div className="space-y-2 relative" ref={fromDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Location (Source)</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isFromDropdownOpen ? 'ring-2 ring-brand-orange border-transparent' : ''}`}
                onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MapPin size={18} className="text-brand-orange shrink-0" />
                  <span className="font-bold truncate">{fromLocation || 'Select source location...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isFromDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isFromDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {locations.length > 0 ? (
                      locations.map((loc, idx) => (
                        <button
                          key={`${loc.location}-${idx}`}
                          type="button"
                          onClick={() => { setFromLocation(loc.location); setIsFromDropdownOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-brand-orange/5 hover:text-brand-orange flex items-center justify-between ${
                            fromLocation === loc.location ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          <span>{loc.location}</span>
                          <span className="text-[10px] opacity-50">{loc.quantity} available</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-5 py-8 text-center opacity-40">
                        <MapPin size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No stock available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* To Location */}
            <div className="space-y-2 relative" ref={toDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Location (Destination)</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isToDropdownOpen ? 'ring-2 ring-brand-orange border-transparent' : ''}`}
                onClick={() => setIsToDropdownOpen(!isToDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MapPin size={18} className="text-brand-orange shrink-0" />
                  <span className="font-bold truncate">{toLocation || 'Select destination location...'}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isToDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isToDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {allLocations.map((loc, idx) => (
                      <button
                        key={`${loc.name}-${idx}`}
                        type="button"
                        onClick={() => { setToLocation(loc.name); setIsToDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-brand-orange/5 hover:text-brand-orange ${
                          toLocation === loc.name ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Program Selection */}
              <div className="space-y-2 relative" ref={programDropdownRef}>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Program</label>
                <div 
                  className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                  } ${isProgramDropdownOpen ? 'ring-2 ring-brand-orange border-transparent' : ''}`}
                  onClick={() => setIsProgramDropdownOpen(!isProgramDropdownOpen)}
                >
                  <span className="font-bold truncate text-xs">{program}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isProgramDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isProgramDropdownOpen && (
                  <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                  }`}>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {programs.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { setProgram(p); setIsProgramDropdownOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-[10px] font-bold transition-all hover:bg-brand-orange/5 hover:text-brand-orange ${
                            program === p ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Total Quantity Display */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Quantity</label>
                <div className="relative">
                  <input 
                    type="text" 
                    readOnly
                    value={totalTransferQty}
                    className={`w-full px-5 py-4 rounded-2xl border outline-none font-bold text-sm transition-all bg-slate-100/50 dark:bg-slate-800/50 ${
                      isDarkMode ? 'border-slate-700 text-white' : 'border-slate-100 text-slate-700'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Conditions Grid */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Items to Transfer (Conditions)</label>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/20 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                {(['brand_new', 'used', 'defective', 'disposal'] as const).map((cond) => (
                  <div key={cond} className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      {cond.replace('_', ' ')}
                    </label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      placeholder="0"
                      value={conditions[cond]}
                      onChange={(e) => updateConditionValue(cond, e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none font-bold text-sm transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-brand-orange' : 'bg-white border-slate-200 text-slate-700 focus:border-brand-orange'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Serial Numbers Section (if serialized) */}
            {isSerializedItem && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => setShowSerials(!showSerials)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Box size={14} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Serial Numbers Entry</span>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showSerials ? 'rotate-180' : ''}`} />
                </button>

                {showSerials && (
                  <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-[9px] font-bold text-amber-500/80 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-center">
                      Tip: You can paste multiple serial numbers from Excel or spreadsheets directly into any field.
                    </p>
                    {(['brand_new', 'used', 'defective', 'disposal'] as const).map(cond => {
                      const qty = parseInt(conditions[cond]) || 0;
                      if (qty === 0) return null;

                      return (
                        <div key={`serials-${cond}`} className="space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-l-2 border-amber-500 pl-2">
                            {cond.replace('_', ' ')} Serials ({qty})
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                            {Array.from({ length: qty }).map((_, i) => (
                              <input 
                                key={`sn-${cond}-${i}`}
                                type="text"
                                placeholder={`Enter Serial # ${i + 1}`}
                                value={serials[cond][i] || ''}
                                onChange={(e) => handleSerialChange(cond, i, e.target.value)}
                                onPaste={(e) => handleSerialPaste(cond, i, e)}
                                className={`w-full px-4 py-2 rounded-lg border text-xs font-mono font-bold outline-none transition-all ${
                                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-500' : 'bg-white border-slate-200 text-slate-700 focus:border-amber-500'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    
                    {totalTransferQty === 0 && (
                      <p className="text-[10px] italic text-slate-400 text-center py-4 uppercase font-bold tracking-widest">
                        Enter quantities above to scan serials
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Remarks */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks (Optional)</label>
              <textarea 
                placeholder="Add any internal notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className={`w-full px-5 py-4 rounded-2xl border outline-none font-bold text-xs transition-all resize-none ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-brand-orange' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-brand-orange'
                }`}
              />
            </div>

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
                className="flex-[2] py-4 bg-brand-orange text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-orange/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
                Confirm Transfer
              </button>
            </div>
          </form>
      )}
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      {content}
    </div>
  );
};

export default StockTransferModal;
