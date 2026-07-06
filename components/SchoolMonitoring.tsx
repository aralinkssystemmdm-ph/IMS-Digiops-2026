import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Plus, Trash2, Edit3, ChevronDown, ChevronUp, Loader2, 
  Calendar, FileText, ShoppingCart, Truck, School, User, 
  Settings, CheckCircle2, AlertCircle, X, Layers, Bell, ClipboardList, AppWindow, Play,
  Download
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase, getProgramBadgeClass } from '../lib/utils';
import { useNotification } from './NotificationProvider';

interface DesignatedHardwareItem {
  item_code: string;
  item_name: string;
  quantity: number;
}

interface SchoolMonitoringRecord {
  id: string;
  customer_code: string;
  school_name: string;
  program: string; // ACE, HUB, NGS, TEACH, OTHER
  sales_team: string;
  class_opening: string;
  target_deployment_date: string;
  status: number; // 1 to 7
  status_dates: Record<number, string>; // status step -> Date string
  items: DesignatedHardwareItem[];
  created_at?: string;
  updated_at?: string;
  school_monitoring_id?: string;
  type_of_document?: string;
}

interface SchoolOption {
  id: string;
  name: string;
  customer_code: string;
  sales_team: string;
}

interface InventoryOption {
  item_code: string;
  item_name: string;
  total_quantity: number;
}

const STATUS_STEPS = [
  { step: 1, label: 'Received initial Document', icon: FileText },
  { step: 2, label: 'Received latest Document', icon: Layers },
  { step: 3, label: 'Creation of Item request', icon: ClipboardList },
  { step: 4, label: 'Received Item Request by Admin', icon: Bell },
  { step: 5, label: 'Purchased Order by Admin', icon: ShoppingCart },
  { step: 6, label: 'In Transit', icon: Truck },
  { step: 7, label: 'Delivered Date to School', icon: School }
];

// Helper to format date into "DD MMM YYYY" (e.g. 02 May 2024)
const formatStepDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const getTodayString = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const renderCustomStepIcon = (step: number, isActive: boolean) => {
  switch (step) {
    case 1:
      return (
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className={`w-8 h-8 ${isActive ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <div className={`absolute top-1 left-2.5 w-3.5 h-3 bg-white dark:bg-slate-800 border ${isActive ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'} rounded-[1.5px] flex flex-col justify-around p-[2px] rotate-6`}>
            <div className={`h-[1px] w-full ${isActive ? 'bg-amber-300' : 'bg-slate-200 dark:bg-slate-750'}`} />
            <div className={`h-[1px] w-2/3 ${isActive ? 'bg-amber-300' : 'bg-slate-200 dark:bg-slate-750'}`} />
          </div>
          {isActive && (
            <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-full p-[1.5px] border border-white dark:border-slate-900 shadow-xs">
              <CheckCircle2 size={8} className="text-white" />
            </div>
          )}
        </div>
      );
    case 2:
      return (
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className={`w-8 h-8 ${isActive ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <div className={`absolute top-1 left-2.5 w-3.5 h-3 bg-white dark:bg-slate-800 border ${isActive ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'} rounded-[1.5px] flex flex-col justify-around p-[2px] -rotate-6`}>
            <div className={`h-[1px] w-full ${isActive ? 'bg-amber-300' : 'bg-slate-200 dark:bg-slate-750'}`} />
            <div className={`h-[1px] w-2/3 ${isActive ? 'bg-amber-300' : 'bg-slate-200 dark:bg-slate-750'}`} />
          </div>
          {isActive && (
            <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-full p-[1.5px] border border-white dark:border-slate-900 shadow-xs flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          )}
        </div>
      );
    case 3:
      return (
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className={`w-7 h-7.5 ${isActive ? 'text-orange-550 dark:text-orange-500' : 'text-slate-300 dark:text-slate-700'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill={isActive ? '#FF5C00' : '#CBD5E1'} />
            <line x1="8" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="16" y2="14" />
          </svg>
          {isActive && (
            <div className="absolute bottom-0.5 right-1.5 bg-brand-orange text-white rounded-full w-3.5 h-3.5 flex items-center justify-center border border-white dark:border-slate-900 text-[9px] font-black">
              +
            </div>
          )}
        </div>
      );
    case 4:
      return (
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className={`w-8 h-8 ${isActive ? 'text-orange-550 dark:text-orange-500' : 'text-slate-300 dark:text-slate-700'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          {isActive && (
            <div className="absolute bottom-0.5 right-0.5 bg-brand-orange text-white rounded-full p-[2px] border border-white dark:border-slate-900">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              </svg>
            </div>
          )}
        </div>
      );
    case 5:
      return (
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className={`w-7.5 h-7.5 ${isActive ? 'text-orange-600' : 'text-slate-300 dark:text-slate-700'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1" fill="currentColor" />
            <circle cx="20" cy="21" r="1" fill="currentColor" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {isActive && (
            <div className="absolute top-0 right-0 bg-emerald-500 rounded-full p-[2px] border border-white dark:border-slate-900 flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>
      );
    case 6:
      return (
        <div className="relative w-10 h-10 flex items-center justify-center">
          <svg className={`w-8 h-8 ${isActive ? 'text-orange-550 dark:text-orange-500' : 'text-slate-300 dark:text-slate-700'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <rect x="1" y="3" width="13" height="13" />
            <polygon points="14 8 18 8 21 11 21 16 14 16" />
            <circle cx="17" cy="18" r="2.2" />
            <circle cx="5" cy="18" r="2.2" />
          </svg>
        </div>
      );
    case 7:
      return (
        <div className="relative w-11 h-11 flex items-center justify-center">
          <svg className={`w-8.5 h-8.5 ${isActive ? 'text-orange-550 dark:text-orange-500' : 'text-slate-300 dark:text-slate-700'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M22 10v11H2V10l10-6 10 6z" />
            <path d="M6 12h4v8H6z" />
            <path d="M14 12h4v8h-4z" />
            <line x1="12" y1="4" x2="12" y2="7" />
            <polygon points="12 4 15 5.5 12 7" fill={isActive ? '#FF5C00' : 'none'} />
          </svg>
        </div>
      );
    default:
      return null;
  }
};

const MOCK_MONITORING_RECORDS: SchoolMonitoringRecord[] = [];

export const SchoolMonitoring: React.FC<{ isDarkMode?: boolean }> = ({ isDarkMode = false }) => {
  const { showSuccess, showError, showInfo } = useNotification();
  const [records, setRecords] = useState<SchoolMonitoringRecord[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [inventory, setInventory] = useState<InventoryOption[]>([]);
  const [equipment, setEquipment] = useState<{ item_code: string; item_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<number | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Status popup modal states
  const [activeStatusEditRecord, setActiveStatusEditRecord] = useState<SchoolMonitoringRecord | null>(null);
  const [modalStatus, setModalStatus] = useState<number>(1);
  const [modalStatusDates, setModalStatusDates] = useState<Record<number, string>>({});

  const openStatusEditModal = (record: SchoolMonitoringRecord) => {
    setActiveStatusEditRecord(record);
    setModalStatus(record.status);
    setModalStatusDates({
      1: record.status_dates?.[1] || '',
      2: record.status_dates?.[2] || '',
      3: record.status_dates?.[3] || '',
      4: record.status_dates?.[4] || '',
      5: record.status_dates?.[5] || '',
      6: record.status_dates?.[6] || '',
      7: record.status_dates?.[7] || '',
    });
  };

  const handleSaveModalStatus = async () => {
    if (!activeStatusEditRecord) return;
    
    // Auto populate date if missing for the active/selected status
    const finalDates = { ...modalStatusDates };
    const today = getTodayString();
    if (!finalDates[modalStatus]) {
      finalDates[modalStatus] = today;
    }

    let target: SchoolMonitoringRecord | null = null;
    const updated = records.map(r => {
      if (r.id === activeStatusEditRecord.id) {
        target = {
          ...r,
          status: modalStatus,
          status_dates: finalDates,
          updated_at: new Date().toISOString()
        };
        return target;
      }
      return r;
    });

    try {
      await persistRecords(updated, target);
      showSuccess('Status Saved', `Successfully updated tracking checklist for ${activeStatusEditRecord.school_name}`);
    } catch (err: any) {
      console.error(err);
      showError('Failed to update status', err.message || 'Could not save the new status step to the database');
    }

    setActiveStatusEditRecord(null);
  };

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formStep, setFormStep] = useState(1); // steps/pages in the creation modal: 1, 2
  const [editingRecord, setEditingRecord] = useState<SchoolMonitoringRecord | null>(null);
  
  const [selectedSchoolName, setSelectedSchoolName] = useState('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [program, setProgram] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [salesTeam, setSalesTeam] = useState('');
  const [classOpening, setClassOpening] = useState('');
  const [targetDeploymentDate, setTargetDeploymentDate] = useState('');
  const [currentStatus, setCurrentStatus] = useState<number>(1);
  const [statusDates, setStatusDates] = useState<Record<number, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: ''
  });
  const [formItems, setFormItems] = useState<DesignatedHardwareItem[]>([]);
  const [schoolMonitoringId, setSchoolMonitoringId] = useState('');
  const [typeOfDocument, setTypeOfDocument] = useState<'MOA' | 'Addendum' | 'AQL' | ''>('');
  const [bundlesForProgram, setBundlesForProgram] = useState<{ name: string; items: { item_code: string; item_name: string; quantity: number }[] }[]>([]);

  // Search and filter states
  const [equipmentSearchQuery, setEquipmentSearchQuery] = useState('');
  const [showEquipmentSuggestions, setShowEquipmentSuggestions] = useState(false);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('ALL');
  const [selectedSalesTeamFilter, setSelectedSalesTeamFilter] = useState('ALL');

  // Multiplier modal states for bundle dispatch
  const [isMultiplierModalOpen, setIsMultiplierModalOpen] = useState(false);
  const [selectedBundleForMultiplier, setSelectedBundleForMultiplier] = useState<string | null>(null);
  const [bundleMultiplierValue, setBundleMultiplierValue] = useState<number>(1);

  // Load bundles from supabase if available
  const fetchBundles = useCallback(async (prog: string) => {
    if (!isSupabaseConfigured) {
      setBundlesForProgram([]);
      return;
    }
    try {
      let query = supabase
        .from('bundle_items')
        .select('bundle, item_code, description, quantity');

      if (prog && prog.toUpperCase().includes('ACE')) {
        query = query.or(`program.eq."${prog}",program.eq."ACE"`);
      } else {
        query = query.eq('program', prog);
      }

      const { data, error } = await query.is('archived_at', null);

      if (!error && data && data.length > 0) {
        const grouped: Record<string, { item_code: string; item_name: string; quantity: number }[]> = {};
        data.forEach((row: any) => {
          const bName = row.bundle || 'Standard Bundle';
          if (!grouped[bName]) {
            grouped[bName] = [];
          }
          grouped[bName].push({
            item_code: row.item_code,
            item_name: row.description || '',
            quantity: Number(row.quantity) || 1
          });
        });
        const bundleList = Object.entries(grouped).map(([name, items]) => ({
          name,
          items
        }));
        setBundlesForProgram(bundleList);
      } else {
        setBundlesForProgram([]);
      }
    } catch (err) {
      console.warn('Could not load bundle items from database:', err);
      setBundlesForProgram([]);
    }
  }, []);

  useEffect(() => {
    if (isFormOpen && program) {
      fetchBundles(program);
    } else {
      setBundlesForProgram([]);
    }
  }, [isFormOpen, program, fetchBundles]);

  // Sub-controls in form
  const [selectedHardwareToAdd, setSelectedHardwareToAdd] = useState('');
  const [hardwareQtyToAdd, setHardwareQtyToAdd] = useState<number>(1);
  const [useQuickAdd, setUseQuickAdd] = useState(false);
  const [quickSelections, setQuickSelections] = useState<Record<string, { checked: boolean; qty: number }>>({});

  // When inventory changes, initialize quick selections
  useEffect(() => {
    const initial: Record<string, { checked: boolean; qty: number }> = {};
    inventory.forEach(inv => {
      initial[inv.item_code] = { checked: false, qty: 1 };
    });
    setQuickSelections(initial);
  }, [inventory]);

  const handleQuickCheckboxChange = (code: string, checked: boolean) => {
    setQuickSelections(prev => {
      const existing = prev[code] || { checked: false, qty: 1 };
      return {
        ...prev,
        [code]: { ...existing, checked }
      };
    });
  };

  const handleQuickQtyChange = (code: string, qty: number) => {
    setQuickSelections(prev => {
      const existing = prev[code] || { checked: false, qty: 1 };
      return {
        ...prev,
        [code]: { ...existing, qty: Math.max(1, qty) }
      };
    });
  };

  const applyMultiHardwareSelection = () => {
    const itemsToAdd: DesignatedHardwareItem[] = [];
    Object.entries(quickSelections).forEach(([code, data]) => {
      const val = data as { checked: boolean; qty: number };
      if (val && val.checked) {
        const invItem = inventory.find(i => i.item_code === code);
        if (invItem) {
          itemsToAdd.push({
            item_code: invItem.item_code,
            item_name: invItem.item_name,
            quantity: val.qty
          });
        }
      }
    });

    if (itemsToAdd.length === 0) {
      showInfo('No selection', 'No hardware items checked. Tick checkboxes in the grid first!');
      return;
    }

    // Merge into formItems
    setFormItems(prev => {
      const updated = [...prev];
      itemsToAdd.forEach(toAdd => {
        const idx = updated.findIndex(item => item.item_code === toAdd.item_code);
        if (idx > -1) {
          updated[idx].quantity += toAdd.quantity;
        } else {
          updated.push(toAdd);
        }
      });
      return updated;
    });

    // Reset checkboxes
    setQuickSelections(prev => {
      const reset = { ...prev };
      Object.keys(reset).forEach(k => {
        reset[k] = { ...reset[k], checked: false, qty: 1 };
      });
      return reset;
    });

    showSuccess('Success', `Appended selected hardware items to school assets list.`);
  };

  // Scheduled class opening changes and adds 45 days to Target Deployment Date automatically
  const handleClassOpeningChange = (dateVal: string) => {
    setClassOpening(dateVal);
    if (dateVal) {
      const date = new Date(dateVal);
      if (!isNaN(date.getTime())) {
        date.setDate(date.getDate() + 45);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        setTargetDeploymentDate(`${yyyy}-${mm}-${dd}`);
      }
    } else {
      setTargetDeploymentDate('');
    }
  };

  // Automate Stage step completion dates based on item requests and delivery receipts
  const automateStages = async (schoolName: string) => {
    if (!schoolName) return;

    let transitDateVal = '';
    let deliveredDateVal = '';
    
    // Evaluate delivery receipts (local logs)
    try {
      const drLocal = localStorage.getItem('aralinks_delivery_receipts');
      if (drLocal) {
        const receipts = JSON.parse(drLocal) as any[];
        
        // Find receipt with Transit status
        const transitDR = receipts.find(r => 
          r.schoolName?.trim().toLowerCase() === schoolName.trim().toLowerCase() && 
          r.status?.toLowerCase() === 'in transit'
        );
        if (transitDR) {
          transitDateVal = transitDR.inTransitDate || transitDR.date || '';
        }

        // Find receipt with Delivered status
        const deliveredDR = receipts.find(r => 
          r.schoolName?.trim().toLowerCase() === schoolName.trim().toLowerCase() && 
          r.status?.toLowerCase() === 'delivered'
        );
        if (deliveredDR) {
          deliveredDateVal = deliveredDR.deliveredDate || deliveredDR.date || '';
        }
      }
    } catch (err) {
      console.warn('Could not load delivery receipts for auto-matching:', err);
    }

    // Evaluate item requests (database queries)
    let creationDateVal = '';
    if (isSupabaseConfigured) {
      try {
        const matchedRecord = records.find(r => r.school_name.trim().toLowerCase() === schoolName.trim().toLowerCase());
        const targetSMId = matchedRecord?.school_monitoring_id || schoolMonitoringId;

        let query = supabase
          .from('item_requests')
          .select('control_no, date, created_at, school_monitoring_id')
          .not('status', 'in', '("Deleted","Rejected")')
          .order('date', { ascending: false });

        if (targetSMId) {
          query = query.or(`school_monitoring_id.eq."${targetSMId}",school_name.eq."${schoolName}"`);
        } else {
          query = query.eq('school_name', schoolName);
        }

        const { data, error } = await query.limit(1);

        if (!error && data && data.length > 0) {
          // Use req date or format created_at date
          creationDateVal = data[0].date || data[0].created_at?.split('T')[0] || '';
        }
      } catch (e) {
        console.warn('Item request query for automation failed:', e);
      }
    }

    // Update form dates
    setStatusDates(prev => {
      const updated = { ...prev };
      if (creationDateVal) {
        updated[3] = creationDateVal;
      }
      if (transitDateVal) {
        updated[6] = transitDateVal;
      }
      if (deliveredDateVal) {
        updated[7] = deliveredDateVal;
      }
      return updated;
    });

    // Advance progress step level dynamically if steps have dates calculated
    setCurrentStatus(prev => {
      if (deliveredDateVal) return 7;
      if (transitDateVal) return 6;
      if (creationDateVal) return Math.max(prev, 3);
      return prev;
    });

    if (creationDateVal || transitDateVal || deliveredDateVal) {
      showInfo('AI Automation', `Synchronized real-time status dates: ${creationDateVal ? 'Item Request (Step 3)' : ''} ${transitDateVal ? 'Transit (Step 6)' : ''} ${deliveredDateVal ? 'Delivered (Step 7)' : ''}`);
    }
  };

  // Fetch core lists
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch schools
      let fetchedSchools: SchoolOption[] = [];
      if (isSupabaseConfigured) {
        const { data: schoolsData } = await supabase
          .from('schools')
          .select('id, name, customer_code, sales_team')
          .order('name');
        
        if (schoolsData) {
          fetchedSchools = schoolsData.map((s: any) => ({
            id: s.id,
            name: s.name,
            customer_code: s.customer_code || '',
            sales_team: s.sales_team || ''
          }));
        }
      }
      setSchools(fetchedSchools);

      // 2. Fetch inventory list
      let fetchedInventory: InventoryOption[] = [];
      if (isSupabaseConfigured) {
        const { data: invData } = await supabase
          .from('view_inventory_summary')
          .select('item_code, item_name, total_quantity');
        if (invData) {
          fetchedInventory = invData.map((i: any) => ({
            item_code: i.item_code,
            item_name: i.item_name,
            total_quantity: Number(i.total_quantity) || 0
          }));
        }
      }
      setInventory(fetchedInventory);

      // 2b. Fetch equipment list (not restricted to stock/inventory)
      let fetchedEquipment: { item_code: string; item_name: string }[] = [];
      if (isSupabaseConfigured) {
        try {
          const { data: equipData } = await supabase
            .from('equipment')
            .select('item_code, description')
            .is('archived_at', null)
            .order('description', { ascending: true });
          if (equipData) {
            fetchedEquipment = equipData.map((e: any) => ({
              item_code: e.item_code,
              item_name: e.description || e.item_code
            }));
          }
        } catch (err) {
          console.warn('Could not fetch from equipment table:', err);
        }
      }

      // If no equipment was fetched or db connection is not configured, fall back to mock list combined with inventory
      if (fetchedEquipment.length === 0) {
        const mockList = [
          { item_code: 'INVD0000336', item_name: 'Acer A15 Laptop Steel Gray' },
          { item_code: 'INVD0000344', item_name: 'Acer Laptop Charger Thin Pin' },
          { item_code: 'INVD0000410', item_name: 'Smart Interactive Board (SIB) 65"' },
          { item_code: 'INVD0000500', item_name: 'Projector Mount Bracket White' },
          { item_code: 'INVD0000600', item_name: 'HDMI High Speed Cable 15m' },
          { item_code: 'INVD0000700', item_name: 'ACE Standard Kit Bag' }
        ];
        // Merge with inventory items just to be safe
        const merged = [...mockList];
        fetchedInventory.forEach(inv => {
          if (!merged.some(m => m.item_code === inv.item_code)) {
            merged.push({ item_code: inv.item_code, item_name: inv.item_name });
          }
        });
        fetchedEquipment = merged;
      }
      setEquipment(fetchedEquipment);

      // 3. Fetch Monitoring records
      // Load local storage first as the base/fallback
      const localStr = localStorage.getItem('aralinks_school_monitoring');
      let localRecords: SchoolMonitoringRecord[] = [];
      if (localStr) {
        try {
          localRecords = JSON.parse(localStr);
        } catch (err) {
          console.error('Failed to parse local school_monitoring:', err);
        }
      } else {
        localStorage.setItem('aralinks_school_monitoring', JSON.stringify(MOCK_MONITORING_RECORDS));
        localRecords = MOCK_MONITORING_RECORDS;
      }

      let monitoringData: SchoolMonitoringRecord[] = [...localRecords];

      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('school_monitoring')
            .select('*');
          
          if (!error && data) {
            const dbRecords = data.map((row: any) => {
              const status_dates = typeof row.status_dates === 'string' 
                ? JSON.parse(row.status_dates) 
                : (row.status_dates || { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' });
              
              const program = row.program || '';

              return {
                id: row.id,
                customer_code: row.customer_code,
                school_name: row.school_name,
                program: program,
                sales_team: row.sales_team,
                class_opening: row.class_opening,
                target_deployment_date: row.target_deployment_date,
                status: Number(row.status) || 1,
                status_dates: status_dates,
                items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
                school_monitoring_id: row.school_monitoring_id || '',
                type_of_document: row.type_of_document || ''
              };
            });

            monitoringData = dbRecords;
            localStorage.setItem('aralinks_school_monitoring', JSON.stringify(dbRecords));
          } else if (error) {
            console.warn('Supabase fetch error, fallback to local records:', error.message);
          }
        } catch (e) {
          console.warn('Could not fetch from Supabase school_monitoring table, falling back to localStorage:', e);
        }
      }

      // 3b. Fetch all active item requests to sync school_monitoring stage 3
      let itemRequestsList: any[] = [];
      if (isSupabaseConfigured) {
        try {
          const { data: irData } = await supabase
            .from('item_requests')
            .select('school_monitoring_id, date, created_at, school_name')
            .not('status', 'in', '("Deleted","Rejected")');
          if (irData) {
            itemRequestsList = irData;
          }
        } catch (e) {
          console.warn('Failed to fetch item requests for sync:', e);
        }
      }

      setRecords(monitoringData);

      // Sync in-memory records with the newest DR receipts status & dates AND item requests stage 3 date
      let hasSyncChanges = false;
      try {
        const drLocal = localStorage.getItem('aralinks_delivery_receipts');
        const receipts = drLocal ? JSON.parse(drLocal) as any[] : [];

        monitoringData = monitoringData.map(record => {
          const schoolName = record.school_name;
          let recordChanged = false;
          let highestStatus = record.status;
          let targetDeploymentDate = record.target_deployment_date;
          const updatedDates = { ...record.status_dates };

          // 1. Match by school_monitoring_id in item_requests
          if (record.school_monitoring_id) {
            const matchedIRs = itemRequestsList.filter(ir => 
              ir.school_monitoring_id && 
              ir.school_monitoring_id.trim().toUpperCase() === record.school_monitoring_id.trim().toUpperCase()
            );

            if (matchedIRs.length > 0) {
              // Get the latest matched request
              const latestIR = matchedIRs.reduce((latest, current) => {
                const currentFullDate = current.date || current.created_at?.split('T')[0] || '';
                const latestFullDate = latest.date || latest.created_at?.split('T')[0] || '';
                return (!latestFullDate || currentFullDate > latestFullDate) ? current : latest;
              }, matchedIRs[0]);

              const creationDateVal = latestIR.date || latestIR.created_at?.split('T')[0] || '';
              if (creationDateVal && updatedDates[3] !== creationDateVal) {
                updatedDates[3] = creationDateVal;
                highestStatus = Math.max(highestStatus, 3);
                recordChanged = true;
              }
            }
          }

          // 2. Match by delivery receipts
          if (schoolName) {
            const schoolReceipts = receipts.filter(r => 
              (r.schoolName && r.schoolName.trim().toLowerCase() === schoolName.trim().toLowerCase()) ||
              (r.clientCode && record.customer_code && r.clientCode.trim().toLowerCase() === record.customer_code.trim().toLowerCase()) ||
              (r.schoolMonitoringId && record.school_monitoring_id && r.schoolMonitoringId.trim().toLowerCase() === record.school_monitoring_id.trim().toLowerCase()) ||
              (r.school_monitoring_id && record.school_monitoring_id && r.school_monitoring_id.trim().toLowerCase() === record.school_monitoring_id.trim().toLowerCase())
            );
            
            if (schoolReceipts.length > 0) {
              let inTransitDate = '';
              let deliveredDate = '';
              
              const transitDRs = schoolReceipts.filter(r => r.status?.toLowerCase() === 'in transit' || r.status?.toLowerCase() === 'partially delivered' || r.status?.toLowerCase() === 'delivered');
              if (transitDRs.length > 0) {
                const latestTransit = transitDRs.reduce((latest, r) => {
                  const curDate = r.inTransitDate || r.date || '';
                  return (!latest || curDate > latest) ? curDate : latest;
                }, '');
                if (latestTransit) inTransitDate = latestTransit;
              }
              
              const deliveredDRs = schoolReceipts.filter(r => r.status?.toLowerCase() === 'delivered');
              if (deliveredDRs.length > 0) {
                highestStatus = 7;
                const latestDelivered = deliveredDRs.reduce((latest, r) => {
                  const curDate = r.deliveredDate || r.date || '';
                  return (!latest || curDate > latest) ? curDate : latest;
                }, '');
                if (latestDelivered) deliveredDate = latestDelivered;
              } else if (transitDRs.length > 0) {
                highestStatus = Math.max(highestStatus, 6);
              }

              const latestTargetDR = schoolReceipts
                .filter((r: any) => r.targetDeliveryDate)
                .reduce((latest: any, r: any) => (!latest || r.date > latest.date) ? r : latest, null as any);

              if (latestTargetDR && latestTargetDR.targetDeliveryDate && record.target_deployment_date !== latestTargetDR.targetDeliveryDate) {
                targetDeploymentDate = latestTargetDR.targetDeliveryDate;
                recordChanged = true;
              }

              if (highestStatus >= 6) {
                const finalTransitDate = inTransitDate || new Date().toISOString().split('T')[0];
                if (updatedDates[6] !== finalTransitDate) {
                  updatedDates[6] = finalTransitDate;
                  recordChanged = true;
                }
              }
              if (highestStatus >= 7) {
                const finalDelDate = deliveredDate || inTransitDate || new Date().toISOString().split('T')[0];
                if (updatedDates[7] !== finalDelDate) {
                  updatedDates[7] = finalDelDate;
                  recordChanged = true;
                }
              }
              if (highestStatus !== record.status) {
                recordChanged = true;
              }
            }
          }
          
          if (recordChanged || highestStatus !== record.status) {
            hasSyncChanges = true;
            return {
              ...record,
              target_deployment_date: targetDeploymentDate,
              status: highestStatus,
              status_dates: updatedDates
            };
          }
          return record;
        });
      } catch (err) {
        console.warn('Error during auto-sync of monitoring data:', err);
      }

      setRecords(monitoringData);
      if (hasSyncChanges) {
        localStorage.setItem('aralinks_school_monitoring', JSON.stringify(monitoringData));
        if (isSupabaseConfigured) {
          try {
            const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            for (const rec of monitoringData) {
              const payload = {
                id: (rec.id && isUUID(rec.id)) ? rec.id : undefined,
                customer_code: rec.customer_code,
                school_name: rec.school_name,
                program: rec.program || null,
                sales_team: rec.sales_team,
                class_opening: rec.class_opening,
                target_deployment_date: rec.target_deployment_date,
                status: rec.status,
                status_dates: rec.status_dates,
                items: rec.items,
                school_monitoring_id: rec.school_monitoring_id || null,
                type_of_document: rec.type_of_document || null,
                updated_at: new Date().toISOString()
              };
              supabase
                .from('school_monitoring')
                .upsert(payload, { onConflict: 'customer_code' })
                .then();
            }
          } catch (err) {
            console.warn('Background db sync fail:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Persists monitoring data
  const persistRecords = async (newRecords: SchoolMonitoringRecord[], singleRecordToUpsert?: SchoolMonitoringRecord | null, bypassDBSync: boolean = false) => {
    let updatedLocalRecords = [...newRecords];

    // Try to save to Supabase
    if (isSupabaseConfigured && !bypassDBSync) {
      try {
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
        const recordsToUpsert = singleRecordToUpsert ? [singleRecordToUpsert] : newRecords;

        for (const rec of recordsToUpsert) {
          const payload: any = {
            customer_code: rec.customer_code,
            school_name: rec.school_name,
            program: rec.program || null,
            sales_team: rec.sales_team,
            class_opening: rec.class_opening || null,
            target_deployment_date: rec.target_deployment_date || null,
            status: rec.status,
            status_dates: rec.status_dates,
            items: rec.items,
            school_monitoring_id: rec.school_monitoring_id || null,
            type_of_document: rec.type_of_document || null,
            updated_at: new Date().toISOString()
          };
          
          let response;
          const isRecUUID = rec.id && isUUID(rec.id);
          
          if (isRecUUID) {
            payload.id = rec.id;
            response = await supabase
              .from('school_monitoring')
              .upsert(payload, { onConflict: 'customer_code' })
              .select();
          } else {
            // Creation mode (POST method equivalent)
            // Explicitly call .insert to let Postgres trigger DEFAULT gen_random_uuid()
            response = await supabase
              .from('school_monitoring')
              .insert(payload)
              .select();
          }
          
          const { data, error } = response;

          if (error) {
            console.error('Supabase row persist error:', error);
            throw new Error(error.message || 'Failed to save record to database');
          }

          if (data && data[0]) {
            const dbRow = data[0];
            const parsedStatusDates = typeof dbRow.status_dates === 'string' 
              ? JSON.parse(dbRow.status_dates) 
              : (dbRow.status_dates || { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' });

            const syncedRec = {
              id: dbRow.id,
              customer_code: dbRow.customer_code,
              school_name: dbRow.school_name,
              program: dbRow.program || '',
              sales_team: dbRow.sales_team,
              class_opening: dbRow.class_opening,
              target_deployment_date: dbRow.target_deployment_date,
              status: Number(dbRow.status) || 1,
              status_dates: parsedStatusDates,
              items: typeof dbRow.items === 'string' ? JSON.parse(dbRow.items) : (dbRow.items || []),
              school_monitoring_id: dbRow.school_monitoring_id || '',
              type_of_document: dbRow.type_of_document || ''
            };
            
            // Update this record in updatedLocalRecords
            updatedLocalRecords = updatedLocalRecords.map(r => 
              r.customer_code === syncedRec.customer_code ? syncedRec : r
            );
          }
        }
      } catch (err: any) {
        console.warn('Supabase DB Sync failed. Data is fully persisted locally first:', err);
        throw err;
      }
    }

    setRecords(updatedLocalRecords);
    // Always save to localStorage
    localStorage.setItem('aralinks_school_monitoring', JSON.stringify(updatedLocalRecords));
  };

  // Handle selected school autofills
  const handleSchoolChange = (schoolName: string) => {
    setSelectedSchoolName(schoolName);
    const matched = schools.find(s => s.name === schoolName);
    if (matched) {
      setCustomerCode(matched.customer_code);
      setSalesTeam(matched.sales_team);
      automateStages(matched.name);
    } else {
      setCustomerCode('');
      setSalesTeam('');
    }
  };

  // Add Item to creation list
  const addHardwareItem = () => {
    if (!selectedHardwareToAdd) return;
    const eqItem = equipment.find(e => e.item_code === selectedHardwareToAdd);
    const itemName = eqItem ? eqItem.item_name : selectedHardwareToAdd;

    // Check if duplicate
    const existingIdx = formItems.findIndex(item => item.item_code === selectedHardwareToAdd);

    if (existingIdx > -1) {
      const updated = [...formItems];
      updated[existingIdx].quantity += hardwareQtyToAdd;
      setFormItems(updated);
    } else {
      setFormItems([...formItems, {
        item_code: selectedHardwareToAdd,
        item_name: itemName,
        quantity: hardwareQtyToAdd
      }]);
    }
    setSelectedHardwareToAdd('');
    setEquipmentSearchQuery('');
    setHardwareQtyToAdd(1);
    setShowEquipmentSuggestions(false);
    showSuccess('Added successfully', `Designated hardware item added to list`);
  };

  // Determine active bundles for currently selected program
  const activeBundles = useMemo(() => {
    if (bundlesForProgram.length > 0) {
      return bundlesForProgram;
    }
    if (program && program.toUpperCase().includes('ACE')) {
      return [
        {
          name: 'ACE Standard Classroom Bundle',
          items: [
            { item_code: 'INVD0000336', item_name: 'Acer A15 Laptop Steel Gray', quantity: 15 },
            { item_code: 'INVD0000344', item_name: 'Acer Laptop Charger Thin Pin', quantity: 15 }
          ]
        }
      ];
    }
    return [];
  }, [bundlesForProgram, program]);

  // Apply batch bundle dispatch without stock restrictions
  const applyBundleBatch = (bundleName: string, multiplier: number = 1) => {
    const bToApply = activeBundles.find(b => b.name === bundleName);
    if (!bToApply) return;

    const updated = [...formItems];

    bToApply.items.forEach(bItem => {
      const eqItem = equipment.find(e => e.item_code === bItem.item_code);
      const itemName = bItem.item_name || (eqItem ? eqItem.item_name : bItem.item_code);
      const existingIdx = updated.findIndex(item => item.item_code === bItem.item_code);
      
      let requestedToAdd = bItem.quantity * multiplier;
      
      // Special formula for Brass Fastener: 1-10 = 1, 11-20 = 2, etc. (Math.max(1, Math.ceil(multiplier / 10)))
      if (itemName.toUpperCase().includes('BRASS FASTENER')) {
        requestedToAdd = Math.max(1, Math.ceil(multiplier / 10));
      }

      if (existingIdx > -1) {
        updated[existingIdx].quantity += requestedToAdd;
      } else {
        updated.push({
          item_code: bItem.item_code,
          item_name: itemName,
          quantity: requestedToAdd
        });
      }
    });

    setFormItems(updated);
    showSuccess('Batch Bundle Loaded', `Successfully added all items from "${bundleName}" (x${multiplier}) to equipment list.`);
  };

  // Remove Item from creation list
  const removeHardwareItem = (code: string) => {
    setFormItems(formItems.filter(item => item.item_code !== code));
  };

  const generateSchoolMonitoringId = (existingRecords: SchoolMonitoringRecord[]) => {
    const nextNum = existingRecords.length + 1;
    const padded = String(nextNum).padStart(4, '0');
    return `ARAL-IMS-2026-${padded}`;
  };

  // Handle Open Create Form
  const openCreateForm = () => {
    setEditingRecord(null);
    setFormStep(1);
    setSelectedSchoolName('');
    setSchoolSearchQuery('');
    setProgram('');
    setCustomerCode('');
    setSalesTeam('');
    setClassOpening('');
    setTargetDeploymentDate('');
    setCurrentStatus(1);
    setEquipmentSearchQuery('');
    const today = getTodayString();
    setStatusDates({
      1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: ''
    });
    setFormItems([]);
    setSchoolMonitoringId(generateSchoolMonitoringId(records));
    setTypeOfDocument('');
    setIsFormOpen(true);
  };

  // Handle Open Edit Form
  const openEditForm = (record: SchoolMonitoringRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setFormStep(1);
    setSelectedSchoolName(record.school_name);
    setSchoolSearchQuery(record.school_name);
    setProgram(record.program || '');
    setCustomerCode(record.customer_code);
    setSalesTeam(record.sales_team);
    setClassOpening(record.class_opening);
    setTargetDeploymentDate(record.target_deployment_date);
    setCurrentStatus(record.status);
    setEquipmentSearchQuery('');
    setStatusDates({ ...record.status_dates });
    setFormItems([...record.items]);
    setSchoolMonitoringId(record.school_monitoring_id || generateSchoolMonitoringId(records));
    setTypeOfDocument((record.type_of_document as any) || '');
    setIsFormOpen(true);
    automateStages(record.school_name);
  };

  // Delete Action
  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this monitoring record?')) {
      const recordToDelete = records.find(r => r.id === id);
      const newRecs = records.filter(r => r.id !== id);
      
      // If synced DB is configured, attempt to delete
      if (isSupabaseConfigured) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          if (isUUID) {
            await supabase.from('school_monitoring').delete().eq('id', id);
          } else if (recordToDelete && recordToDelete.customer_code) {
            await supabase.from('school_monitoring').delete().eq('customer_code', recordToDelete.customer_code);
          }
        } catch (err) {
          console.warn('Failed to delete from Supabase:', err);
        }
      }
      
      await persistRecords(newRecs, null, true);
      if (selectedRecordId === id) setSelectedRecordId(null);
      showSuccess('Deleted Record', 'School monitoring record has been deleted');
    }
  };

  // Quick State change action (1 to 7)
  const handleQuickStatusChange = async (recordId: string, directStatus: number, e?: React.ChangeEvent<HTMLSelectElement>) => {
    if (e) {
      e.stopPropagation();
      directStatus = Number(e.target.value);
    }
    const today = getTodayString();
    
    let changedRec: SchoolMonitoringRecord | null = null;
    const updated = records.map(r => {
      if (r.id === recordId) {
        const newDates = { ...r.status_dates };
        // Populate current step date if empty
        if (!newDates[directStatus]) {
          newDates[directStatus] = today;
        }
        changedRec = {
          ...r,
          status: directStatus,
          status_dates: newDates
        };
        return changedRec;
      }
      return r;
    });

    try {
      await persistRecords(updated, changedRec);
      showSuccess('Status Updated', `Successfully changed status step to ${directStatus}`);
    } catch (err: any) {
      console.error(err);
      showError('Failed to update status', err.message || 'Could not save the new status step to the database');
    }
  };

  // Submit Creation/Edit
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolName) {
      showError('Form invalid', 'Please select a School name');
      return;
    }
    if (formItems.length === 0) {
      showError('Form invalid', 'Please designate at least one hardware item');
      return;
    }

    setSaving(true);
    try {
      const finalCustomerCode = customerCode.trim() || ('CUST-' + selectedSchoolName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10));
      let updatedRecs: SchoolMonitoringRecord[] = [];
      const today = getTodayString();
      const finalStatusDates = { ...statusDates };
      
      // Keep dates clean
      if (!finalStatusDates[currentStatus]) {
        finalStatusDates[currentStatus] = today;
      }

      let targetRecord: SchoolMonitoringRecord | null = null;

      if (editingRecord) {
        // Edit Mode
        updatedRecs = records.map(r => {
          if (r.id === editingRecord.id) {
            targetRecord = {
              ...r,
              school_name: selectedSchoolName,
              program: program,
              customer_code: finalCustomerCode,
              sales_team: salesTeam,
              class_opening: classOpening,
              target_deployment_date: targetDeploymentDate,
              status: currentStatus,
              status_dates: finalStatusDates,
              items: formItems,
              school_monitoring_id: schoolMonitoringId,
              type_of_document: typeOfDocument,
              updated_at: new Date().toISOString()
            };
            return targetRecord;
          }
          return r;
        });
        showSuccess('Record Saved', 'Successfully updated school monitoring parameters');
      } else {
        // Create Mode
        const newRecord: SchoolMonitoringRecord = {
          id: `sm-${Date.now()}`,
          school_name: selectedSchoolName,
          program: program,
          customer_code: finalCustomerCode,
          sales_team: salesTeam,
          class_opening: classOpening,
          target_deployment_date: targetDeploymentDate,
          status: currentStatus,
          status_dates: finalStatusDates,
          items: formItems,
          school_monitoring_id: schoolMonitoringId,
          type_of_document: typeOfDocument,
          created_at: new Date().toISOString()
        };
        targetRecord = newRecord;
        updatedRecs = [newRecord, ...records];
        showSuccess('Record Created', 'Successfully added school to dispatch tracking');
      }

      await persistRecords(updatedRecs, targetRecord);
      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        showError('Duplicate Code', 'A record with this Customer Code already exists');
      } else {
        showError('Failed to save', msg || 'Could not sync monitoring metadata changes');
      }
    } finally {
      setSaving(false);
    }
  };

  // Update a single date in the step list manually inside the Create/Edit form
  const handleUpdateStepDate = (stepNo: number, val: string) => {
    setStatusDates(prev => ({
      ...prev,
      [stepNo]: val
    }));
  };

  // Calculated counts per status
  const countsPerStatus = useMemo(() => {
    const map: Record<number, number> = {};
    for (let s = 1; s <= 7; s++) {
      map[s] = records.filter(r => r.status === s).length;
    }
    return map;
  }, [records]);

  // Get unique programs dynamically from records
  const uniquePrograms = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.program) {
        set.add(r.program.trim());
      }
    });
    return Array.from(set).sort();
  }, [records]);

  // Get unique sales teams dynamically from records
  const uniqueSalesTeams = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.sales_team) {
        set.add(r.sales_team.trim());
      }
    });
    return Array.from(set).sort();
  }, [records]);

  // Filter list
  const filteredRecords = useMemo(() => {
    let result = records;
    if (selectedStatusFilter !== null) {
      result = result.filter(r => r.status === selectedStatusFilter);
    }
    if (selectedProgramFilter !== 'ALL') {
      result = result.filter(r => r.program === selectedProgramFilter);
    }
    if (selectedSalesTeamFilter !== 'ALL') {
      result = result.filter(r => r.sales_team === selectedSalesTeamFilter);
    }
    if (!searchQuery) return result;
    const query = searchQuery.toLowerCase();
    return result.filter(r => 
      r.school_name.toLowerCase().includes(query) ||
      (r.program && r.program.toLowerCase().includes(query)) ||
      r.customer_code.toLowerCase().includes(query) ||
      r.sales_team.toLowerCase().includes(query)
    );
  }, [records, searchQuery, selectedStatusFilter, selectedProgramFilter, selectedSalesTeamFilter]);

  // Filtered equipment catalog items
  const filteredEquipment = useMemo(() => {
    if (!equipmentSearchQuery) return equipment;
    const q = equipmentSearchQuery.toLowerCase();
    return equipment.filter(eq => 
      eq.item_name.toLowerCase().includes(q) || 
      eq.item_code.toLowerCase().includes(q)
    );
  }, [equipment, equipmentSearchQuery]);

  const exportToExcel = () => {
    const STATUS_LABELS: Record<number, string> = {
      1: 'PO Creation',
      2: 'Cataloguing',
      3: 'Dispatching',
      4: 'In-Transit',
      5: 'Delivered',
      6: 'Installation',
      7: 'User Training'
    };

    const headers = [
      'Customer Code',
      'School Name',
      'Program',
      'Sales Team',
      'Class Opening',
      'Target Deployment Date',
      'Current Status Stage',
      'Status Label',
      'Hardware Assets'
    ];

    const rows = filteredRecords.map(r => {
      const statusLabel = STATUS_LABELS[r.status] || `Stage ${r.status}`;
      const assetsString = r.items && r.items.length > 0
        ? r.items.map(item => `${item.item_name} (Code: ${item.item_code}, Qty: ${item.quantity})`).join('; ')
        : 'None';
      
      return [
        r.customer_code || '',
        r.school_name || '',
        r.program || '',
        r.sales_team || '',
        r.class_opening ? formatStepDate(r.class_opening) : '',
        r.target_deployment_date ? formatStepDate(r.target_deployment_date) : '',
        r.status,
        statusLabel,
        assetsString
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `school_distribution_summary_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Export Successful', 'School distribution summary exported to Excel (CSV) format');
  };

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="w-full h-full flex flex-col overflow-auto p-4 lg:p-6 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="text-brand-orange animate-pulse" size={24} />
            School Monitoring Dashboard
          </h1>
        </div>
        
        <button
          onClick={openCreateForm}
          className="px-4 py-2 bg-brand-orange text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <Plus size={15} strokeWidth={3} />
          Monitor New School
        </button>
      </div>

      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center p-12">
          <Loader2 className="animate-spin text-brand-orange mb-3" size={32} />
          <p className="text-sm text-slate-400 italic">Reading synchronization parameters...</p>
        </div>
      ) : (
        <div className="flex-grow flex flex-col gap-6">
          
          {/* INTERACTIVE METRIC BUTTON DASHBOARD */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 leading-none">
                <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
                School Current Status
              </p>
              {selectedStatusFilter !== null && (
                <button
                  onClick={() => setSelectedStatusFilter(null)}
                  className="text-[10px] font-bold text-brand-orange hover:underline uppercase tracking-wider bg-brand-orange/5 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                >
                  Clear Status Filter ×
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {/* Card 1: TOTAL SCHOOLS */}
              <button
                onClick={() => setSelectedStatusFilter(null)}
                className={`relative p-3.5 rounded-2xl border text-left transition-all duration-350 cursor-pointer select-none flex flex-col justify-between min-h-[90px] h-full shadow-2xs group/total ${
                  selectedStatusFilter === null
                    ? 'border-brand-orange bg-brand-orange/[0.04] ring-2 ring-brand-orange/15 shadow-sm -translate-y-0.5'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-orange/45 hover:-translate-y-0.5 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[9.5px] font-bold uppercase tracking-wider leading-none ${
                    selectedStatusFilter === null ? 'text-brand-orange' : 'text-slate-400 group-hover/total:text-brand-orange/80'
                  }`}>
                    ALL SCHOOLS
                  </span>
                  <School size={13} className={selectedStatusFilter === null ? 'text-brand-orange' : 'text-slate-400 group-hover/total:scale-110 transition-transform'} />
                </div>
                <div className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black font-poppins tracking-tight text-slate-900 dark:text-white leading-none">
                    {records.length}
                  </span>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest">
                    Units
                  </span>
                </div>
              </button>

              {/* Cards 2 to 8: STATUS STEPS */}
              {STATUS_STEPS.map((st) => {
                const isSelected = selectedStatusFilter === st.step;
                const count = countsPerStatus[st.step] || 0;
                const StepIcon = st.icon;

                return (
                  <button
                    key={st.step}
                    onClick={() => {
                      if (selectedStatusFilter === st.step) {
                        setSelectedStatusFilter(null);
                      } else {
                        setSelectedStatusFilter(st.step);
                      }
                    }}
                    className={`relative p-3 rounded-2xl border text-left transition-all duration-350 cursor-pointer select-none flex flex-col justify-between min-h-[90px] h-full shadow-2xs group/step ${
                      isSelected
                        ? 'border-brand-orange bg-brand-orange/[0.04] ring-2 ring-brand-orange/15 shadow-sm -translate-y-0.5'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-orange/45 hover:-translate-y-0.5 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full gap-1.5">
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className={`text-[8.5px] font-black uppercase tracking-wide leading-none ${
                          isSelected ? 'text-brand-orange' : 'text-slate-400'
                        }`}>
                          STAGE {st.step}
                        </span>
                        <span className="text-[9.5px] font-black text-slate-700 dark:text-slate-300 mt-1 leading-tight uppercase font-sans tracking-wide whitespace-normal break-words" title={st.label}>
                          {st.label}
                        </span>
                      </div>
                      <div className="shrink-0 -mt-1 scale-90">
                        {renderCustomStepIcon(st.step, isSelected || count > 0)}
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between w-full">
                      <span className="text-2xl font-black font-poppins tracking-tight text-slate-900 dark:text-white leading-none">
                        {count}
                      </span>
                      {count > 0 && (
                        <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-sm ${
                          isSelected ? 'bg-brand-orange text-white' : 'bg-brand-orange/10 text-brand-orange'
                        }`}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* SEARCH, FILTER AND EXPORT CONTROLS */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-805">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
              
              {/* Search input */}
              <div className="relative flex-1 max-w-xs min-w-[200px]">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search name, code, team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border-slate-200 dark:border-slate-800 border bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 dark:text-white"
                />
              </div>

              {/* Program filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">Program:</span>
                <select
                  value={selectedProgramFilter}
                  onChange={(e) => setSelectedProgramFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                >
                  <option value="ALL">All Programs</option>
                  {uniquePrograms.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Sales Team filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">Sales Team:</span>
                <select
                  value={selectedSalesTeamFilter}
                  onChange={(e) => setSelectedSalesTeamFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-orange max-w-[150px]"
                >
                  <option value="ALL">All Sales Teams</option>
                  {uniqueSalesTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Clear filters button if active */}
              {(selectedProgramFilter !== 'ALL' || selectedSalesTeamFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSelectedProgramFilter('ALL');
                    setSelectedSalesTeamFilter('ALL');
                  }}
                  className="text-[10.5px] font-black text-brand-orange hover:underline uppercase tracking-wider self-center whitespace-nowrap"
                >
                  Clear ×
                </button>
              )}

            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-3.5 shrink-0 self-end xl:self-auto">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Export Summary:</span>
              
              <button
                onClick={exportToExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-550 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer hover:opacity-95"
                title="Download Excel / CSV"
              >
                <Download size={13} strokeWidth={2.5} />
                Excel (CSV)
              </button>

              <button
                onClick={exportToPDF}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-550 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer hover:opacity-95"
                title="Download / Print PDF"
              >
                <FileText size={13} strokeWidth={2.5} />
                PDF
              </button>
            </div>
          </div>

          {/* MAIN MONITORING TABLE */}
          <div className="border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">School Monitoring ID</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Customer Code</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">School Name</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Program</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Sales Team</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Class Opening</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Target Date</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">Deployment Status</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-450 tracking-wider text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const isSelected = selectedRecordId === record.id;
                    const activeStepConfig = STATUS_STEPS.find(s => s.step === record.status) || STATUS_STEPS[0];
                    const StepIcon = activeStepConfig.icon;

                    const getProgramColor = (p: string) => getProgramBadgeClass(p);

                    return (
                      <React.Fragment key={record.id}>
                        {/* Table Row */}
                        <tr 
                          onClick={() => setSelectedRecordId(isSelected ? null : record.id)}
                          className={`border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-all cursor-pointer ${
                            isSelected ? 'bg-amber-500/[0.04] dark:bg-brand-orange/5' : ''
                          }`}
                        >
                          <td className="px-5 py-4 text-xs font-bold font-mono text-brand-orange dark:text-brand-orange/90 whitespace-nowrap">
                            {record.school_monitoring_id || 'Not assigned'}
                          </td>
                          <td className="px-5 py-4 text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                            {record.customer_code}
                          </td>
                          <td className="px-5 py-4 text-sm font-extrabold text-slate-800 dark:text-slate-100">
                            <div>{record.school_name}</div>
                            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                              ID: {record.school_monitoring_id || 'Not assigned'}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getProgramColor(record.program)}`}>
                              {record.program || 'OTHER'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                            {record.sales_team}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {record.class_opening ? formatStepDate(record.class_opening) : '--'}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-550 dark:text-slate-400 font-mono">
                            {record.target_deployment_date ? formatStepDate(record.target_deployment_date) : '--'}
                          </td>
                          
                          {/* Status Badge cell */}
                          <td 
                            className="px-5 py-4 min-w-[200px]" 
                            onClick={(e) => {
                              e.stopPropagation();
                              openStatusEditModal(record);
                            }}
                          >
                            <div className="flex items-center gap-2 group/status cursor-pointer animate-fade-in" title="Click to view/update full interactive timeline">
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-orange/10 text-brand-orange border border-indigo-500/10 hover:bg-brand-orange hover:text-white transition-all shadow-xs group-hover/status:scale-102">
                                <span className="w-5.5 h-5.5 rounded-full bg-brand-orange text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                                  {record.status}
                                </span>
                                <span className="truncate max-w-[150px]">
                                  {activeStepConfig.label}
                                </span>
                              </span>
                            </div>
                          </td>

                          {/* Action cell */}
                          <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={(e) => openEditForm(record, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-all"
                                title="Edit parameters"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteRecord(record.id, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-500/15 transition-all"
                                title="Remove and archive"
                              >
                                <Trash2 size={13} />
                              </button>
                              {isSelected ? <ChevronUp size={14} className="text-brand-orange" /> : <ChevronDown size={14} className="text-slate-400" />}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable designated items details and step tracker (REFER TO IMAGE TIMELINE) */}
                        {isSelected && (
                          <tr>
                            <td colSpan={9} className="px-6 py-5 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                              <div className="space-y-6">
                                
                                {/* 7-STEP REPLICA VISUAL TIMELINE FROM THE USER IMAGE */}
                                <div className="space-y-3">
                                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                    <Layers size={13} className="text-brand-orange" />
                                    Step-by-Step Deployment Stage Track
                                  </h3>
                                  
                                  <div className="relative w-full pt-4 pb-8 overflow-x-auto no-scrollbar">
                                    {/* Connection Line */}
                                    <div className="absolute top-[40px] left-[5%] right-[5%] h-1 bg-slate-200 dark:bg-slate-800 z-0 rounded-full" />
                                    
                                    {/* Connection Highlight (Up to current active step) */}
                                    <div 
                                      className="absolute top-[40px] left-[5%] h-1 bg-brand-orange z-0 transition-all duration-500 rounded-full"
                                      style={{ width: `${Math.min(100, Math.max(0, (record.status - 1) * (90 / 6)))}%` }}
                                    />
                                    
                                    <div className="relative flex justify-between min-w-[850px] z-10 px-4">
                                      {STATUS_STEPS.map((col) => {
                                        const stepActive = col.step <= record.status;
                                        const stepCurrent = col.step === record.status;
                                        const stepDate = record.status_dates[col.step];

                                        return (
                                          <div key={col.step} className="flex flex-col items-center text-center w-[12%] shrink-0">
                                            {/* Number Label */}
                                            <span className={`text-[11px] font-black mb-3 w-5 h-5 rounded-full flex items-center justify-center border font-mono select-none ${
                                              stepActive 
                                                ? 'bg-brand-orange text-white border-brand-orange' 
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                                            }`}>
                                              {col.step}
                                            </span>

                                            {/* Outer Circle Ring */}
                                            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-350 shadow-sm relative ${
                                              stepCurrent 
                                                ? 'ring-4 ring-brand-orange/30 scale-105 bg-brand-orange/15 border-2 border-brand-orange text-brand-orange'
                                                : stepActive 
                                                  ? 'bg-orange-500/10 border-2 border-brand-orange text-brand-orange' 
                                                  : 'bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800'
                                            }`}>
                                              <div className={stepCurrent ? 'scale-110 animate-bounce' : ''}>
                                                {renderCustomStepIcon(col.step, stepActive)}
                                              </div>
                                            </div>

                                            {/* Label Text */}
                                            <p className={`text-[10px] font-extrabold max-w-[110px] mt-2.5 leading-tight ${
                                              stepCurrent 
                                                ? 'text-brand-orange' 
                                                : stepActive 
                                                  ? 'text-slate-800 dark:text-slate-100' 
                                                  : 'text-slate-400'
                                            }`}>
                                              {col.label}
                                            </p>

                                            {/* Date Banner */}
                                            <div className={`mt-2 px-2 py-0.5 rounded-lg text-[9px] font-mono leading-none ${
                                              stepDate 
                                                ? 'bg-orange-500/10 text-brand-orange border border-orange-500/20 font-bold' 
                                                : 'bg-slate-100 dark:bg-slate-850 text-slate-400'
                                            }`}>
                                              {stepDate ? formatStepDate(stepDate) : 'Not Reached'}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-150 dark:border-slate-800">
                                  {/* Designated item details */}
                                  <div className="bg-white dark:bg-slate-950/40 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                      <School size={13} className="text-brand-orange" />
                                      Designated Hardware Items List
                                    </h4>
                                    
                                    <div className="divide-y divide-slate-100 dark:divide-slate-850 max-h-56 overflow-y-auto pr-1">
                                      {record.items.map((item, idX) => (
                                        <div key={`${item.item_code}-${idX}`} className="py-2 flex items-center justify-between text-xs">
                                          <div>
                                            <p className="font-extrabold text-slate-700 dark:text-slate-200">{item.item_name}</p>
                                            <span className="text-[10px] text-slate-400 font-mono">Code: {item.item_code}</span>
                                          </div>
                                          <div className="text-right">
                                            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-850 font-mono font-bold text-slate-800 dark:text-slate-200">
                                              qty: {item.quantity}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                      {record.items.length === 0 && (
                                        <p className="text-xs p-3 text-slate-405 italic text-center">No hardware designated to school.</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* School general details card */}
                                  <div className="bg-white dark:bg-slate-950/40 p-4 rounded-xl border border-slate-150 dark:border-slate-850 text-xs text-left grid grid-cols-2 gap-y-3.5 gap-x-2">
                                    <div className="col-span-2">
                                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
                                        Partner parameters
                                      </h4>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase text-slate-450 font-black">School Monitoring ID</span>
                                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{record.school_monitoring_id || 'Not assigned'}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase text-slate-450 font-black">Type of Document</span>
                                      <p className="font-bold text-brand-orange">{record.type_of_document || 'None Selected'}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase text-slate-450 font-black">Customer ID Reference</span>
                                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{record.customer_code}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase text-slate-450 font-black">Sales Team Force</span>
                                      <p className="font-extrabold text-slate-800 dark:text-slate-200">{record.sales_team}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase text-slate-450 font-black">Scheduled Class Start</span>
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        {record.class_opening ? formatStepDate(record.class_opening) : 'None designated'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase text-slate-450 font-black">Target Delivery Target</span>
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        {record.target_deployment_date ? formatStepDate(record.target_deployment_date) : 'None designated'}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-sm italic text-slate-400">
                        No matches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* FORM MODAL - MONITOR NEW SCHOOL / EDIT PARAMETERS */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 blur-xs backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-155 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingRecord ? 'Edit Monitoring Record' : 'Create Monitoring Entry'}
                </h2>
                <p className="text-xs text-slate-450 mt-0.5">Define school targets and active hardware deployment checklists</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Indicators */}
            <div className="bg-slate-100/40 dark:bg-slate-950/20 px-6 py-3 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-6 w-full animate-fade-in">
                {/* Step 1 indicator */}
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className={`flex-1 flex items-center gap-2 pb-1 border-b-2 text-xs font-black uppercase tracking-wider text-left transition-all ${
                    formStep === 1 
                      ? 'border-brand-orange text-brand-orange' 
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${formStep === 1 ? 'bg-brand-orange text-white' : 'bg-slate-200 dark:bg-slate-850 text-slate-500'}`}>1</span>
                  <span className="truncate">Specification</span>
                </button>

                {/* Step 2 indicator */}
                <button
                  type="button"
                  onClick={() => setFormStep(2)}
                  className={`flex-1 flex items-center gap-2 pb-1 border-b-2 text-xs font-black uppercase tracking-wider text-left transition-all ${
                    formStep === 2 
                      ? 'border-brand-orange text-brand-orange' 
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${formStep === 2 ? 'bg-brand-orange text-white' : 'bg-slate-200 dark:bg-slate-850 text-slate-500'}`}>2</span>
                  <span className="truncate">Hardware Assets</span>
                </button>
              </div>
            </div>

            {/* Modal Form scroll container */}
            <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-left">
              
              {/* PAGE 1: PARTNER SPECIFICATION BLOCK */}
              {formStep === 1 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <h3 className="text-xs font-black uppercase text-slate-440 tracking-wider">SECTION 1: PARTNER SPECIFICATION</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* School Name custom searchable auto-complete */}
                    <div className="sm:col-span-4 flex flex-col gap-1 relative">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        School Name <span className="text-[9px] font-bold text-brand-orange">(type or search)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type or select school..."
                          value={schoolSearchQuery}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSchoolSearchQuery(val);
                            setShowSchoolSuggestions(true);
                            // If exactly matches, fill other fields
                            const matched = schools.find(s => s.name.toLowerCase() === val.toLowerCase());
                            if (matched) {
                              handleSchoolChange(matched.name);
                            } else {
                              setSelectedSchoolName(val);
                              setCustomerCode('');
                              setSalesTeam('');
                            }
                          }}
                          onFocus={() => setShowSchoolSuggestions(true)}
                          className="w-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg p-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 dark:text-white"
                          required
                        />
                        <div className="absolute right-2.5 top-2.5 text-slate-400">
                          <Search size={14} />
                        </div>
                      </div>

                      {/* Autocomplete selection overlay and dropdown */}
                      {showSchoolSuggestions && (
                        <>
                          <div 
                            className="fixed inset-0 z-40 bg-transparent" 
                            onClick={() => setShowSchoolSuggestions(false)} 
                          />
                          <div className="absolute top-[100%] left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800/80 animate-in fade-in zoom-in-95 duration-100">
                            {schools
                              .filter(sch => 
                                sch.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()) ||
                                sch.customer_code.toLowerCase().includes(schoolSearchQuery.toLowerCase())
                              )
                              .map(sch => (
                                <button
                                  key={sch.id}
                                  type="button"
                                  onClick={() => {
                                    setSchoolSearchQuery(sch.name);
                                    handleSchoolChange(sch.name);
                                    setShowSchoolSuggestions(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col gap-0.5 cursor-pointer"
                                >
                                  <span className="font-extrabold text-xs text-slate-700 dark:text-slate-200">{sch.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{sch.customer_code} • {sch.sales_team}</span>
                                </button>
                              ))}
                            {schools.filter(sch => 
                              sch.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()) ||
                              sch.customer_code.toLowerCase().includes(schoolSearchQuery.toLowerCase())
                            ).length === 0 && (
                              <div className="p-3 text-center text-xs text-slate-450 italic">
                                "{schoolSearchQuery}" is custom (Press enter to save as is)
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Program drop box */}
                    <div className="sm:col-span-3 flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Program</label>
                      <select
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 dark:text-white"
                      >
                        <option value="">-- No program (Null) --</option>
                        <option value="NGS">NGS</option>
                        <option value="HUB">HUB</option>
                        <option value="TNL">TNL</option>
                        <option value="ACE">ACE</option>
                        <option value="NGS+ACE">NGS+ACE</option>
                        <option value="HUB+ACE">HUB+ACE</option>
                        <option value="PELS NGS">PELS NGS</option>
                        <option value="PELS NGS+ACE">PELS NGS+ACE</option>
                        <option value="ACE+PELS">ACE+PELS</option>
                        <option value="ABDL">ABDL</option>
                        <option value="ACE+ABDL">ACE+ABDL</option>
                        <option value="HUB+NGS">HUB+NGS</option>
                        <option value="ABDL (PELS)">ABDL (PELS)</option>
                      </select>
                    </div>

                    {/* Customer code autofocus view */}
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide opacity-80">Customer Code</label>
                      <input
                        type="text"
                        placeholder="Autofilled"
                        value={customerCode}
                        disabled
                        className="w-full border border-slate-155 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 text-sm text-slate-500 font-mono font-bold rounded-lg focus:outline-none"
                      />
                    </div>

                    {/* Sales team autofocus view */}
                    <div className="sm:col-span-3 flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide opacity-80">Sales Force Team</label>
                      <input
                        type="text"
                        placeholder="Autofilled"
                        value={salesTeam}
                        disabled
                        className="w-full border border-slate-155 dark:border-slate-800 bg-slate-100 dark:bg-slate-955 p-2 text-sm text-slate-550 font-bold rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Class opening date picker */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Scheduled Class Start</label>
                      <input
                        type="date"
                        value={classOpening}
                        onChange={(e) => handleClassOpeningChange(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg p-2 text-sm focus:outline-none text-slate-800 dark:text-white"
                      />
                    </div>

                    {/* Deployment target date picker */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Target Deployment Date</label>
                      <input
                        type="date"
                        value={targetDeploymentDate}
                        onChange={(e) => setTargetDeploymentDate(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg p-2 text-sm focus:outline-none text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* School Monitoring ID */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide opacity-80">School Monitoring ID</label>
                      <input
                        type="text"
                        placeholder="Auto-generated"
                        value={schoolMonitoringId}
                        disabled
                        className="w-full border border-slate-155 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 text-sm text-slate-500 font-mono font-bold rounded-lg focus:outline-none"
                      />
                    </div>

                    {/* Type of Document */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Type of Document</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['MOA', 'Addendum', 'AQL'].map((docType) => {
                          const isSelected = typeOfDocument === docType;
                          return (
                            <button
                              key={docType}
                              type="button"
                              onClick={() => setTypeOfDocument(docType as any)}
                              className={`py-2 px-3 text-xs font-black rounded-lg border transition-all text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-brand-orange text-white border-transparent shadow'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              {docType}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE 2: DESIGNATED EQUIPMENT BLOCK */}
              {formStep === 2 && (() => {
                return (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-slate-440 tracking-wider">SECTION 2: HARDWARE ASSETS LIST</h3>
                    </div>

                    {/* ACE / Program Quick Bundle dispatch */}
                    {activeBundles.length > 0 && (
                      <div className="p-3.5 bg-brand-orange/5 border border-brand-orange/15 rounded-xl space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-orange text-white">
                              {program} Program Bundles
                            </span>
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1">
                              Dispatch Predefined Equipment Packages
                            </h4>
                          </div>
                          <p className="text-[10.5px] font-medium text-slate-500 max-w-sm sm:text-right leading-relaxed">
                            Automate checklist creation with predefined packages.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {activeBundles.map((b, bIdx) => {
                            return (
                              <div 
                                key={`${b.name}-${bIdx}`} 
                                className="p-2.5 border rounded-lg flex items-center justify-between gap-3 shadow-xs transition-all bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 hover:border-brand-orange/30"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11.5px] font-extrabold truncate flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                                    <span>{b.name}</span>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBundleForMultiplier(b.name);
                                    setBundleMultiplierValue(1);
                                    setIsMultiplierModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-brand-orange hover:bg-brand-orange/95 text-white rounded-md text-[10.5px] font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
                                >
                                  Add Bundle
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Select stock tool */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-8 flex flex-col gap-1 relative text-left">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">
                          Equipment Catalog Items <span className="text-[9px] font-bold text-brand-orange">(Type to search name or code)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search catalog by description or code..."
                            value={equipmentSearchQuery}
                            onFocus={() => setShowEquipmentSuggestions(true)}
                            onChange={(e) => {
                              setEquipmentSearchQuery(e.target.value);
                              if (selectedHardwareToAdd) {
                                setSelectedHardwareToAdd('');
                              }
                            }}
                            className="w-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg p-2.5 pr-10 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-orange text-slate-800 dark:text-white"
                          />
                          <div className="absolute right-2.5 top-3 flex items-center gap-1.5 text-slate-400">
                            {equipmentSearchQuery || selectedHardwareToAdd ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEquipmentSearchQuery('');
                                  setSelectedHardwareToAdd('');
                                  setShowEquipmentSuggestions(false);
                                }}
                                className="hover:text-red-500 transition-colors p-0.5 cursor-pointer"
                              >
                                <X size={13} strokeWidth={2.5} />
                              </button>
                            ) : (
                              <Search size={13} />
                            )}
                          </div>
                        </div>

                        {/* Dropdown Suggestions List */}
                        {showEquipmentSuggestions && (
                          <>
                            <div 
                              className="fixed inset-0 z-40 bg-transparent" 
                              onClick={() => setShowEquipmentSuggestions(false)} 
                            />
                            <div className="absolute top-[100%] left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 divide-y divide-slate-100 dark:divide-slate-800/80 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar">
                              {filteredEquipment.length === 0 ? (
                                <div className="p-3.5 text-xs text-slate-400 italic">
                                  No matching catalog items found
                                </div>
                              ) : (
                                filteredEquipment.map(eq => {
                                  const isSelected = selectedHardwareToAdd === eq.item_code;
                                  return (
                                    <button
                                      key={eq.item_code}
                                      type="button"
                                      onClick={() => {
                                        setSelectedHardwareToAdd(eq.item_code);
                                        setEquipmentSearchQuery(`${eq.item_name} (${eq.item_code})`);
                                        setShowEquipmentSuggestions(false);
                                      }}
                                      className={`w-full text-left px-4 py-2.5 text-xs transition-all flex flex-col gap-0.5 hover:bg-brand-orange/5 ${
                                        isSelected 
                                          ? 'bg-brand-orange/10 text-brand-orange font-bold' 
                                          : 'text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      <span className="font-extrabold line-clamp-2">{eq.item_name}</span>
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Code: {eq.item_code}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="sm:col-span-2 flex flex-col gap-1">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Qty To Add</label>
                        <input
                          type="number"
                          min={1}
                          value={hardwareQtyToAdd}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setHardwareQtyToAdd(Math.max(1, val));
                          }}
                          className="w-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-lg p-2 text-sm text-center font-bold focus:outline-none text-slate-800 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={addHardwareItem}
                          disabled={!selectedHardwareToAdd}
                          className={`w-full py-2.5 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all text-center ${
                            selectedHardwareToAdd 
                              ? 'bg-brand-orange hover:opacity-90 cursor-pointer' 
                              : 'bg-slate-300 dark:bg-slate-850 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          Add Hardware
                        </button>
                      </div>
                    </div>

                    {/* Selected Designated Items representation */}
                    <div className="border border-slate-150 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                      {formItems.map((fItem, index) => (
                        <div key={`${fItem.item_code}-${index}`} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-extrabold text-slate-800 dark:text-slate-100">{fItem.item_name}</p>
                            <span className="text-[10px] text-slate-400 font-mono">Code: {fItem.item_code}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-brand-orange font-bold font-mono">
                              qty: {fItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeHardwareItem(fItem.item_code)}
                              className="text-slate-400 hover:text-red-500 p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {formItems.length === 0 && (
                        <div className="p-4 text-center text-xs italic text-slate-410 font-medium">
                          No designated equipment items specified. Add items using the selection above.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </form>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
              <div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Discard
                </button>
              </div>

              <div className="flex items-center gap-2">
                {formStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setFormStep(prev => prev - 1)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-805 transition-all cursor-pointer"
                  >
                    Back
                  </button>
                )}

                {formStep < 2 ? (
                  <button
                    type="button"
                    onClick={() => setFormStep(prev => prev + 1)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-750 hover:opacity-90 transition-all cursor-pointer"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveRecord}
                    disabled={saving}
                    className="px-5 py-2 bg-brand-orange text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin" size={13} />
                        Saving...
                      </>
                    ) : 'Persist and Monitor'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BUNDLE MULTIPLIER POPUP MODAL */}
      {isMultiplierModalOpen && selectedBundleForMultiplier && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-150 dark:border-slate-800">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5 font-sans">
                <div className="w-8 h-8 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Bundle Multiplier
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Specify quantity of bundles to dispatch</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMultiplierModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-805 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-5 font-sans">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150/50 dark:border-slate-800/50">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-450">Selected Package</span>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                  {selectedBundleForMultiplier}
                </h4>
              </div>

              {/* Multiplier Input Controls */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">
                  Number of Bundles
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBundleMultiplierValue(prev => Math.max(1, (prev || 1) - 1))}
                    className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 flex items-center justify-center text-slate-800 dark:text-white text-lg font-bold transition-all cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={bundleMultiplierValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setBundleMultiplierValue(val);
                      } else if (e.target.value === '') {
                        setBundleMultiplierValue('' as any);
                      }
                    }}
                    onBlur={() => {
                      if (typeof bundleMultiplierValue !== 'number' || bundleMultiplierValue < 1) {
                        setBundleMultiplierValue(1);
                      }
                    }}
                    className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-center text-base font-extrabold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  />
                  <button
                    type="button"
                    onClick={() => setBundleMultiplierValue(prev => Math.min(99, (prev || 0) + 1))}
                    className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 flex items-center justify-center text-slate-800 dark:text-white text-lg font-bold transition-all cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bundle Contents Preview with multiplied quantities */}
              {(() => {
                const bToApply = activeBundles.find(b => b.name === selectedBundleForMultiplier);
                if (!bToApply) return null;
                const mult = typeof bundleMultiplierValue === 'number' ? bundleMultiplierValue : 1;
                return (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wide">
                      Expected Item Quantities
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150/50 dark:border-slate-800/50 max-h-40 overflow-y-auto divide-y divide-slate-150/30 dark:divide-slate-800/30">
                      {bToApply.items.map((bItem, idx) => {
                        const eqItem = equipment.find(e => e.item_code === bItem.item_code);
                        const itemName = bItem.item_name || (eqItem ? eqItem.item_name : bItem.item_code);
                        
                        let qty = bItem.quantity * mult;
                        if (itemName.toUpperCase().includes('BRASS FASTENER')) {
                          qty = Math.max(1, Math.ceil(mult / 10));
                        }

                        return (
                          <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {itemName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Code: {bItem.item_code}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-extrabold text-slate-900 dark:text-white">
                                {qty} units
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsMultiplierModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-805 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const mult = typeof bundleMultiplierValue === 'number' ? bundleMultiplierValue : 1;
                  applyBundleBatch(selectedBundleForMultiplier, mult);
                  setIsMultiplierModalOpen(false);
                }}
                className="px-5 py-2 bg-brand-orange text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Add Bundles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLY INTERACTIVE 7-STEP STATUS TRACKER MODAL (EXACTLY MATCHES UPLOADED IMAGE) */}
      {activeStatusEditRecord && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-550 dark:text-indigo-400 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-md">
                  Active Dispatch Stage Track
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider mt-1.5 flex items-center gap-2">
                  <span className="text-brand-orange animate-pulse">●</span>
                  {activeStatusEditRecord.school_name}
                </h2>
                <p className="text-xs text-slate-520 dark:text-slate-400 mt-0.5">
                  Click any stage below to dynamically update active progress, and manage individual completion dates.
                </p>
              </div>
              <button 
                onClick={() => setActiveStatusEditRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scroll Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/40 dark:bg-slate-955/20">
              
              {/* STAGE TIMELINE REPLICA (EXACT HIGHLIGHTED GRADIENT FLOW AS IN USER IMAGE) */}
              <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs relative overflow-x-auto no-scrollbar">
                
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-6">
                  Interactive Status Timeline (1 to 7)
                </p>

                <div className="relative pt-6 pb-4 min-w-[900px] px-8">
                  
                  {/* Background horizontal connector line */}
                  <div className="absolute top-[82px] left-[7%] right-[7%] h-[5px] bg-slate-100 dark:bg-slate-800 z-0 rounded-full" />
                  
                  {/* Highlighted active horizontal connector line */}
                  <div 
                    className="absolute top-[82px] left-[7%] h-[5px] bg-brand-orange z-0 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, (modalStatus - 1) * (100 / 6) * 0.86))}%` }}
                  />

                  <div className="relative flex justify-between z-10">
                    {STATUS_STEPS.map((st) => {
                      const isActive = st.step <= modalStatus;
                      const isCurrent = st.step === modalStatus;
                      const stepDate = modalStatusDates[st.step];

                      // Custom Step Icon matching user's image precisely
                      const customIcon = (() => {
                        switch (st.step) {
                          case 1:
                            return (
                              <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className={`w-8 h-8 ${isActive ? 'text-amber-500' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                                </svg>
                                <div className={`absolute top-1 left-2.5 w-3.5 h-3 bg-white border ${isActive ? 'border-amber-400' : 'border-slate-200'} rounded-[1.5px] flex flex-col justify-around p-[2px] rotate-6`}>
                                  <div className={`h-[1px] w-full ${isActive ? 'bg-amber-300' : 'bg-slate-200'}`} />
                                  <div className={`h-[1px] w-2/3 ${isActive ? 'bg-amber-300' : 'bg-slate-200'}`} />
                                </div>
                                {isActive && (
                                  <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-full p-[1.5px] border border-white dark:border-slate-900 shadow-xs">
                                    <CheckCircle2 size={8} className="text-white" />
                                  </div>
                                )}
                              </div>
                            );
                          case 2:
                            return (
                              <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className={`w-8 h-8 ${isActive ? 'text-amber-500' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                                </svg>
                                <div className={`absolute top-1 left-2.5 w-3.5 h-3 bg-white border ${isActive ? 'border-amber-400' : 'border-slate-200'} rounded-[1.5px] flex flex-col justify-around p-[2px] -rotate-6`}>
                                  <div className={`h-[1px] w-full ${isActive ? 'bg-amber-300' : 'bg-slate-200'}`} />
                                  <div className={`h-[1px] w-2/3 ${isActive ? 'bg-amber-300' : 'bg-slate-200'}`} />
                                </div>
                                {isActive && (
                                  <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-full p-[1.5px] border border-white dark:border-slate-900 shadow-xs flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            );
                          case 3:
                            return (
                              <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className={`w-7 h-7.5 ${isActive ? 'text-orange-500' : 'text-slate-300'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill={isActive ? '#FF5C00' : '#CBD5E1'} />
                                  <line x1="8" y1="10" x2="16" y2="10" />
                                  <line x1="8" y1="14" x2="16" y2="14" />
                                </svg>
                                {isActive && (
                                  <div className="absolute bottom-0.5 right-1.5 bg-brand-orange text-white rounded-full w-3.5 h-3.5 flex items-center justify-center border border-white dark:border-slate-900 text-[9px] font-black">
                                    +
                                  </div>
                                )}
                              </div>
                            );
                          case 4:
                            return (
                              <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className={`w-8 h-8 ${isActive ? 'text-orange-500' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                                {isActive && (
                                  <div className="absolute bottom-0.5 right-0.5 bg-brand-orange text-white rounded-full p-[2px] border border-white dark:border-slate-900">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            );
                          case 5:
                            return (
                              <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className={`w-7.5 h-7.5 ${isActive ? 'text-orange-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <circle cx="9" cy="21" r="1" fill="currentColor" />
                                  <circle cx="20" cy="21" r="1" fill="currentColor" />
                                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                {isActive && (
                                  <div className="absolute top-0 right-0 bg-emerald-500 rounded-full p-[2px] border border-white dark:border-slate-900 flex items-center justify-center">
                                    <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            );
                          case 6:
                            return (
                              <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className={`w-8 h-8 ${isActive ? 'text-orange-500' : 'text-slate-300'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <rect x="1" y="3" width="13" height="13" />
                                  <polygon points="14 8 18 8 21 11 21 16 14 16" />
                                  <circle cx="17" cy="18" r="2.2" />
                                  <circle cx="5" cy="18" r="2.2" />
                                </svg>
                              </div>
                            );
                          case 7:
                            return (
                              <div className="relative w-11 h-11 flex items-center justify-center">
                                <svg className={`w-8.5 h-8.5 ${isActive ? 'text-orange-500' : 'text-slate-300'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path d="M22 10v11H2V10l10-6 10 6z" />
                                  <path d="M6 12h4v8H6z" />
                                  <path d="M14 12h4v8h-4z" />
                                  <line x1="12" y1="4" x2="12" y2="7" />
                                  <polygon points="12 4 15 5.5 12 7" fill={isActive ? '#FF5C00' : 'none'} />
                                </svg>
                              </div>
                            );
                          default:
                            return null;
                        }
                      })();

                      const isAutomated = st.step === 3 || st.step === 6 || st.step === 7;

                      return (
                        <div 
                          key={st.step} 
                          onClick={() => {
                            if (isAutomated) {
                              showInfo('Automated Stage', `${st.label} (Step ${st.step}) is synchronized automatically and cannot be modified manually.`);
                              return;
                            }
                            setModalStatus(st.step);
                            if (!modalStatusDates[st.step]) {
                              setModalStatusDates(prev => ({ ...prev, [st.step]: getTodayString() }));
                            }
                          }}
                          className={`flex flex-col items-center text-center w-[12%] shrink-0 group/col transition-all duration-350 select-none ${
                            isAutomated ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:-translate-y-1'
                          }`}
                        >
                          {/* Top circle number tag */}
                          <div className="flex flex-col items-center gap-1 mb-2">
                            <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border font-mono transition-transform duration-300 ${
                              isActive 
                                ? 'bg-brand-orange text-white border-brand-orange scale-110 shadow-xs' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}>
                              {st.step}
                            </span>
                            {isAutomated && (
                              <span className="text-[7.5px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1 py-0.2 rounded tracking-wider leading-none shrink-0">
                                Auto
                              </span>
                            )}
                          </div>

                          {/* Big Circle with specific custom styled SVG */}
                          <div className={`w-15 h-15 rounded-full flex items-center justify-center transition-all duration-350 relative shadow-xs bg-white dark:bg-slate-900 border ${
                            isCurrent
                              ? 'ring-4 ring-brand-orange/30 border-brand-orange scale-105 text-brand-orange'
                              : isActive
                                ? 'border-brand-orange/80 text-brand-orange bg-brand-orange/[0.04]'
                                : 'border-slate-200 dark:border-slate-800 text-slate-300'
                          }`}>
                            {customIcon}
                          </div>

                          {/* Line Connector Node (Direct replica of user's image with circles and ticks) */}
                          <div className="my-[13px] flex items-center justify-center h-[14px]">
                            {isActive ? (
                              <div className="w-[14px] h-[14px] rounded-full bg-brand-orange text-white border border-brand-orange flex items-center justify-center shadow-xs">
                                <svg className="w-1.5 h-1.5 text-white" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-[12px] h-[12px] rounded-full bg-slate-100 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800" />
                            )}
                          </div>

                          {/* Status Stage Label */}
                          <p className={`text-[10px] font-black max-w-[110px] uppercase tracking-wide leading-tight leading-4 h-8 ${
                            isCurrent 
                              ? 'text-brand-orange scale-102 font-black' 
                              : isActive 
                                ? 'text-slate-800 dark:text-slate-100' 
                                : 'text-slate-400'
                          }`}>
                            {st.label}
                          </p>

                          {/* Target Date Banner */}
                          <div className={`mt-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wide leading-none transition-all ${
                            stepDate 
                              ? 'bg-amber-500/10 text-brand-orange border border-amber-500/20 shadow-xs scale-102' 
                              : 'bg-slate-100 dark:bg-slate-850 text-slate-400'
                          }`}>
                            {stepDate ? formatStepDate(stepDate) : 'Not Reached'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* DATE ADJUSTERS SECTION */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-brand-orange" />
                    Refine Completion Dates for Active Stages
                  </h3>
                  <button 
                    type="button"
                    onClick={() => {
                      // Set today's date for all completed stages that are currently empty
                      const updatedDates = { ...modalStatusDates };
                      const today = getTodayString();
                      for (let i = 1; i <= modalStatus; i++) {
                        if (i === 3 || i === 6 || i === 7) continue; // Skip automated steps
                        if (!updatedDates[i]) updatedDates[i] = today;
                      }
                      setModalStatusDates(updatedDates);
                      showInfo('Auto-filled current date', 'Dates populated for attained non-automated steps');
                    }}
                    className="text-[10px] font-black text-indigo-550 dark:text-indigo-400 hover:underline uppercase tracking-wider"
                  >
                    Set All Completed Steps to Today
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  {STATUS_STEPS.map((col) => {
                    const isReached = col.step <= modalStatus;
                    const isAutomated = col.step === 3 || col.step === 6 || col.step === 7;
                    return (
                      <div 
                        key={col.step} 
                        className={`p-3 border rounded-xl flex flex-col gap-1.5 transition-all ${
                          isReached 
                            ? 'bg-orange-500/[0.02]/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800' 
                            : 'bg-slate-50/50 dark:bg-slate-950/10 border-slate-100 dark:border-slate-900 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] font-mono leading-none ${
                              isReached ? 'bg-orange-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                            }`}>
                              {col.step}
                            </span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate" title={col.label}>
                              {col.label}
                            </span>
                          </div>
                          {isAutomated && (
                            <span className="text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded tracking-widest leading-none shrink-0">
                              Auto
                            </span>
                          )}
                        </div>
                        
                        <input
                          type="date"
                          disabled={!isReached || isAutomated}
                          value={modalStatusDates[col.step] || ''}
                          onChange={(e) => {
                            if (isAutomated) return;
                            const val = e.target.value;
                            setModalStatusDates(prev => ({
                              ...prev,
                              [col.step]: val
                            }));
                          }}
                          className={`w-full bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-orange ${
                            (!isReached || isAutomated) ? 'bg-slate-100/50 dark:bg-slate-950 cursor-not-allowed' : 'font-semibold border-brand-orange/25'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setActiveStatusEditRecord(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer"
              >
                Discard
              </button>

              <button
                type="button"
                onClick={handleSaveModalStatus}
                className="px-5 py-2 bg-brand-orange text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer font-black"
              >
                Save Dispatch Tracker
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT-ONLY REPORT ELEMENT */}
      <div className="hidden print:block print-report-container bg-white text-slate-900 p-8 font-sans w-full min-h-screen">
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
            Aralinks School Distribution & Monitoring Report
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generated on {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
          </p>
          <div className="flex gap-4 mt-2.5 text-[11px] font-bold text-slate-700">
            <div>Program Filter: <span className="text-slate-900">{selectedProgramFilter}</span></div>
            <div>Sales Team Filter: <span className="text-slate-900">{selectedSalesTeamFilter}</span></div>
            <div>Active Stage: <span className="text-slate-900">{selectedStatusFilter !== null ? `Stage ${selectedStatusFilter}` : 'ALL'}</span></div>
            <div>Total Records: <span className="text-slate-900">{filteredRecords.length}</span></div>
          </div>
        </div>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-slate-400 text-left font-black uppercase tracking-wider text-slate-800">
              <th className="py-2.5 pr-2">Customer Code</th>
              <th className="py-2.5 px-2">School Name</th>
              <th className="py-2.5 px-2">Program</th>
              <th className="py-2.5 px-2">Sales Team</th>
              <th className="py-2.5 px-2">Class Opening</th>
              <th className="py-2.5 px-2">Target Date</th>
              <th className="py-2.5 px-2">Status Stage</th>
              <th className="py-2.5 pl-2">Assigned Hardware Assets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRecords.map((r) => {
              const STATUS_LABELS: Record<number, string> = {
                1: 'PO Creation',
                2: 'Cataloguing',
                3: 'Dispatching',
                4: 'In-Transit',
                5: 'Delivered',
                6: 'Installation',
                7: 'User Training'
              };
              const statusLabel = STATUS_LABELS[r.status] || `Stage ${r.status}`;
              const assetsList = r.items && r.items.length > 0
                ? r.items.map(item => `${item.item_name} (x${item.quantity})`).join(', ')
                : 'None';
              return (
                <tr key={r.id} className="align-top hover:bg-slate-50">
                  <td className="py-2 pr-2 font-mono font-bold text-slate-700">{r.customer_code}</td>
                  <td className="py-2 px-2 font-extrabold text-slate-900">{r.school_name}</td>
                  <td className="py-2 px-2 font-semibold text-slate-700 uppercase">{r.program || 'OTHER'}</td>
                  <td className="py-2 px-2 text-slate-700">{r.sales_team}</td>
                  <td className="py-2 px-2 font-mono text-slate-700">{r.class_opening ? formatStepDate(r.class_opening) : '--'}</td>
                  <td className="py-2 px-2 font-mono text-slate-700">{r.target_deployment_date ? formatStepDate(r.target_deployment_date) : '--'}</td>
                  <td className="py-2 px-2 font-bold uppercase text-slate-900">{statusLabel} (S{r.status})</td>
                  <td className="py-2 pl-2 text-slate-600 italic leading-relaxed">{assetsList}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredRecords.length === 0 && (
          <div className="py-8 text-center text-slate-400 italic">No records match current filters.</div>
        )}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-report-container, .print-report-container * {
            visibility: visible !important;
          }
          .print-report-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 24px !important;
          }
        }
      `}</style>

    </div>
  );
};

export default SchoolMonitoring;
