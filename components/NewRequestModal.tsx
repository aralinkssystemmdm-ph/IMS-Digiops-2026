
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, ChevronDown, CheckCircle2, FileText, Check, Plus, Trash2, Paperclip, Upload, AlertCircle, Sparkles, Box, Loader2, Calendar, MapPin, Notebook, Zap, ShieldCheck, Tag, Search, Layers } from 'lucide-react';
import { toTitleCase, getBundleColor } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface RequestedItem {
  id: string | number;
  qty: string;
  uom: string;
  item: string;
  item_code: string;
  is_serialized?: boolean;
  bundle_name?: string;
}

interface EquipmentRecord {
  item_code: string;
  description: string;
  is_serialized: boolean;
  uom: string;
}

interface SchoolItem {
  name: string;
  customer_code?: string;
  school_monitoring_id?: string;
  is_buffer: boolean;
}

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (newId?: string) => void;
  initialData?: RequestData;
  isDarkMode?: boolean;
  prefillItem?: string;
  prefillCode?: string;
}

const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, onSubmit, initialData, isDarkMode = false, prefillItem, prefillCode }) => {
  const { showSuccess, showError, showWarning } = useNotification();
  const [requestedBy, setRequestedBy] = useState('');
  const [requestedByError, setRequestedByError] = useState(false);
  const [userAccounts, setUserAccounts] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isReqDropdownOpen, setIsReqDropdownOpen] = useState(false);
  const reqDropdownRef = useRef<HTMLDivElement>(null);
  const [ticketNumber, setTicketNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [controlNo, setControlNo] = useState('');
  const [requestType, setRequestType] = useState<'ARALINKS' | 'SMS-PROTRACK'>('ARALINKS');
  const [dateOfRequest, setDateOfRequest] = useState('');
  const [program, setProgram] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [schoolSearchText, setSchoolSearchText] = useState('');
  const [requestedItems, setRequestedItems] = useState<RequestedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  
  const [pendingBundle, setPendingBundle] = useState<string | null>(null);
  const [bundleQuantity, setBundleQuantity] = useState('1');

  const [equipmentList, setEquipmentList] = useState<EquipmentRecord[]>([]);
  const [isLoadingEquip, setIsLoadingEquip] = useState(false);
  const [itemSearchText, setItemSearchText] = useState<{[key: string]: string}>({});

  const [availableBundles, setAvailableBundles] = useState<string[]>([]);
  const [allProgramBundles, setAllProgramBundles] = useState<{[program: string]: string[]}>({});
  const [requestedBundlesForSchool, setRequestedBundlesForSchool] = useState<string[]>([]);
  const [pastRequestedItems, setPastRequestedItems] = useState<{ bundle_name: string; item_code: string; qty: number }[]>([]);
  const [programBundleItems, setProgramBundleItems] = useState<{ bundle: string; item_code: string; quantity: number }[]>([]);
  const [relevantItemCodes, setRelevantItemCodes] = useState<Set<string>>(new Set());
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [selectedBundleDropdown, setSelectedBundleDropdown] = useState('');

  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [monitoringRecords, setMonitoringRecords] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBundleDropdownOpen, setIsBundleDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [isReqByDropdownOpen, setIsReqByDropdownOpen] = useState(false);
  const [openItemDropdownId, setOpenItemDropdownId] = useState<string | null>(null);
  const [openUomDropdownId, setOpenUomDropdownId] = useState<string | null>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bundleDropdownRef = useRef<HTMLDivElement>(null);
  const programDropdownRef = useRef<HTMLDivElement>(null);
  const itemDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const uomDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const getTodayIso = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatToDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    if (isoDate.includes('/')) return isoDate;
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    return `${m}/${d}/${y}`;
  };

  const formatToIso = (displayDate: string) => {
    if (!displayDate) return '';
    if (displayDate.includes('-')) return displayDate;
    const parts = displayDate.split('/');
    if (parts.length !== 3) return displayDate; 
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const fetchEquipment = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsLoadingEquip(true);
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('item_code, description, is_serialized, uom, status')
        .is('archived_at', null)
        .order('description', { ascending: true });
      
      if (data) {
        // Filter in JS to be case-insensitive and handle various active statuses
        const activeItems = (data as any[]).filter(item => {
          const s = (item.status || '').toUpperCase();
          return s === 'ACTIVE' || s === 'ENABLE' || s === 'AVAILABLE' || s === '';
        });
        setEquipmentList(activeItems as EquipmentRecord[]); 
      }
    } catch (err) {
      console.error('Error fetching equipment for dropdown:', err);
    } finally {
      setIsLoadingEquip(false);
    }
  }, []);

  const fetchMonitoringRecords = useCallback(async () => {
    const smLocalStr = localStorage.getItem('aralinks_school_monitoring') || '[]';
    let localMonitoring: any[] = [];
    try {
      localMonitoring = JSON.parse(smLocalStr);
    } catch {
      localMonitoring = [];
    }

    let monitoringData: any[] = [...localMonitoring];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('school_monitoring')
          .select('*');
        if (!error && data) {
          const dbRecords = data.map((row: any) => ({
            id: row.id,
            customer_code: row.customer_code,
            school_name: row.school_name,
            program: row.program || 'OTHER',
            sales_team: row.sales_team,
            class_opening: row.class_opening,
            target_deployment_date: row.target_deployment_date,
            status: Number(row.status) || 1,
            status_dates: typeof row.status_dates === 'string' 
              ? JSON.parse(row.status_dates) 
              : (row.status_dates || {}),
            items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
            school_monitoring_id: row.school_monitoring_id || '',
            type_of_document: row.type_of_document || ''
          }));

          monitoringData = dbRecords;
          localStorage.setItem('aralinks_school_monitoring', JSON.stringify(dbRecords));
        }
      } catch (e) {
        console.warn('Could not fetch from Supabase school_monitoring table, falling back to localStorage:', e);
      }
    }
    
    // Fall back if absolutely empty and database was offline/empty
    if (monitoringData.length === 0) {
      monitoringData = [];
      localStorage.setItem('aralinks_school_monitoring', JSON.stringify(monitoringData));
    }

    setMonitoringRecords(monitoringData);

    // Populate schools based on unique school names in monitoring records
    const uniqueSchoolsMap = new Map<string, SchoolItem>();
    monitoringData.forEach(record => {
      if (record.school_name && !uniqueSchoolsMap.has(record.school_name)) {
        uniqueSchoolsMap.set(record.school_name, {
          name: record.school_name,
          customer_code: record.customer_code,
          school_monitoring_id: record.school_monitoring_id,
          is_buffer: false
        });
      }
    });

    setSchools(Array.from(uniqueSchoolsMap.values()));
  }, []);

  const fetchUserAccounts = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select('full_name')
        .order('full_name', { ascending: true });
      
      if (data) {
        setUserAccounts(data.map(u => u.full_name));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    const fetchAllProgramBundles = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase
          .from('bundle_items')
          .select('program, bundle')
          .is('archived_at', null);
        if (data) {
          const mapping: {[program: string]: string[]} = {};
          (data as any[]).forEach(item => {
            if (item.program && item.bundle) {
              const prog = item.program.trim();
              if (!mapping[prog]) {
                mapping[prog] = [];
              }
              if (!mapping[prog].includes(item.bundle)) {
                mapping[prog].push(item.bundle);
              }
            }
          });
          setAllProgramBundles(mapping);
        }
      } catch (err) {
        console.error('Error fetching all bundles mapping:', err);
      }
    };
    fetchAllProgramBundles();
  }, []);

  useEffect(() => {
    const fetchRequestedBundles = async () => {
      if (selectedSchools.length === 0 || !isSupabaseConfigured) {
        setRequestedBundlesForSchool([]);
        setPastRequestedItems([]);
        return;
      }

      try {
        const { data: requests, error: reqError } = await supabase
          .from('item_requests')
          .select('control_no, school_name')
          .not('status', 'in', '("Deleted","Rejected")')
          .is('archived_at', null);

        if (reqError) throw reqError;

        if (requests && requests.length > 0) {
          const matchedControlNos = requests
            .filter((req: any) => {
              if (initialData && (req.control_no === initialData.id || req.control_no === initialData.control_no)) {
                return false;
              }
              const reqSchools = req.school_name.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
              return selectedSchools.some(s => reqSchools.includes(s.trim().toLowerCase()));
            })
            .map((req: any) => req.control_no);

          if (matchedControlNos.length > 0) {
            const { data: items, error: itemsError } = await supabase
              .from('request_items')
              .select('bundle_name, item_code, qty')
              .in('request_control_no', matchedControlNos)
              .is('archived_at', null);

            if (itemsError) throw itemsError;

            if (items) {
              const bundles = Array.from(new Set(items.map((it: any) => it.bundle_name ? it.bundle_name.trim() : '').filter(Boolean))) as string[];
              setRequestedBundlesForSchool(bundles);
              setPastRequestedItems(items.map((it: any) => ({
                bundle_name: it.bundle_name || '',
                item_code: it.item_code || '',
                qty: Number(it.qty) || 0
              })));
              return;
            }
          }
        }
        setRequestedBundlesForSchool([]);
        setPastRequestedItems([]);
      } catch (err) {
        console.error('Error fetching requested bundles for schools:', err);
        setRequestedBundlesForSchool([]);
        setPastRequestedItems([]);
      }
    };

    fetchRequestedBundles();
  }, [selectedSchools, initialData]);

  const schoolMonitoringBundles = useMemo(() => {
    const bundlesMap = new Map<string, any[]>();
    selectedSchools.forEach(schoolName => {
      const rec = monitoringRecords.find(r => r.school_name === schoolName);
      if (rec && rec.items && Array.isArray(rec.items)) {
        rec.items.forEach((item: any) => {
          if (item.bundle_name) {
            const bName = item.bundle_name.trim();
            if (!bundlesMap.has(bName)) {
              bundlesMap.set(bName, []);
            }
            const existing = bundlesMap.get(bName)!;
            const duplicate = existing.find(x => x.item_code === item.item_code);
            if (!duplicate) {
              existing.push({ ...item });
            } else {
              duplicate.quantity = (duplicate.quantity || 1) + (item.quantity || 1);
            }
          }
        });
      }
    });
    return Array.from(bundlesMap.entries()).map(([name, items]) => ({ name, items }));
  }, [selectedSchools, monitoringRecords]);

  useEffect(() => {
    const fetchBundlesForProgram = async () => {
      if (!program || !isSupabaseConfigured) {
        setAvailableBundles([]);
        setProgramBundleItems([]);
        return;
      }

      setIsLoadingBundles(true);
      try {
        const { data, error } = await supabase
          .from('bundle_items')
          .select('bundle, item_code, quantity')
          .eq('program', program)
          .is('archived_at', null);
        
        if (data) {
          setProgramBundleItems(data.map((item: any) => ({
            bundle: item.bundle || '',
            item_code: item.item_code || '',
            quantity: Number(item.quantity) || 1
          })));
          const uniqueBundles = Array.from(new Set((data as any[]).map(item => String(item.bundle || ''))));
          setAvailableBundles(uniqueBundles.sort());
          
          const codes = new Set((data as any[]).map(item => String(item.item_code || '')));
          setRelevantItemCodes(codes);
        }
      } catch (err) {
        console.error('Error fetching bundles:', err);
      } finally {
        setIsLoadingBundles(false);
      }
    };

    fetchBundlesForProgram();
  }, [program]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (reqDropdownRef.current && !reqDropdownRef.current.contains(event.target as Node)) {
        setIsReqDropdownOpen(false);
      }
      if (bundleDropdownRef.current && !bundleDropdownRef.current.contains(event.target as Node)) {
        setIsBundleDropdownOpen(false);
      }
      if (programDropdownRef.current && !programDropdownRef.current.contains(event.target as Node)) {
        setIsProgramDropdownOpen(false);
      }
      if (openItemDropdownId && itemDropdownRefs.current[openItemDropdownId] && !itemDropdownRefs.current[openItemDropdownId]?.contains(event.target as Node)) {
        setOpenItemDropdownId(null);
      }
      if (openUomDropdownId && uomDropdownRefs.current[openUomDropdownId] && !uomDropdownRefs.current[openUomDropdownId]?.contains(event.target as Node)) {
        setOpenUomDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNextControlNo = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const year = new Date().getFullYear();
      setControlNo(`ARAL-${year}-0001`);
      return;
    }

    try {
      const year = new Date().getFullYear();
      const prefix = `ARAL-${year}-`;
      
      const { data, error } = await supabase
        .from('item_requests')
        .select('control_no')
        .like('control_no', `${prefix}%`)
        .order('control_no', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const lastNo = data[0].control_no;
        const parts = lastNo.split('-');
        const lastSequence = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSequence)) {
          const nextSequence = (lastSequence + 1).toString().padStart(4, '0');
          setControlNo(`${prefix}${nextSequence}`);
          return;
        }
      }
      
      setControlNo(`${prefix}0001`);
    } catch (err) {
      console.error('Error fetching next control number:', err);
      const year = new Date().getFullYear();
      setControlNo(`ARAL-${year}-0001`);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setRequestedByError(false);
      setHasAttemptedSubmit(false);
      setPendingBundle(null);
      setBundleQuantity('1');
      setSelectedBundleDropdown('');
      fetchMonitoringRecords();
      fetchEquipment();
      fetchUserAccounts();
      setIsDropdownOpen(false);
      setSelectedFiles([]);
      setExistingAttachments(initialData?.attachment ? initialData.attachment.split(',') : []);
      
      if (initialData) {
        setRequestedBy(initialData.requestedBy || '');
        setTicketNumber(initialData.ticketNo || '');
        setPoNumber(initialData.poNumber || '');
        setPurpose(initialData.purpose || '');
        setControlNo(initialData.id || '');
        setRequestType(initialData.requestType || 'ARALINKS');
        setDateOfRequest(initialData.date || getTodayIso());
        setProgram(initialData.program || '');
        setRemarks(initialData.remarks || '');
        if (initialData.schoolName) {
          setSelectedSchools(initialData.schoolName.split(',').map(s => s.trim()).filter(Boolean));
        } else {
          setSelectedSchools([]);
        }
        
        if (initialData.items && initialData.items.length > 0) {
          setRequestedItems(initialData.items.map(item => ({
            id: item.id,
            qty: String(item.qty || '0'),
            uom: item.uom || '',
            item: item.item || '',
            item_code: item.item_code || '',
            is_serialized: item.isSerialized,
            received_quantity: item.received_quantity,
            serials: item.serials,
            status: item.status,
            bundle_name: item.bundle_name
          })));
        } else {
          setRequestedItems([]);
        }
      } else {
        setRequestedBy('');
        setTicketNumber('');
        setPoNumber('');
        setPurpose('');
        fetchNextControlNo();
        setRequestType('ARALINKS');
        setProgram('');
        setRemarks('');
        setSelectedSchools([]);
        setSchoolSearchText('');
        setDateOfRequest(getTodayIso());
        
        // Handle pre-fill from Inventory
        if (prefillItem && prefillCode) {
          setRequestedItems([{
            id: Math.random().toString(36).substr(2, 9),
            qty: '1',
            uom: 'UNIT',
            item: prefillItem,
            item_code: prefillCode
          }]);
        } else {
          setRequestedItems([]);
        }
      }
    }
  }, [isOpen, initialData, fetchMonitoringRecords, fetchEquipment, prefillItem, prefillCode, fetchNextControlNo]);

  if (!isOpen) return null;

  const handleSchoolToggle = (schoolName: string) => {
    const isSelected = selectedSchools.includes(schoolName);
    let newSelected: string[];
    
    if (isSelected) {
      newSelected = selectedSchools.filter(s => s !== schoolName);
    } else {
      newSelected = [...selectedSchools, schoolName];
    }
    
    setSelectedSchools(newSelected);

    if (!isSelected) {
      // 1. Auto-populate Program
      const matchingRec = monitoringRecords.find(r => r.school_name === schoolName);
      if (matchingRec) {
        if (matchingRec.program) {
          setProgram(matchingRec.program);
        }
        
        // 2. Auto-populate Item List based on monitoring record hardware list
        // Skip automation if hardware is a bundle for this school's program
        const matchedProg = (matchingRec.program || '').trim();
        const hasBundles = matchedProg && (
          (allProgramBundles[matchedProg] && allProgramBundles[matchedProg].length > 0) ||
          matchedProg.toUpperCase().includes('ACE')
        );

        if (hasBundles) {
          console.log('Skipping automated item list population as this program has bundles.');
        } else if (matchingRec.items && Array.isArray(matchingRec.items) && matchingRec.items.length > 0) {
          const nextItems = [...requestedItems];
          matchingRec.items.forEach((item: any) => {
            // Check if already in the requestedItems list
            const existingIdx = nextItems.findIndex(ni => ni.item_code === item.item_code);
            const equip = equipmentList.find(e => e.item_code === item.item_code);
            const uom = equip && equip.uom ? equip.uom : 'UNIT';
            const is_serialized = equip ? equip.is_serialized : false;

            if (existingIdx > -1) {
              const currentQty = parseInt(nextItems[existingIdx].qty) || 0;
              nextItems[existingIdx].qty = String(currentQty + Number(item.quantity || 1));
            } else {
              nextItems.push({
                id: Math.random().toString(36).substr(2, 9),
                qty: String(item.quantity || 1),
                uom: uom,
                item: item.item_name || (equip ? equip.description : item.item_code),
                item_code: item.item_code,
                is_serialized: is_serialized
              });
            }
          });
          setRequestedItems(nextItems);
        }
      }
    }
  };

  const handleAddItem = () => {
    if (!program) {
      showWarning('Program Required', 'Please select a Program before adding item lines.');
      return;
    }
    setRequestedItems([...requestedItems, { id: Math.random().toString(36).substr(2, 9), qty: '', uom: '', item: '', item_code: '' }]);
  };

  const handleApplyBundle = (bundleName: string) => {
    if (!bundleName) return;
    setPendingBundle(bundleName);
    setBundleQuantity('1');
  };

  const confirmApplyBundle = async () => {
    if (!program || !isSupabaseConfigured || !pendingBundle) return;

    const multiplier = parseInt(bundleQuantity) || 1;

    try {
      const { data, error } = await supabase
        .from('bundle_items')
        .select('*')
        .eq('program', program)
        .eq('bundle', pendingBundle)
        .is('archived_at', null);

      if (error) throw error;
      if (data && data.length > 0) {
        const nextItems = [...requestedItems];
        
        (data as any[]).forEach(bundleItem => {
          // Align UOM based on equipment database
          const equip = equipmentList.find(e => e.item_code === bundleItem.item_code);
          const bundleItemUom = equip && equip.uom ? equip.uom : 'SET';
          
          let addQtyValue = (bundleItem.quantity || 1) * multiplier;
          
          // Special formula for Brass Fastener: 1-10 = 1, 11-20 = 2, etc.
          // Based on: Math.ceil(multiplier / 10)
          if (bundleItem.description?.toUpperCase().includes('BRASS FASTENER')) {
            addQtyValue = Math.max(1, Math.ceil(multiplier / 10));
          }
          
          // DO NOT MERGE LOGIC - Always add as a new item row
          nextItems.push({
            id: Math.random().toString(36).substr(2, 9),
            qty: addQtyValue.toString(),
            uom: bundleItemUom, 
            item: bundleItem.description,
            item_code: bundleItem.item_code,
            is_serialized: equip ? equip.is_serialized : false,
            bundle_name: pendingBundle
          });
        });
        
        setRequestedItems(nextItems);
      }
      setPendingBundle(null);
      setSelectedBundleDropdown('');
    } catch (err) {
      console.error('Error applying bundle:', err);
      showError('Error', 'Failed to load bundle items.');
    }
  };

  const handleApplyMonitoringBundleDirect = (bundleName: string, items: any[]) => {
    if (!bundleName || !items || items.length === 0) return;

    const nextItems = [...requestedItems];

    items.forEach(monItem => {
      // Find matching equipment UOM and is_serialized
      const equip = equipmentList.find(e => e.item_code === monItem.item_code);
      const uom = equip && equip.uom ? equip.uom : 'UNIT';
      
      const qtyValue = monItem.quantity || 1;

      // Check if this item is already in nextItems
      const existingIdx = nextItems.findIndex(ri => ri.item_code === monItem.item_code && ri.bundle_name === bundleName);
      if (existingIdx > -1) {
        nextItems[existingIdx].qty = qtyValue.toString();
      } else {
        nextItems.push({
          id: Math.random().toString(36).substr(2, 9),
          qty: qtyValue.toString(),
          uom: uom,
          item: monItem.item_name || (equip ? equip.description : monItem.item_code),
          item_code: monItem.item_code,
          is_serialized: equip ? equip.is_serialized : false,
          bundle_name: bundleName
        });
      }
    });

    setRequestedItems(nextItems);
    showSuccess('Bundle Populated', `Successfully populated items from school monitoring bundle "${bundleName}".`);
  };

  const handleRemoveItem = (id: string) => {
    setRequestedItems(requestedItems.filter(item => item.id !== id));
  };

  const isItemValid = (item: RequestedItem) => {
    const qty = parseInt(item.qty) || 0;
    return qty > 0 && item.uom.trim() !== '' && item.item.trim() !== '' && item.item_code.trim() !== '';
  };

  const areAllItemsValid = requestedItems.length > 0 && requestedItems.every(isItemValid);

  const handleItemUpdate = (id: string | number, field: keyof RequestedItem, value: any) => {
    setRequestedItems(prev => {
      let updatedItems = prev.map(item => {
        if (item.id !== id) return item;

        if (field === 'qty') {
          return { ...item, qty: value.replace(/[^0-9]/g, '') };
        }

        if (field === 'item') {
          const selectedEquip = equipmentList.find(e => e.description === value);
          return { 
            ...item, 
            item: value, 
            item_code: selectedEquip ? selectedEquip.item_code : '',
            is_serialized: selectedEquip ? selectedEquip.is_serialized : false,
            uom: selectedEquip && selectedEquip.uom ? selectedEquip.uom : item.uom
          };
        }

        return { ...item, [field]: value };
      });

      return updatedItems;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const validFiles = files.filter(file => {
        if (file.size > 5 * 1024 * 1024) {
          showWarning('File Too Large', `File "${file.name}" is too large. Max size is 5MB.`);
          return false;
        }
        return true;
      });
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files) as File[];
      const validFiles = files.filter(file => {
        if (file.size > 5 * 1024 * 1024) {
          showWarning('File Too Large', `File "${file.name}" is too large. Max size is 5MB.`);
          return false;
        }
        return true;
      });
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    
    // --- COMPREHENSIVE VALIDATION ---
    if (!requestedBy.trim()) {
      showWarning('Missing Field', 'Requested By is required.');
      return;
    }
    if (selectedSchools.length === 0) {
      showWarning('Missing Field', 'Please select at least one School Name.');
      return;
    }
    if (!purpose.trim()) {
      showWarning('Missing Field', 'Purpose of request is required.');
      return;
    }
    if (!controlNo.trim() || controlNo.includes('ARAL-') && controlNo.endsWith('-')) {
      showWarning('Missing Field', 'Control Number is required.');
      return;
    }
    if (!dateOfRequest.trim()) {
      showWarning('Missing Field', 'Date of Request is required.');
      return;
    }
    if (!program.trim()) {
      showWarning('Missing Field', 'Program is required.');
      return;
    }

    if (requestedItems.length === 0) {
      showWarning('Missing Items', 'Please add at least one item to the request.');
      return;
    }

    if (!areAllItemsValid) {
      showWarning('Incomplete Items', 'Please complete all required item fields.');
      const firstInvalidIndex = requestedItems.findIndex(item => !isItemValid(item));
      if (firstInvalidIndex !== -1) {
        const element = document.getElementById(`item-row-${requestedItems[firstInvalidIndex].id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    // --- CHECK FOR DUPLICATE PO NUMBER WITHIN THE SAME REQUEST ---
    if (poNumber.trim() && isSupabaseConfigured) {
      try {
        const newPoList = poNumber.split(';').map(p => p.trim().toLowerCase()).filter(Boolean);
        const uniquePoSet = new Set<string>();
        for (const po of newPoList) {
          if (uniquePoSet.has(po)) {
            showWarning('Duplicate PO', `PO Number "${po}" is listed more than once in this request.`);
            return;
          }
          uniquePoSet.add(po);
        }

        const { data: existingPos, error: poCheckError } = { data: [] as any[], error: null as any };
        
        if (poCheckError) throw poCheckError;

        const currentSchoolList = selectedSchools.map(s => s.trim().toLowerCase()).filter(Boolean);
        
        for (const req of existingPos || []) {
          // Skip current request if editing
          if (initialData && (req.control_no === initialData.id || req.control_no === initialData.control_no)) continue;
          
          if (req.po_number && req.school_name) {
            const reqSchoolList = req.school_name.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
            const isSameSchool = reqSchoolList.some((s: string) => currentSchoolList.includes(s));
            if (!isSameSchool) continue;

            // Use same regex as cleanPONumber to extract actual PO numbers
            const existingRawParts = req.po_number.split(';');
            const existingPoNumbers = existingRawParts.map(part => {
              const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
              if (match) {
                if (match[1] !== undefined) return match[1].trim().toLowerCase();
                if (match[4] !== undefined) return match[4].trim().toLowerCase();
                return match[6].trim().toLowerCase();
              }
              return part.trim().toLowerCase();
            }).filter(Boolean);

            for (const newPo of newPoList) {
              if (existingPoNumbers.includes(newPo)) {
                showWarning('Duplicate PO', "PO Number already exists for this school.");
                return;
              }
            }
          }
        }
      } catch (err: any) {
        console.error('PO Check Error:', err);
        // Continue if check fails? Or block? Usually safer to block or at least log.
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let final_urls = [...existingAttachments];

      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${controlNo.trim()}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `requests/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('attachment')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('attachment')
            .getPublicUrl(filePath);
          return publicUrl;
        });

        const newUrls = await Promise.all(uploadPromises);
        final_urls = [...final_urls, ...newUrls];
      }

      const attachment_url = final_urls.length > 0 ? final_urls.join(',') : null;

      const currentUser = localStorage.getItem('aralinks_user') || 'System';
      const now = new Date().toISOString();

      const joinedSchools = selectedSchools.join(', ');
      const firstSelectedSchool = selectedSchools[0];
      const selectedSchoolData = schools.find(s => s.name === firstSelectedSchool);
      const isSelectedSchoolBuffer = selectedSchoolData?.is_buffer === true || String(selectedSchoolData?.is_buffer) === 'true';
      const schoolMonitoringId = selectedSchoolData?.school_monitoring_id || null;

      const payload = {
        control_no: controlNo.trim(),
        school_name: joinedSchools,
        buffer_school: isSelectedSchoolBuffer ? firstSelectedSchool : null,
        request_type: requestType,
        date: dateOfRequest,
        requested_by: requestedBy.trim(),
        ticket_no: ticketNumber.trim() || null,
        po_number: poNumber.trim() || null,
        status: initialData?.status || 'Pending',
        purpose: purpose.trim(),
        program: program,
        remarks: remarks.trim(),
        attachment: attachment_url,
        updated_by: currentUser,
        updated_at: now,
        school_monitoring_id: schoolMonitoringId
      };

      console.log("Submitting payload to item_requests:", payload);

      let requestControlNo = '';

      if (initialData) {
        const { data: updatedRequest, error: updateError } = await supabase
          .from('item_requests')
          .update(payload)
          .eq('control_no', initialData.id)
          .select()
          .single();
          
        if (updateError) {
          console.error("Update Request Error:", updateError);
          throw updateError;
        }
        
        requestControlNo = updatedRequest.control_no;
        console.log("Request updated successfully:", updatedRequest);
      } else {
        const { data: newRequest, error: insertError } = await supabase
          .from('item_requests')
          .insert([payload])
          .select()
          .single();
          
        if (insertError) {
          console.error("Insert Request Error:", insertError);
          throw insertError;
        }
        
        requestControlNo = newRequest.control_no;
        console.log("Request created successfully:", newRequest);
      }

      // --- SAFETY VALIDATION ---
      if (!requestControlNo) {
        throw new Error("Invalid control number. Cannot save items.");
      }

      // --- HANDLE ITEMS ---
      console.log("Deleting existing items for:", requestControlNo);
      const { error: deleteError } = await supabase
        .from('request_items')
        .delete()
        .eq('request_control_no', requestControlNo);
      
      if (deleteError) {
        console.error("Delete Items Error:", deleteError);
        throw deleteError;
      }
      
      if (requestedItems.length > 0) {
        const itemsPayload = requestedItems.map(item => {
          const base: any = {
            request_control_no: requestControlNo,
            qty: parseInt(item.qty) || 0,
            uom: item.uom,
            item: item.item,
            item_code: item.item_code,
            is_serialized: item.is_serialized || false,
            bundle_name: item.bundle_name || null
          };

          // If it's an existing item (has a numeric ID), preserve its metadata
          // This ensures we don't wipe out delivery status or serials during an edit
          if (typeof item.id === 'number') {
            const existingItem = item as any;
            if (existingItem.status) base.status = existingItem.status;
            if (existingItem.received_quantity !== undefined) base.received_quantity = existingItem.received_quantity;
            if (existingItem.serials) base.serials = existingItem.serials;
          }

          return base;
        });
        
        console.log("Items to insert (with preserved metadata):", itemsPayload);
        
        const { data: insertedItems, error: itemsInsertError } = await supabase
          .from('request_items')
          .insert(itemsPayload)
          .select();
          
        if (itemsInsertError) {
          console.error("Insert Items Error:", itemsInsertError);
          throw itemsInsertError;
        }
        
        console.log("Items saved successfully:", insertedItems);
      }

      showSuccess('Success', initialData ? 'Requisition updated successfully' : 'Requisition created and synced successfully');
      if (onSubmit) onSubmit(requestControlNo);
      
      setTimeout(() => {
        onClose();
      }, 500);

    } catch (err: any) {
      console.error('Submission Error:', err);
      showError('Error', err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstSelectedSchool = selectedSchools[0] || '';
  const selectedSchoolData = schools.find(s => s.name === firstSelectedSchool);
  const isSelectedSchoolBuffer = selectedSchoolData?.is_buffer === true || String(selectedSchoolData?.is_buffer) === 'true';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      
      {pendingBundle && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => setPendingBundle(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-[400px] rounded-2xl shadow-2xl border p-6 animate-in zoom-in-95 duration-200" style={{ borderColor: 'var(--brand-accent)' }}>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Enter Multiplier for {pendingBundle}</h3>
            <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-800 mb-4"></div>
            
            <div className="space-y-1.5 mb-6">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Multiplier (e.g., 2 sets)</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={bundleQuantity || ''}
                onChange={(e) => setBundleQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-white outline-none transition-all shadow-sm focus:ring-2"
                style={{ 
                  '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                } as any}
                onFocus={(e) => e.target.style.borderColor = 'var(--brand-accent)'}
                onBlur={(e) => e.target.style.borderColor = ''}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPendingBundle(null)}
                className="px-4 py-2 text-slate-400 font-medium uppercase tracking-wider hover:text-slate-600 transition-all text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={confirmApplyBundle}
                className="px-8 py-2.5 text-white rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-all uppercase tracking-wider"
                style={{ 
                  backgroundColor: 'var(--brand-accent)',
                  boxShadow: '0 10px 20px -5px color-mix(in srgb, var(--brand-accent), transparent 70%)'
                }}
              >
                Apply Bundle
              </button>
            </div>
          </div>
        </div>
      )}



      <div className="relative bg-white dark:bg-slate-900 w-full max-w-[850px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white font-poppins tracking-tight">
            {toTitleCase(initialData ? 'Edit Item Request' : 'Add Item Request')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500">
            <X size={20} sm:size={24} />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-4">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-red-800 font-bold uppercase text-[10px] tracking-wider mb-0.5">Upload Error</h4>
                <p className="text-red-600 text-xs font-medium leading-relaxed whitespace-pre-line">{errorMessage}</p>
              </div>
            </div>
          )}

          <div 
            className="flex flex-col items-center gap-3 p-4 sm:p-5 rounded-xl border transition-all"
            style={{ 
              backgroundColor: `color-mix(in srgb, var(--brand-accent), transparent ${isDarkMode ? '90%' : '95%'})`,
              borderColor: `color-mix(in srgb, var(--brand-accent), transparent 80%)`
            }}
          >
            <label 
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: `color-mix(in srgb, var(--brand-accent), transparent 40%)` }}
            >
              {toTitleCase("Pick Request Type *")}
            </label>
            <div className="flex flex-row items-center justify-center gap-6 sm:gap-10">
              <button 
                type="button"
                onClick={() => setRequestType('ARALINKS')}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div 
                  className={`w-4 h-4 sm:w-5 sm:h-5 border-2 flex items-center justify-center transition-all ${requestType === 'ARALINKS' ? 'text-white' : 'bg-white dark:bg-slate-800 text-transparent'}`}
                  style={{ 
                    borderColor: 'var(--brand-accent)',
                    backgroundColor: requestType === 'ARALINKS' ? 'var(--brand-accent)' : undefined
                  }}
                >
                  <span className="font-bold text-[10px] sm:text-xs leading-none">X</span>
                </div>
                <span 
                  className="text-xs sm:text-sm font-medium uppercase tracking-wider transition-all"
                  style={{ color: requestType === 'ARALINKS' ? 'var(--brand-accent)' : undefined }}
                >
                  ARALINKS
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setRequestType('SMS-PROTRACK')}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div 
                  className={`w-4 h-4 sm:w-5 sm:h-5 border-2 flex items-center justify-center transition-all ${requestType === 'SMS-PROTRACK' ? 'text-white' : 'bg-white dark:bg-slate-800 text-transparent'}`}
                  style={{ 
                    borderColor: 'var(--brand-accent)',
                    backgroundColor: requestType === 'SMS-PROTRACK' ? 'var(--brand-accent)' : undefined
                  }}
                >
                  <span className="font-bold text-[10px] sm:text-xs leading-none">X</span>
                </div>
                <span 
                  className="text-xs sm:text-sm font-medium uppercase tracking-wider transition-all"
                  style={{ color: requestType === 'SMS-PROTRACK' ? 'var(--brand-accent)' : undefined }}
                >
                  SMS-PROTRACK
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Requested By")} <span style={{ color: 'var(--brand-accent)' }}>*</span></label>
              <div className="relative" ref={reqDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownDirection(window.innerHeight - rect.bottom < 250 ? 'up' : 'down');
                    setIsReqDropdownOpen(!isReqDropdownOpen);
                  }}
                  className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm text-left focus:outline-none transition-all shadow-sm font-medium flex items-center justify-between group"
                  style={{ 
                    borderColor: isReqDropdownOpen ? 'var(--brand-accent)' : undefined,
                    boxShadow: isReqDropdownOpen ? '0 0 0 2px color-mix(in srgb, var(--brand-accent), transparent 80%)' : undefined
                  }}
                >
                  <span className={requestedBy === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}>
                    {requestedBy || 'Select Requester'}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isReqDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isReqDropdownOpen ? 'var(--brand-accent)' : undefined }} />
                </button>

                {isReqDropdownOpen && (
                  <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200`}>
                    <div className="max-h-[200px] overflow-y-auto py-2">
                      {userAccounts.length > 0 ? (
                        userAccounts.map((name, i) => (
                          <div
                            key={`${name}-${i}`}
                            onClick={() => { setRequestedBy(name); setIsReqDropdownOpen(false); }}
                            className="px-4 py-3 flex items-center justify-between group cursor-pointer transition-colors"
                            style={{
                              backgroundColor: requestedBy === name 
                                ? `color-mix(in srgb, var(--brand-accent), transparent ${isDarkMode ? '80%' : '90%'})`
                                : undefined,
                              color: requestedBy === name ? 'var(--brand-accent)' : undefined
                            }}
                            onMouseEnter={(e) => {
                              if (requestedBy !== name) {
                                e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--brand-accent), transparent ${isDarkMode ? '90%' : '95%'})`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (requestedBy !== name) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            <span className="text-[14px] font-bold">{name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-5 py-4 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                          {isLoadingUsers ? 'Syncing users...' : 'No users found.'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("School Name")} <span style={{ color: 'var(--brand-accent)' }}>*</span></label>
              <div className="relative" ref={dropdownRef}>
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownDirection(window.innerHeight - rect.bottom < 300 ? 'up' : 'down');
                    setIsDropdownOpen(!isDropdownOpen);
                  }}
                  className="w-full min-h-10 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm transition-all shadow-sm font-medium flex flex-wrap gap-2 items-center cursor-pointer group"
                  style={{
                    borderColor: isDropdownOpen ? 'var(--brand-accent)' : undefined,
                    boxShadow: isDropdownOpen ? '0 0 0 2px color-mix(in srgb, var(--brand-accent), transparent 80%)' : undefined
                  }}
                >
                  {selectedSchools.length > 0 ? (
                    selectedSchools.map(school => (
                      <div 
                        key={school}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold border transition-all"
                        style={{
                          backgroundColor: `color-mix(in srgb, var(--brand-accent), transparent 95%)`,
                          color: 'var(--brand-accent)',
                          borderColor: `color-mix(in srgb, var(--brand-accent), transparent 80%)`
                        }}
                      >
                        {school}
                        <X 
                          size={12} 
                          className="cursor-pointer hover:scale-110" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSchoolToggle(school);
                          }}
                        />
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">Select School(s)</span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {selectedSchools.length > 0 && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSchools([]);
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest mr-2"
                      >
                        Clear
                      </button>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDropdownOpen ? 'var(--brand-accent)' : undefined }} />
                  </div>
                </div>

                {isDropdownOpen && (
                  <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200`}>
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text"
                          placeholder="Search schools..."
                          value={schoolSearchText}
                          onChange={(e) => setSchoolSearchText(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg outline-none focus:border-brand transition-all"
                        />
                      </div>
                    </div>
                    <div className="max-h-[200px] md:max-h-[260px] overflow-y-auto py-2">
                      {schools.filter(s => s.name.toLowerCase().includes(schoolSearchText.toLowerCase())).length > 0 ? (
                        schools.filter(s => s.name.toLowerCase().includes(schoolSearchText.toLowerCase())).map((school, i) => {
                          const isBufferActual = school.is_buffer === true || String(school.is_buffer) === 'true';
                          const isSelected = selectedSchools.includes(school.name);
                          return (
                            <div
                              key={`${school.name}-${i}`}
                              onClick={(e) => { 
                                e.stopPropagation();
                                handleSchoolToggle(school.name);
                              }}
                              className="px-4 md:px-5 py-2.5 flex items-center justify-between group cursor-pointer transition-colors"
                              style={{
                                backgroundColor: isSelected 
                                  ? `color-mix(in srgb, var(--brand-accent), transparent 90%)` 
                                  : undefined
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--brand-accent), transparent 95%)`;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'text-white' : 'border-slate-300 dark:border-slate-600'}`}
                                  style={{
                                    backgroundColor: isSelected ? 'var(--brand-accent)' : 'transparent',
                                    borderColor: isSelected ? 'var(--brand-accent)' : undefined
                                  }}
                                >
                                  {isSelected && <Check size={12} strokeWidth={4} />}
                                </div>
                                <div className="flex flex-col">
                                  <span 
                                    className="text-xs md:text-[13px] font-bold"
                                    style={{
                                      color: isSelected 
                                        ? 'var(--brand-accent)' 
                                        : undefined
                                    }}
                                  >
                                    {school.name}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-x-2">
                                    {school.customer_code && (
                                      <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 opacity-70 uppercase tracking-tight">
                                        Code: {school.customer_code}
                                      </span>
                                    )}
                                    {school.school_monitoring_id && (
                                      <span className="text-[9px] font-mono text-brand-orange dark:text-orange-400 font-bold uppercase tracking-tight">
                                        ID: {school.school_monitoring_id}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isBufferActual && (
                                <div 
                                  className="flex items-center gap-1.5 px-2 py-0.5 text-[7px] md:text-[8px] font-bold rounded-full uppercase tracking-wider border"
                                  style={{
                                    backgroundColor: `color-mix(in srgb, var(--brand-accent), transparent 95%)`,
                                    color: 'var(--brand-accent)',
                                    borderColor: `color-mix(in srgb, var(--brand-accent), transparent 90%)`
                                  }}
                                >
                                  <Zap size={8} fill="currentColor" /> Buffer
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-5 py-4 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                          No schools found.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Purpose of request")} <span style={{ color: 'var(--brand-accent)' }}>*</span></label>
              <input 
                type="text" 
                placeholder="Reason for requisition..."
                value={purpose || ''} 
                onChange={(e) => setPurpose(e.target.value)} 
                required
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none transition-all shadow-sm font-medium focus:ring-2" 
                style={{ 
                  '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                } as any}
                onFocus={(e) => e.target.style.borderColor = 'var(--brand-accent)'}
                onBlur={(e) => e.target.style.borderColor = ''}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Control No.")} <span style={{ color: 'var(--brand-accent)' }}>*</span></label>
              <input 
                type="text" 
                placeholder={`ARAL-${new Date().getFullYear()}-0001`}
                value={controlNo || ''} 
                onChange={(e) => {
                  const value = e.target.value;
                  const currentYear = new Date().getFullYear();
                  const expectedPrefix = `ARAL-${currentYear}-`;
                  
                  if (value.startsWith(expectedPrefix)) {
                    setControlNo(value);
                  } else if (!value.startsWith('ARAL-' + currentYear)) {
                    // If they try to change the year or the "ARAL-" part, 
                    // we snap it back or fetch the next one to keep it real-time.
                    if (value.trim() === '') {
                      fetchNextControlNo();
                    } else if (value.startsWith('ARAL-')) {
                      // Preserve the sequence number if possible
                      const suffix = value.split('-').pop() || '';
                      setControlNo(`${expectedPrefix}${suffix}`);
                    } else {
                      fetchNextControlNo();
                    }
                  } else {
                    setControlNo(value);
                  }
                }} 
                required
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none transition-all disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-500 shadow-sm font-medium tracking-normal focus:ring-2" 
                disabled={!!initialData} 
                style={{ 
                  '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                } as any}
                onFocus={(e) => e.target.style.borderColor = 'var(--brand-accent)'}
                onBlur={(e) => e.target.style.borderColor = ''}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Date of Request")} <span style={{ color: 'var(--brand-accent)' }}>*</span></label>
                <div className="relative group">
                  <input 
                    type="date" 
                    value={dateOfRequest || ''} 
                    onChange={(e) => setDateOfRequest(e.target.value)} 
                    required
                    className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none transition-all shadow-sm font-medium focus:ring-2" 
                    style={{ 
                      '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                    } as any}
                    onFocus={(e) => e.target.style.borderColor = 'var(--brand-accent)'}
                    onBlur={(e) => e.target.style.borderColor = ''}
                  />
                </div>
              </div>
            </div>

            {/* PO Number is hidden as per request */}
            {/* 
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("PO Number")}</label>
              <input 
                type="text" 
                placeholder="Optional PO reference"
                value={poNumber || ''} 
                onChange={(e) => setPoNumber(e.target.value)} 
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none transition-all shadow-sm font-medium focus:ring-2" 
                style={{ 
                  '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                } as any}
                onFocus={(e) => e.target.style.borderColor = 'var(--brand-accent)'}
                onBlur={(e) => e.target.style.borderColor = ''}
              />
            </div>
            */}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Program")} <span style={{ color: 'var(--brand-accent)' }}>*</span></label>
                  <div className="relative" ref={programDropdownRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setDropdownDirection(window.innerHeight - rect.bottom < 250 ? 'up' : 'down');
                        setIsProgramDropdownOpen(!isProgramDropdownOpen);
                      }}
                      className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm text-left focus:outline-none transition-all shadow-sm font-medium flex items-center justify-between group"
                      style={{
                        borderColor: isProgramDropdownOpen ? 'var(--brand-accent)' : undefined,
                        boxShadow: isProgramDropdownOpen ? '0 0 0 2px color-mix(in srgb, var(--brand-accent), transparent 80%)' : undefined
                      }}
                    >
                      <span className={program === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}>
                        {program || 'Select a Program'}
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isProgramDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isProgramDropdownOpen ? 'var(--brand-accent)' : undefined }} />
                    </button>

                    {isProgramDropdownOpen && (
                      <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} border rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                      }`}>
                        <div className="max-h-[200px] overflow-y-auto py-2">
                          {['NGS', 'HUB', 'TNL', 'ACE', 'NGS+ACE', 'HUB+ACE', 'PELS NGS', 'PELS NGS+ACE', 'ACE+PELS', 'ABDL', 'ACE+ABDL', 'HUB+NGS', 'ABDL (PELS)'].map((prog) => (
                              <div
                                key={prog}
                                onClick={() => {
                                  setProgram(prog);
                                  setSelectedBundleDropdown('');
                                  setIsProgramDropdownOpen(false);
                                }}
                                className="px-4 md:px-5 py-3 text-xs md:text-sm font-bold cursor-pointer transition-colors"
                                style={{
                                  backgroundColor: program === prog
                                    ? `color-mix(in srgb, var(--brand-accent), transparent ${isDarkMode ? '80%' : '90%'})`
                                    : undefined,
                                  color: program === prog ? (isDarkMode ? '#ffffff' : 'var(--brand-accent)') : undefined
                                }}
                                onMouseEnter={(e) => {
                                  if (program !== prog) {
                                    e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--brand-accent), transparent 95%)`;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (program !== prog) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }
                                }}
                              >
                                {prog}
                              </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Ticket Number")}</label>
                  <input 
                    type="text" 
                    placeholder="Optional ticket reference"
                    value={ticketNumber || ''} 
                    onChange={(e) => setTicketNumber(e.target.value)} 
                    className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none transition-all shadow-sm font-medium focus:ring-2" 
                    style={{ 
                      '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                    } as any}
                    onFocus={(e) => e.target.style.borderColor = 'var(--brand-accent)'}
                    onBlur={(e) => e.target.style.borderColor = ''}
                  />
                </div>
              </div>

              {schoolMonitoringBundles.length > 0 && (
                <div className="mt-4 p-4 border rounded-xl bg-slate-50/50 dark:bg-black/10 animate-in fade-in duration-300" style={{ borderColor: 'var(--brand-accent)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={14} style={{ color: 'var(--brand-accent)' }} />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bundles from School Monitoring ({schoolMonitoringBundles.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {schoolMonitoringBundles.map((b) => {
                      const isAlreadyRequested = requestedBundlesForSchool.some(rb => rb.trim().toLowerCase() === b.name.trim().toLowerCase());
                      const isCurrentlyAdded = requestedItems.some(ri => ri.bundle_name && ri.bundle_name.trim().toLowerCase() === b.name.trim().toLowerCase());
                      const isNotClickable = isAlreadyRequested || isCurrentlyAdded;

                      return (
                        <div 
                          key={b.name}
                          className={`p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                            isNotClickable 
                              ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#FE4E02]'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <p className={`text-xs font-bold leading-tight ${isNotClickable ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-white'}`}>
                                {b.name}
                              </p>
                            </div>
                            
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                              Contains {b.items.length} items from school monitoring.
                            </p>
                            
                            <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto pr-1">
                              {b.items.map((item: any) => (
                                <div key={item.item_code} className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 gap-2">
                                  <span className="truncate">• {item.item_name || item.item_code}</span>
                                  <span className="font-bold shrink-0">Qty: {item.quantity || 1}</span>
                                </div>
                              ))}
                            </div>

                            {isNotClickable && (
                              <span className="inline-block mt-3 px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 uppercase tracking-wider">
                                {isAlreadyRequested ? 'Already Requested' : 'Added to Request'}
                              </span>
                            )}
                          </div>
                          
                          <button
                            type="button"
                            disabled={isNotClickable}
                            onClick={() => {
                              handleApplyMonitoringBundleDirect(b.name, b.items);
                            }}
                            className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              isNotClickable
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-transparent border active:scale-95'
                            }`}
                            style={!isNotClickable ? {
                              color: 'var(--brand-accent)',
                              borderColor: 'var(--brand-accent)'
                            } : {}}
                            onMouseEnter={(e) => {
                              if (!isNotClickable) {
                                e.currentTarget.style.backgroundColor = 'var(--brand-accent)';
                                e.currentTarget.style.color = '#ffffff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isNotClickable) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--brand-accent)';
                              }
                            }}
                          >
                            {isAlreadyRequested ? 'Already Requested' : isCurrentlyAdded ? 'Added to Request' : 'Populate Bundle'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {program && availableBundles.length > 0 && (
                <div className="mt-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-black/10 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={14} style={{ color: 'var(--brand-accent)' }} />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Available Hardware Bundles ({availableBundles.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableBundles.map((bundle) => {
                      const isAlreadyRequested = requestedBundlesForSchool.some(rb => rb.trim().toLowerCase() === bundle.trim().toLowerCase());
                      const isCurrentlyAdded = requestedItems.some(ri => ri.bundle_name && ri.bundle_name.trim().toLowerCase() === bundle.trim().toLowerCase());
                      const isNotClickable = isAlreadyRequested || isCurrentlyAdded;
                      return (
                        <div 
                          key={bundle}
                          className={`p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                            isNotClickable 
                              ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#FE4E02]'
                          }`}
                        >
                          <div>
                            <p className={`text-xs font-bold leading-tight ${isNotClickable ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-white'}`}>
                              {bundle}
                            </p>
                            {isNotClickable && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 uppercase tracking-wider">
                                {isAlreadyRequested ? 'Already Requested' : 'Added to Request'}
                              </span>
                            )}
                          </div>
                          
                          <button
                            type="button"
                            disabled={isNotClickable}
                            onClick={() => {
                              setSelectedBundleDropdown(bundle);
                              handleApplyBundle(bundle);
                            }}
                            className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              isNotClickable
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-transparent border active:scale-95'
                            }`}
                            style={!isNotClickable ? {
                              color: 'var(--brand-accent)',
                              borderColor: 'var(--brand-accent)'
                            } : {}}
                            onMouseEnter={(e) => {
                              if (!isNotClickable) {
                                e.currentTarget.style.backgroundColor = 'var(--brand-accent)';
                                e.currentTarget.style.color = '#ffffff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isNotClickable) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--brand-accent)';
                              }
                            }}
                          >
                            {isAlreadyRequested ? 'Already Requested' : isCurrentlyAdded ? 'Added to Request' : 'Populate Bundle'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{toTitleCase("Remarks / Additional Notes")}</label>
                <div className="relative group">
                  <textarea 
                    placeholder="Any special instructions or comments... (Optional)"
                    value={remarks || ''} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-white outline-none transition-all shadow-sm font-medium resize-none h-20 focus:ring-2" 
                    style={{ 
                      '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                    } as any}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--brand-accent)';
                      const icon = e.currentTarget.nextElementSibling;
                      if (icon) (icon as HTMLElement).style.color = 'var(--brand-accent)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '';
                      const icon = e.currentTarget.nextElementSibling;
                      if (icon) (icon as HTMLElement).style.color = '';
                    }}
                  />
                  <Notebook 
                    className="absolute right-3 top-3 text-slate-300 dark:text-slate-600 transition-colors pointer-events-none" 
                    size={16} 
                  />
                </div>
              </div>
            </div>





            <div className="sm:col-span-2 pt-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Supporting Documents</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upload Button / Drop Zone */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="relative group h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-slate-400"
                  style={{
                    borderColor: isDragging ? 'var(--brand-accent)' : 'rgb(226, 232, 240)',
                    backgroundColor: isDragging ? `color-mix(in srgb, var(--brand-accent), transparent 90%)` : 'transparent',
                    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isDragging ? `0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 90%)` : undefined,
                    color: isDragging ? 'var(--brand-accent)' : undefined
                  }}
                  onMouseEnter={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.borderColor = 'var(--brand-accent)';
                      e.currentTarget.style.color = 'var(--brand-accent)';
                      e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--brand-accent), transparent 95%)`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.borderColor = 'rgb(226, 232, 240)';
                      e.currentTarget.style.color = '';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    multiple
                  />
                  <div 
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: isDragging ? 'var(--brand-accent)' : `color-mix(in srgb, var(--brand-accent), transparent 95%)`,
                      color: isDragging ? '#ffffff' : 'var(--brand-accent)'
                    }}
                  >
                    {isDragging ? <Upload size={20} className="animate-bounce" /> : <Paperclip size={20} className="group-hover:scale-110 transition-transform" />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDragging ? 'animate-pulse' : ''}`}>
                    {isDragging ? 'Drop to Attach' : 'Attach / Drag Documents'}
                  </span>
                </div>

                {/* Previews / Status */}
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div key={`selected-${idx}`} className="p-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-center justify-between animate-in slide-in-from-right-4">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-1.5 bg-emerald-500 text-white rounded-lg shrink-0">
                          <Check size={14} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tighter truncate leading-none mb-1">{file.name}</p>
                          <p className="text-[9px] font-medium text-emerald-600/70 dark:text-emerald-400/50 uppercase tracking-widest leading-none">Ready to Upload</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeSelectedFile(idx); }} className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg text-emerald-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {existingAttachments.map((url, idx) => (
                    <div 
                      key={`existing-${idx}`} 
                      className="p-2 border rounded-xl flex items-center justify-between group"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--brand-accent), transparent 90%)`,
                        borderColor: `color-mix(in srgb, var(--brand-accent), transparent 80%)`
                      }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div 
                          className="p-1.5 text-white rounded-lg shrink-0"
                          style={{ backgroundColor: 'var(--brand-accent)' }}
                        >
                          <FileText size={14} />
                        </div>
                        <div className="overflow-hidden">
                          <p 
                            className="text-[10px] font-black uppercase tracking-tighter truncate leading-none mb-1"
                            style={{ color: 'var(--brand-accent)' }}
                          >
                            Document {idx + 1}
                          </p>
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[9px] font-bold text-slate-500 underline uppercase tracking-widest transition-colors"
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-accent)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          >
                            View Document
                          </a>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeExistingAttachment(idx)} 
                        className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        style={{ color: 'var(--brand-accent)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--brand-accent), transparent 90%)`}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {selectedFiles.length === 0 && existingAttachments.length === 0 && (
                    <div className="h-24 flex items-center justify-center border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-black/20">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">No documents attached</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{toTitleCase("Items List")} <span style={{ color: 'var(--brand-accent)' }}>*</span></h3>
              {(() => {
                const isAddItemDisabled = !program || requestedItems.some(ri => !!ri.bundle_name);
                return (
                  <button 
                    onClick={handleAddItem} 
                    disabled={isAddItemDisabled}
                    className="w-full sm:w-auto px-4 py-2 border rounded-lg font-medium text-xs transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider disabled:border-slate-200 dark:disabled:border-slate-800 disabled:text-slate-300 dark:disabled:text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900/50"
                    style={{
                      borderColor: !isAddItemDisabled ? 'var(--brand-accent)' : undefined,
                      color: !isAddItemDisabled ? 'var(--brand-accent)' : undefined
                    }}
                    onMouseEnter={(e) => {
                      if (!isAddItemDisabled) {
                        e.currentTarget.style.backgroundColor = 'var(--brand-accent)';
                        e.currentTarget.style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAddItemDisabled) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--brand-accent)';
                      }
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Item Line</span>
                  </button>
                );
              })()}
            </div>

            <div className="space-y-4 pb-40">
              {requestedItems.map((item) => {
                const isQtyValid = (parseInt(item.qty) || 0) > 0;
                const isUomValid = item.uom.trim() !== '';
                const isItemValidDesc = item.item.trim() !== '';
                
                const showQtyError = hasAttemptedSubmit && !isQtyValid;
                const showUomError = hasAttemptedSubmit && !isUomValid;
                const showItemError = hasAttemptedSubmit && !isItemValidDesc;

                return (
                  <div 
                    key={item.id} 
                    id={`item-row-${item.id}`}
                    className={`flex flex-col sm:flex-row items-stretch sm:items-end gap-4 p-3 border rounded-xl group animate-in slide-in-from-left-4 duration-300 transition-all relative
                    ${(showQtyError || showUomError || showItemError)
                      ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' 
                      : item.bundle_name
                        ? '' // Style applied below
                        : 'bg-white dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'}
                  `}
                  style={! (showQtyError || showUomError || showItemError) && item.bundle_name ? {
                    borderColor: getBundleColor(item.bundle_name)?.bg + '40',
                    backgroundColor: isDarkMode ? getBundleColor(item.bundle_name)?.bg + '10' : getBundleColor(item.bundle_name)?.lightBg,
                  } : {}}>
                    <div className="flex gap-4">
                      {item.bundle_name && (
                        <div className="absolute -top-3 left-3 z-[10]">
                          <div 
                            className="px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest shadow-sm border"
                            style={{
                              backgroundColor: getBundleColor(item.bundle_name)?.bg || 'var(--brand-accent)',
                              color: getBundleColor(item.bundle_name)?.text || '#ffffff',
                              borderColor: getBundleColor(item.bundle_name)?.border || 'rgba(0,0,0,0.1)'
                            }}
                          >
                            {item.bundle_name}
                          </div>
                        </div>
                      )}
                      <div className="flex-1 sm:flex-none space-y-1.5">
                        <label className={`text-[10px] font-medium uppercase px-1 tracking-wider ${showQtyError ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                          {toTitleCase("Qty")}
                        </label>
                        <input 
                          type="text" 
                          placeholder="0" 
                          value={item.qty || ''} 
                          inputMode="numeric"
                          onChange={(e) => handleItemUpdate(item.id, 'qty', e.target.value)} 
                          className={`w-full sm:w-16 h-9 px-2 border rounded-lg text-sm bg-white dark:bg-slate-800 outline-none shadow-sm font-medium text-center text-slate-700 dark:text-white transition-all focus:ring-2 ${
                            showQtyError ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-500/10' : 'border-slate-300 dark:border-slate-700'
                          }`} 
                          style={{ 
                            '--tw-ring-color': showQtyError ? undefined : 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
                          } as any}
                          onFocus={(e) => {
                            if (!showQtyError) e.target.style.borderColor = 'var(--brand-accent)';
                          }}
                          onBlur={(e) => {
                            if (!showQtyError) e.target.style.borderColor = '';
                          }}
                        />
                        {showQtyError && <p className="text-[8px] font-medium text-red-500 uppercase tracking-tighter px-1">Required</p>}
                      </div>
                      <div className="flex-1 sm:flex-none space-y-1.5">
                        <label className={`text-[10px] font-medium uppercase px-1 tracking-wider ${showUomError ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {toTitleCase("Uom *")}
                        </label>
                        <div className="relative" ref={el => uomDropdownRefs.current[item.id] = el}>
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDropdownDirection(window.innerHeight - rect.bottom < 200 ? 'up' : 'down');
                              setOpenUomDropdownId(openUomDropdownId === item.id ? null : item.id);
                              setOpenItemDropdownId(null);
                            }}
                            className={`w-full sm:w-24 h-9 px-3 border rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none shadow-sm font-medium transition-all text-left flex items-center justify-between ${
                              showUomError ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-500/10' : 'border-slate-300 dark:border-slate-700'
                            } ${openUomDropdownId === item.id ? 'ring-2' : ''}`}
                            style={{
                              borderColor: openUomDropdownId === item.id ? 'var(--brand-accent)' : undefined,
                              '--tw-ring-color': openUomDropdownId === item.id ? 'color-mix(in srgb, var(--brand-accent), transparent 80%)' : undefined
                            } as any}
                          >
                            <span className={item.uom === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}>
                              {item.uom || 'UOM'}
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openUomDropdownId === item.id ? 'rotate-180' : ''}`} style={{ color: openUomDropdownId === item.id ? 'var(--brand-accent)' : undefined }} />
                          </button>

                          {openUomDropdownId === item.id && (
                            <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} border rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${
                              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                            }`}>
                              <div className="max-h-[150px] overflow-y-auto py-1">
                                {['SET', 'PC/S', 'KIT', 'LOT', 'BOX/ES'].map((uom) => (
                                  <div
                                    key={uom}
                                    onClick={() => { handleItemUpdate(item.id, 'uom', uom); setOpenUomDropdownId(null); }}
                                    className="px-4 py-2 text-xs font-bold cursor-pointer transition-colors"
                                    style={{
                                      backgroundColor: item.uom === uom
                                        ? `color-mix(in srgb, var(--brand-accent), transparent ${isDarkMode ? '80%' : '90%'})`
                                        : undefined,
                                      color: item.uom === uom ? (isDarkMode ? '#ffffff' : 'var(--brand-accent)') : undefined
                                    }}
                                    onMouseEnter={(e) => {
                                      if (item.uom !== uom) {
                                        e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--brand-accent), transparent 95%)`;
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (item.uom !== uom) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                      }
                                    }}
                                  >
                                    {uom}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {showUomError && <p className="text-[8px] font-medium text-red-500 uppercase tracking-tighter px-1">Required</p>}
                      </div>
                    </div>
                    <div className="flex-grow space-y-1.5 sm:ml-4">
                      <div className="flex items-center justify-between px-1">
                        <label className={`text-[10px] font-medium uppercase tracking-wider ${showItemError ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                          {toTitleCase("Item Description")}
                        </label>
                        {item.bundle_name && (
                          <div 
                            className="flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-tighter"
                            style={{
                              backgroundColor: `color-mix(in srgb, var(--brand-accent), transparent 90%)`,
                              color: 'var(--brand-accent)',
                              borderColor: `color-mix(in srgb, var(--brand-accent), transparent 80%)`
                            }}
                          >
                            <Box size={8} /> {item.bundle_name}
                          </div>
                        )}
                      </div>
                      <div className="relative" ref={el => itemDropdownRefs.current[item.id] = el}>
                        <button
                          type="button"
                          disabled={isLoadingEquip}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownDirection(window.innerHeight - rect.bottom < 250 ? 'up' : 'down');
                            setOpenItemDropdownId(openItemDropdownId === item.id ? null : item.id);
                            setOpenUomDropdownId(null);
                          }}
                          className={`w-full h-9 px-3 border rounded-lg text-sm bg-white dark:bg-slate-800 focus:outline-none shadow-sm font-medium transition-all text-left flex items-center justify-between ${
                            showItemError ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-500/10' : 'border-slate-300 dark:border-slate-700'
                          } ${openItemDropdownId === item.id ? 'ring-2' : ''} ${isLoadingEquip ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={{
                              borderColor: openItemDropdownId === item.id ? 'var(--brand-accent)' : undefined,
                              '--tw-ring-color': openItemDropdownId === item.id ? 'color-mix(in srgb, var(--brand-accent), transparent 80%)' : undefined
                            } as any}
                        >
                          <span className={`truncate ${item.item === '' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white font-medium'}`}>
                            {isLoadingEquip ? 'Loading Catalog...' : item.item || 'Select Equipment'}
                          </span>
                          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openItemDropdownId === item.id ? 'rotate-180' : ''}`} style={{ color: openItemDropdownId === item.id ? 'var(--brand-accent)' : undefined }} />
                        </button>

                        {openItemDropdownId === item.id && (
                          <div className={`absolute z-[130] left-0 right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'} border rounded-xl shadow-xl overflow-hidden animate-in fade-in ${dropdownDirection === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200 ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'
                          }`}>
                            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                              <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Search by code or description..."
                                  value={itemSearchText[item.id] || ''}
                                  onChange={(e) => setItemSearchText({ ...itemSearchText, [item.id]: e.target.value })}
                                  className={`w-full pl-9 pr-4 py-2 text-xs font-bold rounded-lg outline-none transition-all ${
                                    isDarkMode ? 'bg-slate-900 focus:bg-slate-950 text-white' : 'bg-slate-50 focus:bg-white text-slate-700'
                                  } border border-transparent focus:border-[#FE4E02]`}
                                />
                              </div>
                            </div>
                            <div className="max-h-[220px] overflow-y-auto py-2">
                              {(() => {
                                const q = (itemSearchText[item.id] || '').toLowerCase();
                                const filteredEquip = equipmentList.filter(e => 
                                  e.item_code.toLowerCase().includes(q) || 
                                  e.description.toLowerCase().includes(q)
                                );

                                if (filteredEquip.length === 0) {
                                  return (
                                    <div className="px-4 py-8 text-center">
                                      <Box size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600 opacity-50" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Items Found</p>
                                    </div>
                                  );
                                }

                                // Sort filtered equipment: Relevant item codes first, then alphabetical
                                const sortedEquip = [...filteredEquip].sort((a, b) => {
                                  const aRelevant = relevantItemCodes.has(a.item_code);
                                  const bRelevant = relevantItemCodes.has(b.item_code);
                                  
                                  if (aRelevant && !bRelevant) return -1;
                                  if (!aRelevant && bRelevant) return 1;
                                  return a.description.localeCompare(b.description);
                                });

                                const filteredBundles = availableBundles.filter(b => 
                                  b.toLowerCase().includes(q) &&
                                  !requestedBundlesForSchool.some(rb => rb.trim().toLowerCase() === b.trim().toLowerCase()) &&
                                  !requestedItems.some(ri => ri.bundle_name && ri.bundle_name.trim().toLowerCase() === b.trim().toLowerCase())
                                );

                                return (
                                  <>
                                    {filteredBundles.map((bundleName) => (
                                      <div
                                        key={`bundle-${bundleName}`}
                                        onClick={() => { 
                                          handleApplyBundle(bundleName);
                                          setOpenItemDropdownId(null);
                                          setItemSearchText({ ...itemSearchText, [item.id]: '' });
                                          // Remove the current empty line if it was just added
                                          if (!item.item && !item.item_code) {
                                            handleRemoveItem(item.id as string);
                                          }
                                        }}
                                        className="px-4 py-2.5 flex items-start gap-3 group cursor-pointer transition-colors"
                                        style={{ backgroundColor: `color-mix(in srgb, var(--brand-accent), transparent 95%)` }}
                                      >
                                        <div className="shrink-0 mt-0.5">
                                          <Layers size={14} className="text-blue-500" />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                          <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full uppercase border border-blue-200 dark:border-blue-500/30">
                                              Bundle Package
                                            </span>
                                          </div>
                                          <p className="text-xs font-bold leading-tight">
                                            {bundleName}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                    
                                    {sortedEquip.map((equip, i) => (
                                      <div
                                        key={`${equip.item_code}-${i}`}
                                        onClick={() => { 
                                          handleItemUpdate(item.id, 'item', equip.description); 
                                          setOpenItemDropdownId(null);
                                          setItemSearchText({ ...itemSearchText, [item.id]: '' });
                                        }}
                                        className="px-4 py-2.5 flex items-start gap-3 group cursor-pointer transition-colors"
                                        style={{
                                          backgroundColor: item.item === equip.description
                                            ? `color-mix(in srgb, var(--brand-accent), transparent ${isDarkMode ? '80%' : '90%'})`
                                            : undefined,
                                          color: item.item === equip.description ? (isDarkMode ? '#ffffff' : 'var(--brand-accent)') : undefined
                                        }}
                                        onMouseEnter={(e) => {
                                          if (item.item !== equip.description) {
                                            e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--brand-accent), transparent 95%)`;
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (item.item !== equip.description) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                          }
                                        }}
                                      >
                                        <div className="shrink-0 mt-0.5">
                                          <Box size={14} className={item.item === equip.description ? 'text-inherit' : 'text-slate-400 opacity-50 group-hover:opacity-100'} />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                          <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black font-mono tracking-tighter opacity-60 truncate">
                                                {equip.item_code}
                                              </span>
                                              {relevantItemCodes.has(equip.item_code) && (
                                                <span className="shrink-0 text-[7px] font-black px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full uppercase border border-blue-200 dark:border-blue-500/30">
                                                  {program} Recommended
                                                </span>
                                              )}
                                            </div>
                                            {equip.is_serialized && (
                                              <span className="shrink-0 text-[7px] font-black px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full uppercase border border-amber-200 dark:border-amber-500/30">
                                                S/N
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs font-bold leading-tight line-clamp-2">
                                            {equip.description}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                      {showItemError && <p className="text-[8px] font-medium text-red-500 uppercase tracking-tighter px-1">Required</p>}
                    </div>
                    <div className="flex items-end gap-4 shrink-0">
                      <div className="flex-grow sm:w-32 space-y-1.5">
                        <label className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase px-1 tracking-wider">{toTitleCase("Item Code")}</label>
                        <input 
                          type="text" 
                          placeholder="Auto-filled" 
                          value={item.item_code || ''} 
                          readOnly
                          className="w-full h-9 px-3 border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-mono cursor-not-allowed shadow-inner" 
                        />
                      </div>
                      <button onClick={() => handleRemoveItem(item.id)} className="p-2 mb-0.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all shrink-0">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {requestedItems.length === 0 && (
                <div className="text-center py-12 md:py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[1.5rem] md:rounded-[2.5rem] text-slate-400 dark:text-slate-600 flex flex-col items-center gap-3">
                  <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                    <FileText size={24} md:size={32} className="text-slate-200 dark:text-slate-700" />
                  </div>
                  <p className="font-bold uppercase tracking-widest text-[10px] md:text-xs">{toTitleCase("No Items Listed Yet")}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-6 py-2 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider hover:text-slate-800 dark:hover:text-white transition-colors disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || requestedItems.length === 0 || !areAllItemsValid} 
            className="px-6 py-2 text-white rounded-lg font-medium text-sm tracking-wide active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 uppercase"
            style={{ 
              backgroundColor: 'var(--brand-accent)',
              boxShadow: '0 8px 16px -4px color-mix(in srgb, var(--brand-accent), transparent 70%)'
            }}
          >
            {toTitleCase(isSubmitting ? 'Processing...' : initialData ? 'Update Request' : 'Add Request')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewRequestModal;
