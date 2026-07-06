
import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, MapPin, Loader2, CheckCircle2, AlertCircle, ChevronDown, Box, Plus, Trash2, User, Notebook, ArrowLeft, Sparkles, Hash, History, Search, QrCode, Paperclip, Upload } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface VerifiedTransferPageProps {
  onNavigate: (viewId: string, params?: any) => void;
  initialFromLocation?: string | null;
  initialToLocation?: string | null;
  isDarkMode?: boolean;
  userRole?: string | null;
}

interface StockCondition {
  brand_new: string;
  used: string;
  defective: string;
  disposal: string;
}

interface TransferItemLine {
  id: string;
  item_code: string;
  item_name: string;
  from_location: string;
  available_stock: number;
  availableStocks: StockCondition; // Condition specific stocks
  isItemDropdownOpen: boolean;
  isFromDropdownOpen: boolean;
  itemSearch: string;
  fromLocations: { location: string; quantity: number }[];
  is_serialized: boolean;
  conditions: StockCondition;
  serials: {
    brand_new: string[];
    used: string[];
    defective: string[];
    disposal: string[];
  };
  availableSerials: {
    brand_new: string[];
    used: string[];
    defective: string[];
    disposal: string[];
  };
  showSerials: boolean;
  isSerialsExpanded: boolean;
}

const INITIAL_CONDITION: StockCondition = {
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

interface LocationItem {
  name: string;
}

interface CatalogItem {
  item_code: string;
  description: string;
  is_serialized: boolean;
}

const VerifiedTransferPage: React.FC<VerifiedTransferPageProps> = ({ 
  onNavigate,
  initialFromLocation = null,
  initialToLocation = null,
  isDarkMode = false,
  userRole = 'Staff'
}) => {
  const { showSuccess, showError: showNotifyError } = useNotification();
  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  
  // Bundle States
  const [availableBundles, setAvailableBundles] = useState<string[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<string>('');
  const [bundleMultiplier, setBundleMultiplier] = useState<string>('1');
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [isBundleDropdownOpen, setIsBundleDropdownOpen] = useState(false);
  const bundleDropdownRef = useRef<HTMLDivElement>(null);
  const [appliedBundleName, setAppliedBundleName] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Header Details
  const [fromLocation, setFromLocation] = useState<string>('');
  const [toLocation, setToLocation] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [transferBy, setTransferBy] = useState<string>('');
  
  // DROPDOWN STATES
  const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);

  // ITEMS STATE
  const [items, setItems] = useState<TransferItemLine[]>([]);
  const [errorItemIds, setErrorItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLocations();
    fetchBundles();
    resetForm();
  }, [initialToLocation, initialFromLocation]);

  useEffect(() => {
    if (fromLocation) {
      fetchAvailableItems(fromLocation);
    }
  }, [fromLocation]);

  useEffect(() => {
    const hasValues = items.some(i => i.item_code.trim() !== '');
    if (!hasValues && appliedBundleName) {
      setAppliedBundleName(null);
    }
  }, [items, appliedBundleName]);

  const fetchBundles = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoadingBundles(true);
    try {
      const { data, error } = await supabase
        .from('bundle_items')
        .select('bundle')
        .is('archived_at', null)
        .order('bundle');
      
      if (data) {
        const uniqueBundles = Array.from(new Set(data.map(item => item.bundle)));
        setAvailableBundles(uniqueBundles.sort());
      }
    } catch (err) {
      console.error('Error fetching bundles:', err);
    } finally {
      setIsLoadingBundles(false);
    }
  };

  const handleBack = () => {
    onNavigate('inventory', { inventoryTab: 'transfer' });
  };

  const resetForm = () => {
    setFromLocation(initialFromLocation || 'IT Basement');
    setToLocation(initialToLocation || '');
    setRemarks('');
    
    // Get first name from full name if available, otherwise use username
    const fullName = localStorage.getItem('aralinks_fullname');
    const username = localStorage.getItem('aralinks_user');
    let displayUser = 'System';
    
    if (fullName) {
      displayUser = fullName.split(' ')[0];
    } else if (username) {
      displayUser = username;
    }

    setTransferBy(displayUser);
    setItems([]);
    setError(null);
    setSuccess(false);
    
    // Add one initial empty item row
    const firstRow: TransferItemLine = {
      id: Math.random().toString(36).substr(2, 9),
      item_code: '',
      item_name: '',
      from_location: '',
      available_stock: 0,
      availableStocks: { ...INITIAL_CONDITION },
      isItemDropdownOpen: false,
      isFromDropdownOpen: false,
      itemSearch: '',
      fromLocations: [],
      is_serialized: false,
      conditions: { ...INITIAL_CONDITION },
      serials: { ...INITIAL_SERIALS },
      availableSerials: { ...INITIAL_SERIALS },
      showSerials: false,
      isSerialsExpanded: true
    };
    setItems([firstRow]);
  };

  const fetchAvailableItems = async (locationName: string) => {
    if (!isSupabaseConfigured || !locationName) {
      setCatalogItems([]);
      return;
    }
    try {
      // Fetch only items that have stock in the selected location
      const { data: stockData, error: stockErr } = await supabase
        .from('item_location_stocks')
        .select('*')
        .eq('location', locationName)
        .gt('quantity', 0);
      
      if (stockErr) throw stockErr;
      
      if (stockData && stockData.length > 0) {
        const itemCodes = Array.from(new Set(stockData.map(d => d.item_code)));
        
        const { data: equipData } = await supabase
          .from('equipment')
          .select('item_code, is_serialized')
          .in('item_code', itemCodes);
        
        const filteredItems = stockData.map(stock => {
          const equip = equipData?.find(e => e.item_code === stock.item_code);
          const isSerialized = !!(
            equip?.is_serialized === true || 
            equip?.is_serialized === 1 || 
            String(equip?.is_serialized).toUpperCase() === 'YES' ||
            String(equip?.is_serialized).toUpperCase() === 'TRUE'
          );
          
          return {
            item_code: stock.item_code,
            description: stock.item_name,
            is_serialized: isSerialized,
            quantity: stock.quantity, // Total available in this location
            brand_new_qty: stock.brand_new_qty || 0,
            used_qty: stock.used_qty || 0,
            defective_qty: stock.defective_qty || 0,
            disposal_qty: stock.disposal_qty || 0
          };
        });

        setCatalogItems(filteredItems as any);

        // Also update existing item lines with new stocks for this location
        const updatedItems = await Promise.all(items.map(async (line) => {
          if (!line.item_code) return line;
          const match = stockData.find(s => s.item_code === line.item_code);
          const catalogInfo = filteredItems.find(fi => fi.item_code === line.item_code);
          const isSerialized = catalogInfo?.is_serialized || false;
          
          let availableSerials: { [key: string]: string[] } = {
            brand_new: [],
            used: [],
            defective: [],
            disposal: []
          };
          
          if (isSerialized) {
            const allSerials = await fetchItemSerials(line.item_code, locationName);
            availableSerials.brand_new = allSerials.filter(s => s.condition === 'brand_new').map(s => s.serial_number);
            availableSerials.used = allSerials.filter(s => s.condition === 'used').map(s => s.serial_number);
            availableSerials.defective = allSerials.filter(s => s.condition === 'defective').map(s => s.serial_number);
            availableSerials.disposal = allSerials.filter(s => s.condition === 'disposal').map(s => s.serial_number);
          }

          return {
            ...line,
            available_stock: match?.quantity || 0,
            availableStocks: {
              brand_new: (match?.brand_new_qty || 0).toString(),
              used: (match?.used_qty || 0).toString(),
              defective: (match?.defective_qty || 0).toString(),
              disposal: (match?.disposal_qty || 0).toString(),
            },
            from_location: locationName,
            is_serialized: isSerialized,
            // We should keep or reset conditions? Usually switching location resets quantities since availability changes
            conditions: { ...INITIAL_CONDITION },
            serials: { ...INITIAL_SERIALS },
            availableSerials: availableSerials
          };
        }));
        setItems(updatedItems);
      } else {
        setCatalogItems([]);
        setItems(prev => prev.map(line => ({ 
          ...line, 
          available_stock: 0, 
          availableStocks: { ...INITIAL_CONDITION },
          from_location: locationName, 
          conditions: { ...INITIAL_CONDITION },
          serials: { ...INITIAL_SERIALS } 
        })));
      }
    } catch (err) {
      console.error('Error fetching catalog items:', err);
    }
  };

  const fetchItemSerials = async (itemCode: string, location: string) => {
    if (!isSupabaseConfigured) return [];
    try {
      const { data } = await supabase
        .from('item_serials')
        .select('serial_number, condition')
        .eq('item_code', itemCode)
        .eq('location', location)
        .eq('status', 'Available');
      
      return data || [];
    } catch (err) {
      console.error('Error fetching item serials:', err);
      return [];
    }
  };

  const fetchLocations = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: locationsData } = await supabase
        .from('locations')
        .select('name')
        .order('name');

      if (locationsData) {
        // Unique by name (ignoring casing and extra spaces/dashes for UI cleanliness)
        const unique = locationsData.reduce((acc, curr) => {
          const norm = curr.name.toLowerCase().trim().replace(/[\s-]/g, '');
          if (!acc.some(l => l.name.toLowerCase().trim().replace(/[\s-]/g, '') === norm)) {
            acc.push(curr);
          }
          return acc;
        }, [] as LocationItem[]);
        setAllLocations(unique);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchItemStocks = async (itemCode: string) => {
    if (!isSupabaseConfigured) return [];
    try {
      const { data } = await supabase
        .from('item_location_stocks')
        .select('*')
        .eq('item_code', itemCode)
        .gt('quantity', 0)
        .order('quantity', { ascending: false });

      return data || [];
    } catch (err) {
      console.error('Error fetching item stocks:', err);
      return [];
    }
  };

  const addItemRow = () => {
    const newItem: TransferItemLine = {
      id: Math.random().toString(36).substr(2, 9),
      item_code: '',
      item_name: '',
      from_location: '',
      available_stock: 0,
      availableStocks: { ...INITIAL_CONDITION },
      isItemDropdownOpen: false,
      isFromDropdownOpen: false,
      itemSearch: '',
      fromLocations: [],
      is_serialized: false,
      conditions: { ...INITIAL_CONDITION },
      serials: { ...INITIAL_SERIALS },
      availableSerials: { ...INITIAL_SERIALS },
      showSerials: false,
      isSerialsExpanded: true
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItemRow = (id: string) => {
    // Clear error for this item if it exists
    if (errorItemIds.has(id)) {
      const newErrors = new Set(errorItemIds);
      newErrors.delete(id);
      setErrorItemIds(newErrors);
      // Clear general error if no more items have errors
      if (newErrors.size === 0) setError(null);
    }

    if (items.length === 1) {
      setItems([{
        id: Math.random().toString(36).substr(2, 9),
        item_code: '',
        item_name: '',
        from_location: '',
        available_stock: 0,
        availableStocks: { ...INITIAL_CONDITION },
        isItemDropdownOpen: false,
        isFromDropdownOpen: false,
        itemSearch: '',
        fromLocations: [],
        is_serialized: false,
        conditions: { ...INITIAL_CONDITION },
        serials: { ...INITIAL_SERIALS },
        availableSerials: { ...INITIAL_SERIALS },
        showSerials: false,
        isSerialsExpanded: true
      }]);
      // Reset everything if clearing the last item
      setError(null);
      setErrorItemIds(new Set());
      setAppliedBundleName('');
    } else {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleApplyBundle = async () => {
    if (!selectedBundle || !fromLocation) return;
    
    const multiplier = parseInt(bundleMultiplier) || 1;
    
    try {
      const { data: bundleItems, error } = await supabase
        .from('bundle_items')
        .select('*')
        .eq('bundle', selectedBundle);
      
      if (error) throw error;
      if (bundleItems && bundleItems.length > 0) {
        const newLines: TransferItemLine[] = await Promise.all(bundleItems.map(async (bi: any) => {
          const itemInCatalog = catalogItems.find(ci => ci.item_code === bi.item_code);
          const isSerialized = itemInCatalog?.is_serialized || bi.is_serialized || false;
          const rawStocks = await fetchItemStocks(bi.item_code);
          
          // CONSOLIDATE DUPLICATE/SIMILAR LOCATIONS
          const consolidated = rawStocks.reduce((acc, curr) => {
            const normName = curr.location.toLowerCase().trim().replace(/[\s-]/g, '');
            const existing = acc.find(l => l.location.toLowerCase().trim().replace(/[\s-]/g, '') === normName);
            
            if (existing) {
              existing.quantity += curr.quantity;
              existing.brand_new_qty += curr.brand_new_qty || 0;
              existing.used_qty += curr.used_qty || 0;
              existing.defective_qty += curr.defective_qty || 0;
              existing.disposal_qty += curr.disposal_qty || 0;
            } else {
              acc.push({ ...curr });
            }
            return acc;
          }, [] as any[]);

          const stockAtSource = consolidated.find(l => l.location === fromLocation);
          
          const availableSerials: { brand_new: string[]; used: string[]; defective: string[]; disposal: string[]; } = {
            brand_new: [],
            used: [],
            defective: [],
            disposal: []
          };
          if (isSerialized && fromLocation) {
            const allSerials = await fetchItemSerials(bi.item_code, fromLocation);
            availableSerials.brand_new = allSerials.filter(s => s.condition === 'brand_new').map(s => s.serial_number);
            availableSerials.used = allSerials.filter(s => s.condition === 'used').map(s => s.serial_number);
            availableSerials.defective = allSerials.filter(s => s.condition === 'defective').map(s => s.serial_number);
            availableSerials.disposal = allSerials.filter(s => s.condition === 'disposal').map(s => s.serial_number);
          }

          // Bundles usually assume brand new? Or generic? 
          // Let's assume the bundle quantity goes into 'brand_new' for now
          const neededQty = (bi.quantity || 1) * multiplier;
          const conditions = { ...INITIAL_CONDITION, brand_new: neededQty.toString() };
          
          const serials = { ...INITIAL_SERIALS };
          if (isSerialized) {
             serials.brand_new = Array(neededQty).fill('');
          }

          return {
            id: Math.random().toString(36).substr(2, 9),
            item_code: bi.item_code,
            item_name: itemInCatalog?.description || bi.item_name || bi.item_code,
            from_location: fromLocation,
            available_stock: stockAtSource?.quantity || 0,
            availableStocks: {
              brand_new: (stockAtSource?.brand_new_qty || 0).toString(),
              used: (stockAtSource?.used_qty || 0).toString(),
              defective: (stockAtSource?.defective_qty || 0).toString(),
              disposal: (stockAtSource?.disposal_qty || 0).toString(),
            },
            isItemDropdownOpen: false,
            isFromDropdownOpen: false,
            itemSearch: '',
            fromLocations: consolidated,
            is_serialized: isSerialized,
            conditions: conditions,
            serials: serials,
            availableSerials: availableSerials,
            showSerials: false,
            isSerialsExpanded: true
          };
        }));

        // Remove the first empty row if it is still empty
        setItems(prev => {
          const filtered = prev.filter(line => line.item_code !== '');
          return [...filtered, ...newLines];
        });
        
        setAppliedBundleName(selectedBundle);
        setSelectedBundle('');
        setBundleMultiplier('1');
        showSuccess(`Bundle "${selectedBundle}" applied successfully!`);
      }
    } catch (err) {
      console.error('Error applying bundle:', err);
    }
  };

  const updateItemLine = async (id: string, updates: Partial<TransferItemLine>) => {
    // Clear error for this item if any field is updated
    if (errorItemIds.has(id)) {
      const newErrors = new Set(errorItemIds);
      newErrors.delete(id);
      setErrorItemIds(newErrors);
      // Clear general error if no more items have errors
      if (newErrors.size === 0) setError(null);
    }

    const currentLine = items.find(line => line.id === id);
    if (!currentLine) return;

    const updatedItems = await Promise.all(items.map(async (item) => {
      if (item.id === id) {
        const newItem = { ...item, ...updates };
        
        if (updates.item_code && updates.item_code !== item.item_code) {
          const catalogItem = catalogItems.find(ci => ci.item_code === updates.item_code);
          const isSerialized = catalogItem?.is_serialized || false;
          const availableStock = (catalogItem as any)?.quantity || 0;
          
          newItem.from_location = fromLocation;
          newItem.available_stock = availableStock;
          newItem.availableStocks = {
            brand_new: ((catalogItem as any)?.brand_new_qty || 0).toString(),
            used: ((catalogItem as any)?.used_qty || 0).toString(),
            defective: ((catalogItem as any)?.defective_qty || 0).toString(),
            disposal: ((catalogItem as any)?.disposal_qty || 0).toString(),
          };
          newItem.is_serialized = isSerialized;
          
          if (isSerialized) {
            const allSerials = await fetchItemSerials(newItem.item_code, fromLocation);
            newItem.availableSerials = {
              brand_new: allSerials.filter(s => s.condition === 'brand_new').map(s => s.serial_number),
              used: allSerials.filter(s => s.condition === 'used').map(s => s.serial_number),
              defective: allSerials.filter(s => s.condition === 'defective').map(s => s.serial_number),
              disposal: allSerials.filter(s => s.condition === 'disposal').map(s => s.serial_number),
            };
          } else {
            newItem.availableSerials = { ...INITIAL_SERIALS };
          }
          
          newItem.conditions = { ...INITIAL_CONDITION };
          newItem.serials = { ...INITIAL_SERIALS };
          newItem.showSerials = false;
          newItem.isSerialsExpanded = true;
          newItem.isItemDropdownOpen = false;
        }

        if (updates.from_location && updates.from_location !== item.from_location) {
          const stock = newItem.fromLocations.find(l => l.location === updates.from_location);
          newItem.available_stock = stock?.quantity || 0;
          newItem.availableStocks = {
            brand_new: (stock?.brand_new_qty || 0).toString(),
            used: (stock?.used_qty || 0).toString(),
            defective: (stock?.defective_qty || 0).toString(),
            disposal: (stock?.disposal_qty || 0).toString(),
          };
          
          if (newItem.is_serialized) {
            const allSerials = await fetchItemSerials(newItem.item_code, updates.from_location);
            newItem.availableSerials = {
              brand_new: allSerials.filter(s => s.condition === 'brand_new').map(s => s.serial_number),
              used: allSerials.filter(s => s.condition === 'used').map(s => s.serial_number),
              defective: allSerials.filter(s => s.condition === 'defective').map(s => s.serial_number),
              disposal: allSerials.filter(s => s.condition === 'disposal').map(s => s.serial_number),
            };
          }

          newItem.conditions = { ...INITIAL_CONDITION };
          newItem.serials = { ...INITIAL_SERIALS };
          newItem.showSerials = false;
        }

        return newItem;
      }
      return item;
    }));
    setItems(updatedItems);
  };

  const updateCondition = (lineId: string, condition: keyof StockCondition, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const count = parseInt(numericValue) || 0;
    
    setItems(prev => prev.map(item => {
      if (item.id === lineId) {
        let newSerials = { ...item.serials };
        if (item.is_serialized) {
          const currentSerials = item.serials[condition];
          const updatedSerials = [...currentSerials];
          
          if (count > currentSerials.length) {
            for (let i = currentSerials.length; i < count; i++) {
              updatedSerials.push('');
            }
          } else {
            updatedSerials.length = count;
          }
          newSerials[condition] = updatedSerials;
        }

        return {
          ...item,
          conditions: {
            ...item.conditions,
            [condition]: numericValue
          },
          serials: newSerials,
          showSerials: count > 0 || Object.entries(item.conditions).some(([k, v]) => k !== condition && parseInt(v as string) > 0)
        };
      }
      return item;
    }));
  };

  const handleSerialPaste = (lineId: string, condition: keyof StockCondition, index: number, event: React.ClipboardEvent) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text');
    const pastedSerials = pastedText.split(/\r?\n/).map(s => s.trim()).filter(s => s !== '');
    
    if (pastedSerials.length <= 1) {
      const newSerials = pastedSerials[0] || pastedText.trim();
      setItems(prev => prev.map(item => {
        if (item.id === lineId) {
          const updatedSerials = [...item.serials[condition]];
          updatedSerials[index] = newSerials;
          return { ...item, serials: { ...item.serials, [condition]: updatedSerials } };
        }
        return item;
      }));
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const updatedSerials = [...item.serials[condition]];
        let pasteIdx = 0;
        for (let i = index; i < updatedSerials.length && pasteIdx < pastedSerials.length; i++) {
          updatedSerials[i] = pastedSerials[pasteIdx++];
        }
        return { ...item, serials: { ...item.serials, [condition]: updatedSerials } };
      }
      return item;
    }));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target as Node)) {
        setIsFromDropdownOpen(false);
      }
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target as Node)) {
        setIsToDropdownOpen(false);
      }
      if (bundleDropdownRef.current && !bundleDropdownRef.current.contains(event.target as Node)) {
        setIsBundleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorItemIds(new Set());

    if (!toLocation) {
      setError('Please select a destination location.');
      return;
    }

    const validItems = items.filter(i => {
      const totalQty = (Object.values(i.conditions) as string[]).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
      return i.item_code && i.from_location && totalQty > 0;
    });

    if (validItems.length === 0) {
      setError('Please add at least one complete item line with quantity.');
      return;
    }

    const newErrorIds = new Set<string>();
    let hasStockError = false;

    for (const item of validItems) {
      const conditionKeys: (keyof StockCondition)[] = ['brand_new', 'used', 'defective', 'disposal'];
      for (const cond of conditionKeys) {
        const qty = parseInt(item.conditions[cond]) || 0;
        const available = parseInt(item.availableStocks[cond]) || 0;
        if (qty > available) {
          hasStockError = true;
          newErrorIds.add(item.id);
        }
      }

      if (item.from_location === toLocation) {
        setError(`Source and destination must be different for all items.`);
        newErrorIds.add(item.id);
      }

      if (item.is_serialized) {
        for (const cond of conditionKeys) {
          const qty = parseInt(item.conditions[cond]) || 0;
          const serialLines = item.serials[cond].filter(s => s && s.trim());
          if (serialLines.length !== qty) {
            setError(`Please provide all serial numbers for the ${cond.replace('_', ' ')} condition of ${item.item_name}.`);
            newErrorIds.add(item.id);
          }
        }
      }
    }

    if (newErrorIds.size > 0) {
      setErrorItemIds(newErrorIds);
      if (!error) {
        let msg = 'Transfer failed: please review the highlighted rows.';
        if (hasStockError) {
          msg = 'Transfer failed: Insufficient stock detected for one or more conditions. Please review the highlighted rows.';
        }
        setError(msg);
      }
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const reqNo = `V-TRF-${Math.floor(100000 + Math.random() * 900000)}`;

      for (const item of validItems) {
        const conditionKeys: (keyof StockCondition)[] = ['brand_new', 'used', 'defective', 'disposal'];
        const totalQty = (Object.values(item.conditions) as string[]).reduce((sum, v) => sum + (parseInt(v) || 0), 0);

        // 1. Log Transfer Request
        await supabase
          .from('transfer_requests')
          .insert([{
            req_no: reqNo,
            item_code: item.item_code,
            item_name: item.item_name,
            from_location: item.from_location,
            to_location: toLocation,
            program: 'General',
            quantity: totalQty,
            status: 'Completed',
            remarks: remarks,
            created_by: transferBy
          }]);

        // 2. Update Source and Destination Stocks
        const { data: itemStocks } = await supabase
          .from('item_location_stocks')
          .select('*')
          .eq('item_code', item.item_code);

        if (itemStocks) {
          // Deduct from Source
          const sourceRecord = itemStocks.find(s => s.location === item.from_location);
          if (sourceRecord) {
            await supabase
              .from('item_location_stocks')
              .update({
                quantity: sourceRecord.quantity - totalQty,
                brand_new_qty: (sourceRecord.brand_new_qty || 0) - (parseInt(item.conditions.brand_new) || 0),
                used_qty: (sourceRecord.used_qty || 0) - (parseInt(item.conditions.used) || 0),
                defective_qty: (sourceRecord.defective_qty || 0) - (parseInt(item.conditions.defective) || 0),
                disposal_qty: (sourceRecord.disposal_qty || 0) - (parseInt(item.conditions.disposal) || 0),
              })
              .eq('id', sourceRecord.id);
          }

          // Add to Destination
          const destRecord = itemStocks.find(s => s.location === toLocation);
          if (destRecord) {
            await supabase
              .from('item_location_stocks')
              .update({
                quantity: destRecord.quantity + totalQty,
                brand_new_qty: (destRecord.brand_new_qty || 0) + (parseInt(item.conditions.brand_new) || 0),
                used_qty: (destRecord.used_qty || 0) + (parseInt(item.conditions.used) || 0),
                defective_qty: (destRecord.defective_qty || 0) + (parseInt(item.conditions.defective) || 0),
                disposal_qty: (destRecord.disposal_qty || 0) + (parseInt(item.conditions.disposal) || 0),
              })
              .eq('id', destRecord.id);
          } else {
            await supabase
              .from('item_location_stocks')
              .insert([{
                item_code: item.item_code,
                item_name: item.item_name,
                location: toLocation,
                quantity: totalQty,
                brand_new_qty: parseInt(item.conditions.brand_new) || 0,
                used_qty: parseInt(item.conditions.used) || 0,
                defective_qty: parseInt(item.conditions.defective) || 0,
                disposal_qty: parseInt(item.conditions.disposal) || 0
              }]);
          }
        }

        // 3. Update Serial Numbers
        if (item.is_serialized) {
          for (const cond of conditionKeys) {
            const serialsInCond = item.serials[cond].filter(s => s && s.trim());
            if (serialsInCond.length > 0) {
              await supabase
                .from('item_serials')
                .update({ 
                   location: toLocation,
                   request_id: reqNo, // Track which request/transaction this serial belongs to
                   updated_at: new Date().toISOString()
                })
                .eq('item_code', item.item_code)
                .in('serial_number', serialsInCond);
            }
          }
        }

        // 4. Record Transaction
        await supabase.from('stock_transactions').insert([{
          item_code: item.item_code,
          from_location: item.from_location,
          to_location: toLocation,
          quantity: totalQty as number,
          transaction_type: 'Transfer',
          reference_id: reqNo,
          created_by: transferBy,
          reason: remarks || 'Stock Transfer'
        }]);
      }

      setSuccess(true);
      showSuccess('Batch transfer completed successfully!');

      // 5. Register in Transfer History
      try {
        const itemsSnapshot = validItems.map(item => ({
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: (Object.values(item.conditions) as string[]).reduce((sum, v) => sum + (parseInt(v) || 0), 0),
          conditions: { ...item.conditions }
        }));

        const uniqueSources = Array.from(new Set(validItems.map(i => i.from_location)));
        const fromLocDisplay = uniqueSources.join(', ');

        await supabase.from('transfer_history').insert([{
          req_no: reqNo,
          from_location: fromLocDisplay,
          to_location: toLocation,
          transferred_by: transferBy,
          items: itemsSnapshot,
          program: 'General'
        }]);
      } catch (historyErr) {
        console.error('Error logging to transfer history:', historyErr);
      }

      setTimeout(() => {
        handleBack();
      }, 1500);
    } catch (err: any) {
      console.error('Error during batch transfer:', err);
      setError(err.message || 'Failed to process bulk transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`h-full overflow-y-auto custom-scrollbar p-4 md:p-6 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="max-w-full mx-auto space-y-2 animate-in fade-in duration-500 pb-8 px-2 md:px-4">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-2">
          <button 
            onClick={handleBack}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowLeft size={18} />
            <span className="font-bold text-sm tracking-tight">Back to Inventory</span>
          </button>
        </div>

        {/* Main Content Card */}
        <div className={`rounded-[2rem] shadow-xl border-2 flex flex-col ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`} style={{ borderColor: 'color-mix(in srgb, var(--brand-accent), transparent 80%)' }}>
          
          {/* Section Header */}
          <div className="p-3 md:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)' }}>
                <ArrowRightLeft size={16} style={{ color: 'var(--brand-accent)' }} />
              </div>
              <div>
                <h3 className={`text-base font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Stock Transfer
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] italic">
                  Batch inventory movement between storage locations
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 md:px-5 md:py-3">
            {success ? (
              <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8">
                  <CheckCircle2 size={56} className="text-emerald-500" />
                </div>
                <h4 className={`text-3xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Transfer Successful!</h4>
                <p className="text-slate-500 font-medium">All items have been moved to the destination location.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
              
              {/* Form Inputs Grid - 2x2 Layout */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-2">
                
                {/* ROW 1 LEFT: TRANSFER BY */}
                <div className="md:col-span-2 space-y-1">
                  <div className="flex items-center gap-2 ml-1">
                    <User size={12} className="text-brand-orange" strokeWidth={2.5} />
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Transfer By</label>
                  </div>
                  <input 
                    type="text"
                    value={transferBy || ''}
                    onChange={(e) => setTransferBy(e.target.value)}
                    className={`w-full px-4 py-2 rounded-xl border-2 font-bold text-xs outline-none transition-all focus:ring-4 focus:ring-brand-orange/10 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-brand-orange' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-brand-orange'
                    }`}
                  />
                </div>

                {/* ROW 1 RIGHT/ATTACHMENT REPLACEMENT: REMARKS */}
                <div className="md:col-span-2 space-y-1">
                  <div className="flex items-center gap-2 ml-1">
                    <Notebook size={12} className="text-brand-orange" strokeWidth={2.5} />
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Remarks</label>
                  </div>
                  <textarea 
                    placeholder="General transfer notes..."
                    rows={1}
                    value={remarks || ''}
                    onChange={(e) => setRemarks(e.target.value)}
                    className={`w-full px-4 py-2 rounded-xl border-2 font-bold text-xs outline-none transition-all focus:ring-4 focus:ring-brand-orange/10 resize-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-brand-orange' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-brand-orange'
                    }`}
                  />
                </div>

                {/* ROW 2 LEFT: SOURCE LOCATION */}
                <div className="md:col-span-2 relative" ref={fromDropdownRef}>
                  <div className="flex items-center gap-2 ml-1">
                    <MapPin size={12} className="text-brand-orange" strokeWidth={2.5} />
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Location</label>
                  </div>
                  <div 
                    className={`w-full px-4 py-2 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                    } ${isFromDropdownOpen ? 'ring-4 ring-brand-orange/10 border-brand-orange' : ''}`}
                    onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}
                  >
                    <span className="font-bold truncate text-xs">{fromLocation || 'Select location...'}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isFromDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isFromDropdownOpen && (
                    <div className={`absolute top-full left-0 right-0 mt-3 rounded-[2.5rem] shadow-3xl border-2 overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                    }`}>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar">
                        {allLocations.map((loc, idx) => (
                          <button
                            key={`${loc.name}-${idx}`}
                            type="button"
                            onClick={() => { setFromLocation(loc.name); setIsFromDropdownOpen(false); }}
                            className={`w-full text-left px-8 py-5 text-sm font-bold transition-all hover:bg-brand-orange/5 hover:text-brand-orange ${
                              fromLocation === loc.name ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {loc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ROW 2 RIGHT: DESTINATION LOCATION */}
                <div className="md:col-span-2 relative" ref={toDropdownRef}>
                  <div className="flex items-center gap-2 ml-1">
                    <MapPin size={12} className="text-brand-orange" strokeWidth={2.5} />
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Destination Location</label>
                  </div>
                  <div 
                    className={`w-full px-4 py-2 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                    } ${isToDropdownOpen ? 'ring-4 ring-brand-orange/10 border-brand-orange' : ''}`}
                    onClick={() => setIsToDropdownOpen(!isToDropdownOpen)}
                  >
                    <span className="font-bold truncate text-xs">{toLocation || 'Select target location...'}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isToDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isToDropdownOpen && (
                    <div className={`absolute top-full left-0 right-0 mt-3 rounded-[2.5rem] shadow-3xl border-2 overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                    }`}>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar">
                        {allLocations.map((loc, idx) => (
                          <button
                            key={`${loc.name}-${idx}`}
                            type="button"
                            onClick={() => { setToLocation(loc.name); setIsToDropdownOpen(false); }}
                            className={`w-full text-left px-8 py-5 text-sm font-bold transition-all hover:bg-brand-orange/5 hover:text-brand-orange ${
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

                </div>

                {/* ITEMS SECTION */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-brand-orange flex items-center justify-center text-white shadow-lg shadow-brand-orange/20">
                        <Box size={12} />
                      </div>
                      <h4 className={`text-base font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Items to Transfer</h4>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Bundle Selection */}
                      <div className="flex items-center gap-2" ref={bundleDropdownRef}>
                        {(selectedBundle || appliedBundleName) && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border animate-in slide-in-from-right-4 duration-300 ${
                            selectedBundle 
                              ? (isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600')
                              : (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600')
                          }`}>
                            <Sparkles size={12} className={selectedBundle ? 'animate-pulse' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                              {selectedBundle ? `Selected: ${selectedBundle}` : `Bundle: ${appliedBundleName}`}
                            </span>
                            {!selectedBundle && appliedBundleName && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setAppliedBundleName(null); }}
                                className="ml-1 hover:text-red-500 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="relative group">
                          <div 
                            className={`flex items-center justify-between w-48 md:w-56 px-4 py-2 rounded-xl border-2 transition-all cursor-pointer ${
                              selectedBundle 
                                ? (isDarkMode ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
                                : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')
                            } ${isBundleDropdownOpen ? 'border-brand-orange ring-4 ring-brand-orange/10' : ''}`}
                            onClick={() => setIsBundleDropdownOpen(!isBundleDropdownOpen)}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest truncate">
                              {selectedBundle || 'Select Bundle Name'}
                            </span>
                            <ChevronDown size={14} className={`transition-transform duration-300 ${isBundleDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>

                          {isBundleDropdownOpen && (
                            <div className={`absolute top-full left-0 right-0 mt-2 py-2 rounded-2xl shadow-3xl border-2 z-[400] animate-in fade-in slide-in-from-top-2 ${
                              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                            }`}>
                              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {availableBundles.length > 0 ? (
                                  availableBundles.map((bundle, idx) => (
                                    <button
                                      key={`${bundle}-${idx}`}
                                      type="button"
                                      onClick={() => { setSelectedBundle(bundle); setIsBundleDropdownOpen(false); }}
                                      className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-brand-orange/5 hover:text-brand-orange ${
                                        selectedBundle === bundle ? 'bg-brand-orange/10 text-brand-orange' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                      }`}
                                    >
                                      {bundle}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-5 py-3 text-[10px] font-bold text-slate-400 italic">No bundles found</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Multiplier */}
                        {selectedBundle && (
                          <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                            <input 
                              type="number"
                              min="1"
                              value={bundleMultiplier || ''}
                              onChange={(e) => setBundleMultiplier(e.target.value)}
                              placeholder="Qty"
                              className={`w-14 px-2 py-2 rounded-lg border-2 text-center text-xs font-black transition-all ${
                                isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-brand-orange' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-brand-orange'
                              }`}
                            />
                            <button 
                              type="button"
                              onClick={handleApplyBundle}
                              className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

                      {(userRole === 'Admin' || userRole === 'SUPERADMIN' || !userRole) && (
                        <button 
                          type="button"
                          onClick={addItemRow}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          <Plus size={14} />
                          Add Item Line
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {items.map((line, index) => {
                      const hasError = errorItemIds.has(line.id);
                      const totalQty = (Object.values(line.conditions) as string[]).reduce((sum: number, v: string) => sum + (parseInt(v) || 0), 0);
                      
                      return (
                        <div 
                          key={line.id} 
                          className={`relative p-3 md:p-4 rounded-[1rem] border-2 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 group ${
                            hasError 
                              ? (isDarkMode ? 'bg-red-500/5 border-red-500/30' : 'bg-red-50 border-red-200 shadow-red-100')
                              : (isDarkMode ? 'bg-slate-800/20 border-slate-800 hover:border-brand-orange/30' : 'bg-slate-50 border-slate-100 hover:border-brand-orange/20 shadow-sm')
                          }`}
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          {/* Remove Button */}
                          {(userRole === 'Admin' || userRole === 'SUPERADMIN' || !userRole) && (
                            <button 
                              type="button"
                              onClick={() => removeItemRow(line.id)}
                              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:bg-red-600 active:scale-90 z-10"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                          <div className="space-y-3">
                            {/* Line Header: Item Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                              {/* Item Picker */}
                              <div className="md:col-span-12 space-y-0.5 relative">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                  Item Selection
                                </label>
                                <div 
                                  className={`w-full px-3 py-2 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                                    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                                  } ${line.isItemDropdownOpen ? 'ring-4 ring-brand-orange/10 border-brand-orange' : ''} ${!fromLocation ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                                  onClick={() => updateItemLine(line.id, { isItemDropdownOpen: !line.isItemDropdownOpen })}
                                >
                                  <div className="flex items-center gap-2 overflow-hidden">
                                     <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Box size={14} className={line.item_code ? 'text-brand-orange' : 'text-slate-400'} />
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                        <span className="font-bold truncate text-sm">
                                          {line.item_name || (fromLocation ? 'Choose an item to transfer...' : 'Select source location first')}
                                        </span>
                                        {line.item_code && (
                                          <div className="flex items-center gap-2">
                                             <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{line.item_code}</span>
                                             {line.is_serialized && (
                                               <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-wider">Serialized</span>
                                             )}
                                          </div>
                                        )}
                                     </div>
                                  </div>
                                  <ChevronDown size={20} className={`text-slate-400 transition-transform ${line.isItemDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {line.isItemDropdownOpen && (
                                  <div className={`absolute top-full left-0 right-0 mt-3 rounded-[2rem] shadow-3xl border-2 z-[450] overflow-hidden animate-in fade-in slide-in-from-top-2 ${
                                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-slate-200'
                                  }`}>
                                    <div className="p-4 border-b border-inherit bg-slate-50/50 dark:bg-slate-900/50">
                                      <div className="relative">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                          type="text"
                                          placeholder="Search in catalog..."
                                          value={line.itemSearch || ''}
                                          onChange={(e) => updateItemLine(line.id, { itemSearch: e.target.value })}
                                          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-brand-orange transition-all"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                        {catalogItems
                                         .filter(i => i.description.toLowerCase().includes((line.itemSearch || '').toLowerCase()) || i.item_code.toLowerCase().includes((line.itemSearch || '').toLowerCase()))
                                         .map((i, idx) => (
                                           <button
                                             key={`${i.item_code}-${idx}`}
                                             type="button"
                                             onClick={() => updateItemLine(line.id, { 
                                               item_code: i.item_code, 
                                               item_name: i.description, 
                                               isItemDropdownOpen: false 
                                             })}
                                             className={`w-full text-left px-8 py-5 text-sm font-bold border-b last:border-0 border-slate-50 dark:border-slate-700 transition-all flex items-center justify-between ${
                                               line.item_code === i.item_code ? 'text-brand-orange bg-brand-orange/5' : isDarkMode ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white' : 'text-slate-600 hover:bg-slate-50'
                                              }`}
                                           >
                                             <div className="flex flex-col gap-1">
                                               <span>{i.description}</span>
                                               <div className="flex items-center gap-3">
                                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{i.item_code}</span>
                                                  <span className="px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange text-[8px] font-black">Stock: {i.quantity}</span>
                                               </div>
                                             </div>
                                             {i.is_serialized && (
                                               <div className="p-2 rounded-lg bg-amber-500/10">
                                                  <QrCode size={18} className="text-amber-500" />
                                               </div>
                                             )}
                                           </button>
                                         ))
                                        }
                                        {catalogItems.length === 0 && (
                                          <div className="p-10 text-center text-slate-400 italic text-sm">No items available in this location</div>
                                        )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Conditions & Quantity Grid */}
                            {line.item_code && (
                              <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {(['brand_new', 'used', 'defective', 'disposal'] as const).map((cond) => (
                                    <div key={cond} className="space-y-0.5">
                                      <div className="flex items-center justify-between ml-1">
                                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                          {cond.replace('_', ' ')}
                                        </label>
                                        <span className={`text-[7px] font-black uppercase ${line.availableStocks[cond] === '0' ? 'text-slate-300' : 'text-emerald-500'}`}>
                                           Avail: {line.availableStocks[cond]}
                                        </span>
                                      </div>
                                      <input 
                                        type="text" 
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={line.conditions[cond]}
                                        onChange={(e) => updateCondition(line.id, cond, e.target.value)}
                                        className={`w-full px-3 py-1.5 rounded-lg border-2 outline-none font-black text-xs transition-all focus:ring-4 focus:ring-brand-orange/10 ${
                                          isDarkMode 
                                            ? 'bg-slate-900 border-slate-700 text-white focus:border-brand-orange' 
                                            : 'bg-white border-slate-100 text-slate-700 focus:border-brand-orange shadow-sm'
                                        } ${parseInt(line.conditions[cond]) > parseInt(line.availableStocks[cond]) ? 'border-red-500 ring-4 ring-red-500/10' : ''}`}
                                      />
                                    </div>
                                  ))}
                                </div>

                                {/* Summary & Serial Transition */}
                                <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-slate-900 text-white shadow-xl">
                                   <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                                         <ArrowRightLeft size={14} className="text-brand-orange" />
                                      </div>
                                      <div>
                                         <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Total Transfer Quantity</p>
                                         <h4 className="text-lg font-black tracking-tight">{totalQty as number} <span className="text-[10px] font-bold text-slate-500 ml-1">Units</span></h4>
                                      </div>
                                   </div>

                                   {line.is_serialized && (totalQty as number) > 0 && (
                                     <button 
                                       type="button"
                                       onClick={() => updateItemLine(line.id, { showSerials: !line.showSerials })}
                                       className={`mt-4 md:mt-0 flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${
                                         line.showSerials 
                                           ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20' 
                                           : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                       }`}
                                     >
                                        <QrCode size={16} />
                                        {line.showSerials ? 'Hide Serials' : 'Entry Serial Numbers'}
                                     </button>
                                   )}
                                </div>

                                {/* Serial Numbers Entrance - EXACT MATCH TO INITIAL STOCK MODULE */}
                                {line.is_serialized && line.showSerials && totalQty > 0 && (
                                  <div className="p-4 md:p-5 rounded-[1.5rem] border-2 border-amber-500/30 bg-amber-500/[0.02] space-y-4 animate-in zoom-in-95 duration-500">
                                     <div className="flex items-center gap-3 border-b border-amber-500/10 pb-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                           <Hash size={16} className="text-amber-500" />
                                        </div>
                                        <div>
                                           <h5 className="text-base font-black tracking-tight text-slate-800 dark:text-slate-200">Serial Numbers Entry</h5>
                                           <p className="text-[8px] font-bold text-amber-500/80 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10 inline-block mt-0.5">
                                              TIP: Paste multiple serials from Excel or Sheets directly.
                                           </p>
                                        </div>
                                     </div>

                                     {(['brand_new', 'used', 'defective', 'disposal'] as const).map(cond => {
                                        const qty = parseInt(line.conditions[cond]) || 0;
                                        if (qty === 0) return null;

                                        return (
                                          <div key={`serials-${line.id}-${cond}`} className="space-y-4">
                                            <div className="flex items-center gap-3">
                                               <span className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-400">
                                                  {cond.replace('_', ' ')}
                                               </span>
                                               <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                               <span className="text-[8px] font-bold text-amber-500">{qty} Items</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                              {Array.from({ length: qty }).map((_, i) => (
                                                <div key={`${line.id}-${cond}-${i}`} className="relative">
                                                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 dark:text-slate-600">
                                                      {i + 1}
                                                   </span>
                                                   <input 
                                                      type="text"
                                                      list={`serials-${line.id}-${cond}-${i}`}
                                                      placeholder={`Scan/Enter serial for ${cond.replace('_', ' ')} ${i + 1}`}
                                                      value={line.serials[cond][i] || ''}
                                                      onChange={(e) => {
                                                          const updatedSerials = [...line.serials[cond]];
                                                          updatedSerials[i] = e.target.value.trim();
                                                          updateItemLine(line.id, { serials: { ...line.serials, [cond]: updatedSerials } });
                                                      }}
                                                      onPaste={(e) => handleSerialPaste(line.id, cond, i, e)}
                                                      className={`w-full pl-8 pr-3 p-2 rounded-lg border-2 font-mono text-[10px] font-bold outline-none transition-all ${
                                                        isDarkMode 
                                                          ? 'bg-slate-900 border-slate-700 text-white focus:border-amber-500/50' 
                                                          : 'bg-white border-slate-200 text-slate-700 focus:border-amber-500'
                                                      } ${line.serials[cond][i] && !line.availableSerials[cond].includes(line.serials[cond][i]) ? 'border-red-500' : ''}`}
                                                   />
                                                   <datalist id={`serials-${line.id}-${cond}-${i}`}>
                                                      {line.availableSerials[cond]
                                                        .filter(sn => {
                                                          // Don't show if already selected in any other field
                                                          const isSelectedElsewhere = items.some(l => 
                                                            (Object.values(l.serials) as string[][]).some(sArr => 
                                                              sArr.some((s, sIdx) => s === sn && !(l.id === line.id && sArr === (line.serials as any)[cond] && sIdx === i))
                                                            )
                                                          );
                                                          return !isSelectedElsewhere;
                                                        })
                                                        .map(sn => (
                                                          <option key={sn} value={sn} />
                                                        ))}
                                                   </datalist>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                     })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ERROR ALERT */}
                {error && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border-2 border-red-100 dark:border-red-500/20 rounded-2xl text-red-500 animate-in shake duration-500">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-sm font-bold tracking-tight">{error}</p>
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="pt-3 flex flex-col sm:flex-row gap-3">
                  <button 
                    type="button"
                    onClick={handleBack}
                    className={`flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all hover:scale-[0.98] ${
                      isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-200/50 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    { (userRole === 'Admin' || userRole === 'SUPERADMIN' || !userRole) ? 'Discard Transfer' : 'Go Back' }
                  </button>
                  
                  {(userRole === 'Admin' || userRole === 'SUPERADMIN' || !userRole) ? (
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] py-2.5 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 group"
                      style={{ 
                        backgroundColor: 'var(--brand-accent)',
                        boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)'
                      }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ArrowRightLeft size={20} className="transition-transform group-hover:rotate-180 duration-500" />
                          Confirm Transfer
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-[2] flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-200 dark:border-slate-700">
                      <AlertCircle size={16} />
                      Read-Only Mode
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifiedTransferPage;
