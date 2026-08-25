import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { syncSchoolMonitoringWithDRs } from './monitoringSync';
import { 
  ArrowLeft, 
  ArrowRight,
  Save, 
  Trash2, 
  Plus, 
  FileText, 
  User, 
  Building2, 
  Tag, 
  Briefcase, 
  Calendar, 
  Settings, 
  Check, 
  ChevronDown, 
  AlertCircle, 
  AlertTriangle,
  Eye, 
  Info, 
  Fingerprint, 
  Printer, 
  CheckCircle2, 
  PenTool, 
  Sparkles, 
  X,
  Loader2,
  FileCheck,
  ListPlus,
  Compass,
  Upload,
  Image,
  FileUp,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { useNotification } from './NotificationProvider';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getBundleColor } from '../lib/utils';

// Local storage key
const STORAGE_KEY = 'aralinks_delivery_receipts';

interface DRHardwareItem {
  id: string;
  qty: number;
  unit: string;
  description: string;
  specifications: string;
  remarks: string;
  item_code?: string;
  deduct_location?: string;
  bundle_name?: string;
  bundle?: string;
}

export interface ACEPrintPage {
  pageNumber: number;
  totalPages: number;
  groupKey: 'arduino' | 'raspberry' | 'toolkit_group' | 'other';
  groupLabel: string;
  badgeColor: string;
  items: DRHardwareItem[];
}

export const getAcePrintPages = (items: DRHardwareItem[]): ACEPrintPage[] => {
  if (!items || items.length === 0) {
    return [{
      pageNumber: 1,
      totalPages: 1,
      groupKey: 'other',
      groupLabel: 'HARDWARE',
      badgeColor: '#ea580c',
      items: []
    }];
  }

  // Helper to categorize single item into ACE bundles
  const classifyItem = (hw: DRHardwareItem): 'arduino' | 'raspberry' | 'toolkit_group' | 'other' => {
    const r = (hw.remarks || '').toUpperCase();
    const b = (hw.bundle_name || hw.bundle || '').toUpperCase();
    const d = (hw.description || '').toUpperCase();
    const text = `${b} ${r} ${d}`;

    if (text.includes('ARDUINO')) return 'arduino';
    if (text.includes('RASPBERRY')) return 'raspberry';
    if (
      text.includes('LITTLE BITS') ||
      text.includes('LITTLEBITS') ||
      text.includes('MICRO:BIT') ||
      text.includes('MICROBIT') ||
      text.includes('MICRO BIT') ||
      text.includes('MAKEY-MAKEY') ||
      text.includes('MAKEY MAKEY') ||
      text.includes('MAKEYMAKEY') ||
      text.includes('AF TOOLS') ||
      text.includes('AF-TOOLS') ||
      text.includes('A&F TOOLS')
    ) {
      return 'toolkit_group';
    }
    return 'other';
  };

  const classified = items.map(it => ({ item: it, cat: classifyItem(it) }));
  const hasAceBundles = classified.some(c => c.cat !== 'other');

  // If there are no ACE bundles at all, return all items on a single page
  if (!hasAceBundles) {
    return [{
      pageNumber: 1,
      totalPages: 1,
      groupKey: 'other',
      groupLabel: 'HARDWARE',
      badgeColor: '#ea580c',
      items: items
    }];
  }

  const arduinoItems: DRHardwareItem[] = [];
  const raspberryItems: DRHardwareItem[] = [];
  const toolkitGroupItems: DRHardwareItem[] = [];
  const otherItems: DRHardwareItem[] = [];

  classified.forEach(({ item, cat }) => {
    if (cat === 'arduino') arduinoItems.push(item);
    else if (cat === 'raspberry') raspberryItems.push(item);
    else if (cat === 'toolkit_group') toolkitGroupItems.push(item);
    else otherItems.push(item);
  });

  const rawPages: {
    groupKey: 'arduino' | 'raspberry' | 'toolkit_group' | 'other';
    groupLabel: string;
    badgeColor: string;
    items: DRHardwareItem[];
  }[] = [];

  if (otherItems.length > 0) {
    rawPages.push({
      groupKey: 'other',
      groupLabel: 'HARDWARE - GENERAL / NON-BUNDLE',
      badgeColor: '#64748b',
      items: otherItems
    });
  }

  if (arduinoItems.length > 0) {
    rawPages.push({
      groupKey: 'arduino',
      groupLabel: 'HARDWARE - ARDUINO BUNDLE',
      badgeColor: '#8b5cf6',
      items: arduinoItems
    });
  }

  if (raspberryItems.length > 0) {
    rawPages.push({
      groupKey: 'raspberry',
      groupLabel: 'HARDWARE - RASPBERRY BUNDLE',
      badgeColor: '#ec4899',
      items: raspberryItems
    });
  }

  if (toolkitGroupItems.length > 0) {
    rawPages.push({
      groupKey: 'toolkit_group',
      groupLabel: 'HARDWARE - LITTLE BITS, MICRO:BIT, MAKEY-MAKEY & AF TOOLS',
      badgeColor: '#10b981',
      items: toolkitGroupItems
    });
  }

  const total = rawPages.length || 1;
  return rawPages.map((p, idx) => ({
    ...p,
    pageNumber: idx + 1,
    totalPages: total
  }));
};

interface DRServiceItem {
  id: string;
  qty: number;
  unit: string;
  serviceDetails: string;
}

interface DRSignatory {
  name: string;
  date: string;
  signatureImage?: string; // Data URL
  type: 'drawn' | 'typed' | 'pending';
}

interface DeliveryReceiptData {
  id: string; // DR number
  date: string;
  deliveredTo: string;
  clientCode: string;
  address: string;
  agent: string;
  contactPerson: string;
  contactNo: string;
  project: string;
  moa: string;
  status: 'Ready for delivery' | 'In Transit' | 'Delivered';
  inTransitDate?: string;
  deliveredDate?: string;
  hardwareItems: DRHardwareItem[];
  serviceItems: DRServiceItem[];
  signatoryPrepared: DRSignatory;
  signatoryApproved: DRSignatory;
  signatoryDelivered: DRSignatory;
  signatoryCheckedReceived: DRSignatory;
  remarks?: string;
}

// Prefilled seed pools
const MOCK_SCHOOLS = [
  { name: 'ST. LOUIS SCHOOL (CENTER), INC.', customer_code: 'C00000231(GS)', location: 'ASSUMPTION ROAD, 2600 BAGUIO CITY, BEN', sales_team: 'Team Gina', moa: 'S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26' },
  { name: 'Ateneo de Manila University', customer_code: 'ATC-2201_ADMU', location: 'Katipunan Ave, Quezon City', sales_team: 'John Doe', moa: 'S.Y. 2025 TO S.Y. 2026-27' },
  { name: 'De La Salle University', customer_code: 'DLC-3401_DLSU', location: 'Taft Ave, Manila', sales_team: 'Jane Smith', moa: 'S.Y. 2024 TO S.Y. 2025-26' },
  { name: 'University of Santo Tomas', customer_code: 'UST-5109_UST', location: 'España Blvd, Sampaloc, Manila', sales_team: 'Robert Johnson', moa: 'S.Y. 2024 TO S.Y. 2026-27' },
  { name: 'Far Eastern University', customer_code: 'FEU-4202_FEU', location: 'Nicanor Reyes St, Sampaloc, Manila', sales_team: 'John Doe', moa: 'S.Y. 2025-2026' },
  { name: 'Mapua University', customer_code: 'MAP-1105_MAP', location: 'Muralla St, Intramuros, Manila', sales_team: 'Michael Garibaldi', moa: 'S.Y. 2026-2027' }
];

const MOCK_HARDWARE_CATALOG = [
  { code: 'INVD0000336', name: 'LAPTOP-Acer A15-51M-56E2 Steel Gray', spec: 'NXKS7SP00141509F333400', unit: 'unit' },
  { code: 'EQ-CHG-ACER', name: 'ACER LAPTOP CHARGER (THIN PIN)', spec: 'Standard 45W 4.0mm Pin', unit: 'pcs' },
  { code: 'EQ-TAB-A10', name: 'Aralinks Tablet Book Lite', spec: 'A10 Pro 10.4" Quadcore 4G/128G', unit: 'pcs' },
  { code: 'EQ-SIB-H75', name: 'Aralinks Smart Interactive Board 75"', spec: 'UHD 4K Quad Pen Dual OS Win11', unit: 'pcs' },
  { code: 'EQ-VR-G02', name: 'Aralinks VR Headset G2', spec: 'OpticX Virtual Reality Box with Controllers', unit: 'pcs' }
];

interface CreateDeliveryReceiptPageProps {
  isDarkMode?: boolean;
}

