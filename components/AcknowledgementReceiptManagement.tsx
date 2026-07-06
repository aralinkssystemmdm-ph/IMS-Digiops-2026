import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Building2, 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  X, 
  Filter, 
  ChevronDown, 
  Eye, 
  AlertTriangle, 
  Activity,
  Trash2,
  Box,
  FileCheck,
  RefreshCw,
  Notebook,
  Printer,
  PenTool,
  Download,
  Check,
  Briefcase,
  FileText,
  User,
  Hash,
  XCircle,
  HelpCircle,
  CheckSquare
} from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import PageHeader from './PageHeader';
import { useNotification } from './NotificationProvider';

interface ARItem {
  id: string;
  name: string;
  qty: number;
  category: string;
  serialNumber?: string;
  remarks?: string;
}

interface AcknowledgementReceipt {
  id: string; // AR No
  recipientName: string;
  schoolName: string;
  date: string;
  ticketNo: string;
  status: 'Draft' | 'Issued' | 'Acknowledged' | 'Returned' | 'Lost' | 'Cancelled';
  totalItems: number;
  items: ARItem[];
  initiatedBy: string;
  remarks?: string;
  customerCode?: string;
  address?: string;
  agent?: string;
  contactNo?: string;
  schoolYear?: string;
}

const SAMPLE_AR_DATA: AcknowledgementReceipt[] = [
  {
    id: 'AR-20260601-0105',
    recipientName: 'Dr. Maria Santos',
    schoolName: 'Ateneo de Manila University',
    date: '2026-06-01',
    ticketNo: 'TK-20260601-41',
    status: 'Acknowledged',
    totalItems: 52,
    initiatedBy: 'John Doe',
    customerCode: 'C-ADE-082',
    address: 'Katipunan Ave, Quezon City, 1108 Metro Manila',
    agent: 'Team Phoenix Alpha',
    contactNo: '+63 917 123 4567',
    schoolYear: '2026-2027',
    remarks: 'Issued for standard high school science department faculty deployment.',
    items: [
      { id: 'item-1', name: 'Aralinks Tablet Book Lite', qty: 50, category: 'Tablets', serialNumber: 'SN-TB-081290-X', remarks: 'With leather cases' },
      { id: 'item-2', name: 'Aralinks Router Pro V4', qty: 2, category: 'Networking', serialNumber: 'SN-RT-773121-W', remarks: 'Main corridor relays' }
    ]
  },
  {
    id: 'AR-20260528-0240',
    recipientName: 'Prof. Arnold Clavio',
    schoolName: 'De La Salle University',
    date: '2026-05-28',
    ticketNo: 'TK-20260528-12',
    status: 'Issued',
    totalItems: 1,
    initiatedBy: 'Jane Smith',
    customerCode: 'C-DLS-012',
    address: 'Taft Ave, Malate, Manila, 1004 Metro Manila',
    agent: 'Team Phoenix Gamma',
    contactNo: '+63 920 987 6543',
    schoolYear: '2026-2027',
    remarks: 'Smart Interactive Board demonstration unit.',
    items: [
      { id: 'item-3', name: 'Aralinks Smart Interactive Board 75"', qty: 1, category: 'Displays', serialNumber: 'SN-SIB-75-0109', remarks: 'Wall mount bracket included' }
    ]
  },
  {
    id: 'AR-20260520-0085',
    recipientName: 'Librarian Clara Cruz',
    schoolName: 'University of Santo Tomas',
    date: '2026-05-20',
    ticketNo: 'TK-20260520-33',
    status: 'Returned',
    totalItems: 5,
    initiatedBy: 'Robert Johnson',
    customerCode: 'C-UST-044',
    address: 'España Blvd, Sampaloc, Manila, 1008 Metro Manila',
    agent: 'Team Phoenix Beta',
    contactNo: '+63 935 444 8812',
    schoolYear: '2025-2026',
    remarks: 'Returned VR packages after end of learning cycle program.',
    items: [
      { id: 'item-4', name: 'Aralinks VR Headset G2', qty: 5, category: 'VR Gear', serialNumber: 'SN-VRG2-880-92', remarks: 'Cleaned and sanitized' }
    ]
  },
  {
    id: 'AR-20260515-0912',
    recipientName: 'Engr. Roger Ramos',
    schoolName: 'Mapua University',
    date: '2026-05-15',
    ticketNo: 'TK-20260515-22',
    status: 'Lost',
    totalItems: 1,
    initiatedBy: 'Michael Garibaldi',
    customerCode: 'C-MAP-009',
    address: 'Muralla St, Intramuros, Manila, 1002 Metro Manila',
    agent: 'Team Phoenix Delta',
    contactNo: '+63 909 313 1928',
    schoolYear: '2025-2026',
    remarks: 'Reported lost during classroom relocation. Security investigation pending.',
    items: [
      { id: 'item-5', name: 'Aralinks Access Point V2', qty: 1, category: 'Networking', serialNumber: 'SN-APV2-0051', remarks: 'Missing since May 14' }
    ]
  },
  {
    id: 'AR-20260510-0412',
    recipientName: 'Mrs. Elizabeth Roxas',
    schoolName: 'Far Eastern University',
    date: '2026-05-10',
    ticketNo: 'TK-20260510-02',
    status: 'Draft',
    totalItems: 10,
    initiatedBy: 'Sarah Connor',
    customerCode: 'C-FEU-055',
    address: 'Nicanor Reyes St, Sampaloc, Manila, 1008 Metro Manila',
    agent: 'Team Phoenix Alpha',
    contactNo: '+63 944 551 2290',
    schoolYear: '2026-2027',
    remarks: 'Proposed setup for deployment in library multimedia room.',
    items: [
      { id: 'item-6', name: 'Aralinks Laptop Pro V3', qty: 10, category: 'Laptops', serialNumber: 'PENDING', remarks: 'Pending serial tags assignment' }
    ]
  }
];

interface AcknowledgementReceiptManagementProps {
  isDarkMode?: boolean;
}

