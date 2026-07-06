
import React, { useState, useEffect, useRef } from 'react';
import { X, Box, MapPin, Plus, Loader2, CheckCircle2, AlertCircle, ChevronDown, Search, Trash2, Filter } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isDarkMode?: boolean;
}

interface EquipmentItem {
  item_code: string;
  description: string;
  is_serialized: boolean | string;
}

interface LocationItem {
  name: string;
}

interface StockCondition {
  brand_new: string;
  used: string;
  defective: string;
  disposal: string;
}

interface LocationEntry {
  id: string;
  location: string;
  conditions: StockCondition;
  serials: {
    brand_new: string[];
    used: string[];
    defective: string[];
    disposal: string[];
  };
  showSerials: boolean;
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

const AddStockModal: React.FC<AddStockModalProps> = ({ isOpen, onClose, onSuccess, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotification();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemFilter, setItemFilter] = useState<'All' | 'Serialized' | 'Non-Serialized'>('All');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const itemDropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [locationEntries, setLocationEntries] = useState<LocationEntry[]>([
    { 
      id: Math.random().toString(36).substr(2, 9), 
      location: '', 
      conditions: { ...INITIAL_CONDITION },
      serials: { ...INITIAL_SERIALS },
      showSerials: false
    }
  ]);
  
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const locationDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [duplicateSerials, setDuplicateSerials] = useState<string[]>([]);
  const [dbDuplicates, setDbDuplicates] = useState<string[]>([]);

  // Real-time duplicate check with debouncing
  useEffect(() => {
    const isSerialized = selectedItem && (
      selectedItem.is_serialized === true || 
      selectedItem.is_serialized === 'YES' || 
      String(selectedItem.is_serialized).toUpperCase() === 'TRUE'
    );

    if (!isSerialized) {
      setDuplicateSerials([]);
      setDbDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      const allSerials: string[] = [];
      locationEntries.forEach(entry => {
        (['brand_new', 'used', 'defective', 'disposal'] as const).forEach(condition => {
          entry.serials[condition].forEach(sn => {
            const trimmed = sn.trim();
            if (trimmed) allSerials.push(trimmed);
          });
        });
      });

      if (allSerials.length === 0) {
        setDuplicateSerials([]);
        setDbDuplicates([]);
        return;
      }

      // 1. Check for local duplicates within the current entry itself
      const localDupes = allSerials.filter((item, index) => allSerials.indexOf(item) !== index);
      setDuplicateSerials([...new Set(localDupes)]);

      // 2. Check against database
      try {
        const { data: existingSerials, error: snCheckError } = await supabase
          .from('item_serials')
          .select('serial_number')
          .in('serial_number', allSerials);

        if (snCheckError) throw snCheckError;

        if (existingSerials) {
          setDbDuplicates(existingSerials.map(s => s.serial_number));
        } else {
          setDbDuplicates([]);
        }
      } catch (err) {
        console.error('Error checking serials:', err);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [locationEntries, selectedItem]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target as Node)) {
        setIsItemDropdownOpen(false);
      }
      
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }

      if (openDropdownId) {
        const ref = locationDropdownRefs.current[openDropdownId];
        if (ref && !ref.contains(event.target as Node)) {
          setOpenDropdownId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [equipRes, locRes] = await Promise.all([
        supabase.from('equipment').select('item_code, description, is_serialized').order('description'),
        supabase.from('locations').select('name').order('name')
      ]);

      if (equipRes.data) setItems(equipRes.data);
      if (locRes.data) setAllLocations(locRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setItemSearch('');
    setItemFilter('All');
    setLocationEntries([
      { 
        id: Math.random().toString(36).substr(2, 9), 
        location: '', 
        conditions: { ...INITIAL_CONDITION },
        serials: { ...INITIAL_SERIALS },
        showSerials: false
      }
    ]);
    setError(null);
  };

  const addLocationEntry = () => {
    setLocationEntries([
      ...locationEntries,
      { 
        id: Math.random().toString(36).substr(2, 9), 
        location: '', 
        conditions: { ...INITIAL_CONDITION },
        serials: { ...INITIAL_SERIALS },
        showSerials: false
      }
    ]);
  };

  const removeLocationEntry = (id: string) => {
    if (locationEntries.length > 1) {
      setLocationEntries(locationEntries.filter(entry => entry.id !== id));
    }
  };

  const updateLocationEntry = (id: string, updates: Partial<LocationEntry>) => {
    setLocationEntries(locationEntries.map(entry => 
      entry.id === id ? { ...entry, ...updates } : entry
    ));
  };

  const updateCondition = (entryId: string, condition: keyof StockCondition, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const count = parseInt(numericValue) || 0;
    
    setLocationEntries(locationEntries.map(entry => {
      if (entry.id === entryId) {
        // Update serials array size to match count
        const currentSerials = entry.serials[condition];
        const newSerials = [...currentSerials];
        
        if (count > currentSerials.length) {
          // Add empty strings
          for (let i = currentSerials.length; i < count; i++) {
            newSerials.push('');
          }
        } else if (count < currentSerials.length) {
          // Truncate
          newSerials.length = count;
        }

        return {
          ...entry,
          conditions: {
            ...entry.conditions,
            [condition]: numericValue
          },
          serials: {
            ...entry.serials,
            [condition]: newSerials
          }
        };
      }
      return entry;
    }));
  };

  const handleSerialChange = (entryId: string, condition: keyof StockCondition, index: number, value: string) => {
    setLocationEntries(locationEntries.map(entry => {
      if (entry.id === entryId) {
        const newSerials = [...entry.serials[condition]];
        newSerials[index] = value;
        return {
          ...entry,
          serials: {
            ...entry.serials,
            [condition]: newSerials
          }
        };
      }
      return entry;
    }));
  };

  const handleSerialPaste = (entryId: string, condition: keyof StockCondition, index: number, e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    // Split by newlines or tabs (common Excel/spreadsheet separators)
    const rows = pastedData.split(/[\r\n\t]+/).map(row => row.trim()).filter(row => row.length > 0);
    
    if (rows.length === 0) return;

    setLocationEntries(locationEntries.map(entry => {
      if (entry.id === entryId) {
        const newSerials = [...entry.serials[condition]];
        const qty = parseInt(entry.conditions[condition]) || 0;
        
        // Fill serials starting from the pasted index
        for (let i = 0; i < rows.length && (index + i) < qty; i++) {
          newSerials[index + i] = rows[i];
        }
        
        return {
          ...entry,
          serials: {
            ...entry.serials,
            [condition]: newSerials
          }
        };
      }
      return entry;
    }));
  };

  const toggleSerials = (entryId: string) => {
    setLocationEntries(locationEntries.map(entry => 
      entry.id === entryId ? { ...entry, showSerials: !entry.showSerials } : entry
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItem) {
      setError('Please select an item.');
      return;
    }

    const isSerialized = selectedItem.is_serialized === true || 
                         selectedItem.is_serialized === 'YES' || 
                         String(selectedItem.is_serialized).toUpperCase() === 'TRUE';

    // Validation
    const selectedLocationsList = locationEntries.map(e => e.location).filter(l => l !== '');
    if (selectedLocationsList.length === 0) {
      setError('At least 1 location is required.');
      return;
    }

    // Check for duplicate locations
    const uniqueLocations = new Set(selectedLocationsList);
    if (uniqueLocations.size !== selectedLocationsList.length) {
      setError('Duplicate locations selected. Please ensure each location is unique.');
      return;
    }

    const processedLocations = locationEntries.filter(entry => entry.location !== '').map(entry => {
      const conditions = {
        brand_new: parseInt(entry.conditions.brand_new) || 0,
        used: parseInt(entry.conditions.used) || 0,
        defective: parseInt(entry.conditions.defective) || 0,
        disposal: parseInt(entry.conditions.disposal) || 0
      };
      
      const totalQty = conditions.brand_new + conditions.used + conditions.defective + conditions.disposal;
      
      return {
        location: entry.location,
        conditions,
        serials: entry.serials,
        totalQty
      };
    });

    for (const entry of processedLocations) {
      if (entry.totalQty <= 0) {
        setError(`Location "${entry.location}" must have at least one quantity > 0.`);
        return;
      }

      if (isSerialized) {
        // Ensure all serials are filled
        for (const condition of (['brand_new', 'used', 'defective', 'disposal'] as const)) {
          const count = entry.conditions[condition];
          const serials = entry.serials[condition];
          if (serials.length !== count || serials.some(s => !s.trim())) {
            setError(`Please fill all serial numbers for ${condition.replace('_', ' ')} at ${entry.location}.`);
            return;
          }
        }
      }
    }

    setSubmitting(true);

    try {
      // Duplicate Serial Check
      if (isSerialized) {
        const allNewSerials: string[] = [];
        processedLocations.forEach(p => {
          (['brand_new', 'used', 'defective', 'disposal'] as const).forEach(condition => {
            p.serials[condition].forEach(sn => {
              if (sn.trim()) allNewSerials.push(sn.trim());
            });
          });
        });

        if (allNewSerials.length > 0) {
          // Check for duplicates within the current entry itself
          const localDuplicates = allNewSerials.filter((item, index) => allNewSerials.indexOf(item) !== index);
          if (localDuplicates.length > 0) {
            setError(`Duplicate serial numbers found in your entry: ${[...new Set(localDuplicates)].join(', ')}`);
            setSubmitting(false);
            return;
          }

          // Check against database
          const { data: existingSerials, error: snCheckError } = await supabase
            .from('item_serials')
            .select('serial_number')
            .in('serial_number', allNewSerials);

          if (snCheckError) throw snCheckError;

          if (existingSerials && existingSerials.length > 0) {
            const conflictList = existingSerials.map(s => s.serial_number).join(', ');
            setError(`The following serial numbers already exist in the system: ${conflictList}. Please remove or correct them before proceeding.`);
            setSubmitting(false);
            return;
          }
        }
      }

      // Build the requested payload structure
      const payload = {
        item_id: selectedItem.item_code,
        is_serialized: isSerialized,
        locations: processedLocations.map(p => ({
          location_id: p.location,
          conditions: p.conditions,
          serials: p.serials
        }))
      };

      console.log('Stock Initialization Payload:', payload);

      const currentUser = localStorage.getItem('aralinks_user') || 'System';

      // Perform updates for each location
      for (const entry of processedLocations) {
        // 1. Check if stock already exists
        const { data: existingStock } = await supabase
          .from('item_location_stocks')
          .select('*')
          .eq('item_code', selectedItem.item_code)
          .eq('location', entry.location)
          .maybeSingle();

        const generatedRef = `INIT-${Math.floor(100000 + Math.random() * 900000)}`;

        // 2. Record Transaction
        const { error: txError } = await supabase
          .from('stock_transactions')
          .insert([{
            item_code: selectedItem.item_code,
            to_location: entry.location,
            quantity: entry.totalQty,
            transaction_type: 'Initial',
            reference_id: generatedRef,
            created_by: currentUser,
            reason: entry.remarks || (existingStock ? 'Manual Setup - Stock Addition' : 'Manual Setup - Initial Inventory')
          }]);

        if (txError) throw txError;

        // 3. Create or Update stock record
        if (existingStock) {
          // UPDATE existing record (Accumulate)
          const { error: stockError } = await supabase
            .from('item_location_stocks')
            .update({
              quantity: (existingStock.quantity || 0) + entry.totalQty,
              brand_new_qty: (existingStock.brand_new_qty || 0) + entry.conditions.brand_new,
              used_qty: (existingStock.used_qty || 0) + entry.conditions.used,
              defective_qty: (existingStock.defective_qty || 0) + entry.conditions.defective,
              disposal_qty: (existingStock.disposal_qty || 0) + entry.conditions.disposal
            })
            .eq('id', existingStock.id);
          
          if (stockError) throw stockError;
        } else {
          // INSERT new record
          const { error: stockError } = await supabase
            .from('item_location_stocks')
            .insert([{
              item_code: selectedItem.item_code,
              item_name: selectedItem.description,
              location: entry.location,
              quantity: entry.totalQty,
              brand_new_qty: entry.conditions.brand_new,
              used_qty: entry.conditions.used,
              defective_qty: entry.conditions.defective,
              disposal_qty: entry.conditions.disposal
            }]);

          if (stockError) {
            console.warn('Could not insert condition columns, falling back to standard insertion.', stockError);
            const { error: fallbackError } = await supabase
              .from('item_location_stocks')
              .insert([{
                item_code: selectedItem.item_code,
                item_name: selectedItem.description,
                location: entry.location,
                quantity: entry.totalQty
              }]);
            if (fallbackError) throw fallbackError;
          }
        }

        // 4. Insert Serials if serialized
        if (isSerialized) {
          const serialsToInsert: any[] = [];
          
          (['brand_new', 'used', 'defective', 'disposal'] as const).forEach(condition => {
            entry.serials[condition].forEach(sn => {
              if (sn.trim()) {
                serialsToInsert.push({
                  item_code: selectedItem.item_code,
                  location: entry.location,
                  serial_number: sn.trim(),
                  condition: condition,
                  status: 'Available',
                  request_id: generatedRef
                });
              }
            });
          });

          if (serialsToInsert.length > 0) {
            const { error: serialsError } = await supabase
              .from('item_serials')
              .insert(serialsToInsert);
            
            if (serialsError) {
              console.warn('Could not insert serials to item_serials. Ensure the table exists.', serialsError);
            }
          }
        }
      }

      showSuccess('Success', 'Inventory initialized successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error initializing stock:', err);
      setError(err.message || 'Failed to initialize stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(i => {
    const matchesSearch = i.description.toLowerCase().includes(itemSearch.toLowerCase()) ||
                         i.item_code.toLowerCase().includes(itemSearch.toLowerCase());
    
    if (itemFilter === 'All') return matchesSearch;
    
    const isSerialized = i.is_serialized === true || 
                        i.is_serialized === 'YES' || 
                        String(i.is_serialized).toUpperCase() === 'TRUE';
                        
    if (itemFilter === 'Serialized') return matchesSearch && isSerialized;
    if (itemFilter === 'Non-Serialized') return matchesSearch && !isSerialized;
    
    return matchesSearch;
  });

  if (!isOpen) return null;

  const isSerializedItem = selectedItem && (
    selectedItem.is_serialized === true || 
    selectedItem.is_serialized === 'YES' || 
    String(selectedItem.is_serialized).toUpperCase() === 'TRUE'
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2rem] shadow-2xl border-2 animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`} style={{ borderColor: 'var(--brand-accent)' }}>
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)' }}>
              <Plus size={24} style={{ color: 'var(--brand-accent)' }} />
            </div>
            <div>
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Stock Entry & Initialization</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manual Inventory Setup</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar space-y-8">
          <form id="stock-entry-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Item Selection */}
            <div className="space-y-2 relative" ref={itemDropdownRef}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Item</label>
              <div 
                className={`w-full px-5 py-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                } ${isItemDropdownOpen ? 'ring-2 ring-brand-orange border-transparent' : ''}`}
                onClick={() => setIsItemDropdownOpen(!isItemDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Box size={18} className="text-brand-orange shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold truncate">{selectedItem ? selectedItem.description : 'Choose an item...'}</span>
                    {selectedItem && (
                      <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isSerializedItem ? 'text-amber-500' : 'text-slate-500'}`}>
                        {isSerializedItem ? 'Serialized Item' : 'Non-Serialized Item'}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isItemDropdownOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-3xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text"
                          placeholder="Search items..."
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-xs font-bold outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="relative" ref={filterRef}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsFilterOpen(!isFilterOpen);
                          }}
                          className={`p-2 rounded-xl transition-all ${
                            isFilterOpen || itemFilter !== 'All' 
                              ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20' 
                              : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Filter size={14} />
                        </button>

                        {isFilterOpen && (
                          <div className={`absolute top-full right-0 mt-2 w-40 rounded-xl shadow-2xl border overflow-hidden z-[220] animate-in slide-in-from-top-2 ${
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                          }`}>
                            {(['All', 'Serialized', 'Non-Serialized'] as const).map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemFilter(f);
                                  setIsFilterOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                  itemFilter === f 
                                    ? 'bg-brand-orange/10 text-brand-orange' 
                                    : isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item, idx) => {
                        const isSerialized = item.is_serialized === true || 
                                          item.is_serialized === 'YES' || 
                                          String(item.is_serialized).toUpperCase() === 'TRUE';
                        return (
                          <button
                            key={`${item.item_code}-${idx}`}
                            type="button"
                            onClick={() => { setSelectedItem(item); setIsItemDropdownOpen(false); }}
                            className={`w-full text-left px-5 py-3 text-xs font-bold transition-all hover:bg-brand-orange/5 hover:text-brand-orange flex flex-col gap-0.5 ${
                              selectedItem?.item_code === item.item_code ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{item.description}</span>
                              {isSerialized && <span className="text-[8px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full ring-1 ring-amber-500/20 uppercase font-black">Serialized</span>}
                            </div>
                            <span className="text-[9px] opacity-50 uppercase tracking-widest">{item.item_code}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-5 py-8 text-center opacity-40">
                        <Box size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No items found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Multi-Location Blocks */}
            <div className="space-y-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Storage Locations & Conditions</label>
              
              {locationEntries.map((entry, index) => (
                <div 
                  key={entry.id}
                  className={`relative p-6 rounded-3xl border-2 transition-all group ${
                    isDarkMode ? 'bg-slate-800/20 border-slate-800 hover:border-brand-orange/30' : 'bg-slate-50 border-slate-100 hover:border-brand-orange/20'
                  }`}
                >
                  {locationEntries.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeLocationEntry(entry.id)}
                      className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 active:scale-90"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  <div className="space-y-4">
                    {/* Location Dropdown */}
                    <div className="relative" ref={el => locationDropdownRefs.current[entry.id] = el}>
                      <div 
                        className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                        } ${openDropdownId === entry.id ? 'ring-2 ring-brand-orange border-transparent' : ''}`}
                        onClick={() => setOpenDropdownId(openDropdownId === entry.id ? null : entry.id)}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <MapPin size={16} className="text-brand-orange shrink-0" />
                          <span className="text-xs font-bold truncate">{entry.location || 'Select location...'}</span>
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${openDropdownId === entry.id ? 'rotate-180' : ''}`} />
                      </div>

                      {openDropdownId === entry.id && (
                        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden z-[210] animate-in fade-in slide-in-from-top-2 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200'
                        }`}>
                          <div className="max-h-40 overflow-y-auto custom-scrollbar">
                            {allLocations.map((loc, idx) => {
                              const isTaken = locationEntries.some(e => e.location === loc.name && e.id !== entry.id);
                              return (
                                <button
                                  key={`${loc.name}-${idx}`}
                                  type="button"
                                  disabled={isTaken}
                                  onClick={() => { updateLocationEntry(entry.id, { location: loc.name }); setOpenDropdownId(null); }}
                                  className={`w-full text-left px-4 py-2.5 text-[11px] font-bold transition-all ${
                                    isTaken ? 'opacity-30 cursor-not-allowed italic' : 'hover:bg-brand-orange/5 hover:text-brand-orange'
                                  } ${
                                    entry.location === loc.name ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                                  }`}
                                >
                                  {loc.name} {isTaken && '(Selected)'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Conditions Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {(['brand_new', 'used', 'defective', 'disposal'] as const).map((cond) => (
                        <div key={cond} className="space-y-1.5">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                            {cond.replace('_', ' ')}
                          </label>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            placeholder="0"
                            value={entry.conditions[cond]}
                            onChange={(e) => updateCondition(entry.id, cond, e.target.value)}
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none font-bold text-sm transition-all ${
                              isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-brand-orange' : 'bg-white border-slate-200 text-slate-700 focus:border-brand-orange'
                            }`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Serialize Toggle/Section */}
                    {isSerializedItem && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          type="button"
                          onClick={() => toggleSerials(entry.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                            isDarkMode ? 'bg-slate-900/50 hover:bg-slate-900' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Box size={14} className="text-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Serial Numbers Entry</span>
                          </div>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${entry.showSerials ? 'rotate-180' : ''}`} />
                        </button>

                        {entry.showSerials && (
                          <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <p className="text-[9px] font-bold text-amber-500/80 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-center">
                              Tip: You can paste multiple serial numbers from Excel or spreadsheets directly into any field.
                            </p>
                            {(['brand_new', 'used', 'defective', 'disposal'] as const).map(cond => {
                              const qty = parseInt(entry.conditions[cond]) || 0;
                              if (qty === 0) return null;

                              return (
                                <div key={`serials-${cond}-${entry.id}`} className="space-y-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-l-2 border-amber-500 pl-2">
                                    {cond.replace('_', ' ')} Serials ({qty})
                                  </span>
                                  <div className="grid grid-cols-1 gap-2">
                                    {Array.from({ length: qty }).map((_, i) => (
                                      <input 
                                        key={`sn-${cond}-${entry.id}-${i}`}
                                        type="text"
                                        placeholder={`Enter Serial # ${i + 1}`}
                                        value={entry.serials[cond][i] || ''}
                                        onChange={(e) => handleSerialChange(entry.id, cond, i, e.target.value)}
                                        onPaste={(e) => handleSerialPaste(entry.id, cond, i, e)}
                                        className={`w-full px-4 py-2 rounded-lg border text-xs font-mono font-bold outline-none transition-all ${
                                          isDarkMode 
                                            ? `bg-slate-900 ${duplicateSerials.includes(entry.serials[cond][i]?.trim()) || dbDuplicates.includes(entry.serials[cond][i]?.trim()) ? 'border-red-500 text-red-500 focus:ring-1 focus:ring-red-500' : 'border-slate-700 text-white focus:border-amber-500'}` 
                                            : `bg-white ${duplicateSerials.includes(entry.serials[cond][i]?.trim()) || dbDuplicates.includes(entry.serials[cond][i]?.trim()) ? 'border-red-500 text-red-500 focus:ring-1 focus:ring-red-500' : 'border-slate-200 text-slate-700 focus:border-amber-500'}`
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {(!entry.conditions.brand_new && !entry.conditions.used && !entry.conditions.defective && !entry.conditions.disposal) && (
                              <p className="text-[10px] italic text-slate-400 text-center py-4 uppercase font-bold tracking-widest">
                                Enter quantities above to scan serials
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button 
                type="button"
                onClick={addLocationEntry}
                className={`w-full py-4 border-2 border-dashed rounded-3xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
                  isDarkMode 
                    ? 'border-slate-800 text-slate-500 hover:border-brand-orange/30 hover:text-brand-orange' 
                    : 'border-slate-200 text-slate-400 hover:border-brand-orange/30 hover:text-brand-orange'
                }`}
              >
                <Plus size={16} />
                Add Location
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className={`p-8 pt-4 space-y-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
          {(error || duplicateSerials.length > 0 || dbDuplicates.length > 0) && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                {error && <p className="text-xs font-bold tracking-tight">{error}</p>}
                {duplicateSerials.length > 0 && (
                  <p className="text-[11px] font-bold">
                    Duplicate serial numbers found in your entry: <span className="font-black underline">{duplicateSerials.join(', ')}</span>
                  </p>
                )}
                {dbDuplicates.length > 0 && (
                  <p className="text-[11px] font-bold leading-relaxed">
                    The following serial numbers already exist in the system: <span className="font-black underline">{dbDuplicates.join(', ')}</span>. Please remove or correct them before proceeding.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
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
              form="stock-entry-form"
              type="submit"
              disabled={submitting || duplicateSerials.length > 0 || dbDuplicates.length > 0}
              className="flex-[2] py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--brand-accent)',
                boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)'
              }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Initialize {isSerializedItem ? 'Serialized ' : ''}Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStockModal;