export const CreateDeliveryReceiptPage: React.FC<CreateDeliveryReceiptPageProps> = ({ isDarkMode = false }) => {
  const { drId } = useParams<{ drId?: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useNotification();

  const isEditMode = !!drId;

  // Form Fields
  const [drNo, setDrNo] = useState('');
  const [dateOfAcceptance, setDateOfAcceptance] = useState('');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [address, setAddress] = useState('');
  const [agent, setAgent] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [project, setProject] = useState('');
  const [moa, setMoa] = useState('');
  const [status, setStatus] = useState<DeliveryReceiptData['status']>('Ready for delivery');
  const [initialStatus, setInitialStatus] = useState<DeliveryReceiptData['status'] | null>(null);
  const [inTransitDate, setInTransitDate] = useState('');
  const [deliveredDate, setDeliveredDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [schoolMonitoringId, setSchoolMonitoringId] = useState('');

  // Items Tables states
  const [hardwareItems, setHardwareItems] = useState<DRHardwareItem[]>([]);
  const [serviceItems, setServiceItems] = useState<DRServiceItem[]>([]);

  // Signatories (Default values: Prepared by = Bianca Aguinaldo, Approved by = Jerald Dela Cruz, Delivered = blank, fully editable)
  const [signatoryPrepared, setSignatoryPrepared] = useState<DRSignatory>({ name: 'Bianca Aguinaldo', date: '', type: 'typed' });
  const [signatoryApproved, setSignatoryApproved] = useState<DRSignatory>({ name: 'Jerald Dela Cruz', date: '', type: 'typed' });
  const [signatoryDelivered, setSignatoryDelivered] = useState<DRSignatory>({ name: '', date: '', type: 'typed' });
  const [signatoryCheckedReceived, setSignatoryCheckedReceived] = useState<DRSignatory>({ name: '', date: '', type: 'pending' });
  const [previewActivePageTab, setPreviewActivePageTab] = useState<number | 'all'>('all');

  // Autocomplete UI controllers
  const [schoolType, setSchoolType] = useState<'new' | 'existing'>('new');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [monitoringRecords, setMonitoringRecords] = useState<any[]>([]);

  useEffect(() => {
    const fetchMonitoring = async () => {
      let loaded: any[] = [];
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('school_monitoring')
            .select('*')
            .order('school_name', { ascending: true });
          if (!error && data && data.length > 0) {
            loaded = data.map((row: any) => ({
              ...row,
              id: row.id,
              school_name: row.school_name,
              school_monitoring_id: row.school_monitoring_id || '',
              customer_code: row.customer_code,
              program: row.program,
              sales_team: row.sales_team,
              class_opening: row.class_opening,
              target_deployment_date: row.target_deployment_date,
              status: row.status,
              items: row.items || []
            }));
          }
        } catch (e) {
          console.error('Failed to fetch school_monitoring from Supabase', e);
        }
      }

      if (loaded.length === 0) {
        const raw = localStorage.getItem('aralinks_school_monitoring');
        if (raw) {
          try {
            loaded = JSON.parse(raw);
          } catch (e) {
            console.error('Failed to parse aralinks_school_monitoring', e);
          }
        }
      }
      
      if (!loaded || loaded.length === 0) {
        // Use fallback matching SchoolMonitoring.tsx mock
        loaded = [
          {
            id: 'mock-1',
            school_monitoring_id: 'SM-2026-001',
            customer_code: 'SCH-2026-001',
            school_name: 'St. Mary Polytechnic College',
            program: 'ACE',
            sales_team: 'Luzon Elite Sales Force',
            class_opening: '2026-06-15',
            target_deployment_date: '2026-06-08',
            status: 5,
            items: [
              { item_code: 'INVD0000336', item_name: 'Acer A15 Laptop Steel Gray', quantity: 15 },
              { item_code: 'INVD0000344', item_name: 'Acer Laptop Charger Thin Pin', quantity: 15 }
            ]
          },
          {
            id: 'mock-2',
            school_monitoring_id: 'SM-2026-042',
            customer_code: 'SCH-2026-042',
            school_name: 'Quezon Science High School',
            program: 'NGS',
            sales_team: 'NCR Academic Alliance',
            class_opening: '2026-07-20',
            target_deployment_date: '2026-07-10',
            status: 3,
            items: [
              { item_code: 'INVD0000410', item_name: 'Smart Interactive Board (SIB) 65"', quantity: 1 }
            ]
          }
        ];
      }
      setMonitoringRecords(loaded);
    };

    fetchMonitoring();
  }, []);

  const [hardwareSearchQueries, setHardwareSearchQueries] = useState<{ [rowId: string]: string }>({});
  const [hardwareDropdownOpens, setHardwareDropdownOpens] = useState<{ [rowId: string]: boolean }>({});

  // Serial number dropdown & dynamic search states
  const [serialDropdownOpens, setSerialDropdownOpens] = useState<{ [rowId: string]: boolean }>({});
  const [serialSearchQueries, setSerialSearchQueries] = useState<{ [rowId: string]: string }>({});
  const [availableSerials, setAvailableSerials] = useState<{ [itemCode: string]: { serial_number: string; location: string; condition: string; item_code?: string }[] }>({});
  const [loadingSerials, setLoadingSerials] = useState<{ [itemCode: string]: boolean }>({});
  const [globalAvailableSerials, setGlobalAvailableSerials] = useState<{ serial_number: string; item_code: string; location: string; condition: string }[]>([]);
  const [loadingGlobalSerials, setLoadingGlobalSerials] = useState(false);

  // Step Workflow Navigation: Step 1 (Edit Form Details) -> Step 2 (Print Preview & Sign before Save & Publish)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Signatory Scribbling & E-Signature Overlay state
  const [drawingSignatoryKey, setDrawingSignatoryKey] = useState<'prepared' | 'approved' | 'delivered' | 'checkedReceived' | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [sigModalTab, setSigModalTab] = useState<'upload' | 'draw' | 'type'>('upload');
  const [uploadedSigPreview, setUploadedSigPreview] = useState<string | null>(null);
  const [typedSignName, setTypedSignName] = useState('');
  const [typedSignDate, setTypedSignDate] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScribbling, setIsScribbling] = useState(false);
  const sigFileInputRef = useRef<HTMLInputElement | null>(null);

  // Bundle and equipment list states for dynamic bundle loading
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [locationStocksList, setLocationStocksList] = useState<any[]>([]);
  const [availableBundles, setAvailableBundles] = useState<string[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [isBundleDropdownOpen, setIsBundleDropdownOpen] = useState(false);
  const [selectedBundleDropdown, setSelectedBundleDropdown] = useState('');
  const [pendingBundle, setPendingBundle] = useState<string | null>(null);
  const [bundleQuantity, setBundleQuantity] = useState('1');
  const bundleDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Dates and DR info
  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10);
    setDateOfAcceptance(today);
    setSignatoryPrepared(prev => ({ ...prev, date: today }));
    setSignatoryApproved(prev => ({ ...prev, date: today }));
    setSignatoryDelivered(prev => ({ ...prev, date: today }));
    setSignatoryCheckedReceived(prev => ({ ...prev, date: today }));

    // Generate random DR No in Create Mode
    if (!isEditMode) {
      const randNo = Math.floor(10000 + Math.random() * 90000);
      const randYearPart = today.substring(2, 4) + today.substring(5, 7);
      setDrNo(`00${randYearPart}-${randNo}`);
    }
  }, [isEditMode]);

  // Load existing DR record if edit mode
  useEffect(() => {
    const loadRecord = async () => {
      if (isEditMode && drId) {
        try {
          let found: any = null;

          if (isSupabaseConfigured) {
            try {
              const { data, error } = await supabase
                .from('delivery_receipts')
                .select('*')
                .eq('id', drId)
                .maybeSingle();
              if (!error && data) {
                found = {
                  id: data.id,
                  schoolName: data.school_name,
                  schoolMonitoringId: data.school_monitoring_id,
                  school_monitoring_id: data.school_monitoring_id,
                  clientCode: data.client_code,
                  agent: data.agent,
                  project: data.project,
                  date: data.date,
                  status: data.status === 'In transit' ? 'In Transit' : data.status,
                  inTransitDate: data.in_transit_date,
                  deliveredDate: data.delivered_date,
                  totalItems: data.total_items,
                  issuedBy: data.issued_by,
                  deliveredBy: data.delivered_by,
                  receivedBy: data.received_by,
                  remarks: data.remarks,
                  hardwareItems: typeof data.hardware_items === 'string' ? JSON.parse(data.hardware_items) : (data.hardware_items || []),
                  serviceItems: typeof data.service_items === 'string' ? JSON.parse(data.service_items) : (data.service_items || []),
                  signatoryPrepared: typeof data.signatory_prepared === 'string' ? JSON.parse(data.signatory_prepared) : data.signatory_prepared,
                  signatoryApproved: typeof data.signatory_approved === 'string' ? JSON.parse(data.signatory_approved) : data.signatory_approved,
                  signatoryDelivered: typeof data.signatory_delivered === 'string' ? JSON.parse(data.signatory_delivered) : data.signatory_delivered,
                  signatoryCheckedReceived: typeof data.signatory_checked_received === 'string' ? JSON.parse(data.signatory_checked_received) : data.signatory_checked_received,
                  address: data.address,
                  contactPerson: data.contact_person,
                  contactNo: data.contact_no,
                  moa: data.moa,
                  deliveryHistory: typeof data.delivery_history === 'string' ? JSON.parse(data.delivery_history) : (data.delivery_history || [])
                };
              }
            } catch (err) {
              console.warn('Failed to load edit details from Supabase:', err);
            }
          }

          if (!found) {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
              const receipts: any[] = JSON.parse(localData);
              found = receipts.find(r => r.id === drId || r.drNo === drId);
            }
          }

          if (found) {
            // Found existing receipt. Fill state
            setDrNo(found.id || found.drNo);
            setDateOfAcceptance(found.date);
            setDeliveredTo(found.schoolName || found.deliveredTo || '');
            setSchoolSearchQuery(found.schoolName || found.deliveredTo || '');
            const smId = found.school_monitoring_id || found.schoolMonitoringId || '';
            setSchoolMonitoringId(smId);
            setSchoolType(smId ? 'new' : 'existing');
            setClientCode(found.clientCode || '');
            setAddress(found.address || '');
            setAgent(found.agent || '');
            setContactPerson(found.contactPerson || '');
            setContactNo(found.contactNo || '');
            setProject(found.project || '');
            setMoa(found.moa || '');
            setStatus(found.status || 'Ready for delivery');
            setInitialStatus(found.status || 'Ready for delivery');
            setInTransitDate(found.inTransitDate || '');
            setDeliveredDate(found.deliveredDate || '');
            setRemarks(found.remarks || '');

            // Load items
            if (found.hardwareItems && found.hardwareItems.length > 0) {
              setHardwareItems(found.hardwareItems);
            } else if (found.items) {
              // Convert basic schema
              const convertedHardware = found.items.map((it: any, index: number) => ({
                id: it.id || `hw-${index}-${Date.now()}`,
                qty: it.qty,
                unit: it.uom || 'pcs',
                description: it.description,
                specifications: it.serialNumber || '',
                remarks: it.remarks || ''
              }));
              setHardwareItems(convertedHardware);
            } else {
              setHardwareItems([]);
            }

            // Load services
            if (found.serviceItems) {
              setServiceItems(found.serviceItems);
            } else {
              setServiceItems([]);
            }

            // Load signatories
            if (found.signatoryPrepared) setSignatoryPrepared(found.signatoryPrepared);
            if (found.signatoryApproved) setSignatoryApproved(found.signatoryApproved);
            if (found.signatoryDelivered) setSignatoryDelivered(found.signatoryDelivered);
            if (found.signatoryCheckedReceived) setSignatoryCheckedReceived(found.signatoryCheckedReceived);
          }
        } catch (e) {
          console.error('Error loading delivery receipt edit details', e);
        }
      } else {
        // Seed default items in CREATE MODE to replicate the template exactly!
        setHardwareItems([]);

        // Seed default service items to match the layout
        setServiceItems([
          {
            id: `srv-default-1`,
            qty: 1,
            unit: 'service',
            serviceDetails: 'Standard Configuration, Enrollment, and Domain Deployment of Student Units'
          }
        ]);
      }
    };

    loadRecord();
  }, [isEditMode, drId]);

  // Fetch equipment, actual inventory summary and schools list on mount
  useEffect(() => {
    const fetchEquipmentAndDbRecords = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('item_code, description, is_serialized, uom, status')
          .is('archived_at', null)
          .order('description', { ascending: true });
        
        if (data) {
          const activeItems = (data as any[]).filter(item => {
            const s = (item.status || '').toUpperCase();
            return s === 'ACTIVE' || s === 'ENABLE' || s === 'AVAILABLE' || s === '';
          });
          setEquipmentList(activeItems);
        }

        // Fetch actual inventory summary, schools list, and location stocks concurrently
        const [invRes, schoolsRes, stocksRes] = await Promise.all([
          supabase.from('view_inventory_summary').select('*'),
          supabase.from('schools').select('name, customer_code, location, sales_team, is_buffer').order('name'),
          supabase.from('item_location_stocks').select('id, item_code, location, quantity, brand_new_qty')
        ]);
        
        if (invRes && invRes.data) {
          setInventoryItems(invRes.data);
        }
        if (schoolsRes && schoolsRes.data) {
          setSchoolsList(schoolsRes.data);
        }
        if (stocksRes && stocksRes.data) {
          setLocationStocksList(stocksRes.data);
        }
      } catch (err) {
        console.error('Error fetching database records:', err);
      }
    };
    fetchEquipmentAndDbRecords();
  }, []);

  // Fetch unique bundle names when project changes
  useEffect(() => {
    const fetchBundlesForProject = async () => {
      if (!project || !isSupabaseConfigured) {
        setAvailableBundles([]);
        return;
      }
      setIsLoadingBundles(true);
      try {
        const { data, error } = await supabase
          .from('bundle_items')
          .select('bundle, item_code')
          .eq('program', project)
          .is('archived_at', null);

        if (data) {
          const uniqueBundles = Array.from(new Set((data as any[]).map(item => String(item.bundle || ''))));
          setAvailableBundles(uniqueBundles.filter(Boolean).sort());
        }
      } catch (err) {
        console.error('Error fetching bundles for project:', err);
      } finally {
        setIsLoadingBundles(false);
      }
    };
    fetchBundlesForProject();
  }, [project]);

  // Click outside listener for bundle dropdown and serial dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bundleDropdownRef.current && !bundleDropdownRef.current.contains(event.target as Node)) {
        setIsBundleDropdownOpen(false);
      }
      
      const isInsideSerialContainer = (event.target as HTMLElement).closest('.serial-dropdown-container');
      if (!isInsideSerialContainer) {
        setSerialDropdownOpens({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle school suggestion selections
  const handleSelectSchool = (school: any) => {
    const schoolName = school.school_name || school.name || '';
    setDeliveredTo(schoolName);
    setSchoolSearchQuery(schoolName);
    const smId = schoolType === 'new' ? (school.school_monitoring_id || school.id || '') : '';
    setSchoolMonitoringId(smId);
    setClientCode(school.customer_code || school.customerCode || '');
    setAddress(school.location || school.address || 'BAGUIO CITY, BEN');
    setAgent(school.sales_team || school.salesTeam || 'Team Gina');
    
    // Auto populate the project as program
    const programName = school.program || '';
    setProject(programName);

    if (school.moa) {
      setMoa(school.moa);
    } else {
      setMoa('S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26');
    }

    if (schoolType === 'existing') {
      // Do not auto populate hardware delivered for existing schools
      setHardwareItems([]);
      showInfo('Existing School Selected', `Selected ${schoolName}. No hardware was auto-populated. You can add items manually.`);
    } else {
      // Auto populate all hardware items from school monitoring
      const hasBundles = school.items && school.items.some((it: any) => it.bundle_name);
      if (hasBundles) {
        setHardwareItems([]);
        showInfo('Bundles Detected', `This school contains bundle packages. Click the bundle(s) below to populate hardware items.`);
      } else if (school.items && school.items.length > 0) {
        const populatedHardware = school.items.map((it: any, index: number) => {
          const itemCode = it.item_code || '';
          const matched = MOCK_HARDWARE_CATALOG.find(c => c.code === itemCode);
          return {
            id: `hw-${itemCode}-${index}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            qty: it.quantity || it.qty || 1,
            unit: it.unit || it.uom || matched?.unit || 'pcs',
            description: it.item_name || it.description || '',
            specifications: it.specifications || matched?.spec || '',
            remarks: it.remarks || '',
            item_code: itemCode
          };
        });
        setHardwareItems(populatedHardware);
        showInfo('Hardware Populated', `Loaded ${populatedHardware.length} items from ${schoolName}'s monitoring record.`);
      } else {
        setHardwareItems([]);
      }
    }

    setIsSchoolDropdownOpen(false);
  };

  // Filtered Schools list based on School Monitoring database or Schools table
  const filteredSchools = useMemo(() => {
    const list = schoolType === 'new' ? monitoringRecords : schoolsList;
    if (!schoolSearchQuery) return list;
    return list.filter(s => 
      (s.school_name || s.name || '').toLowerCase().includes(schoolSearchQuery.toLowerCase()) ||
      (s.customer_code || s.customerCode || '').toLowerCase().includes(schoolSearchQuery.toLowerCase())
    );
  }, [schoolSearchQuery, schoolType, monitoringRecords, schoolsList]);

  // Computed school monitoring record based on selected school name
  const selectedSchoolRecord = useMemo(() => {
    if (schoolType !== 'new') return null;
    return monitoringRecords.find(r => (r.school_name || r.name || '').toLowerCase() === deliveredTo.toLowerCase());
  }, [deliveredTo, schoolType, monitoringRecords]);

  // Computed bundles from selected school monitoring record
  const schoolMonitoringBundles = useMemo(() => {
    if (schoolType !== 'new' || !selectedSchoolRecord || !selectedSchoolRecord.items || !Array.isArray(selectedSchoolRecord.items)) {
      return [];
    }
    const bundlesMap = new Map<string, any[]>();
    selectedSchoolRecord.items.forEach((item: any) => {
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
    return Array.from(bundlesMap.entries()).map(([name, items]) => ({ name, items }));
  }, [selectedSchoolRecord, schoolType]);

  const handleApplyMonitoringBundleDirect = (bundleName: string, items: any[]) => {
    const populatedHardware = items.map((it: any, index: number) => {
      const itemCode = it.item_code || '';
      const matched = MOCK_HARDWARE_CATALOG.find(c => c.code === itemCode);
      return {
        id: `hw-${itemCode}-${index}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        qty: it.quantity || it.qty || 1,
        unit: it.unit || it.uom || matched?.unit || 'pcs',
        description: it.item_name || it.description || '',
        specifications: it.specifications || matched?.spec || '',
        remarks: `Bundle: ${bundleName}`,
        item_code: itemCode
      };
    });

    setHardwareItems(prev => {
      // Filter out previous items for this bundle, then append new ones
      const filtered = prev.filter(item => item.remarks !== `Bundle: ${bundleName}`);
      return [...filtered, ...populatedHardware];
    });

    showSuccess('Bundle Populated', `Successfully populated ${populatedHardware.length} items from "${bundleName}" based on school monitoring quantities.`);
  };

  const resolvedInventoryItems = useMemo(() => {
    if (inventoryItems && inventoryItems.length > 0) {
      return inventoryItems;
    }
    return MOCK_HARDWARE_CATALOG.map(item => ({
      item_code: item.code,
      item_name: item.name,
      total_quantity: 10,
      is_serialized: false
    }));
  }, [inventoryItems]);

  // Hardware items table management
  const addHardwareRow = () => {
    const newId = `hw-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setHardwareItems([
      ...hardwareItems,
      {
        id: newId,
        qty: 1,
        unit: 'pcs',
        description: '',
        specifications: '',
        remarks: ''
      }
    ]);
  };

  const addAceBundle = (bundleType: 'classroom' | 'sib') => {
    const timestamp = Date.now();
    let newItems: DRHardwareItem[] = [];

    if (bundleType === 'classroom') {
      newItems = [
        {
          id: `hw-bundle-tablet-${timestamp}-1`,
          qty: 50,
          unit: 'pcs',
          description: 'Aralinks Tablet Book Lite',
          specifications: 'A10 Pro 10.4" Quadcore 4G/128G',
          remarks: 'ACE Program Tablet Classroom Package'
        },
        {
          id: `hw-bundle-sib-${timestamp}-2`,
          qty: 1,
          unit: 'pcs',
          description: 'Aralinks Smart Interactive Board 75"',
          specifications: 'UHD 4K Quad Pen Dual OS Win11',
          remarks: 'ACE Program Tablet Classroom Package'
        }
      ];
      showSuccess('ACE Classroom Bundle Added', 'Added 50 Tablet Books + 1 Smart Interactive Board to hardware list.');
    } else {
      newItems = [
        {
          id: `hw-bundle-sib-only-${timestamp}-1`,
          qty: 1,
          unit: 'pcs',
          description: 'Aralinks Smart Interactive Board 75"',
          specifications: 'UHD 4K Quad Pen Dual OS Win11',
          remarks: 'ACE Interactive Board Package'
        }
      ];
      showSuccess('ACE SIB Bundle Added', 'Added 1 Smart Interactive Board to hardware list.');
    }

    setHardwareItems(prev => [...prev, ...newItems]);
  };

  const handleApplyBundle = (bundleName: string) => {
    if (!bundleName) return;
    setPendingBundle(bundleName);
    setBundleQuantity('1');
  };

  const confirmApplyBundle = async () => {
    if (!project || !isSupabaseConfigured || !pendingBundle) return;

    const multiplier = parseInt(bundleQuantity) || 1;

    try {
      const { data, error } = await supabase
        .from('bundle_items')
        .select('*')
        .eq('program', project)
        .eq('bundle', pendingBundle)
        .is('archived_at', null);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const nextItems = [...hardwareItems];
        
        (data as any[]).forEach(bundleItem => {
          // Align UOM and specifications using equipmentList
          const equip = equipmentList.find(e => e.item_code === bundleItem.item_code);
          const bundleItemUom = equip && equip.uom ? equip.uom : 'pcs';
          const spec = equip && equip.specifications ? equip.specifications : '';
          
          let addQtyValue = (bundleItem.quantity || bundleItem.qty || 1) * multiplier;
          
          // Special formula for Brass Fastener: 1-10 = 1, 11-20 = 2, etc.
          if (bundleItem.description?.toUpperCase().includes('BRASS FASTENER')) {
            addQtyValue = Math.max(1, Math.ceil(multiplier / 10));
          }
          
          nextItems.push({
            id: `hw-bundle-item-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            qty: addQtyValue,
            unit: bundleItemUom,
            description: bundleItem.description || '',
            specifications: spec,
            remarks: `Bundle: ${pendingBundle}`,
            item_code: bundleItem.item_code
          });
        });
        
        setHardwareItems(nextItems);
        showSuccess('Bundle Applied', `Successfully added bundle "${pendingBundle}" (x${multiplier}) to hardware list.`);
      } else {
        showError('No Items Found', `Selected bundle "${pendingBundle}" does not have any items defined in the database.`);
      }
      setPendingBundle(null);
      setSelectedBundleDropdown('');
    } catch (err) {
      console.error('Error applying bundle:', err);
      showError('Error', 'Failed to load bundle items from database.');
    }
  };

  // Helper to determine if an item is serialized
  const isSerializedItem = (itemCode?: string, description?: string) => {
    if (!itemCode && !description) return false;
    
    const cleanCode = itemCode ? itemCode.trim().toUpperCase() : '';
    const cleanDesc = description ? description.trim().toLowerCase() : '';

    // 1. Try finding in equipmentList by item_code
    let equip = cleanCode 
      ? equipmentList.find(e => (e.item_code || '').trim().toUpperCase() === cleanCode)
      : null;

    // 2. Try finding in equipmentList by description as a fallback
    if (!equip && cleanDesc) {
      equip = equipmentList.find(e => (e.description || '').trim().toLowerCase() === cleanDesc);
    }

    if (equip) {
      const val = equip.is_serialized;
      if (val === true || val === 1 || val === '1') return true;
      if (typeof val === 'string') {
        const upper = val.trim().toUpperCase();
        return upper === 'YES' || upper === 'TRUE';
      }
    }

    // 3. Try checking in resolvedInventoryItems as a fallback
    if (resolvedInventoryItems && resolvedInventoryItems.length > 0) {
      let inv = cleanCode
        ? resolvedInventoryItems.find((e: any) => (e.item_code || '').trim().toUpperCase() === cleanCode)
        : null;
      if (!inv && cleanDesc) {
        inv = resolvedInventoryItems.find((e: any) => (e.item_name || '').trim().toLowerCase() === cleanDesc);
      }
      if (inv && (inv as any).is_serialized) {
        const val = (inv as any).is_serialized;
        if (val === true || val === 1 || val === '1') return true;
        if (typeof val === 'string') {
          const upper = val.trim().toUpperCase();
          return upper === 'YES' || upper === 'TRUE';
        }
      }
    }

    return false;
  };

  // Format serial numbers into ranges (e.g. GOO-25-15 to GOO-25-34) if consecutive
  const formatSerialRanges = (serialsString: string): string => {
    if (!serialsString) return '------';
    const serials = serialsString.split(',').map(s => s.trim()).filter(Boolean);
    if (serials.length === 0) return '------';

    interface SerialInfo {
      original: string;
      prefix: string;
      numStr: string;
      numVal: number;
    }

    const parsed: SerialInfo[] = serials.map(s => {
      const match = s.match(/^(.*?)(\d+)$/);
      if (match) {
        return {
          original: s,
          prefix: match[1],
          numStr: match[2],
          numVal: parseInt(match[2], 10)
        };
      } else {
        return {
          original: s,
          prefix: s,
          numStr: '',
          numVal: -1
        };
      }
    });

    // Sort parsed serials to ensure consecutive grouping works even if selected in random order
    parsed.sort((a, b) => {
      if (a.prefix !== b.prefix) {
        return a.prefix.localeCompare(b.prefix);
      }
      return a.numVal - b.numVal;
    });

    const ranges: string[] = [];
    let i = 0;
    while (i < parsed.length) {
      const start = parsed[i];
      let end = start;

      if (start.numVal !== -1) {
        while (
          i + 1 < parsed.length &&
          parsed[i + 1].prefix === start.prefix &&
          parsed[i + 1].numVal === end.numVal + 1
        ) {
          end = parsed[i + 1];
          i++;
        }
      }

      if (start.original === end.original) {
        ranges.push(start.original);
      } else {
        ranges.push(`${start.original} to ${end.original}`);
      }
      i++;
    }

    return ranges.join(', ');
  };

  const removeHardwareRow = (id: string) => {
    setHardwareItems(hardwareItems.filter(item => item.id !== id));
  };

  const updateHardwareRow = (id: string, updates: Partial<DRHardwareItem>) => {
    setHardwareItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const merged = { ...item, ...updates };
          const rowItemCode = merged.item_code || (() => {
            const matched = resolvedInventoryItems.find(it => 
              (it.item_name || '').toLowerCase() === (merged.description || '').toLowerCase()
            );
            return matched?.item_code;
          })();
          const isSerialized = isSerializedItem(rowItemCode, merged.description);
          
          if (isSerialized) {
            // "this can be payload in column remarks"
            // If specifications (selected serial numbers) are updated, copy them to remarks
            if ('specifications' in updates && !('remarks' in updates)) {
              merged.remarks = updates.specifications || '';
            }
          }
          return merged;
        }
        return item;
      })
    );
  };

  // Services table management
  const addServiceRow = () => {
    const newId = `srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setServiceItems([
      ...serviceItems,
      {
        id: newId,
        qty: 1,
        unit: 'job',
        serviceDetails: ''
      }
    ]);
  };

  const removeServiceRow = (id: string) => {
    setServiceItems(serviceItems.filter(item => item.id !== id));
  };

  const updateServiceRow = (id: string, updates: Partial<DRServiceItem>) => {
    setServiceItems(
      serviceItems.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Handle Autocomplete hardware catalog trigger
  const handleSelectHardwareItem = (rowId: string, hItem: any) => {
    const code = hItem.item_code || hItem.code;
    const nameStr = hItem.item_name || hItem.name;
    const resolvedUnit = hItem.unit || 'pcs';
    const resolvedSpecifications = hItem.spec || '';

    // Find the location with the highest quantity of this item code
    const itemStocks = locationStocksList.filter(l => l.item_code === code && l.quantity > 0);
    let defaultLoc = '';
    if (itemStocks.length > 0) {
      const highestStock = [...itemStocks].sort((a, b) => b.quantity - a.quantity)[0];
      defaultLoc = highestStock.location;
    }

    updateHardwareRow(rowId, {
      description: nameStr,
      unit: resolvedUnit,
      specifications: resolvedSpecifications,
      item_code: code,
      deduct_location: defaultLoc
    });
    
    // Clear searches
    setHardwareSearchQueries(prev => ({ ...prev, [rowId]: nameStr }));
    setHardwareDropdownOpens(prev => ({ ...prev, [rowId]: false }));
  };

  // Fetch available serial numbers for a given item code from item_serials table
  const fetchSerialsForItem = async (itemCode: string) => {
    if (!isSupabaseConfigured || !itemCode) return;
    if (loadingSerials[itemCode]) return;

    setLoadingSerials(prev => ({ ...prev, [itemCode]: true }));
    try {
      const { data, error } = await supabase
        .from('item_serials')
        .select('serial_number, location, condition, item_code')
        .eq('item_code', itemCode)
        .eq('status', 'Available');

      if (error) throw error;

      if (data) {
        setAvailableSerials(prev => ({ ...prev, [itemCode]: data as any[] }));
      }
    } catch (err) {
      console.error('Error fetching serials for item:', itemCode, err);
    } finally {
      setLoadingSerials(prev => ({ ...prev, [itemCode]: false }));
    }
  };

  // Fetch all available serial numbers from the database for global searching
  const fetchGlobalSerials = async () => {
    if (!isSupabaseConfigured) return;
    if (loadingGlobalSerials) return;

    setLoadingGlobalSerials(true);
    try {
      const { data, error } = await supabase
        .from('item_serials')
        .select('serial_number, item_code, location, condition')
        .eq('status', 'Available');

      if (error) throw error;

      if (data) {
        setGlobalAvailableSerials(data as any[]);
      }
    } catch (err) {
      console.error('Error fetching global serials:', err);
    } finally {
      setLoadingGlobalSerials(false);
    }
  };

  // Canvas & E-Signature drawing/upload signatories controllers
  const openSignatureModal = (key: 'prepared' | 'approved' | 'delivered' | 'checkedReceived') => {
    setDrawingSignatoryKey(key);
    let currentSignatory: DRSignatory;
    if (key === 'prepared') currentSignatory = signatoryPrepared;
    else if (key === 'approved') currentSignatory = signatoryApproved;
    else if (key === 'delivered') currentSignatory = signatoryDelivered;
    else currentSignatory = signatoryCheckedReceived;

    setTypedSignName(currentSignatory.name || '');
    setTypedSignDate(currentSignatory.date || dateOfAcceptance || new Date().toISOString().substring(0, 10));
    setUploadedSigPreview(currentSignatory.signatureImage || null);
    setSigModalTab(currentSignatory.signatureImage ? 'upload' : 'upload');
    setIsSignModalOpen(true);

    // Give time for layout rendering and establish strokes
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#ea580c'; // Brand orange accent
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }, 150);
  };

  // Core Drawing logic
  const startScribble = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsScribbling(true);
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawScribbling = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isScribbling) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  // Close signature and draw
  const stopScribbling = () => {
    setIsScribbling(false);
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Handle direct file upload for e-signatures
  const handleSignatureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Invalid Format', 'Please upload a valid image file (PNG, JPG, SVG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      setUploadedSigPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDirectSignatureUpload = (key: 'prepared' | 'approved' | 'delivered' | 'checkedReceived', file: File) => {
    if (!file.type.startsWith('image/')) {
      showError('Invalid Format', 'Please select a valid image file (PNG, JPG, SVG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      const updateFn = key === 'prepared' ? setSignatoryPrepared
        : key === 'approved' ? setSignatoryApproved
        : key === 'delivered' ? setSignatoryDelivered
        : setSignatoryCheckedReceived;
      
      updateFn(prev => ({
        ...prev,
        signatureImage: result,
        type: 'drawn'
      }));
      showSuccess('Signature Uploaded', 'E-signature image attached successfully.');
    };
    reader.readAsDataURL(file);
  };

  const clearSignatureData = (key: 'prepared' | 'approved' | 'delivered' | 'checkedReceived') => {
    const updateFn = key === 'prepared' ? setSignatoryPrepared
      : key === 'approved' ? setSignatoryApproved
      : key === 'delivered' ? setSignatoryDelivered
      : setSignatoryCheckedReceived;
    
    updateFn(prev => ({
      ...prev,
      signatureImage: undefined,
      type: 'typed'
    }));
    showSuccess('Signature Cleared', 'E-signature image has been removed.');
  };

  const saveSignatureDetails = (method: 'drawn' | 'typed' | 'uploaded') => {
    if (!drawingSignatoryKey) return;
    let dataUrlImage: string | undefined = undefined;

    if (method === 'drawn') {
      const canvas = canvasRef.current;
      if (canvas) {
        dataUrlImage = canvas.toDataURL('image/png');
      }
    } else if (method === 'uploaded') {
      dataUrlImage = uploadedSigPreview || undefined;
    }

    const sigUpdate: DRSignatory = {
      name: typedSignName,
      date: typedSignDate || new Date().toISOString().substring(0, 10),
      signatureImage: dataUrlImage,
      type: method === 'typed' ? 'typed' : 'drawn'
    };

    if (drawingSignatoryKey === 'prepared') setSignatoryPrepared(sigUpdate);
    else if (drawingSignatoryKey === 'approved') setSignatoryApproved(sigUpdate);
    else if (drawingSignatoryKey === 'delivered') setSignatoryDelivered(sigUpdate);
    else if (drawingSignatoryKey === 'checkedReceived') setSignatoryCheckedReceived(sigUpdate);

    setIsSignModalOpen(false);
    setDrawingSignatoryKey(null);
    setUploadedSigPreview(null);
    showSuccess('Signature Saved', 'Signatory information updated successfully.');
  };

  // Section 2 Stock and Catalog validation status
  const section2Validation = useMemo(() => {
    if (hardwareItems.length === 0) {
      return {
        isValid: false,
        reason: 'Please add at least one hardware item.',
        insufficientCount: 0,
        notFoundCount: 0,
        missingSerialsCount: 0,
        invalidRows: [] as { rowId: string; description: string; issue: string }[]
      };
    }

    const invalidRows: { rowId: string; description: string; issue: string }[] = [];
    let insufficientCount = 0;
    let notFoundCount = 0;
    let missingSerialsCount = 0;

    hardwareItems.forEach((row, idx) => {
      const desc = (row.description || '').trim();
      if (!desc) {
        invalidRows.push({ rowId: row.id, description: `Hardware Row #${idx + 1}`, issue: 'Empty item description' });
        notFoundCount++;
        return;
      }

      let itemCode = row.item_code;
      let matchedInv = itemCode ? resolvedInventoryItems.find(it => it.item_code === itemCode) : null;
      if (!matchedInv) {
        matchedInv = resolvedInventoryItems.find(it => 
          (it.item_name || '').toLowerCase().trim() === desc.toLowerCase() ||
          (it.item_code || '').toLowerCase().trim() === desc.toLowerCase()
        ) || null;
        if (matchedInv) itemCode = matchedInv.item_code;
      }

      if (!matchedInv && !itemCode) {
        invalidRows.push({ rowId: row.id, description: desc, issue: 'Item not found in inventory catalog' });
        notFoundCount++;
        return;
      }

      let availableStock = 0;
      let stockLocationName = 'Total active inventory';

      if (row.deduct_location) {
        const matchedLocStock = locationStocksList.find(l => l.item_code === itemCode && l.location === row.deduct_location);
        availableStock = matchedLocStock ? Number(matchedLocStock.quantity || 0) : 0;
        stockLocationName = `Location "${row.deduct_location}"`;
      } else if (matchedInv) {
        availableStock = Number(matchedInv.total_quantity ?? (matchedInv as any).quantity ?? 0);
      }

      const reqQty = Number(row.qty || 1);
      if (availableStock < reqQty) {
        invalidRows.push({
          rowId: row.id,
          description: desc,
          issue: `Insufficient stock in ${stockLocationName} (Available: ${availableStock}, Requested: ${reqQty})`
        });
        insufficientCount++;
        return;
      }

      if (itemCode && isSerializedItem(itemCode, desc)) {
        const sns = row.specifications
          ? row.specifications.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        if (sns.length === 0) {
          invalidRows.push({
            rowId: row.id,
            description: desc,
            issue: `Serial numbers missing (Select ${reqQty} serial numbers)`
          });
          missingSerialsCount++;
        } else if (sns.length !== reqQty) {
          invalidRows.push({
            rowId: row.id,
            description: desc,
            issue: `Serial count mismatch (Selected ${sns.length} of ${reqQty} required serials)`
          });
          missingSerialsCount++;
        }
      }
    });

    return {
      isValid: invalidRows.length === 0,
      reason: invalidRows.length > 0 ? invalidRows[0].issue : '',
      insufficientCount,
      notFoundCount,
      missingSerialsCount,
      invalidRows
    };
  }, [hardwareItems, resolvedInventoryItems, locationStocksList]);

  // Step transition helper with strict stock & catalog validation
  const handleProceedToPreview = () => {
    if (!deliveredTo.trim()) {
      showError('Validation Required', 'Please search and select or input a School Client name before proceeding to preview.');
      return;
    }
    if (hardwareItems.length === 0) {
      showError('Validation Required', 'Please add at least one Hardware unit item before proceeding to preview.');
      return;
    }

    if (!section2Validation.isValid) {
      const firstIssue = section2Validation.invalidRows[0];
      if (section2Validation.insufficientCount > 0) {
        showError(
          'Insufficient Stock Detected',
          `Cannot proceed to Step 2: "${firstIssue.description}" has insufficient inventory stock (${firstIssue.issue}). Please adjust quantity or select available stock.`
        );
      } else if (section2Validation.notFoundCount > 0) {
        showError(
          'Item Not Found in Catalog',
          `Cannot proceed to Step 2: "${firstIssue.description}" was not found in the active inventory catalog. Please choose a valid item from inventory.`
        );
      } else if (section2Validation.missingSerialsCount > 0) {
        showError(
          'Serial Numbers Incomplete',
          `Cannot proceed to Step 2: "${firstIssue.description}" has incomplete serial numbers (${firstIssue.issue}).`
        );
      } else {
        showError('Validation Failed', `Cannot proceed to Step 2: ${section2Validation.reason}`);
      }
      return;
    }

    setCurrentStep(2);
    setPreviewActivePageTab('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit and save handler
  const handleSaveDeliveryReceipt = async () => {
    if (!deliveredTo.trim()) {
      showError('Validation Failed', 'Please search and select or input a School Client name.');
      return;
    }

    if (hardwareItems.length === 0) {
      showError('Validation Failed', 'Please input at least one Hardware Item.');
      return;
    }

    // Validate that all serialized items have serial numbers (specifications) set
    for (const item of hardwareItems) {
      let itemCode = item.item_code;
      if (!itemCode) {
        const matched = resolvedInventoryItems.find(it => 
          (it.item_name || '').toLowerCase() === (item.description || '').toLowerCase()
        );
        if (matched) {
          itemCode = matched.item_code;
        }
      }

      if (itemCode && isSerializedItem(itemCode, item.description)) {
        const sns = item.specifications
          ? item.specifications.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        if (sns.length === 0) {
          showError('Validation Failed', `Please select at least one serial number for the serialized item "${item.description || 'Unknown Item'}".`);
          return;
        }
        if (sns.length !== item.qty) {
          showError('Validation Failed', `For "${item.description || 'Unknown Item'}", you have selected ${sns.length} serials, but the quantity is ${item.qty}. Please select exactly ${item.qty} serials or adjust the quantity.`);
          return;
        }
      }
    }

    try {
      // Validate stock levels before proceeding (especially if status is 'In Transit' or 'Delivered')
      const statusLower = (status || '').toLowerCase();
      if (statusLower === 'in transit' || statusLower === 'delivered') {
        for (const item of hardwareItems) {
          let itemCode = item.item_code;
          if (!itemCode) {
            const matched = resolvedInventoryItems.find(it => 
              (it.item_name || '').toLowerCase() === (item.description || '').toLowerCase()
            );
            if (matched) {
              itemCode = matched.item_code;
            }
          }

          if (itemCode) {
            let availableStock = 0;
            let stockLocationName = 'Total active inventory';

            if (item.deduct_location) {
              const matchedLocStock = locationStocksList.find(l => l.item_code === itemCode && l.location === item.deduct_location);
              availableStock = matchedLocStock ? Number(matchedLocStock.quantity || 0) : 0;
              stockLocationName = `Location "${item.deduct_location}"`;
            } else {
              const invItem = resolvedInventoryItems.find(it => it.item_code === itemCode);
              availableStock = invItem ? Number(invItem.total_quantity || 0) : 0;
            }

            if (availableStock < Number(item.qty || 0)) {
              showError(
                'Insufficient Stock Trigger',
                `Cannot save as "${status}" because item "${item.description}" has insufficient stock in ${stockLocationName}! Available: ${availableStock}, Requested: ${item.qty}`
              );
              return;
            }
          } else {
            showError(
              'Item Unmapped Trigger',
              `Cannot proceed with "${status}" because "${item.description || 'Unknown Item'}" is not found in the active inventory catalog.`
            );
            return;
          }
        }
      }

      const computedTotalItems = hardwareItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

      // Map back to global management schema so that listings automatically integrate
      const newDRRecord = {
        id: drNo,
        schoolName: deliveredTo,
        schoolMonitoringId: schoolMonitoringId,
        school_monitoring_id: schoolMonitoringId,
        clientCode: clientCode || 'CL-GEN-999',
        agent: agent || 'Direct Store',
        project: project || 'ACE',
        date: dateOfAcceptance,
        status: status,
        inTransitDate: statusLower === 'in transit' || statusLower === 'delivered' ? inTransitDate : undefined,
        deliveredDate: statusLower === 'delivered' ? deliveredDate : undefined,
        totalItems: computedTotalItems,
        issuedBy: signatoryPrepared.name || '',
        deliveredBy: signatoryDelivered.name || '',
        receivedBy: signatoryCheckedReceived.name || '',
        remarks: remarks || '',
        // Full local metadata
        hardwareItems,
        serviceItems,
        signatoryPrepared,
        signatoryApproved,
        signatoryDelivered,
        signatoryCheckedReceived,
        address,
        contactPerson,
        contactNo,
        moa
      };

      // Always update localStorage
      const dbStr = localStorage.getItem(STORAGE_KEY) || '[]';
      const existingReceipts: any[] = JSON.parse(dbStr);
      let updatedList: any[] = [];
      if (isEditMode) {
        updatedList = existingReceipts.map(r => (r.id === drNo || r.drNo === drNo) ? newDRRecord : r);
      } else {
        updatedList = [newDRRecord, ...existingReceipts];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

      // Try saving to Supabase if configured
      if (isSupabaseConfigured) {
        try {
          const dbPayload = {
            id: drNo,
            school_name: deliveredTo,
            school_monitoring_id: schoolMonitoringId,
            client_code: clientCode || 'CL-GEN-999',
            agent: agent || 'Direct Store',
            project: project || 'ACE',
            date: dateOfAcceptance,
            status: status === 'In Transit' ? 'In transit' : status,
            in_transit_date: statusLower === 'in transit' || statusLower === 'delivered' ? inTransitDate : null,
            delivered_date: statusLower === 'delivered' ? deliveredDate : null,
            total_items: computedTotalItems,
            issued_by: signatoryPrepared.name || '',
            delivered_by: signatoryDelivered.name || '',
            received_by: signatoryCheckedReceived.name || '',
            remarks: remarks || '',
            hardware_items: hardwareItems,
            service_items: serviceItems,
            signatory_prepared: signatoryPrepared,
            signatory_approved: signatoryApproved,
            signatory_delivered: signatoryDelivered,
            signatory_checked_received: signatoryCheckedReceived,
            address: address || '',
            contact_person: contactPerson || '',
            contact_no: contactNo || '',
            moa: moa || '',
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase
            .from('delivery_receipts')
            .upsert(dbPayload, { onConflict: 'id' });

          if (error) throw error;

          // Once status is 'In Transit' or 'Delivered' (and transitioning from a non-transit status),
          // deduct stock from item_location_stocks and log to stock_transactions
          const initialStatusLower = (initialStatus || '').toLowerCase();
          const isTransitioningToTransit = 
            (statusLower === 'in transit' || statusLower === 'delivered') && 
            (initialStatusLower !== 'in transit' && initialStatusLower !== 'delivered');

          if (isTransitioningToTransit) {
            const currentUser = localStorage.getItem('aralinks_user') || 'System';

            for (const item of hardwareItems) {
              let itemCode = item.item_code;
              let itemName = item.description;

              if (!itemCode) {
                const matched = resolvedInventoryItems.find(it => 
                  (it.item_name || '').toLowerCase() === (item.description || '').toLowerCase()
                );
                if (matched) {
                  itemCode = matched.item_code;
                  itemName = matched.item_name;
                }
              }

              if (!itemCode) continue;

              let qtyToDeduct = Number(item.qty || 0);
              if (qtyToDeduct <= 0) continue;

              // Fetch location stocks to deduct from
              let stockQuery = supabase
                .from('item_location_stocks')
                .select('id, location, quantity, brand_new_qty')
                .eq('item_code', itemCode);

              if (item.deduct_location) {
                stockQuery = stockQuery.eq('location', item.deduct_location);
              } else {
                stockQuery = stockQuery.order('quantity', { ascending: false });
              }

              const { data: stockRecords, error: fetchErr } = await stockQuery;

              if (fetchErr) throw fetchErr;

              let deductedLocations: Array<{ location: string, qty: number }> = [];

              if (stockRecords && stockRecords.length > 0) {
                for (const record of stockRecords) {
                  if (qtyToDeduct <= 0) break;

                  const availableRecordQty = Number(record.quantity || 0);
                  if (availableRecordQty <= 0) continue;

                  const toDeductNow = Math.min(availableRecordQty, qtyToDeduct);
                  const newRecordQty = availableRecordQty - toDeductNow;
                  const newBrandNewQty = Math.max(0, Number(record.brand_new_qty || 0) - toDeductNow);

                  const { error: updateErr } = await supabase
                    .from('item_location_stocks')
                    .update({ 
                      quantity: newRecordQty,
                      brand_new_qty: newBrandNewQty
                    })
                    .eq('id', record.id);

                  if (updateErr) throw updateErr;

                  qtyToDeduct -= toDeductNow;
                  deductedLocations.push({ location: record.location, qty: toDeductNow });
                }
              }

              // Fallback if needed (though our UI validation prevents this)
              if (qtyToDeduct > 0) {
                const fallbackLoc = item.deduct_location || stockRecords?.[0]?.location || 'Main Depot';
                const fallbackRecord = stockRecords?.find(r => r.location === fallbackLoc) || stockRecords?.[0];

                if (fallbackRecord) {
                  const newRecordQty = Number(fallbackRecord.quantity || 0) - qtyToDeduct;
                  const newBrandNewQty = Math.max(0, Number(fallbackRecord.brand_new_qty || 0) - qtyToDeduct);
                  const { error: updateErr } = await supabase
                    .from('item_location_stocks')
                    .update({ 
                      quantity: newRecordQty,
                      brand_new_qty: newBrandNewQty
                    })
                    .eq('id', fallbackRecord.id);
                  if (updateErr) throw updateErr;
                } else {
                  const { error: insertErr } = await supabase
                    .from('item_location_stocks')
                    .insert([{
                      item_code: itemCode,
                      item_name: itemName,
                      location: fallbackLoc,
                      quantity: -qtyToDeduct,
                      brand_new_qty: -qtyToDeduct
                    }]);
                  if (insertErr) throw insertErr;
                }
                deductedLocations.push({ location: fallbackLoc, qty: qtyToDeduct });
              }

              // Write transactions to stock_transactions for history log
              for (const dLoc of deductedLocations) {
                const { error: txError } = await supabase
                  .from('stock_transactions')
                  .insert([{
                    item_code: itemCode,
                    from_location: dLoc.location,
                    to_location: deliveredTo,
                    quantity: dLoc.qty,
                    transaction_type: 'Delivery',
                    reference_id: drNo,
                    created_by: currentUser,
                    reason: `Delivered to School: ${deliveredTo} via DR ${drNo}`
                  }]);

                if (txError) throw txError;
              }

              // Update the status of the selected serial number in item_serials table to match the DR transition
              if (itemCode && isSerializedItem(itemCode, item.description) && item.specifications) {
                const sns = item.specifications.split(',').map(sn => sn.trim()).filter(Boolean);
                if (sns.length > 0) {
                  const { error: serErr } = await supabase
                    .from('item_serials')
                    .update({
                      status: status === 'Delivered' ? 'Delivered' : 'In Transit',
                      request_id: drNo
                    })
                    .eq('item_code', itemCode)
                    .in('serial_number', sns);
                  if (serErr) {
                    console.warn('Could not update status of serial numbers in item_serials:', sns, serErr);
                  }
                }
              }
            }
          }
        } catch (dbErr) {
          console.warn('Failed to persist to Supabase delivery_receipts table. Saved locally.', dbErr);
        }
      }

      if (isEditMode) {
        showSuccess('Receipt Modified', `Delivery Receipt ${drNo} of client ${deliveredTo} updated.`);
      } else {
        showSuccess('Receipt Submitted', `Delivery Receipt ${drNo} created successfully with ${computedTotalItems} logs.`);
      }

      await syncSchoolMonitoringWithDRs();
      navigate('/delivery-receipt');
    } catch (e) {
      console.error('Error saving record', e);
      showError('Database Write Error', 'Failed to save delivery receipt metadata securely.');
    }
  };

  return (
    <div className={`w-full h-full p-4 lg:p-6 overflow-y-auto no-scrollbar font-sans ${isDarkMode ? 'text-slate-100 bg-slate-950' : 'text-slate-800 bg-slate-50'}`}>
      
      {/* HEADER CONTROLS & 2-STEP WORKFLOW */}
      <div className="flex flex-col gap-4 mb-6 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (currentStep === 2) {
                  setCurrentStep(1);
                } else {
                  navigate('/delivery-receipt');
                }
              }}
              className={`p-2.5 rounded-xl border transition-all hover:scale-105 cursor-pointer ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title={currentStep === 2 ? "Back to Step 1 Form" : "Go Back"}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 px-2.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                  {isEditMode ? 'Modify Mode' : 'New Form Draft'}
                </span>
                <span className={`p-1 px-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                  currentStep === 1 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}>
                  {currentStep === 1 ? 'Step 1: Edit Form' : 'Step 2: Print Preview & Sign'}
                </span>
              </div>
              <h1 className="text-xl font-black mt-1 leading-tight tracking-tight">
                {currentStep === 1 
                  ? (isEditMode ? `Edit Delivery Acceptance: ${drNo}` : 'Create Delivery Acceptance Form')
                  : `Print Preview & Authorize: ${drNo}`
                }
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={handleProceedToPreview}
                className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-md active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 bg-brand-orange"
              >
                <span>Proceed to Step 2: Print Preview</span>
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`px-4 py-2.5 rounded-xl border text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Edit Form</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`px-4 py-2.5 rounded-xl border text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDeliveryReceipt}
                  className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-md active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand-accent)' }}
                >
                  <Save size={14} strokeWidth={2.5} />
                  <span>{isEditMode ? 'Update Record' : 'Save & Publish'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* STEPPER PROGRESS BAR */}
        <div className={`p-2 rounded-2xl border flex items-center gap-2 ${isDarkMode ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200 shadow-xs'}`}>
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentStep === 1 
                ? 'bg-brand-orange text-white shadow-xs' 
                : isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              currentStep === 1 ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              1
            </span>
            <span>Step 1: Fill Form Details & Items</span>
            {currentStep === 2 && <CheckCircle2 size={14} className="text-emerald-500 ml-1" />}
          </button>

          <button
            type="button"
            onClick={handleProceedToPreview}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentStep === 2 
                ? 'bg-brand-orange text-white shadow-xs' 
                : isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              currentStep === 2 ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              2
            </span>
            <span>Step 2: Print Preview & Digital Signatures (Save & Publish)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* STEP 1: INTERACTIVE FORM SECTION */}
        <div className={`lg:col-span-12 space-y-6 ${currentStep === 1 ? 'block' : 'hidden'} print:hidden`}>
          
          {/* SECTION 1: CORE CLIENT & METADATA */}
          <div className={`p-4 rounded-xl border shadow-xs space-y-3.5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-2">
              <Building2 size={16} className="text-brand-orange" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Section 1: Client & Document Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              
              {/* DR NO CARD */}
              <div className="flex flex-col gap-0.5 relative">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">DR No. (Receipt Number)</label>
                <input
                  type="text"
                  placeholder="e.g., 00014-2627"
                  value={drNo}
                  onChange={(e) => setDrNo(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm font-semibold tracking-wider font-mono focus:outline-none focus:ring-1 focus:ring-brand-orange ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-amber-500' : 'bg-slate-50 border-slate-200 text-brand-orange'
                  }`}
                />
              </div>

              {/* Date Box */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Date Created</label>
                <div className="relative">
                  <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={dateOfAcceptance}
                    onChange={(e) => setDateOfAcceptance(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Delivered To Dropdown & Input */}
              <div className="flex flex-col gap-1.5 sm:col-span-2 relative">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Delivered To (School Client / Center)</label>
                  
                  {/* School Type Options */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setSchoolType('new');
                        setSchoolSearchQuery('');
                        setDeliveredTo('');
                        setSchoolMonitoringId('');
                        setClientCode('');
                        setAddress('');
                        setAgent('');
                        setProject('');
                        setHardwareItems([]);
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all uppercase tracking-wider cursor-pointer ${
                        schoolType === 'new'
                          ? 'bg-brand-orange text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      New School
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSchoolType('existing');
                        setSchoolSearchQuery('');
                        setDeliveredTo('');
                        setSchoolMonitoringId('');
                        setClientCode('');
                        setAddress('');
                        setAgent('');
                        setProject('');
                        setHardwareItems([]);
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all uppercase tracking-wider cursor-pointer ${
                        schoolType === 'existing'
                          ? 'bg-brand-orange text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      Existing School
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder={schoolType === 'new' ? "Search school monitoring records..." : "Search management schools list..."}
                    value={schoolSearchQuery}
                    onChange={(e) => {
                      setSchoolSearchQuery(e.target.value);
                      setDeliveredTo(e.target.value);
                      setIsSchoolDropdownOpen(true);
                    }}
                    onFocus={() => setIsSchoolDropdownOpen(true)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  {schoolSearchQuery && (
                    <button
                      onClick={() => {
                        setSchoolSearchQuery('');
                        setDeliveredTo('');
                        setSchoolMonitoringId('');
                        setClientCode('');
                        setAddress('');
                        setAgent('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {schoolMonitoringId && (
                  <div className="text-[11px] font-mono font-extrabold text-brand-orange mt-1 select-all">
                    School Monitoring ID: {schoolMonitoringId}
                  </div>
                )}

                {isSchoolDropdownOpen && filteredSchools.length > 0 && (
                  <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-50 p-1.5 max-h-56 overflow-y-auto ${
                    isDarkMode ? 'bg-slate-900 border-slate-850 text-white' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <p className="text-[10px] font-bold text-brand-orange uppercase p-1.5 tracking-wide border-b border-b-slate-100 dark:border-b-indigo-950/20 mb-1">
                      {schoolType === 'new' ? 'Matched School Monitoring Records' : 'Matched Management Schools List'}
                    </p>
                    {filteredSchools.map((s, i) => (
                      <button
                        key={`${s.school_name || s.name || 'school'}-${i}`}
                        type="button"
                        onClick={() => handleSelectSchool(s)}
                        className={`w-full text-left p-2 rounded-lg text-sm leading-tight transition-all flex flex-col gap-0.5 ${
                          isDarkMode ? 'hover:bg-slate-955 hover:text-amber-400' : 'hover:bg-amber-50 hover:text-brand-orange'
                        }`}
                      >
                        <span className="font-bold">{s.school_name || s.name}</span>
                        {schoolType === 'new' ? (
                          <span className="text-[11px] text-brand-orange font-mono font-extrabold">
                            School Monitoring ID: {s.school_monitoring_id || s.id || '-'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-500 font-mono font-extrabold">
                            Existing School (Client Code: {s.customer_code || '-'})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Code Box */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Client Code</label>
                <div className="relative">
                  <Tag size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold" />
                  <input
                    type="text"
                    placeholder="e.g., C00000231(GS)"
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-mono' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Address input */}
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Address Location</label>
                <input
                  type="text"
                  placeholder="ASSUMPTION ROAD, 2600 BAGUIO CITY, BEN"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              {/* Agent Representative Selection */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Sales Representative / Agent</label>
                <input
                  type="text"
                  placeholder="Team Gina"
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              {/* Contact Person */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Contact Person</label>
                <div className="relative">
                  <User size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Principal or IT Admin"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Contact Number */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Contact No.</label>
                <input
                  type="text"
                  placeholder="0917-XXX-YYYY"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              {/* Project Name */}
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Project</label>
                <div className="relative">
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className={`w-full px-3 py-1 rounded-lg border text-sm focus:outline-none appearance-none pr-8 cursor-pointer ${
                      isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="">Select Project...</option>
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
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* MOA Period range */}
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Memorandum of Agreement MOA (School Years)</label>
                <input
                  type="text"
                  placeholder="S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26"
                  value={moa}
                  onChange={(e) => setMoa(e.target.value)}
                  className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

            </div>
          </div>

          {/* SECTION 2: HARDWARE CARDS SPECIFICATION */}
          <div className={`p-4 rounded-xl border shadow-xs space-y-3.5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ListPlus size={16} className="text-brand-orange" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Section 2: Hardware Delivered Items</h2>
                {!section2Validation.isValid && hardwareItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    {section2Validation.insufficientCount > 0 ? 'Insufficient Stock' : section2Validation.notFoundCount > 0 ? 'Item Not In Inventory' : 'Serials Missing'}
                  </span>
                )}
                {section2Validation.isValid && hardwareItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    Stock Ready
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 items-center relative">
                {schoolType === 'existing' && (
                  <button
                    type="button"
                    onClick={addHardwareRow}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange border border-brand-orange/20 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add Hardware Row
                  </button>
                )}
                {project && (availableBundles.length > 0 || project === 'ACE') && (
                  <div className="relative" ref={bundleDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsBundleDropdownOpen(!isBundleDropdownOpen)}
                      className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={12} />
                      {isLoadingBundles ? 'Loading...' : selectedBundleDropdown || 'Add Bundle'}
                      <ChevronDown size={10} className="transition-transform duration-200" style={{ transform: isBundleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                    {isBundleDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 w-60 rounded-xl border border-slate-100 bg-white p-1 shadow-lg dark:bg-slate-900 dark:border-slate-800 z-50 text-left max-h-60 overflow-y-auto">
                        <div className="px-2 py-1 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                          Database Bundles
                        </div>
                        {availableBundles.map((bName) => (
                          <button
                            key={bName}
                            type="button"
                            onClick={() => {
                              setSelectedBundleDropdown(bName);
                              handleApplyBundle(bName);
                              setIsBundleDropdownOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                          >
                            {bName}
                          </button>
                        ))}
                        {availableBundles.length === 0 && (
                          <div className="px-2.5 py-1.5 text-[10px] text-slate-400 italic">
                            No synced bundles found
                          </div>
                        )}
                        {project === 'ACE' && (
                          <>
                            <div className="px-2 py-1 mt-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-b border-slate-100 dark:border-slate-800 mb-1 pt-1">
                              Standard Packages
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBundleDropdown('Tablet Classroom Bundle');
                                addAceBundle('classroom');
                                setIsBundleDropdownOpen(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            >
                              Tablet Classroom (50 + 1)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBundleDropdown('SIB Bundle');
                                addAceBundle('sib');
                                setIsBundleDropdownOpen(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            >
                              Interactive Board (1 SIB)
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {schoolMonitoringBundles.length > 0 && (
              <div className="p-4 border rounded-xl bg-slate-50/50 dark:bg-black/10 animate-in fade-in duration-300" style={{ borderColor: 'var(--brand-accent)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} style={{ color: 'var(--brand-accent)' }} />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bundles from School Monitoring ({schoolMonitoringBundles.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {schoolMonitoringBundles.map((b) => {
                    const isCurrentlyAdded = hardwareItems.some(ri => ri.remarks && ri.remarks.includes(`Bundle: ${b.name}`));
                    return (
                      <div 
                        key={b.name}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                          isCurrentlyAdded 
                            ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#FE4E02]'
                        }`}
                      >
                        <div>
                          <p className={`text-xs font-bold leading-tight ${isCurrentlyAdded ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-white'}`}>
                            {b.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Contains {b.items.length} hardware items.
                          </p>
                          <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto pr-1">
                            {b.items.map((item: any) => (
                              <div key={item.item_code} className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 gap-2">
                                <span className="truncate">• {item.item_name || item.item_code}</span>
                                <span className="font-bold shrink-0">Qty: {item.quantity || item.qty || 1}</span>
                              </div>
                            ))}
                          </div>
                          {isCurrentlyAdded && (
                            <span className="inline-block mt-3 px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 uppercase tracking-wider">
                              Added to DR
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleApplyMonitoringBundleDirect(b.name, b.items);
                          }}
                          className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            isCurrentlyAdded
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 hover:bg-green-500/20'
                              : 'bg-transparent border active:scale-95'
                          }`}
                          style={!isCurrentlyAdded ? {
                            color: 'var(--brand-accent)',
                            borderColor: 'var(--brand-accent)'
                          } : {}}
                          onMouseEnter={(e) => {
                            if (!isCurrentlyAdded) {
                              e.currentTarget.style.backgroundColor = 'var(--brand-accent)';
                              e.currentTarget.style.color = '#ffffff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isCurrentlyAdded) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--brand-accent)';
                            }
                          }}
                        >
                          {isCurrentlyAdded ? 'Populate Again' : 'Populate Bundle'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {hardwareItems.map((row, index) => {
                const rowItemCode = row.item_code || (() => {
                  const matched = resolvedInventoryItems.find(it => 
                    (it.item_name || '').toLowerCase() === (row.description || '').toLowerCase()
                  );
                  return matched?.item_code;
                })();
                const isSerialized = isSerializedItem(rowItemCode, row.description);

                return (
                  <div 
                    key={row.id} 
                    className={`p-3 rounded-xl border flex flex-col gap-2 relative transition-all duration-200 ${
                      isDarkMode ? 'bg-slate-950/20 border-slate-801 hover:border-slate-700' : 'bg-slate-50/50 border-slate-105 hover:border-slate-200'
                    }`}
                  >
                  {/* Delete Hardware row button top-right */}
                  <button
                    type="button"
                    onClick={() => removeHardwareRow(row.id)}
                    className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 border-none bg-transparent cursor-pointer transition-colors"
                    title="Remove Hardware row"
                  >
                    <Trash2 size={13} />
                  </button>

                  {/* Real-time Stock Connection & Warnings */}
                  {(() => {
                    const rowItemCode = row.item_code || (() => {
                      const matched = resolvedInventoryItems.find(it => 
                        (it.item_name || '').toLowerCase() === (row.description || '').toLowerCase()
                      );
                      return matched?.item_code;
                    })();
                    const invItem = rowItemCode ? resolvedInventoryItems.find(it => it.item_code === rowItemCode) : null;
                    const availableStock = invItem ? Number(invItem.total_quantity || 0) : 0;
                    const hasInsufficientStock = availableStock < Number(row.qty || 0);

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="text-xs font-extrabold text-brand-orange font-mono select-none flex items-center gap-2">
                          Hardware Unit #{index + 1}
                          {rowItemCode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono font-normal">
                              Code: {rowItemCode}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold sm:mr-8">
                          {invItem ? (
                            hasInsufficientStock ? (
                              <span className="text-red-500 font-black animate-pulse flex items-center gap-1 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-md">
                                <AlertCircle size={12} /> Insufficient Stock! Available: {availableStock}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                                ✓ Stock Available: {availableStock}
                              </span>
                            )
                          ) : row.description ? (
                            <span className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md">
                              ⚠ Not found in Inventory Catalog
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    
                    {/* Quantity Box */}
                    <div className="sm:col-span-2 flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateHardwareRow(row.id, { qty: Number(e.target.value) })}
                        className={`w-full px-2.5 py-1 rounded-lg border text-sm text-center font-bold font-mono focus:outline-none ${
                          isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Unit Box */}
                    <div className="sm:col-span-2 flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Unit</label>
                      <input
                        type="text"
                        placeholder="unit/pcs"
                        value={row.unit}
                        onChange={(e) => updateHardwareRow(row.id, { unit: e.target.value })}
                        className={`w-full px-2 py-1 rounded-lg border text-sm text-center font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Description autocomplete input */}
                    <div className="sm:col-span-8 flex flex-col gap-0.5 relative text-left">
                      <label className="text-xs font-bold text-slate-500 uppercase">Item Description Specification</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search actual inventory stock or input manually"
                          value={hardwareSearchQueries[row.id] !== undefined ? hardwareSearchQueries[row.id] : row.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHardwareSearchQueries(prev => ({ ...prev, [row.id]: val }));
                            updateHardwareRow(row.id, { description: val });
                            setHardwareDropdownOpens(prev => ({ ...prev, [row.id]: true }));
                          }}
                          onFocus={() => setHardwareDropdownOpens(prev => ({ ...prev, [row.id]: true }))}
                          className={`w-full px-2.5 py-1 rounded-lg border text-sm focus:outline-none pr-8 ${
                            isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                          }`}
                        />
                        {row.description && (
                          <button
                            onClick={() => {
                              updateHardwareRow(row.id, { description: '', specifications: '', unit: 'pcs' });
                              setHardwareSearchQueries(prev => ({ ...prev, [row.id]: '' }));
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown catalog */}
                      {hardwareDropdownOpens[row.id] && (() => {
                        const searchQueryInput = (hardwareSearchQueries[row.id] !== undefined ? hardwareSearchQueries[row.id] : row.description || '').toLowerCase();
                        const matchedInventoryOptions = resolvedInventoryItems.filter(item => 
                          (item.item_name || '').toLowerCase().includes(searchQueryInput) ||
                          (item.item_code || '').toLowerCase().includes(searchQueryInput)
                        );

                        return (
                          <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-30 p-1 max-h-40 overflow-y-auto ${
                            isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                          }`}>
                            {matchedInventoryOptions.map((hc, codeIdx) => (
                              <button
                                key={`${hc.item_code}-${codeIdx}`}
                                type="button"
                                onClick={() => handleSelectHardwareItem(row.id, hc)}
                                className={`w-full text-left p-2 rounded-lg text-xs leading-normal transition-all flex flex-col gap-0.5 ${
                                  isDarkMode ? 'hover:bg-slate-900 hover:text-amber-400' : 'hover:bg-amber-50 hover:text-brand-orange'
                                }`}
                              >
                                <span className="font-bold text-slate-800 dark:text-slate-100">{hc.item_name}</span>
                                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-0.5">
                                  <span>Code: {hc.item_code}</span>
                                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Available Stock: {hc.total_quantity}</span>
                                </div>
                              </button>
                            ))}
                            {matchedInventoryOptions.length === 0 && (
                              <p className="p-3 text-xs italic text-slate-400 text-center">No inventory items found</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1 text-left">
                    {/* Item Specifications (Serial no) */}
                    <div className="flex flex-col gap-1">
                      {(() => {
                        if (rowItemCode && !isSerialized) {
                          // Non-serialized item, normal specifications/serial input
                          return (
                            <>
                              <label className="text-xs font-bold text-slate-500 uppercase">Item Specifications / Serial Numbers (Optional)</label>
                              <input
                                type="text"
                                placeholder="e.g., Core i7 16G, NXKS7SP001..."
                                value={row.specifications}
                                onChange={(e) => updateHardwareRow(row.id, { specifications: e.target.value })}
                                className={`px-3 py-1 rounded-lg border text-sm font-mono focus:outline-none ${
                                  isDarkMode ? 'bg-slate-955 border-slate-808 text-white' : 'bg-white border-slate-205 text-slate-800'
                                }`}
                              />
                            </>
                          );
                        }

                        // Serialized item or unspecified stock selection
                        const selectedSerials = row.specifications
                          ? row.specifications.split(',').map(s => s.trim()).filter(Boolean)
                          : [];

                        const serialSearchVal = serialSearchQueries[row.id] || '';
                        
                        let matchedSerials: any[] = [];
                        let allSerials: any[] = [];
                        let isFetching = false;

                        if (rowItemCode) {
                          allSerials = availableSerials[rowItemCode || ''] || [];
                          const locationFilteredSerials = row.deduct_location 
                            ? allSerials.filter(s => s.location === row.deduct_location)
                            : allSerials;
                          
                          matchedSerials = locationFilteredSerials.filter(s => 
                            s.serial_number.toLowerCase().includes(serialSearchVal.toLowerCase())
                          );
                          isFetching = loadingSerials[rowItemCode || ''];
                        } else {
                          // No item_code set yet, search globally
                          allSerials = globalAvailableSerials;
                          matchedSerials = globalAvailableSerials.filter(s => 
                            s.serial_number.toLowerCase().includes(serialSearchVal.toLowerCase())
                          );
                          isFetching = loadingGlobalSerials;
                        }

                        const reqQty = row.qty || 1;
                        const selCount = selectedSerials.length;
                        
                        // Status styling for serial selection progress
                        let badgeClass = "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50";
                        let statusText = `${selCount} of ${reqQty} selected`;
                        if (selCount === reqQty) {
                          badgeClass = "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50";
                          statusText = "✓ Complete";
                        } else if (selCount > reqQty) {
                          badgeClass = "text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50";
                          statusText = `⚠ Too many (${selCount}/${reqQty})`;
                        }

                        const toggleSerial = (sn: string) => {
                          let next: string[];
                          if (selectedSerials.includes(sn)) {
                            next = selectedSerials.filter(s => s !== sn);
                          } else {
                            next = [...selectedSerials, sn];
                          }
                          updateHardwareRow(row.id, { specifications: next.join(', ') });
                        };

                        const handleAutoFill = () => {
                          const availableFiltered = row.deduct_location 
                            ? allSerials.filter(s => s.location === row.deduct_location)
                            : allSerials;
                          
                          // Prioritize serials that aren't already selected elsewhere if possible
                          const toSelect = availableFiltered.slice(0, reqQty).map(s => s.serial_number);
                          updateHardwareRow(row.id, { specifications: toSelect.join(', ') });
                          
                          // Show notification
                          showSuccess('Auto-Filled', `Auto-selected ${toSelect.length} available serials for this item.`);
                        };

                        return (
                          <>
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                Item Specifications / Serial Numbers (Required)
                                <span className="text-rose-500 font-extrabold">*</span>
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${badgeClass}`}>
                                {statusText}
                              </span>
                            </label>

                            {/* Selected serials pills */}
                            {selectedSerials.length > 0 && (
                              <div className="flex flex-wrap gap-1 p-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 max-h-24 overflow-y-auto">
                                {selectedSerials.map(sn => (
                                  <span 
                                    key={sn}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-orange/10 text-brand-orange dark:bg-brand-orange/20 text-xs font-mono font-medium border border-brand-orange/20"
                                  >
                                    {sn}
                                    <button
                                      type="button"
                                      onClick={() => toggleSerial(sn)}
                                      className="text-brand-orange hover:text-rose-600 border-none bg-transparent cursor-pointer p-0 ml-0.5 flex items-center justify-center"
                                    >
                                      <X size={10} strokeWidth={2.5} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Help / auto-fill links */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Select exactly {reqQty} serial{reqQty > 1 ? 's' : ''}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleAutoFill}
                                  className="text-brand-orange hover:underline font-bold border-none bg-transparent cursor-pointer"
                                >
                                  Auto-Fill (FIFO)
                                </button>
                                {selectedSerials.length > 0 && (
                                  <>
                                    <span className="text-slate-300">|</span>
                                    <button
                                      type="button"
                                      onClick={() => updateHardwareRow(row.id, { specifications: '' })}
                                      className="text-slate-500 hover:text-rose-600 font-semibold border-none bg-transparent cursor-pointer"
                                    >
                                      Clear All
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="relative serial-dropdown-container">
                              <input
                                type="text"
                                placeholder="Search & add stock serial numbers..."
                                value={serialSearchVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSerialSearchQueries(prev => ({ ...prev, [row.id]: val }));
                                  setSerialDropdownOpens(prev => ({ ...prev, [row.id]: true }));
                                  if (rowItemCode) {
                                    fetchSerialsForItem(rowItemCode);
                                  } else {
                                    fetchGlobalSerials();
                                  }
                                }}
                                onFocus={() => {
                                  setSerialDropdownOpens(prev => ({ ...prev, [row.id]: true }));
                                  if (rowItemCode) {
                                    fetchSerialsForItem(rowItemCode);
                                  } else {
                                    fetchGlobalSerials();
                                  }
                                }}
                                className={`w-full px-3 py-1 pr-8 rounded-lg border text-sm font-mono focus:outline-none ${
                                  isDarkMode ? 'bg-slate-955 border-slate-808 text-white' : 'bg-white border-slate-205 text-slate-800'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const isOpen = !serialDropdownOpens[row.id];
                                  setSerialDropdownOpens(prev => ({ ...prev, [row.id]: isOpen }));
                                  if (isOpen) {
                                    if (rowItemCode) {
                                      fetchSerialsForItem(rowItemCode);
                                    } else {
                                      fetchGlobalSerials();
                                    }
                                  }
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0.5"
                              >
                                {isFetching ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <ChevronDown size={14} />
                                )}
                              </button>

                              {serialDropdownOpens[row.id] && (
                                <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-30 p-1 max-h-48 overflow-y-auto ${
                                  isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                                }`}>
                                  {isFetching ? (
                                    <p className="p-3 text-xs italic text-slate-400 text-center flex items-center justify-center gap-1">
                                      <Loader2 size={12} className="animate-spin text-brand-orange" /> Loading stock serials...
                                    </p>
                                  ) : (
                                    <>
                                      {matchedSerials.map((s, sIdx) => {
                                        const equip = equipmentList.find(e => e.item_code === s.item_code);
                                        const itemDesc = equip ? (equip.description || equip.item_name) : s.item_code;
                                        const isSel = selectedSerials.includes(s.serial_number);
                                        return (
                                          <button
                                            key={`${s.serial_number}-${sIdx}`}
                                            type="button"
                                            onClick={() => {
                                              if (!row.item_code) {
                                                updateHardwareRow(row.id, { 
                                                  specifications: s.serial_number,
                                                  item_code: s.item_code,
                                                  description: itemDesc,
                                                  deduct_location: s.location || row.deduct_location 
                                                });
                                                setHardwareSearchQueries(prev => ({ ...prev, [row.id]: itemDesc }));
                                                setSerialDropdownOpens(prev => ({ ...prev, [row.id]: false }));
                                              } else {
                                                toggleSerial(s.serial_number);
                                              }
                                            }}
                                            className={`w-full text-left p-2 rounded-lg text-xs leading-normal transition-all flex flex-col gap-0.5 ${
                                              isSel 
                                                ? (isDarkMode ? 'bg-slate-900 text-brand-orange border border-brand-orange/20' : 'bg-orange-50/55 text-brand-orange border border-orange-200/50') 
                                                : (isDarkMode ? 'hover:bg-slate-900 hover:text-amber-400' : 'hover:bg-amber-50 hover:text-brand-orange')
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold font-mono text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                {isSel && <Check size={12} className="text-brand-orange" strokeWidth={3} />}
                                                {s.serial_number}
                                              </span>
                                              {!row.item_code && (
                                                <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded font-mono truncate max-w-[120px]">
                                                  {s.item_code}
                                                </span>
                                              )}
                                            </div>
                                            {itemDesc && (
                                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate pl-4">
                                                {itemDesc}
                                              </span>
                                            )}
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-800/55 pl-4">
                                              <span>Location: <span className="font-bold text-slate-600 dark:text-slate-300">{s.location || 'Unknown'}</span></span>
                                              <span className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 uppercase tracking-wider text-[8px]">
                                                {s.condition ? s.condition.replace('_', ' ') : 'brand new'}
                                              </span>
                                            </div>
                                          </button>
                                        );
                                      })}

                                      {matchedSerials.length === 0 && (
                                        <div className="p-3 text-xs italic text-slate-400 text-center flex flex-col gap-1">
                                          <span>No available stock serials found</span>
                                          {row.deduct_location && (
                                            <span className="text-[10px] text-slate-500">
                                              (Filtered for location: {row.deduct_location})
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Remarks field */}
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Specific Target Remarks</label>
                      <input
                        type="text"
                        placeholder="e.g., ELEM DEPT. Replacement 6-6573"
                        value={row.remarks}
                        onChange={(e) => updateHardwareRow(row.id, { remarks: e.target.value })}
                        className={`px-3 py-1 rounded-lg border text-sm focus:outline-none ${
                          isDarkMode ? 'bg-slate-955 border-slate-808 text-white' : 'bg-white border-slate-205 text-slate-805'
                        }`}
                      />
                    </div>

                    {/* Deduct From Location Select */}
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Deduct From Location</label>
                      <select
                        value={row.deduct_location || ''}
                        onChange={(e) => updateHardwareRow(row.id, { deduct_location: e.target.value })}
                        className={`px-3 py-1 rounded-lg border text-sm font-semibold focus:outline-none h-[30px] ${
                          isDarkMode ? 'bg-slate-955 border-slate-808 text-white' : 'bg-white border-slate-205 text-slate-800'
                        }`}
                      >
                        <option value="">-- Auto-Deduct (FIFO) --</option>
                        {locationStocksList
                          .filter(l => l.item_code === row.item_code && l.quantity > 0)
                          .map(loc => (
                            <option key={loc.location} value={loc.location}>
                              {loc.location} ({loc.quantity} {row.unit || 'pcs'} available)
                            </option>
                          ))
                        }
                        {Array.from(new Set(locationStocksList.map(l => l.location)))
                          .filter(Boolean)
                          .filter(l => !locationStocksList.some(ls => ls.item_code === row.item_code && ls.quantity > 0 && ls.location === l))
                          .sort()
                          .map(l => (
                            <option key={l} value={l}>
                              {l} (0 pcs available)
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            {hardwareItems.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl gap-3 text-center">
                <p className="text-xs italic text-slate-400 max-w-md">
                  {schoolType === 'existing'
                    ? 'No hardware units drafted. Click "Add Hardware Row" below to manually add equipment for this school.'
                    : 'No hardware units drafted. Selected school monitoring records will auto-populate equipment, or you can add manually.'}
                </p>
                <button
                  type="button"
                  onClick={addHardwareRow}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-orange text-white hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Add Hardware Row
                </button>
              </div>
            )}
          </div>

          {/* SECTION 3: SIGNATORIES & AUTHORIZATIONS (Default Blank Names, Editable & E-Signature Upload Support) */}
          <div className={`p-4 rounded-xl border shadow-xs space-y-4 text-left ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <PenTool size={16} className="text-brand-orange" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Section 3: Document Signatories & E-Signatures
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 italic">
                Blank by default • Editable names & dates • Upload or draw signatures
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Signatory 1: Prepared by */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-500">Prepared by / Date</span>
                    {signatoryPrepared.signatureImage && (
                      <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Signed
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Signatory Name</label>
                      <input
                        type="text"
                        placeholder="Bianca Aguinaldo"
                        value={signatoryPrepared.name}
                        onChange={(e) => setSignatoryPrepared(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                      <input
                        type="date"
                        value={signatoryPrepared.date || dateOfAcceptance}
                        onChange={(e) => setSignatoryPrepared(prev => ({ ...prev, date: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* E-Signature Area */}
                <div className="pt-2 border-t border-dashed dark:border-slate-800">
                  <div className="h-16 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center relative overflow-hidden mb-2">
                    {signatoryPrepared.signatureImage ? (
                      <img src={signatoryPrepared.signatureImage} alt="Prepared Sig" className="object-contain h-full w-full p-1" />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">No e-signature attached</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase text-center bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1">
                      <Upload size={10} />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDirectSignatureUpload('prepared', file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => openSignatureModal('prepared')}
                      className="flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase text-center bg-brand-orange/10 border-brand-orange/30 text-brand-orange hover:bg-brand-orange/20 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <PenTool size={10} />
                      <span>Draw</span>
                    </button>
                    {signatoryPrepared.signatureImage && (
                      <button
                        type="button"
                        onClick={() => clearSignatureData('prepared')}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Remove Signature"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Signatory 2: Delivered / Installed by (Full Name only - no date, no e-signature) */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-500">Delivered / Installed by</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Signatory Full Name</label>
                      <input
                        type="text"
                        placeholder="Enter Delivered / Installed full name..."
                        value={signatoryDelivered.name}
                        onChange={(e) => setSignatoryDelivered(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                      <p className="text-[9.5px] text-slate-400 mt-1 italic">Full name only (no date & no e-signature required)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signatory 3: Approved by */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-500">Approved by / Date</span>
                    {signatoryApproved.signatureImage && (
                      <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Signed
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Signatory Name</label>
                      <input
                        type="text"
                        placeholder="Jerald Dela Cruz"
                        value={signatoryApproved.name}
                        onChange={(e) => setSignatoryApproved(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                      <input
                        type="date"
                        value={signatoryApproved.date || dateOfAcceptance}
                        onChange={(e) => setSignatoryApproved(prev => ({ ...prev, date: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* E-Signature Area */}
                <div className="pt-2 border-t border-dashed dark:border-slate-800">
                  <div className="h-16 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center relative overflow-hidden mb-2">
                    {signatoryApproved.signatureImage ? (
                      <img src={signatoryApproved.signatureImage} alt="Approved Sig" className="object-contain h-full w-full p-1" />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">No e-signature attached</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase text-center bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1">
                      <Upload size={10} />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDirectSignatureUpload('approved', file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => openSignatureModal('approved')}
                      className="flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase text-center bg-brand-orange/10 border-brand-orange/30 text-brand-orange hover:bg-brand-orange/20 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <PenTool size={10} />
                      <span>Draw</span>
                    </button>
                    {signatoryApproved.signatureImage && (
                      <button
                        type="button"
                        onClick={() => clearSignatureData('approved')}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Remove Signature"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Signatory 4: Checked & Received by */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-500">Checked & Received by / Date</span>
                    {signatoryCheckedReceived.signatureImage && (
                      <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Signed
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Signatory Name</label>
                      <input
                        type="text"
                        placeholder="Enter Receiver name..."
                        value={signatoryCheckedReceived.name}
                        onChange={(e) => setSignatoryCheckedReceived(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                      <input
                        type="date"
                        value={signatoryCheckedReceived.date || dateOfAcceptance}
                        onChange={(e) => setSignatoryCheckedReceived(prev => ({ ...prev, date: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* E-Signature Area */}
                <div className="pt-2 border-t border-dashed dark:border-slate-800">
                  <div className="h-16 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center relative overflow-hidden mb-2">
                    {signatoryCheckedReceived.signatureImage ? (
                      <img src={signatoryCheckedReceived.signatureImage} alt="Received Sig" className="object-contain h-full w-full p-1" />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">No e-signature attached</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase text-center bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1">
                      <Upload size={10} />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDirectSignatureUpload('checkedReceived', file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => openSignatureModal('checkedReceived')}
                      className="flex-1 px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase text-center bg-brand-orange/10 border-brand-orange/30 text-brand-orange hover:bg-brand-orange/20 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <PenTool size={10} />
                      <span>Draw</span>
                    </button>
                    {signatoryCheckedReceived.signatureImage && (
                      <button
                        type="button"
                        onClick={() => clearSignatureData('checkedReceived')}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Remove Signature"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 4: GENERAL REMARKS */}
          <div className={`p-4 rounded-xl border shadow-xs text-left ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Section 4: Additional Receipt Instructions or Dispatch notes</label>
            <textarea
              rows={3}
              placeholder="Provide delivery routing conditions or remarks for Logistics drivers..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none mt-2 ${
                isDarkMode ? 'bg-slate-955 border-slate-800 text-white' : 'bg-slate-50 border-slate-150 text-slate-800'
              }`}
            />
          </div>

          {/* STEP 1 BOTTOM ACTION: PROCEED TO PRINT PREVIEW */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/delivery-receipt')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel & Exit
            </button>
            <button
              type="button"
              onClick={handleProceedToPreview}
              className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 bg-brand-orange"
            >
              <span>Proceed to Step 2: Print Preview & Authorize</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>

        </div>

        {/* STEP 2: PRINT / PREVIEW RENDER PANEL MATCHING PHOENIX LAYOUT (2nd Step Before Save & Publish) */}
        <div className={`lg:col-span-12 print:block ${currentStep === 2 ? 'block' : 'hidden'}`}>
          
          {/* Multi-Bundle Page Selector Tabs (Only shown when multiple ACE bundle pages exist) */}
          {(() => {
            const acePages = getAcePrintPages(hardwareItems);
            if (acePages.length <= 1) return null;
            return (
              <div className="max-w-4xl mx-auto mb-4 p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden shadow-xs">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-brand-orange" />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      ACE Multi-Bundle Document Pagination ({acePages.length} Pages Generated)
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Arduino & Raspberry on separate pages; Little Bits, Micro:Bit, Makey-Makey & AF Tools grouped on same page.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPreviewActivePageTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      previewActivePageTab === 'all'
                        ? 'bg-brand-orange text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    View All ({acePages.length})
                  </button>
                  {acePages.map((page) => (
                    <button
                      key={page.pageNumber}
                      type="button"
                      onClick={() => setPreviewActivePageTab(page.pageNumber)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                        previewActivePageTab === page.pageNumber
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: page.badgeColor }} />
                      <span>Page {page.pageNumber}: {page.groupKey === 'arduino' ? 'Arduino' : page.groupKey === 'raspberry' ? 'Raspberry' : page.groupKey === 'toolkit_group' ? 'Toolkits' : 'Hardware'}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* RENDER PAGES (Each page has complete Phoenix layout with identical header and 2x2 signatory footer) */}
          {(() => {
            const acePages = getAcePrintPages(hardwareItems);
            return acePages.map((page, pageIdx) => {
              const isVisibleOnScreen = previewActivePageTab === 'all' || previewActivePageTab === page.pageNumber;
              return (
                <div
                  key={`ace-preview-page-${page.pageNumber}`}
                  className={`border bg-white text-zinc-900 p-8 shadow-md rounded-2xl relative select-none print:shadow-none print:border-none print:p-0 max-w-4xl mx-auto font-sans mb-8 print:mb-0 print:block ${
                    isVisibleOnScreen ? 'block' : 'hidden'
                  }`}
                  style={{
                    breakAfter: pageIdx < acePages.length - 1 ? 'page' : 'auto',
                    pageBreakAfter: pageIdx < acePages.length - 1 ? 'always' : 'auto'
                  }}
                >
                  {/* Header branding logo section */}
                  <div className="flex items-center justify-center mb-1 pb-1">
                    <img 
                      src="https://www.phoenix.com.ph/wp-content/uploads/2026/06/Screenshot-2026-06-04-093703.png"
                      alt="Phoenix Publishing House Logo Header"
                      className="w-full object-contain max-h-[85px]"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Document title & top right date blocks */}
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="w-1/4 flex items-center">
                      {acePages.length > 1 && (
                        <span 
                          className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider text-white print:hidden"
                          style={{ backgroundColor: page.badgeColor }}
                        >
                          {page.groupLabel}
                        </span>
                      )}
                    </div>
                    <div className="w-2/4 text-center">
                      <h2 className="text-[14px] font-black tracking-widest text-zinc-900 uppercase font-sans">
                        DELIVERY ACCEPTANCE
                      </h2>
                    </div>

                    {/* Box container for Date and DR No. matching paper sketch */}
                    <div className="w-1/4 flex justify-end">
                      <div className="border border-zinc-500 rounded-sm overflow-hidden shrink-0 text-center text-[10px] w-[165px] leading-tight">
                        <div className="border-b border-zinc-500 p-1 flex items-center justify-between px-2 bg-zinc-50">
                          <span className="font-bold text-zinc-500 uppercase">Date:</span>
                          <span className="font-mono font-bold text-zinc-800">
                            {dateOfAcceptance ? new Date(dateOfAcceptance).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '--/--/----'}
                          </span>
                        </div>
                        <div className="p-1 flex items-center justify-between px-2 bg-zinc-100/50">
                          <span className="font-bold text-zinc-500 uppercase">DR No.</span>
                          <span className="font-mono font-bold text-zinc-900 tracking-wider">
                            {drNo || '00014-2627'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Client information fields grid */}
                  <div className="grid grid-cols-12 gap-y-2 text-[10px] text-left mt-4 pb-4 border-b border-zinc-300">
                    
                    <div className="col-span-7 flex flex-col pr-4 justify-end">
                      <div className="flex items-end">
                        <span className="w-24 shrink-0 font-bold text-zinc-700">Delivered to</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-black text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1">
                          {deliveredTo || 'ST. LOUIS SCHOOL (CENTER), INC.'}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">Client Code</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-mono font-bold text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                        {clientCode || 'C00000231(GS)'}
                      </span>
                    </div>

                    <div className="col-span-7 flex items-end pr-4">
                      <span className="w-24 shrink-0 font-bold text-zinc-700">Address</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1">
                        {address || 'ASSUMPTION ROAD, 2600 BAGUIO CITY, BEN'}
                      </span>
                    </div>
                    <div className="col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">Agent</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-semibold text-zinc-850 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                        {agent || 'Team Gina'}
                      </span>
                    </div>

                    <div className="col-span-7 flex items-end pr-4">
                      <span className="w-24 shrink-0 font-bold text-zinc-700">Contact Person</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-medium text-zinc-800 border-b border-zinc-350 flex-grow pb-0.5 pl-1 truncate">
                        {contactPerson || <span className="text-zinc-300">__________________________________________</span>}
                      </span>
                    </div>
                    <div className="col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">Project</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-bold text-zinc-950 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                        {project || 'ARALINKS ACE'}
                      </span>
                    </div>

                    <div className="col-span-7 flex items-end pr-4">
                      <span className="w-24 shrink-0 font-bold text-zinc-700">Contact No.</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                        {contactNo || <span className="text-zinc-300">__________________________________________</span>}
                      </span>
                    </div>
                    <div className="col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">MOA</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-semibold text-zinc-805 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                        {moa || 'S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26'}
                      </span>
                    </div>

                  </div>

                  {/* HARDWARE ITEMS TABLE (Matches physical style closely) */}
                  <div className="mt-4 text-[9.5px] text-left">
                    <table className="w-full border-collapse border border-zinc-400">
                      <thead>
                        <tr className="bg-zinc-100 text-[8.5px] font-black uppercase text-zinc-650 border-b border-zinc-400">
                          <th className="border-r border-zinc-400 px-2.5 py-1.5 text-center w-14">Quantity</th>
                          <th className="border-r border-zinc-400 px-2.5 py-1.5 text-center w-14">Unit</th>
                          <th className="border-r border-zinc-400 px-3 py-1.5 text-left w-1/2">Description</th>
                          <th className="border-r border-zinc-400 px-3 py-1.5 text-left">Specifications</th>
                          <th className="px-3 py-1.5 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="text-[9.5px]">
                        {/* Category Indicator Row mimicking paper template */}
                        <tr className="border-b border-zinc-300 font-bold text-zinc-800 bg-zinc-50/70">
                          <td className="border-r border-zinc-300 py-1 text-center"></td>
                          <td className="border-r border-zinc-300 py-1 text-center"></td>
                          <td colSpan={3} className="px-3 py-1 font-black uppercase tracking-wider text-[8.5px] text-zinc-700">
                            Hardware {acePages.length > 1 ? `— ${page.groupLabel}` : ''}
                          </td>
                        </tr>

                        {page.items.map((hw, idx) => (
                          <tr key={hw.id || idx} className="border-b border-zinc-200">
                            <td className="border-r border-zinc-400 px-2 py-1 text-center font-bold font-mono text-zinc-900">{hw.qty}</td>
                            <td className="border-r border-zinc-400 px-2 py-1 text-center text-zinc-600 font-sans">{hw.unit}</td>
                            <td className="border-r border-zinc-400 px-3 py-1 font-black text-zinc-900 truncate max-w-[210px]" title={hw.description}>{hw.description || '------'}</td>
                            <td className="border-r border-zinc-400 px-3 py-1 font-mono text-[9px] text-zinc-650 truncate max-w-[150px]" title={hw.specifications}>
                              {(() => {
                                const rowItemCode = hw.item_code;
                                const isSerialized = isSerializedItem(rowItemCode, hw.description);
                                const isBundled = !!(hw.bundle_name || hw.bundle || (hw.remarks && hw.remarks.startsWith('Bundle: ')));
                                if ((isSerialized || isBundled) && hw.specifications) {
                                  return formatSerialRanges(hw.specifications);
                                }
                                return hw.specifications || '------';
                              })()}
                            </td>
                            <td className="px-3 py-1 text-zinc-600 truncate max-w-[140px]" title={hw.remarks}>
                              {(() => {
                                if (!hw.remarks) return '------';
                                const bName = hw.bundle_name || hw.bundle || (hw.remarks.startsWith('Bundle: ') ? hw.remarks.substring(8).trim() : '');
                                if (bName) {
                                  const bColor = getBundleColor(bName);
                                  if (bColor) {
                                    return (
                                      <span style={{ color: bColor.bg }} className="font-extrabold uppercase text-[9.5px]">
                                        {hw.remarks}
                                      </span>
                                    );
                                  }
                                }
                                return hw.remarks;
                              })()}
                            </td>
                          </tr>
                        ))}
                        {/* Fill empty lines up to 8 rows for that notepad look */}
                        {Array.from({ length: Math.max(0, 8 - page.items.length) }).map((_, i) => (
                          <tr key={`empty-hw-${page.pageNumber}-${i}`} className="h-[21px] border-b border-zinc-200">
                            <td className="border-r border-zinc-400"></td>
                            <td className="border-r border-zinc-400"></td>
                            <td className="border-r border-zinc-400"></td>
                            <td className="border-r border-zinc-400"></td>
                            <td></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Document Remarks/Footnotes */}
                  {remarks && (
                    <div className="mt-3.5 p-2 rounded border border-zinc-200 text-left text-[8.5px] leading-relaxed text-zinc-500 font-sans">
                      <span className="font-extrabold text-[#FF6A00] uppercase block mb-0.5">Dispatcher / Routing Notes:</span>
                      {remarks}
                    </div>
                  )}

                  {/* SIGNATURE FIELDS AT THE BOTTOM (A high-fidelity 2x2 paper document signatory section) */}
                  <div className="mt-6 pt-4 border-t border-zinc-300 grid grid-cols-2 gap-x-12 gap-y-5 text-left leading-snug text-[10px]">
                    
                    {/* Row 1 Column 1: Prepared */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-600 block">Prepared by/ Date:</span>
                      </div>
                      <div 
                        onClick={() => openSignatureModal('prepared')}
                        className="h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer relative overflow-hidden flex items-center justify-center transition-all group"
                        title="Click to draw or upload signature"
                      >
                        {signatoryPrepared.signatureImage ? (
                          <img src={signatoryPrepared.signatureImage} alt="Prepared Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                        ) : signatoryPrepared.name ? (
                          <div className="text-zinc-400 text-center font-mono opacity-60 flex items-center gap-1 group-hover:opacity-100">
                            <PenTool size={10} className="text-brand-orange" />
                            <span className="text-[7.5px] font-bold uppercase">Click to Sign</span>
                          </div>
                        ) : (
                          <div className="text-center font-mono flex items-center justify-center gap-1 group-hover:scale-105 transition-all">
                            <PenTool size={10} className="text-brand-orange" />
                            <span className="text-[7.5px] text-brand-orange font-bold uppercase tracking-wider">Click to Sign / Upload</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center font-sans">
                        <input
                          type="text"
                          placeholder="Bianca Aguinaldo"
                          value={signatoryPrepared.name}
                          onChange={(e) => setSignatoryPrepared(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full text-center font-extrabold border-b border-zinc-400 focus:outline-none focus:border-brand-orange text-zinc-900 pb-0.5 leading-none text-[10px] uppercase bg-transparent max-w-[200px] mx-auto block"
                        />
                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                      </div>
                    </div>

                    {/* Row 1 Column 2: Delivered/Installed (Full name only - no date, no e-signature) */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-600 block">Delivered/Installed by:</span>
                      </div>
                      <div className="h-14 flex items-center justify-center">
                        {/* Clean open space for physical paper or full name alignment */}
                      </div>
                      <div className="text-center font-sans">
                        <input
                          type="text"
                          placeholder="[ DELIVERED / INSTALLED BY NAME ]"
                          value={signatoryDelivered.name}
                          onChange={(e) => setSignatoryDelivered(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full text-center font-extrabold border-b border-zinc-400 focus:outline-none focus:border-brand-orange text-zinc-900 pb-0.5 leading-none text-[10px] uppercase bg-transparent max-w-[240px] mx-auto block"
                        />
                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">Printed Name</span>
                      </div>
                    </div>

                    {/* Row 2 Column 1: Approved */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-600 block">Approved by/ Date:</span>
                      </div>
                      <div 
                        onClick={() => openSignatureModal('approved')}
                        className="h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer relative overflow-hidden flex items-center justify-center transition-all group"
                        title="Click to draw or upload signature"
                      >
                        {signatoryApproved.signatureImage ? (
                          <img src={signatoryApproved.signatureImage} alt="Approved Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                        ) : signatoryApproved.name ? (
                          <div className="text-zinc-400 text-center font-mono opacity-60 flex items-center gap-1 group-hover:opacity-100">
                            <PenTool size={10} className="text-brand-orange" />
                            <span className="text-[7.5px] font-bold uppercase">Click to Sign</span>
                          </div>
                        ) : (
                          <div className="text-center font-mono flex items-center justify-center gap-1 group-hover:scale-105 transition-all">
                            <PenTool size={10} className="text-brand-orange" />
                            <span className="text-[7.5px] text-brand-orange font-bold uppercase tracking-wider">Click to Sign / Upload</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center font-sans">
                        <input
                          type="text"
                          placeholder="Jerald Dela Cruz"
                          value={signatoryApproved.name}
                          onChange={(e) => setSignatoryApproved(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full text-center font-extrabold border-b border-zinc-400 focus:outline-none focus:border-brand-orange text-zinc-900 pb-0.5 leading-none text-[10px] uppercase bg-transparent max-w-[200px] mx-auto block"
                        />
                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                      </div>
                    </div>

                    {/* Row 2 Column 2: Checked and Received */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-650 block">CHECKED and Received the above articles in good order and condition:</span>
                      </div>
                      <div 
                        onClick={() => openSignatureModal('checkedReceived')}
                        className="h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer relative overflow-hidden flex items-center justify-center transition-all group"
                        title="Click to draw or upload signature"
                      >
                        {signatoryCheckedReceived.signatureImage ? (
                          <img src={signatoryCheckedReceived.signatureImage} alt="Received Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                        ) : signatoryCheckedReceived.name ? (
                          <div className="text-zinc-400 text-center font-mono opacity-60 flex items-center gap-1 group-hover:opacity-100">
                            <PenTool size={10} className="text-brand-orange" />
                            <span className="text-[7.5px] font-bold uppercase">Click to Sign</span>
                          </div>
                        ) : (
                          <div className="text-center font-mono flex items-center justify-center gap-1 group-hover:scale-105 transition-all">
                            <PenTool size={10} className="text-brand-orange" />
                            <span className="text-[7.5px] text-brand-orange font-bold uppercase tracking-wider">Receiver Sign / Upload</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center font-sans">
                        <input
                          type="text"
                          placeholder="Enter receiver name..."
                          value={signatoryCheckedReceived.name}
                          onChange={(e) => setSignatoryCheckedReceived(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full text-center font-extrabold border-b border-zinc-400 focus:outline-none focus:border-brand-orange text-zinc-900 pb-0.5 leading-none text-[10px] uppercase bg-transparent max-w-[200px] mx-auto block"
                        />
                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature/Date</span>
                      </div>
                    </div>

                  </div>

                  {/* Document Footnote standard alignment */}
                  <div className="mt-8 border-t border-zinc-300 pt-3.5 flex items-center justify-between text-[8px] text-zinc-400 font-mono">
                    <span>* Please fill up remarks field if necessary</span>
                    <span className="font-bold">page {page.pageNumber} of {page.totalPages}</span>
                    <span>cc: FPH I.T. Dept., Customer</span>
                  </div>
                </div>
              );
            });
          })()}

          {/* STEP 2 BOTTOM ACTIONS: BACK TO EDIT & SAVE & PUBLISH */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-4xl mx-auto mt-6 print:hidden">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
            >
              <ArrowLeft size={14} />
              <span>Back to Edit Form (Step 1)</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                <Printer size={14} />
                <span>Print Document</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDeliveryReceipt}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
                style={{ backgroundColor: 'var(--brand-accent)' }}
              >
                <Save size={14} strokeWidth={2.5} />
                <span>{isEditMode ? 'Update Record' : 'Save & Publish Delivery Receipt'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ENHANCED 3-TAB E-SIGNATURE MODAL (UPLOAD, DRAW, TYPE) */}
      {isSignModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[2000] flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl border shadow-2xl max-w-md w-full text-left font-sans ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PenTool size={16} className="text-brand-orange" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Digital E-Signature Authentication
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsSignModalOpen(false);
                  setUploadedSigPreview(null);
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 mb-4">
              <button
                type="button"
                onClick={() => setSigModalTab('upload')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sigModalTab === 'upload'
                    ? 'bg-white dark:bg-slate-800 text-brand-orange shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Upload size={13} />
                <span>Upload Image</span>
              </button>
              <button
                type="button"
                onClick={() => setSigModalTab('draw')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sigModalTab === 'draw'
                    ? 'bg-white dark:bg-slate-800 text-brand-orange shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <PenTool size={13} />
                <span>Draw on Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setSigModalTab('type')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sigModalTab === 'type'
                    ? 'bg-white dark:bg-slate-800 text-brand-orange shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileText size={13} />
                <span>Type Name</span>
              </button>
            </div>

            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Signatory Printed Name</label>
                  <input
                    type="text"
                    placeholder="Enter full name..."
                    value={typedSignName}
                    onChange={(e) => setTypedSignName(e.target.value)}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Date Signed</label>
                  <input
                    type="date"
                    value={typedSignDate}
                    onChange={(e) => setTypedSignDate(e.target.value)}
                    className={`px-3 py-2 rounded-lg border text-xs focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* TAB 1: UPLOAD E-SIGNATURE IMAGE */}
              {sigModalTab === 'upload' && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Upload E-Signature File (PNG, JPG, SVG)</label>
                  
                  {uploadedSigPreview ? (
                    <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
                      <img
                        src={uploadedSigPreview}
                        alt="Signature preview"
                        className="max-h-28 max-w-full object-contain mb-2"
                      />
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 cursor-pointer text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <RefreshCw size={12} />
                          <span>Replace Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSignatureFileUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setUploadedSigPreview(null)}
                          className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-rose-500/10 border-rose-500/20 text-rose-600 hover:bg-rose-500/20 cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 size={12} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-orange rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50 hover:bg-orange-500/5 transition-all">
                      <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                        <Upload size={20} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Click to browse or drop signature image</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Supports transparent PNG, JPG, or WEBP (Max 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* TAB 2: DRAW ON CANVAS */}
              {sigModalTab === 'draw' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
                    <span>Draw Signature Below</span>
                    <button
                      type="button"
                      onClick={clearSignatureCanvas}
                      className="text-[9px] text-[#FF6A00] uppercase font-black hover:underline cursor-pointer border-none bg-transparent"
                    >
                      Clear Slate
                    </button>
                  </label>

                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={150}
                    onMouseDown={startScribble}
                    onMouseMove={drawScribbling}
                    onMouseUp={stopScribbling}
                    onMouseLeave={stopScribbling}
                    onTouchStart={startScribble}
                    onTouchMove={drawScribbling}
                    onTouchEnd={stopScribbling}
                    className="w-full bg-zinc-50 dark:bg-slate-950/40 border border-zinc-250 dark:border-slate-800 rounded-xl cursor-crosshair h-[150px] touch-none"
                  />
                  <p className="text-[9.5px] text-slate-400 leading-normal italic text-center">
                    * Draw using mouse or touchscreen finger.
                  </p>
                </div>
              )}

              {/* TAB 3: TYPE PRINTED NAME */}
              {sigModalTab === 'type' && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center min-h-[120px] text-center">
                  <p className="font-serif italic text-2xl text-slate-800 dark:text-slate-100 mb-1">
                    {typedSignName || 'Your Signature Name'}
                  </p>
                  <div className="w-48 h-0.5 bg-slate-300 dark:bg-slate-700 my-1" />
                  <p className="text-[10px] text-slate-400 font-mono uppercase">
                    Digitally Authorized: {typedSignDate || new Date().toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignModalOpen(false);
                    setUploadedSigPreview(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isDarkMode ? 'bg-slate-800 text-slate-350 hover:text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (sigModalTab === 'upload') {
                      saveSignatureDetails('uploaded');
                    } else if (sigModalTab === 'draw') {
                      saveSignatureDetails('drawn');
                    } else {
                      saveSignatureDetails('typed');
                    }
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase text-white shadow bg-brand-orange inline-flex items-center gap-1.5 active:scale-95 cursor-pointer transition-all hover:opacity-90"
                >
                  <Check size={14} strokeWidth={3} />
                  <span>Save & Apply Signature</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* PENDING BUNDLE MULTIPLIER MODAL */}
      {pendingBundle && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[2000] flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl border shadow-2xl max-w-sm w-full text-left font-sans ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-amber-500" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Apply Bundle Configuration
                </h3>
              </div>
              <button
                onClick={() => setPendingBundle(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4 font-medium">
              You are applying the bundle configuration <span className="font-bold text-slate-700 dark:text-white uppercase">"{pendingBundle}"</span> to your active hardware delivery.
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Multiplier (Number of Bundles)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bundleQuantity || ''}
                  onChange={(e) => setBundleQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                  className={`px-3 py-2 rounded-lg border text-sm font-bold font-mono focus:outline-none ${
                    isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  placeholder="1"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingBundle(null)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isDarkMode ? 'bg-slate-800 text-slate-350 hover:text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmApplyBundle}
                  className="px-4.5 py-2 rounded-xl text-xs font-black uppercase text-white shadow bg-brand-orange inline-flex items-center gap-1.5 active:scale-95 cursor-pointer transition-all hover:opacity-90"
                >
                  <Check size={14} strokeWidth={3} />
                  Confirm & Apply
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CreateDeliveryReceiptPage;