const AcknowledgementReceiptManagement: React.FC<AcknowledgementReceiptManagementProps> = ({ isDarkMode = false }) => {
  const { showInfo, showSuccess, showError, showWarning } = useNotification();
  
  // States
  const [records, setRecords] = useState<AcknowledgementReceipt[]>(() => {
    const saved = localStorage.getItem('aralinks_receipt_records');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing stored receipts:', e);
      }
    }
    localStorage.setItem('aralinks_receipt_records', JSON.stringify(SAMPLE_AR_DATA));
    return SAMPLE_AR_DATA;
  });

  // Save changes to localStorage
  const saveRecords = (updated: AcknowledgementReceipt[]) => {
    setRecords(updated);
    localStorage.setItem('aralinks_receipt_records', JSON.stringify(updated));
  };

  // Searching, Filtering & View State
  const [searchARNo, setSearchARNo] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchSchool, setSearchSchool] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  
  // Modals state
  const [selectedAR, setSelectedAR] = useState<AcknowledgementReceipt | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAR, setEditingAR] = useState<AcknowledgementReceipt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form states (creating or editing)
  const [formARNo, setFormARNo] = useState('');
  const [formRecipientName, setFormRecipientName] = useState('');
  const [formSchoolName, setFormSchoolName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTicketNo, setFormTicketNo] = useState('');
  const [formStatus, setFormStatus] = useState<AcknowledgementReceipt['status']>('Draft');
  const [formRemarks, setFormRemarks] = useState('');
  const [formCustomerCode, setFormCustomerCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAgent, setFormAgent] = useState('');
  const [formContactNo, setFormContactNo] = useState('');
  const [formSchoolYear, setFormSchoolYear] = useState('2026-2027');
  const [formItems, setFormItems] = useState<ARItem[]>([]);

  // Individual Form Row adding State
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemCategory, setNewItemCategory] = useState('Tablets');
  const [newItemSerial, setNewItemSerial] = useState('');
  const [newItemRemarks, setNewItemRemarks] = useState('');

  // Syncing Form States when editingAR toggles
  useEffect(() => {
    if (editingAR) {
      setFormARNo(editingAR.id);
      setFormRecipientName(editingAR.recipientName);
      setFormSchoolName(editingAR.schoolName);
      setFormDate(editingAR.date);
      setFormTicketNo(editingAR.ticketNo);
      setFormStatus(editingAR.status);
      setFormRemarks(editingAR.remarks || '');
      setFormCustomerCode(editingAR.customerCode || '');
      setFormAddress(editingAR.address || '');
      setFormAgent(editingAR.agent || '');
      setFormContactNo(editingAR.contactNo || '');
      setFormSchoolYear(editingAR.schoolYear || '2026-2027');
      setFormItems([...editingAR.items]);
    } else {
      // Clear Form state for creating
      const generatedAR = `AR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
      setFormARNo(generatedAR);
      setFormRecipientName('');
      setFormSchoolName('');
      setFormDate(new Date().toISOString().slice(0, 10));
      setFormTicketNo('');
      setFormStatus('Draft');
      setFormRemarks('');
      setFormCustomerCode('');
      setFormAddress('');
      setFormAgent('');
      setFormContactNo('');
      setFormSchoolYear('2026-2027');
      setFormItems([]);
    }
    // Clear adding row fields
    setNewItemName('');
    setNewItemQty(1);
    setNewItemCategory('Tablets');
    setNewItemSerial('');
    setNewItemRemarks('');
  }, [editingAR, isFormModalOpen]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalRecords = records.length;
    // Active assets count: total items of AR with status Issued, Acknowledged or Draft
    const activeAssets = records
      .filter(r => ['Acknowledged', 'Issued'].includes(r.status))
      .reduce((sum, r) => sum + r.items.reduce((acc, item) => acc + item.qty, 0), 0);

    // Returned assets count
    const returnedAssets = records
      .filter(r => r.status === 'Returned')
      .reduce((sum, r) => sum + r.items.reduce((acc, item) => acc + item.qty, 0), 0);

    // Outstanding assets count: total items where they are Draft, Issued, Acknowledged, Lost
    const outstandingAssets = records
      .filter(r => ['Acknowledged', 'Issued', 'Lost', 'Draft'].includes(r.status))
      .reduce((sum, r) => sum + r.items.reduce((acc, item) => acc + item.qty, 0), 0);

    return { totalRecords, activeAssets, returnedAssets, outstandingAssets };
  }, [records]);

  // Handle items rows in creating state
  const handleAddItemRow = () => {
    if (!newItemName.trim()) {
      showWarning('Missing Field', 'Please provide an equipment item name.');
      return;
    }
    const targetItem: ARItem = {
      id: `form-item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: newItemName.trim(),
      qty: newItemQty,
      category: newItemCategory,
      serialNumber: newItemSerial.trim() || '------',
      remarks: newItemRemarks.trim() || '------'
    };
    setFormItems(prev => [...prev, targetItem]);
    setNewItemName('');
    setNewItemQty(1);
    setNewItemSerial('');
    setNewItemRemarks('');
    showSuccess('Row Added', 'Added item to current draft list.');
  };

  const handleRemoveItemRow = (id: string) => {
    setFormItems(prev => prev.filter(i => i.id !== id));
  };

  // Form submission
  const handleSaveARForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRecipientName.trim() || !formSchoolName.trim() ) {
      showError('Validation Error', 'Recipient Name and School Name are strictly required.');
      return;
    }
    if (formItems.length === 0) {
      showError('Empty Receipt', 'You must add at least one item row to the acknowledgement receipt.');
      return;
    }

    const calculatedTotal = formItems.reduce((sum, item) => sum + item.qty, 0);

    const targetAR: AcknowledgementReceipt = {
      id: formARNo.trim(),
      recipientName: formRecipientName.trim(),
      schoolName: formSchoolName.trim(),
      date: formDate,
      ticketNo: formTicketNo.trim() || `TK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`,
      status: formStatus,
      totalItems: calculatedTotal,
      items: formItems,
      initiatedBy: editingAR ? editingAR.initiatedBy : 'Authorized User',
      remarks: formRemarks.trim(),
      customerCode: formCustomerCode.trim() || 'C-GEN-001',
      address: formAddress.trim() || 'Katipunan Ave, Quezon City',
      agent: formAgent.trim() || 'Team Phoenix',
      contactNo: formContactNo.trim(),
      schoolYear: formSchoolYear
    };

    let nextRecords = [...records];
    if (editingAR) {
      nextRecords = nextRecords.map(r => r.id === editingAR.id ? targetAR : r);
      showSuccess('Receipt Updated', `Successfully updated record ${targetAR.id}.`);
    } else {
      nextRecords.push(targetAR);
      showSuccess('Receipt Created', `Successfully generated receipt ${targetAR.id}.`);
    }

    saveRecords(nextRecords);
    setIsFormModalOpen(false);
    setEditingAR(null);
  };

  // Delete Record
  const confirmDeleteRecord = () => {
    if (!showDeleteConfirm) return;
    const nextList = records.filter(p => p.id !== showDeleteConfirm);
    saveRecords(nextList);
    showSuccess('Deleted', `AR Record ${showDeleteConfirm} has been permanently deleted.`);
    setShowDeleteConfirm(null);
  };

  // Filter conditions
  const filteredData = useMemo(() => {
    return records.filter(p => {
      const matchesAR = p.id.toLowerCase().includes(searchARNo.toLowerCase());
      const matchesName = p.recipientName.toLowerCase().includes(searchName.toLowerCase());
      const matchesSchool = p.schoolName.toLowerCase().includes(searchSchool.toLowerCase());

      let matchesDate = true;
      if (dateFilterStart) {
        matchesDate = matchesDate && p.date >= dateFilterStart;
      }
      if (dateFilterEnd) {
        matchesDate = matchesDate && p.date <= dateFilterEnd;
      }

      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;

      return matchesAR && matchesName && matchesSchool && matchesDate && matchesStatus;
    });
  }, [records, searchARNo, searchName, searchSchool, dateFilterStart, dateFilterEnd, statusFilter]);

  // Export actions
  const handleExportAll = () => {
    showInfo(
      'Export In Progress', 
      'Creating high-fidelity Excel/CSV spreadsheets of acknowledgement records.'
    );
    setTimeout(() => {
      showSuccess('Export Succeeded', `Downloaded fixed_assets_ar_records_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }, 1200);
  };

  const handleExportPDFSingle = (ar: AcknowledgementReceipt) => {
    showInfo(
      'Generating PDF Document', 
      `Packaging vector components and standard metadata layout for ${ar.id}.`
    );
    setTimeout(() => {
      showSuccess('PDF Downloaded', `Successfully prepared and saved ${ar.id}.pdf`);
    }, 1000);
  };

  const handlePrintAR = (arId: string) => {
    showInfo(
      'Print Spooler Triggered',
      `Preparing layout margins for active acknowledgement receipt ${arId}.`
    );
    window.print();
  };

  const getStatusStyle = (status: AcknowledgementReceipt['status']) => {
    switch (status) {
      case 'Acknowledged':
        return {
          label: 'Acknowledged',
          style: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
          icon: <CheckCircle2 size={13} />
        };
      case 'Issued':
        return {
          label: 'Issued',
          style: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
          icon: <CheckSquare size={13} />
        };
      case 'Draft':
        return {
          label: 'Draft',
          style: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50',
          icon: <Clock size={13} />
        };
      case 'Returned':
        return {
          label: 'Returned',
          style: 'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20',
          icon: <RefreshCw size={13} />
        };
      case 'Lost':
        return {
          label: 'Lost',
          style: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
          icon: <AlertTriangle size={13} />
        };
      case 'Cancelled':
      default:
        return {
          label: 'Cancelled',
          style: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
          icon: <XCircle size={13} />
        };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '------';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    });
  };

  // Signatory definitions for the Document paper sheet
  const displaySignatories = useMemo(() => {
    if (!selectedAR) return null;
    return {
      issuedBy: { name: selectedAR.initiatedBy || 'Authorized Manager', title: 'Issued By / Custodian' },
      checkedBy: { name: 'JERALD DELA CRUZ', title: 'Quality Assurance Officer' },
      approvedBy: { name: 'JOHN ROBERT PAGALA', title: 'Inventory Director' },
      acknowledgedBy: { name: selectedAR.recipientName, title: 'Acknowledged Recipient Employee / Personnel' }
    };
  }, [selectedAR]);

  return (
    <div className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative no-scrollbar">
      
      {/* 1. Page Header Area */}
      <div className="mx-2 lg:mx-4 mt-2">
        <PageHeader 
          title="Acknowledgement Receipt Management" 
          description="Manage issued assets and acknowledgement records." 
          isDarkMode={isDarkMode}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingAR(null);
                  setIsFormModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 bg-brand-orange"
                style={{
                  boxShadow: '0 4px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 60%)'
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Create Acknowledgement Receipt
              </button>
              <button
                onClick={handleExportAll}
                className={`px-4 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white' 
                    : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Download size={14} />
                Export
              </button>
              <button
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={`px-4 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                  showFiltersPanel
                    ? 'border-brand-orange text-brand-orange bg-brand-orange/5'
                    : isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                      : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                }`}
              >
                <Filter size={14} />
                Filter
              </button>
            </div>
          }
        />
      </div>

      {/* 2. Top Summary Info Cards Grid */}
      <div className="mx-2 lg:mx-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        
        {/* Total Records Card */}
        <div className={`p-4 rounded-xl border shadow-xs transition-all flex items-center justify-between ${
          isDarkMode ? 'bg-slate-900 border-slate-800/80 text-white' : 'bg-white border-slate-150 text-slate-800'
        }`}>
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Total AR Records</span>
            <p className="text-3xl font-black">{stats.totalRecords}</p>
            <span className="text-[9.5px] text-zinc-400 font-medium block">Stored documents</span>
          </div>
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-xl shrink-0">
            <FileText size={24} />
          </div>
        </div>

        {/* Active Assets Card */}
        <div className={`p-4 rounded-xl border shadow-xs transition-all flex items-center justify-between ${
          isDarkMode ? 'bg-slate-900 border-slate-800/80 text-white' : 'bg-white border-slate-150 text-slate-800'
        }`}>
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Active Assets</span>
            <p className="text-3xl font-black text-blue-500">{stats.activeAssets}</p>
            <span className="text-[9.5px] text-zinc-400 font-medium block">Issued & acknowledged</span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
            <Briefcase size={24} />
          </div>
        </div>

        {/* Returned Assets Card */}
        <div className={`p-4 rounded-xl border shadow-xs transition-all flex items-center justify-between ${
          isDarkMode ? 'bg-slate-900 border-slate-800/80 text-white' : 'bg-white border-slate-150 text-slate-800'
        }`}>
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Returned Assets</span>
            <p className="text-3xl font-black text-emerald-500">{stats.returnedAssets}</p>
            <span className="text-[9.5px] text-zinc-400 font-medium block">Recovered back safely</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
            <RefreshCw size={24} />
          </div>
        </div>

        {/* Outstanding Assets Card */}
        <div className={`p-4 rounded-xl border shadow-xs transition-all flex items-center justify-between ${
          isDarkMode ? 'bg-slate-900 border-slate-800/80 text-white' : 'bg-white border-slate-150 text-slate-800'
        }`}>
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Outstanding Assets</span>
            <p className="text-3xl font-black text-amber-500">{stats.outstandingAssets}</p>
            <span className="text-[9.5px] text-zinc-400 font-medium block">Currently with personnel</span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
            <Box size={24} />
          </div>
        </div>

      </div>

      {/* 3. Filters Panel (Expandable & Highly Styled) */}
      <AnimatePresence>
        {(showFiltersPanel || searchARNo || searchName || searchSchool || dateFilterStart || dateFilterEnd) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`mx-2 lg:mx-4 p-5 mt-4 rounded-xl shadow-sm border ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-dashed border-slate-150 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-brand-orange tracking-widest flex items-center gap-1.5">
                  <Filter size={11} />
                  Advanced Filter Query Builder
                </span>
                <button 
                  onClick={() => {
                    setSearchARNo('');
                    setSearchName('');
                    setSearchSchool('');
                    setDateFilterStart('');
                    setDateFilterEnd('');
                    setStatusFilter('All');
                  }}
                  className="text-[9.5px] text-slate-500 hover:text-brand-orange font-bold uppercase transition"
                >
                  Clear All Filters
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-2.5">
                
                {/* Search AR No */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-black uppercase text-slate-400">Search AR No.</label>
                  <div className="relative">
                    <Hash size={13} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. AR-2026..."
                      value={searchARNo}
                      onChange={(e) => setSearchARNo(e.target.value)}
                      className={`pl-8 pr-3 py-2 w-full rouned-lg text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange border ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Search Name */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-black uppercase text-slate-400">Search Name</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Santos..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      className={`pl-8 pr-3 py-2 w-full rouned-lg text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange border ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Search School */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-black uppercase text-slate-400">Search School</label>
                  <div className="relative">
                    <Building2 size={13} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Ateneo..."
                      value={searchSchool}
                      onChange={(e) => setSearchSchool(e.target.value)}
                      className={`pl-8 pr-3 py-2 w-full rouned-lg text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange border ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Date range start */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-black uppercase text-slate-400">Date Range Start</label>
                  <div className="relative">
                    <CalendarDays size={13} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="date"
                      value={dateFilterStart}
                      onChange={(e) => setDateFilterStart(e.target.value)}
                      className={`pl-8 pr-3 py-2 w-full rouned-lg text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange border ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Date range end */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-black uppercase text-slate-400">Date Range End</label>
                  <div className="relative">
                    <CalendarDays size={13} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="date"
                      value={dateFilterEnd}
                      onChange={(e) => setDateFilterEnd(e.target.value)}
                      className={`pl-8 pr-3 py-2 w-full rouned-lg text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange border ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                      }`}
                    />
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Sub Filter Bar (Filter by status, search indicator) */}
      <div className="mx-2 lg:mx-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 mt-6">
        
        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {['All', 'Draft', 'Issued', 'Acknowledged', 'Returned', 'Lost', 'Cancelled'].map((filter) => {
            const isActive = statusFilter === filter;
            const count = filter === 'All' 
              ? records.length
              : records.filter(r => r.status === filter).length;
            
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-xs active:scale-95 cursor-pointer ${
                  isActive 
                    ? 'text-white border-brand-orange bg-brand-orange' 
                    : isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-350' 
                      : 'bg-white border-slate-150 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
                style={{ 
                  backgroundColor: isActive ? 'var(--brand-accent)' : undefined,
                  borderColor: isActive ? 'var(--brand-accent)' : undefined,
                }}
              >
                <span>{filter}</span>
                <span className={`px-1 rounded-full text-[8.5px] font-black tracking-normal transition-all ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : isDarkMode 
                      ? 'bg-slate-950 text-slate-500' 
                      : 'bg-slate-100 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Found count indicator */}
        <div className="flex items-center gap-2 justify-end text-right">
          <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase flex items-center gap-1.5 ${
            isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-650'
          }`}>
            <Activity size={12} className="text-brand-orange animate-pulse" />
            <span>Found Rows: <strong className="font-mono text-xs text-brand-orange">{filteredData.length}</strong></span>
          </div>
        </div>

      </div>

      {/* 5. Main Table Container */}
      <div className={`mx-2 lg:mx-4 rounded-xl shadow-sm overflow-hidden border flex flex-col mb-12 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-150'}`}>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">AR No.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">School / Client</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Issued Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Ticket No.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total Items</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-150'}`}>
              {filteredData.map((ar) => {
                const badge = getStatusStyle(ar.status);
                return (
                  <tr 
                    key={ar.id}
                    className={`group transition-all duration-150 border-l-4 border-transparent hover:border-brand-orange ${
                      isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {/* AR No */}
                    <td className="px-6 py-4 font-mono font-bold text-xs tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-brand-orange transition-colors">
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} className="text-brand-orange" />
                        <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800 font-bold'}>
                          {ar.id}
                        </span>
                      </div>
                    </td>

                    {/* Recipient Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-zinc-400 shrink-0" />
                        <span className={`text-sm font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {ar.recipientName}
                        </span>
                      </div>
                    </td>

                    {/* School / Client */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-blue-500 shrink-0" />
                        <span className={`text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[210px]`}>
                          {ar.schoolName}
                        </span>
                      </div>
                    </td>

                    {/* Issued Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={13} className="text-[#0081f1]" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {formatDate(ar.date)}
                        </span>
                      </div>
                    </td>

                    {/* Ticket No */}
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                        {ar.ticketNo || '------'}
                      </span>
                    </td>

                    {/* Total Items */}
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black pr-2 ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                        {ar.totalItems}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full w-fit border shadow-2xs group-hover:scale-105 transition-transform duration-300 ${badge.style}`}>
                          {badge.icon}
                          <span className="text-[8.5px] font-black tracking-widest uppercase">{badge.label}</span>
                        </div>
                      </div>
                    </td>

                    {/* Action buttons list */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedAR(ar)}
                          className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-brand-orange hover:bg-slate-850' 
                              : 'bg-white border-slate-100 text-slate-600 hover:text-brand-orange hover:bg-slate-50'
                          }`}
                          title="View Receipt"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingAR(ar);
                            setIsFormModalOpen(true);
                          }}
                          className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-blue-400 hover:bg-slate-850' 
                              : 'bg-white border-slate-100 text-slate-600 hover:text-blue-500 hover:bg-slate-50'
                          }`}
                          title="Edit Document"
                        >
                          <Notebook size={14} />
                        </button>
                        <button
                          onClick={() => handlePrintAR(ar.id)}
                          className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-purple-400 hover:bg-slate-850' 
                              : 'bg-white border-slate-100 text-slate-600 hover:text-purple-500 hover:bg-slate-50'
                          }`}
                          title="Print Document"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => handleExportPDFSingle(ar)}
                          className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-850' 
                              : 'bg-white border-slate-100 text-slate-600 hover:text-emerald-500 hover:bg-slate-50'
                          }`}
                          title="Export PDF file"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(ar.id)}
                          className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-rose-400 hover:bg-rose-500/10' 
                              : 'bg-white border-slate-100 text-rose-550 hover:bg-rose-50'
                          }`}
                          title="Delete AR Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">
                    No matching acknowledgement records found. Adjust your advanced filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* MODAL 1: VIEW RECEIPT DOCUMENT (High-Fidelity Printable Layout) */}
      <AnimatePresence>
        {selectedAR && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedAR(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[1000] print:hidden"
            />
            
            <div className="fixed inset-0 z-[1001] flex items-center justify-center p-2 sm:p-4 md:p-6 print:relative print:p-0 overflow-y-auto">
              <style>{`
                @media print {
                  aside, nav, header, .print\\:hidden, [class*="sidebar"], [class*="navbar"] {
                    display: none !important;
                  }
                  body {
                    background-color: white !important;
                    color: black !important;
                  }
                }
              `}</style>

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className={`w-full max-w-4xl max-h-[92vh] print:max-h-none shadow-2xl rounded-2xl flex flex-col border font-sans print:w-full print:border-none print:shadow-none print:p-0 print:relative ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
                }`}
              >
                
                {/* Header controls */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 print:hidden text-left">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase text-brand-orange tracking-widest font-mono">
                      PHOENIX PUBLISHING HOUSE ACKNOWLEDGEMENT
                    </span>
                    <div className="flex items-center gap-2">
                      <FileCheck size={18} className="text-brand-orange" />
                      <h3 className="text-lg font-black tracking-tight leading-none text-slate-800 dark:text-white">
                        Receipt Preview Details - {selectedAR.id}
                      </h3>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedAR(null)}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Print Paper Canvas Section */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-slate-100 dark:bg-slate-950 custom-scrollbar print:p-0 print:bg-white space-y-4">
                  <div className="border border-slate-200 dark:border-slate-800 bg-white text-zinc-900 p-6 md:p-8 shadow-md rounded-2xl relative select-none print:shadow-none print:border-none print:p-0 max-w-3xl mx-auto font-sans">
                                        {/* CUSTOM HIGH FIDELITY SPREADSHEET HEADER */}
                    <div className="grid grid-cols-12 border border-zinc-300 divide-x divide-zinc-350 p-0 text-left font-sans bg-white">
                      
                      {/* Left Logo / Company Block (PPH Digital Media Production) */}
                      <div className="col-span-12 sm:col-span-6 p-4 flex items-center gap-3">
                        {/* CSS Mock Logo for PPH */}
                        <div className="w-16 h-16 shrink-0 rounded bg-gradient-to-br from-orange-500 to-amber-600 p-1 flex flex-col justify-between text-white select-none border border-amber-700 shadow-xs">
                          <span className="text-xl font-black tracking-tight leading-none">PPH</span>
                          <span className="text-[5.5px] leading-tight font-extrabold uppercase text-center block mb-0.5">Digital Media Production</span>
                        </div>
                        <div className="flex flex-col justify-center leading-normal">
                          <h1 className="text-xl font-black text-black tracking-tight font-sans">PPH</h1>
                          <p className="text-[9.5px] font-black uppercase text-zinc-800 tracking-wide">DIGITAL MEDIA PRODUCTION, INC.</p>
                          <p className="text-[8px] text-zinc-550">Phoenix Building, 927 Quezon Avenue, Quezon City</p>
                          <p className="text-[8px] text-zinc-550 font-semibold">Tel. No.: 375-1640</p>
                        </div>
                      </div>

                      {/* Right Logo / Department Block (Phoenix Aralinks IT Dept) */}
                      <div className="col-span-12 sm:col-span-6 p-4 flex items-center justify-between gap-2 bg-[#fbfcff]">
                        <div className="flex flex-col justify-center leading-normal text-left">
                          <div className="flex items-center gap-1 mb-0.5">
                            {/* CSS Mock Logo for Phoenix Aralinks */}
                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-450 via-yellow-450 to-orange-500 flex items-center justify-center text-white font-black text-xs shadow-xs">
                              a
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-orange-6000">
                              <span className="text-orange-550">PHOENIX</span>
                              <span className="text-sky-500">ARALINKS</span>
                            </span>
                          </div>
                          <p className="text-[10px] font-black text-zinc-950 uppercase tracking-widest border-t border-zinc-200 pt-0.5">
                            I.T. DEPARTMENT
                          </p>
                          <p className="text-[8.5px] text-zinc-500 font-bold">(02) 374 2873 Loc. 244</p>
                        </div>
                        
                        {/* Floating Excel Sheet Grid Accent */}
                        <div className="hidden sm:flex flex-col text-[7px] text-zinc-350 select-none font-mono text-right justify-end h-full">
                          <span>SHEET 1 OF 1</span>
                          <span>STRICTLY CONFIDENTIAL</span>
                        </div>
                      </div>

                    </div>

                    {/* METADATA GRID BLOCKS (spreadsheet lines style) */}
                    <div className="grid grid-cols-12 border-x border-b border-zinc-300 font-sans text-xs bg-white text-left divide-y sm:divide-y-0 divide-zinc-300">
                      
                      {/* Left metadata fields (NAME, DATE) */}
                      <div className="col-span-12 sm:col-span-7 flex flex-col divide-y divide-zinc-300">
                        <div className="flex items-center px-3 py-2">
                          <span className="w-16 shrink-0 font-black text-zinc-950 uppercase tracking-wider">NAME:</span>
                          <span className="font-extrabold text-zinc-900 flex-grow pl-1 text-sm">
                            {selectedAR.recipientName}
                          </span>
                        </div>
                        <div className="flex items-center px-3 py-2">
                          <span className="w-16 shrink-0 font-black text-zinc-950 uppercase tracking-wider">DATE:</span>
                          <span className="font-mono font-bold text-zinc-800 flex-grow pl-1">
                            {selectedAR.date ? formatDate(selectedAR.date) : '--/--/----'}
                          </span>
                        </div>
                      </div>

                      {/* Right metadata fields (AR NO, NAV, TICKET NO) with highlighted AR NO */}
                      <div className="col-span-12 sm:col-span-5 flex flex-col divide-y divide-zinc-300 sm:border-l border-zinc-300">
                        <div className="flex items-center bg-[#FFFF00] px-3 py-2">
                          <span className="w-24 shrink-0 font-black text-zinc-950 uppercase tracking-wider text-[10.5px]">AR NO. :</span>
                          <span className="font-mono font-black text-zinc-950 tracking-wider flex-grow text-xs pl-1">
                            {selectedAR.id}
                          </span>
                        </div>
                        <div className="flex items-center px-3 py-2">
                          <span className="w-24 shrink-0 font-black text-zinc-950 uppercase tracking-widest text-[9.5px]">NAV:</span>
                          <span className="font-mono font-bold text-zinc-600 flex-grow pl-1 text-[10.5px]">
                            {selectedAR.customerCode || '------'}
                          </span>
                        </div>
                        <div className="flex items-center px-3 py-2">
                          <span className="w-24 shrink-0 font-black text-zinc-950 uppercase tracking-wider text-[9.5px]">TICKET NO. :</span>
                          <span className="font-mono font-bold text-zinc-800 flex-grow pl-1 text-[10.5px]">
                            {selectedAR.ticketNo}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* RED UPPERCASE DOCUMENT TITLE */}
                    <div className="py-4 text-center bg-white border-x border-b border-zinc-300">
                      <h2 className="text-lg font-black tracking-widest text-red-650 uppercase font-sans">
                        ACKNOWLEDGEMENT RECEIPT
                      </h2>
                    </div>

                    {/* CORE ITEMS & DETAILS SPREADSHEET GRID TABLE */}
                    <div className="text-left font-sans text-xs">
                      <table className="w-full border-collapse border-x border-b border-zinc-300 bg-white">
                        <thead>
                          {/* Row 1 Header: Items & Details */}
                          <tr className="bg-zinc-50 border-b border-zinc-300 text-[10px] font-black text-zinc-900 divide-x divide-zinc-300">
                            <th className="px-3 py-1.5 text-left w-[8%]">Items:</th>
                            <th colSpan={4} className="px-3 py-1.5 text-center uppercase tracking-wide">Details</th>
                          </tr>
                          
                          {/* Row 2 Header: Columns */}
                          <tr className="bg-zinc-100 border-b border-zinc-300 text-[9px] font-black uppercase text-zinc-900 divide-x divide-zinc-300">
                            <th className="px-2 py-1.5 text-center w-[8%]">QTY</th>
                            <th className="px-2 py-1.5 text-center w-[8%]">UOM</th>
                            <th className="px-3 py-1.5 text-left w-[36%]">Particular/s | Item Name</th>
                            <th className="px-3 py-1.5 text-left w-[28%]">Specifications | Serials</th>
                            <th className="px-3 py-1.5 text-left w-[20%]">Remarks | Purpose</th>
                          </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y divide-zinc-300 font-sans">
                          {selectedAR.items.map((it, i) => (
                            <tr key={it.id || i} className="divide-x divide-zinc-300 text-zinc-950">
                              {/* QTY */}
                              <td className="px-2 py-2 text-center font-black font-mono">
                                {it.qty}
                              </td>
                              {/* UOM */}
                              <td className="px-2 py-2 text-center font-bold text-zinc-500 uppercase">
                                {it.category === 'Tablets' ? 'UNIT' : 'PC'}
                              </td>
                              {/* Item Name */}
                              <td className="px-3 py-2 font-extrabold text-zinc-900">
                                {it.name}
                              </td>
                              {/* Specs / Serials */}
                              <td className="px-3 py-2 font-mono text-[10px] text-zinc-650">
                                {it.serialNumber && it.serialNumber !== '------' ? it.serialNumber : 'S/N: PENDING ASSIGNMENT'}
                              </td>
                              {/* Remarks / Purpose */}
                              <td className="px-3 py-2 text-zinc-550 text-[10px] truncate max-w-[150px]" title={it.remarks || selectedAR.remarks}>
                                {it.remarks && it.remarks !== '------' ? it.remarks : selectedAR.remarks || 'Standard IT Asset Issued'}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Dynamic empty/filler spreadsheet rows matching the screenshot layout */}
                          {Array.from({ length: Math.max(2, 6 - selectedAR.items.length) }).map((_, i) => (
                            <tr key={`excel-filler-${i}`} className="h-[28px] divide-x divide-zinc-300">
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* COMPLIANCE DISCLAIMER BOX */}
                    <div className="p-3 border-x border-b border-zinc-300 bg-zinc-50/50 text-left text-[11px] font-sans font-medium text-zinc-900 select-none">
                      By signing, I hereby certify that I received the following items listed above.
                    </div>

                    {/* SIGNATORIES BLOCK GROUP */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 border-x border-b border-zinc-300 bg-white font-sans text-xs">
                      
                      {/* Prepared by block */}
                      <div className="p-4 flex flex-col justify-between h-[110px] text-left border-b sm:border-b-0 sm:border-r border-zinc-300">
                        <span className="font-extrabold text-zinc-600 block mb-1">Prepared by:</span>
                        <div className="space-y-0.5">
                          <span className="font-black text-zinc-950 uppercase tracking-wide block border-b border-zinc-400 pb-0.5 text-center leading-none pl-1 mx-2">
                            {selectedAR.initiatedBy || 'Authorized IT Officer'}
                          </span>
                          <span className="text-[8px] text-zinc-500 font-bold block text-center uppercase tracking-wide">
                            (Signature over Printed Name / Date)
                          </span>
                        </div>
                      </div>

                      {/* Endorsed by block */}
                      <div className="p-4 flex flex-col justify-between h-[110px] text-left border-b sm:border-b-0 sm:border-r border-zinc-300">
                        <span className="font-extrabold text-zinc-600 block mb-1">Endorsed by:</span>
                        <div className="space-y-0.5">
                          <span className="font-black text-zinc-950 uppercase tracking-wide block border-b border-zinc-400 pb-0.5 text-center leading-none pl-1 mx-2">
                            JOHN ROBERT PAGALA
                          </span>
                          <span className="text-[8px] text-zinc-500 font-bold block text-center uppercase tracking-wide">
                            (Signature over Printed Name / Date)
                          </span>
                        </div>
                      </div>

                      {/* Received by block */}
                      <div className="p-4 flex flex-col justify-between h-[110px] text-left">
                        <span className="font-extrabold text-zinc-600 block mb-1">Received by:</span>
                        <div className="space-y-0.5">
                          <span className="font-black text-brand-orange uppercase tracking-wide block border-b border-zinc-400 pb-0.5 text-center leading-none pl-1 mx-2">
                            {selectedAR.recipientName}
                          </span>
                          <span className="text-[8px] text-zinc-500 font-bold block text-center uppercase tracking-wide">
                            (Signature over Printed Name / Date)
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* SPREADSHEET FOOTER ROW */}
                    <div className="flex items-center justify-between font-sans text-[8px] font-bold text-zinc-400 bg-white pt-2.5">
                      <span>* Please fill up remarks field if necessary</span>
                      <span className="font-mono">ver. 2.0-8.18.2022</span>
                    </div>

                  </div>
                </div>

                {/* Drawer Footer Actions split */}
                <div className={`p-4 border-t flex items-center justify-between gap-3 shrink-0 print:hidden ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-150'
                }`}>
                  <button
                    onClick={() => setSelectedAR(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Close Preview
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrintAR(selectedAR.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0081f1] hover:bg-blue-600 text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Printer size={14} />
                      Print Document
                    </button>
                    <button
                      onClick={() => handleExportPDFSingle(selectedAR)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download size={14} />
                      Download PDF
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>


      {/* MODAL 2: CREATE & EDIT FORM MODAL (Premium Full Controls) */}
      <AnimatePresence>
        {isFormModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1000]"
            />

            <div className="fixed inset-0 z-[1001] flex items-center justify-center p-2 sm:p-4 text-left overflow-y-auto">
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                className={`w-full max-w-2xl max-h-[92vh] shadow-2xl rounded-2xl border flex flex-col font-sans overflow-hidden ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                
                {/* Form Title banner */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Notebook size={18} className="text-brand-orange" />
                    <h3 className="text-base font-black uppercase tracking-wider text-slate-850 dark:text-white">
                      {editingAR ? `Edit Acknowledgement: ${editingAR.id}` : 'Create New Acknowledgement Receipt'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setIsFormModalOpen(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveARForm} className="flex-grow flex flex-col min-h-0">
                  
                  {/* Scrollable form controls */}
                  <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar text-xs">
                    
                    {/* Two-Column Primary Row */}
                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* Document AR No. */}
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400">Acknowledgement No. (AR No.)</label>
                        <input
                          type="text"
                          required
                          value={formARNo}
                          onChange={(e) => setFormARNo(e.target.value)}
                          className={`px-3 py-2 rounded-lg border font-mono font-bold text-xs ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-205 text-slate-805'
                          }`}
                        />
                      </div>

                      {/* Date */}
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400">Date Issued</label>
                        <input
                          type="date"
                          required
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className={`px-3 py-2 rounded-lg border font-bold text-xs ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-205 text-slate-805'
                          }`}
                        />
                      </div>

                    </div>

                    {/* Recipient Full Name */}
                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-[10px] font-black uppercase text-slate-400">Recipient Employee / Client Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Maria Santos"
                        required
                        value={formRecipientName}
                        onChange={(e) => setFormRecipientName(e.target.value)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-650' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                        }`}
                      />
                    </div>

                    {/* School / Institution Institution */}
                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-[10px] font-black uppercase text-slate-400">Associated School / Client Institution *</label>
                      <input
                        type="text"
                        placeholder="e.g. Ateneo de Manila University"
                        required
                        value={formSchoolName}
                        onChange={(e) => setFormSchoolName(e.target.value)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-650' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Ticket No */}
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400">Ticket Reference Number</label>
                        <input
                          type="text"
                          placeholder="e.g. TK-20260601-41"
                          value={formTicketNo}
                          onChange={(e) => setFormTicketNo(e.target.value)}
                          className={`px-3 py-2 rounded-lg border text-xs font-mono font-bold ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>

                      {/* Status */}
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400">Document Status</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as any)}
                          className={`px-3 py-2 rounded-lg border text-xs font-bold ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Issued">Issued</option>
                          <option value="Acknowledged">Acknowledged</option>
                          <option value="Returned">Returned</option>
                          <option value="Lost">Lost</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {/* Metadata breakdown expandable */}
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
                      <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider block mb-1">Standard Document Specifications</span>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-slate-400">Client Code</label>
                          <input
                            type="text"
                            placeholder="C-ADE-082"
                            value={formCustomerCode}
                            onChange={(e) => setFormCustomerCode(e.target.value)}
                            className={`px-2.5 py-1.5 rounded border text-xs font-mono ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-slate-400">Contact Telephone</label>
                          <input
                            type="text"
                            placeholder="+63 917..."
                            value={formContactNo}
                            onChange={(e) => setFormContactNo(e.target.value)}
                            className={`px-2.5 py-1.5 rounded border text-xs ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-slate-400">Institution Location Address</label>
                          <input
                            type="text"
                            placeholder="Quezon City"
                            value={formAddress}
                            onChange={(e) => setFormAddress(e.target.value)}
                            className={`px-2.5 py-1.5 rounded border text-xs ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-slate-400">Account agent representative</label>
                          <input
                            type="text"
                            placeholder="Team Phoenix Alpha"
                            value={formAgent}
                            onChange={(e) => setFormAgent(e.target.value)}
                            className={`px-2.5 py-1.5 rounded border text-xs ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-205 text-slate-800'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* ITEMS ROW BUILDER MODULE */}
                    <div className="border border-slate-150 dark:border-slate-800 rounded-xl p-4 space-y-3 text-left">
                      <div className="border-b pb-2 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-orange flex items-center gap-1.5">
                          <Plus size={11} />
                          Issued Equipment Items List
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-400">
                          Active Row Count: {formItems.length}
                        </span>
                      </div>

                      {/* Item Addition form rows fields */}
                      <div className="grid grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border dark:border-slate-800 items-end">
                        <div className="col-span-12 sm:col-span-5 flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Item Name / Description</label>
                          <input
                            type="text"
                            placeholder="e.g. Aralinks Tablet Book Lite"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className={`px-2.5 py-1.5 rounded text-xs border ${
                              isDarkMode ? 'bg-slate-900 border-slate-805 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={newItemQty}
                            onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className={`px-2.5 py-1.5 rounded text-xs border font-mono font-bold ${
                              isDarkMode ? 'bg-slate-900 border-slate-805 text-white' : 'bg-white border-slate-200 text-slate-805'
                            }`}
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-2 flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Category</label>
                          <select
                            value={newItemCategory}
                            onChange={(e) => setNewItemCategory(e.target.value)}
                            className={`px-2 py-1.5 rounded text-xs border ${
                              isDarkMode ? 'bg-slate-900 border-slate-805 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <option value="Tablets">Tablets</option>
                            <option value="Displays">Displays</option>
                            <option value="Networking">Networking</option>
                            <option value="Laptops">Laptops</option>
                            <option value="VR Gear">VR Gear</option>
                            <option value="Accessories">Accessories</option>
                          </select>
                        </div>
                        <div className="col-span-12 sm:col-span-3 flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Serial No.</label>
                          <input
                            type="text"
                            placeholder="SN/Barcode"
                            value={newItemSerial}
                            onChange={(e) => setNewItemSerial(e.target.value)}
                            className={`px-2.5 py-1.5 rounded text-xs border font-mono ${
                              isDarkMode ? 'bg-slate-900 border-slate-805 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="col-span-12 items-stretch flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                          <button
                            type="button"
                            onClick={handleAddItemRow}
                            className="px-3.5 py-1.5 rounded bg-brand-orange text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow"
                          >
                            <Plus size={11} strokeWidth={2.5} />
                            Add Row
                          </button>
                        </div>
                      </div>

                      {/* Render listed items under the document with small table list */}
                      {formItems.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                          {formItems.map((item, index) => (
                            <div key={item.id} className="p-3 bg-white dark:bg-slate-950/20 flex items-center justify-between gap-4">
                              <div className="text-left">
                                <p className="font-extrabold text-slate-800 dark:text-slate-200">{item.name}</p>
                                <span className="text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                                  Category: <strong>{item.category}</strong> | Serial: <strong className="text-zinc-650">{item.serialNumber}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                                  {item.qty} pcs
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(item.id)}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                                  title="Delete Row Item"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 border-2 border-dashed border-slate-150 dark:border-slate-800 rounded-lg text-center text-slate-400 dark:text-slate-500 font-medium italic">
                          No issued rows. Add equipment or devices from builder fields above.
                        </div>
                      )}
                    </div>

                    {/* Remarks and details */}
                    <div className="flex flex-col gap-1 text-left">
                      <label className="text-[10px] font-black uppercase text-slate-400">Acknowledegment Remarks / Purpose / Terms Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Detail the purpose of asset issuances, deployment conditions..."
                        value={formRemarks}
                        onChange={(e) => setFormRemarks(e.target.value)}
                        className={`px-3 py-2 rounded-lg border text-xs ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-650' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                        }`}
                      />
                    </div>

                  </div>

                  {/* Form bottom actions sheet */}
                  <div className={`p-4 border-t flex items-center justify-end gap-2.5 shrink-0 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-150'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setIsFormModalOpen(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isDarkMode ? 'bg-slate-800 text-slate-350 hover:bg-slate-700 hover:text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md transition-all active:scale-95 bg-brand-orange hover:opacity-90 flex items-center gap-1.5"
                    >
                      <Check size={14} strokeWidth={3} />
                      {editingAR ? 'Save Receipt Changes' : 'Confirm & Save Receipt'}
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>


      {/* MODAL 3: DELETE CONFIRMATION DIALOG (Sleek Toast Pop) */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2000]"
            />
            <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                className={`p-6 rounded-2xl border shadow-2xl max-w-sm w-full text-left font-sans ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-450 border-b pb-3 mb-4 dark:border-slate-800">
                  <AlertTriangle size={20} className="animate-bounce" />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Confirm Permanent Deletion
                  </h3>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  You are about to delete Acknowledgement Receipt <span className="font-bold font-mono text-rose-500">{showDeleteConfirm}</span>. This operational action is irreversible. All associated equipment tags will be decoupled. 
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t dark:border-slate-800 mt-4">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteRecord}
                    className="px-4 py-1.5 rounded-xl text-xs font-black uppercase text-white bg-rose-600 hover:bg-rose-700 shadow flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    Confirm Delete
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AcknowledgementReceiptManagement;
