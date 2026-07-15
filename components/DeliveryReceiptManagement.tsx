import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncSchoolMonitoringWithDRs } from './monitoringSync';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getBundleColor } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  FileCheck, 
  Building2, 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  X, 
  Filter, 
  Eye, 
  Trash2, 
  Box, 
  Printer, 
  FileDown, 
  Edit3, 
  User, 
  FileText,
  Activity,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Tag,
  CircleDot,
  ChevronDown,
  Truck,
  Calendar,
  History,
  PenTool,
  CheckSquare,
  XCircle
} from 'lucide-react';
import PageHeader from './PageHeader';
import { useNotification } from './NotificationProvider';

export interface DeliveryReceiptItem {
  id: string;
  item_code: string;
  description: string;
  qty: number;
  uom: string;
  serialNumber?: string;
  category?: string;
  remarks?: string;
  deliveryStatus?: 'Delivered' | 'Cancelled' | 'Pending';
}

export interface DeliveryReceipt {
  id: string; // DR No.
  schoolName: string;
  schoolMonitoringId?: string;
  school_monitoring_id?: string;
  clientCode: string;
  agent: string;
  project: string;
  date: string;
  status: 'Ready for delivery' | 'In Transit' | 'Delivered' | 'Partially Delivered';
  inTransitDate?: string;
  deliveredDate?: string;
  totalItems: number;
  issuedBy: string;
  deliveredBy: string;
  receivedBy?: string;
  items: DeliveryReceiptItem[];
  hardwareItems?: any[];
  remarks?: string;
  deliveryHistory?: {
    id: string;
    item_code: string;
    description: string;
    qty: number;
    uom: string;
    serialNumber?: string;
    deliveryStatus: 'Delivered' | 'Cancelled';
    date: string;
  }[];
}

const INITIAL_DR_DATA: DeliveryReceipt[] = [
  {
    id: 'DR-20260601-5501',
    schoolName: 'Ateneo de Manila University',
    clientCode: 'CL-ADMU-541',
    agent: 'John Doe',
    project: 'ACE',
    date: '2026-06-01',
    status: 'Delivered',
    inTransitDate: '2026-06-01',
    deliveredDate: '2026-06-02',
    totalItems: 35,
    issuedBy: 'Sarah Connor',
    deliveredBy: 'LBC Logistics',
    receivedBy: 'Prof. Amalia Reyes',
    remarks: 'Installation of interactive whiteboards in Science block.',
    items: [
      { id: 'item-1', item_code: 'EQ-TAB-A10', description: 'Aralinks Tablet Book Lite', qty: 30, uom: 'PCS', serialNumber: 'SN-TB-489201', category: 'Tablets', remarks: 'With heavy-duty bumper cases' },
      { id: 'item-2', item_code: 'EQ-SIB-H75', description: 'Aralinks Smart Interactive Board 75"', qty: 5, uom: 'PCS', serialNumber: 'SN-SIB-882193', category: 'Displays', remarks: 'Wall mount included' }
    ]
  },
  {
    id: 'DR-20260528-9844',
    schoolName: 'De La Salle University',
    clientCode: 'CL-DLSU-202',
    agent: 'Jane Smith',
    project: 'HUB',
    date: '2026-05-28',
    status: 'Delivered',
    inTransitDate: '2026-05-28',
    deliveredDate: '2026-05-29',
    totalItems: 12,
    issuedBy: 'Sarah Connor',
    deliveredBy: 'Phoenix Fleet Truck A',
    receivedBy: 'Engr. Manuel Garcia',
    remarks: 'High performance student laptops for virtual simulation tests.',
    items: [
      { id: 'item-3', item_code: 'EQ-LAP-P15', description: 'Aralinks Laptop Pro V3', qty: 10, uom: 'PCS', serialNumber: 'SN-LP-910245', category: 'Laptops', remarks: 'Core i7, 16GB RAM' },
      { id: 'item-4', item_code: 'EQ-NET-R54', description: 'Aralinks Access Point V2', qty: 2, uom: 'PCS', serialNumber: 'SN-AP-311200', category: 'Networking', remarks: 'PoE adapters included' }
    ]
  },
  {
    id: 'DR-20260524-1189',
    schoolName: 'University of Santo Tomas',
    clientCode: 'CL-UST-009',
    agent: 'Robert Johnson',
    project: 'NGS',
    date: '2026-05-24',
    status: 'Delivered',
    inTransitDate: '2026-05-24',
    deliveredDate: '2026-05-25',
    totalItems: 80,
    issuedBy: 'Sarah Connor',
    deliveredBy: 'Phoenix Fleet Truck B',
    receivedBy: 'Rev. Fr. Julius Torres',
    remarks: 'Primary grade classroom device setup.',
    items: [
      { id: 'item-5', item_code: 'EQ-TAB-A10', description: 'Aralinks Tablet Book Lite', qty: 75, uom: 'PCS', serialNumber: 'SN-TB-774021', category: 'Tablets' },
      { id: 'item-6', item_code: 'EQ-SIB-H75', description: 'Aralinks Smart Interactive Board 75"', qty: 5, uom: 'PCS', serialNumber: 'SN-SIB-229410', category: 'Displays' }
    ]
  },
  {
    id: 'DR-20260520-2210',
    schoolName: 'Far Eastern University',
    clientCode: 'CL-FEU-392',
    agent: 'John Doe',
    project: 'TEACH',
    date: '2026-05-20',
    status: 'In Transit',
    inTransitDate: '2026-05-20',
    totalItems: 15,
    issuedBy: 'Sarah Connor',
    deliveredBy: 'LBC Logistics',
    remarks: 'Units picked up from depot and dispatched.',
    items: [
      { id: 'item-7', item_code: 'EQ-VR-G02', description: 'Aralinks VR Headset G2', qty: 15, uom: 'PCS', serialNumber: 'SN-VR-504932', category: 'VR Gear', remarks: 'With controllers and travel bags' }
    ]
  },
  {
    id: 'DR-20260515-4421',
    schoolName: 'Mapua University',
    clientCode: 'CL-MU-855',
    agent: 'Michael Garibaldi',
    project: 'OTHER',
    date: '2026-05-15',
    status: 'Ready for delivery',
    totalItems: 4,
    issuedBy: 'Sarah Connor',
    deliveredBy: 'Pending dispatch',
    remarks: 'Awaiting client technical confirmation for smart board accessory units.',
    items: [
      { id: 'item-8', item_code: 'EQ-SIB-H75', description: 'Aralinks Smart Interactive Board 75"', qty: 4, uom: 'PCS', serialNumber: 'SN-SIB-334912', category: 'Displays', remarks: 'With extra replacement styling pens' }
    ]
  },
  {
    id: 'DR-20260510-7712',
    schoolName: 'San Beda University',
    clientCode: 'CL-SBU-443',
    agent: 'Jane Smith',
    project: 'ACE',
    date: '2026-05-10',
    status: 'Ready for delivery',
    totalItems: 20,
    issuedBy: 'Sarah Connor',
    deliveredBy: 'N/A',
    remarks: 'Wrong customer specifications, request terminated.',
    items: [
      { id: 'item-9', item_code: 'EQ-TAB-A10', description: 'Aralinks Tablet Book Lite', qty: 20, uom: 'PCS', serialNumber: 'SN-TB-011293', category: 'Tablets' }
    ]
  }
];

interface DeliveryReceiptManagementProps {
  isDarkMode?: boolean;
}

const DeliveryReceiptManagement: React.FC<DeliveryReceiptManagementProps> = ({ isDarkMode = false }) => {
  const navigate = useNavigate();
  const { showInfo, showSuccess, showWarning } = useNotification();

  // Search & Filter state
  const [searchDR, setSearchDR] = useState('');
  const [searchSchool, setSearchSchool] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected DR for detail slideover
  const [selectedDR, setSelectedDR] = useState<DeliveryReceipt | null>(null);

  // Equipment list for checking serialization status of items
  const [equipmentList, setEquipmentList] = useState<any[]>([]);

  // Delete Delivery Receipt Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Selected DR for history modal
  const [historyDR, setHistoryDR] = useState<DeliveryReceipt | null>(null);

  // Selected DR for target delivery date modal
  const [selectedDRForTargetDate, setSelectedDRForTargetDate] = useState<DeliveryReceipt | null>(null);
  const [targetDateInput, setTargetDateInput] = useState('');

  // Status with Date capture state
  const [statusDatePrompt, setStatusDatePrompt] = useState<{
    drId: string;
    newStatus: 'In Transit' | 'Delivered';
    dateVal: string;
  } | null>(null);

  // Item-level confirmation when status changes to Delivered/Partially Delivered
  const [itemValidationPrompt, setItemValidationPrompt] = useState<{
    drId: string;
    dateVal: string;
    items: {
      id: string;
      item_code: string;
      description: string;
      qty: number;
      uom: string;
      serialNumber?: string;
      deliveryStatus: 'Delivered' | 'Cancelled' | 'Pending';
      selectedQty?: number;
    }[];
    deliveryHistory: {
      id: string;
      item_code: string;
      description: string;
      qty: number;
      uom: string;
      serialNumber?: string;
      deliveryStatus: 'Delivered' | 'Cancelled';
      date: string;
    }[];
  } | null>(null);

  // Delivery receipts records state
  const [receipts, setReceipts] = useState<DeliveryReceipt[]>(() => {
    const saved = localStorage.getItem('aralinks_delivery_receipts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsed storage receipts', e);
      }
    }
    localStorage.setItem('aralinks_delivery_receipts', JSON.stringify(INITIAL_DR_DATA));
    return INITIAL_DR_DATA;
  });

  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);

  // Fetch receipts from Supabase on mount
  useEffect(() => {
    const fetchDRs = async () => {
      if (!isSupabaseConfigured) return;
      setIsLoadingReceipts(true);
      try {
        const { data, error } = await supabase
          .from('delivery_receipts')
          .select('*');

        if (!error && data) {
          const loaded: DeliveryReceipt[] = data.map((row: any) => ({
            id: row.id,
            schoolName: row.school_name,
            schoolMonitoringId: row.school_monitoring_id,
            school_monitoring_id: row.school_monitoring_id,
            clientCode: row.client_code,
            agent: row.agent,
            project: row.project,
            date: row.date,
            status: row.status === 'In transit' ? 'In Transit' : row.status,
            inTransitDate: row.in_transit_date,
            deliveredDate: row.delivered_date,
            targetDeliveryDate: row.target_delivery_date,
            totalItems: row.total_items,
            issuedBy: row.issued_by,
            deliveredBy: row.delivered_by,
            receivedBy: row.received_by,
            remarks: row.remarks,
            items: typeof row.hardware_items === 'string' ? JSON.parse(row.hardware_items) : (row.hardware_items || []),
            hardwareItems: typeof row.hardware_items === 'string' ? JSON.parse(row.hardware_items) : (row.hardware_items || []),
            serviceItems: typeof row.service_items === 'string' ? JSON.parse(row.service_items) : (row.service_items || []),
            signatoryPrepared: typeof row.signatory_prepared === 'string' ? JSON.parse(row.signatory_prepared) : row.signatory_prepared,
            signatoryApproved: typeof row.signatory_approved === 'string' ? JSON.parse(row.signatory_approved) : row.signatory_approved,
            signatoryDelivered: typeof row.signatory_delivered === 'string' ? JSON.parse(row.signatory_delivered) : row.signatory_delivered,
            signatoryCheckedReceived: typeof row.signatory_checked_received === 'string' ? JSON.parse(row.signatory_checked_received) : row.signatory_checked_received,
            address: row.address,
            contactPerson: row.contact_person,
            contactNo: row.contact_no,
            moa: row.moa,
            deliveryHistory: typeof row.delivery_history === 'string' ? JSON.parse(row.delivery_history) : (row.delivery_history || [])
          }));
          setReceipts(loaded);
          localStorage.setItem('aralinks_delivery_receipts', JSON.stringify(loaded));
        }

        // Fetch equipment for serialization status checks
        const { data: equipData, error: equipError } = await supabase
          .from('equipment')
          .select('item_code, description, is_serialized, uom, status')
          .is('archived_at', null);

        if (!equipError && equipData) {
          const activeItems = equipData.filter((item: any) => item.status === 'ACTIVE');
          setEquipmentList(activeItems);
        }
      } catch (err) {
        console.warn('Failed to load delivery receipts from Supabase:', err);
      } finally {
        setIsLoadingReceipts(false);
      }
    };

    fetchDRs();
  }, []);

  // Unique Agent list for filter dropdown
  const uniqueAgents = useMemo(() => {
    const agents = receipts.map(r => r.agent);
    return Array.from(new Set(agents)).filter(Boolean);
  }, [receipts]);

  // Helper to determine if an item is serialized
  const isSerializedItem = (itemCode?: string, description?: string) => {
    if (!itemCode && !description) return false;
    
    const cleanCode = itemCode ? itemCode.trim().toUpperCase() : '';
    const cleanDesc = description ? description.trim().toLowerCase() : '';

    // Try finding in equipmentList by item_code
    let equip = cleanCode 
      ? equipmentList.find(e => (e.item_code || '').trim().toUpperCase() === cleanCode)
      : null;

    // Try finding in equipmentList by description as a fallback
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

  // Handle Create DR Route Trigger
  const handleCreateDR = () => {
    navigate('/delivery-receipt/create');
  };

  // Edit Receipt Route Trigger
  const handleEditDR = (drId: string) => {
    navigate(`/delivery-receipt/edit/${drId}`);
  };

  // Delete Delivery Receipt trigger (setting confirmation state)
  const handleDeleteDR = (drId: string) => {
    setShowDeleteConfirm(drId);
  };

  // Actual permanent deletion execution
  const confirmDeleteDR = async () => {
    if (!showDeleteConfirm) return;
    const drId = showDeleteConfirm;
    const updated = receipts.filter(r => r.id !== drId);
    setReceipts(updated);
    localStorage.setItem('aralinks_delivery_receipts', JSON.stringify(updated));

    if (isSupabaseConfigured) {
      try {
        // Fetch all delivery transactions for this delivery receipt to revert stock
        const { data: transactions, error: txFetchError } = await supabase
          .from('stock_transactions')
          .select('*')
          .eq('reference_id', drId)
          .eq('transaction_type', 'Delivery');

        if (txFetchError) throw txFetchError;

        if (transactions && transactions.length > 0) {
          for (const tx of transactions) {
            // Find the stock record at from_location to add back the deducted quantity
            const { data: stock, error: stockFetchError } = await supabase
              .from('item_location_stocks')
              .select('id, quantity, brand_new_qty')
              .eq('item_code', tx.item_code)
              .eq('location', tx.from_location)
              .maybeSingle();

            if (stockFetchError) throw stockFetchError;

            if (stock) {
              const newQty = Number(stock.quantity || 0) + Number(tx.quantity || 0);
              const newBrandNewQty = Number(stock.brand_new_qty || 0) + Number(tx.quantity || 0);
              
              const { error: stockUpdateError } = await supabase
                .from('item_location_stocks')
                .update({ 
                  quantity: newQty,
                  brand_new_qty: newBrandNewQty
                })
                .eq('id', stock.id);

              if (stockUpdateError) throw stockUpdateError;
            } else {
              // If for some reason the stock record was deleted, create it
              const { error: stockInsertError } = await supabase
                .from('item_location_stocks')
                .insert([{
                  item_code: tx.item_code,
                  location: tx.from_location,
                  quantity: tx.quantity,
                  brand_new_qty: tx.quantity
                }]);

              if (stockInsertError) throw stockInsertError;
            }
          }

          // Delete the stock transaction records associated with this DR
          const { error: txDeleteError } = await supabase
            .from('stock_transactions')
            .delete()
            .eq('reference_id', drId)
            .eq('transaction_type', 'Delivery');

          if (txDeleteError) throw txDeleteError;
        }

        // Also delete any other transaction history associated with this DR to be thorough
        await supabase
          .from('stock_transactions')
          .delete()
          .eq('reference_id', drId);

        // Now delete the delivery receipt from Supabase
        await supabase
          .from('delivery_receipts')
          .delete()
          .eq('id', drId);
      } catch (err) {
        console.warn('Failed to revert stock and delete delivery receipt from Supabase:', err);
      }
    }

    await syncSchoolMonitoringWithDRs();
    showSuccess('Receipt Deleted', `Delivery acceptance record ${drId} removed.`);
    if (selectedDR?.id === drId) {
      setSelectedDR(null);
    }
    setShowDeleteConfirm(null);
  };

  // Change Delivery Receipt status
  const handleChangeStatus = async (drId: string, newStatus: DeliveryReceipt['status']) => {
    const receiptObj = receipts.find(r => r.id === drId);
    if (!receiptObj) return;

    const currentStatusLower = (receiptObj.status || '').toLowerCase();
    const newStatusLower = (newStatus || '').toLowerCase();

    // If newStatus is the same as current status, do nothing (unless it is 'In Transit' and we want to allow changing/updating the date)
    if (newStatusLower === currentStatusLower && newStatusLower !== 'in transit') return;

    // State Transition Constraints:
    // 1. Delivered = no action
    if (currentStatusLower === 'delivered') {
      showWarning('Action Restricted', 'Delivered records are locked and cannot be changed.');
      return;
    }

    // 2. Ready for Delivery => In Transit only
    if (currentStatusLower === 'ready for delivery' && newStatusLower !== 'in transit') {
      showWarning('Action Restricted', 'Ready for Delivery status can only transition to In Transit.');
      return;
    }

    // 3. In Transit/Partially Delivered => Delivered only (or updating In Transit date)
    if ((currentStatusLower === 'in transit' || currentStatusLower === 'partially delivered') && 
        newStatusLower !== 'delivered' && 
        newStatusLower !== 'partially delivered' && 
        newStatusLower !== 'in transit') {
      showWarning('Action Restricted', 'In Transit status can only transition to Delivered.');
      return;
    }

    if (newStatusLower === 'ready for delivery') {
      if (currentStatusLower === 'in transit' || currentStatusLower === 'delivered' || currentStatusLower === 'partially delivered') {
        showWarning('Action Restricted', `Cannot change status back to Ready for delivery once it has been marked as ${receiptObj.status}.`);
        return;
      }
      const updated = receipts.map(r => r.id === drId ? { ...r, status: newStatus, inTransitDate: undefined, deliveredDate: undefined } : r);
      setReceipts(updated);
      localStorage.setItem('aralinks_delivery_receipts', JSON.stringify(updated));

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('delivery_receipts')
            .update({
              status: newStatus === 'In Transit' ? 'In transit' : newStatus,
              in_transit_date: null,
              delivered_date: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', drId);
          if (error) console.warn('Supabase status update failed:', error);
        } catch (err) {
          console.warn('Error during Supabase status update:', err);
        }
      }

      await syncSchoolMonitoringWithDRs(updated);
      showSuccess('Status Updated', `Delivery receipt ${drId} status changed to ${newStatus}.`);
      if (selectedDR?.id === drId) {
        setSelectedDR(prev => prev ? { ...prev, status: newStatus, inTransitDate: undefined, deliveredDate: undefined } : null);
      }
    } else if (newStatusLower === 'in transit') {
      // In transit moves forward with the simple date prompt
      setStatusDatePrompt({
        drId,
        newStatus,
        dateVal: receiptObj.inTransitDate || new Date().toISOString().substring(0, 10)
      });
    } else {
      // Delivered or Partially Delivered: open full item-level validation modal
      const existingHistory = (receiptObj as any).deliveryHistory || [];
      setItemValidationPrompt({
        drId,
        dateVal: '',
        items: (receiptObj.hardwareItems || receiptObj.items || []).map(item => {
          const itemHistory = existingHistory.filter((h: any) => 
            h.itemId === item.id || 
            (item.item_code && h.item_code === item.item_code)
          );
          const processedQty = itemHistory.reduce((sum: number, h: any) => sum + h.qty, 0);
          const remainingQty = Math.max(0, item.qty - processedQty);
          return {
            id: item.id || `item-${Math.random()}`,
            item_code: item.item_code || '',
            description: item.description,
            qty: item.qty,
            uom: item.uom || (item as any).unit || 'pcs',
            serialNumber: item.serialNumber,
            deliveryStatus: item.deliveryStatus || 'Pending',
            selectedQty: remainingQty // make a default based on request
          };
        }),
        deliveryHistory: existingHistory
      });
    }
  };

  const handleConfirmItemValidation = async () => {
    if (!itemValidationPrompt) return;
    const { drId, dateVal, deliveryHistory } = itemValidationPrompt;

    if (!dateVal) {
      showWarning('Delivery Date Required', 'Please select a valid overall delivery date first.');
      return;
    }

    if (deliveryHistory.length === 0) {
      showWarning('Selection Required', 'Please process at least one item as Delivered or Cancelled before confirming.');
      return;
    }

    const updated = receipts.map(r => {
      if (r.id === drId) {
        const sourceItems = r.hardwareItems || r.items || [];

        const updatedItems = sourceItems.map(origItem => {
          const itemHistory = deliveryHistory.filter(h => 
            h.itemId === origItem.id || 
            (origItem.item_code && h.item_code === origItem.item_code)
          );
          const deliveredQty = itemHistory.filter(h => h.deliveryStatus === 'Delivered').reduce((sum, h) => sum + h.qty, 0);
          const cancelledQty = itemHistory.filter(h => h.deliveryStatus === 'Cancelled').reduce((sum, h) => sum + h.qty, 0);
          const processedQty = deliveredQty + cancelledQty;

          let itemStatus: 'Pending' | 'Delivered' | 'Cancelled' = 'Pending';
          if (processedQty >= origItem.qty) {
            if (cancelledQty >= origItem.qty) {
              itemStatus = 'Cancelled';
            } else {
              itemStatus = 'Delivered';
            }
          }

          return {
            ...origItem,
            deliveryStatus: itemStatus
          };
        });

        const hasAnyPending = updatedItems.some(item => item.deliveryStatus === 'Pending' || !item.deliveryStatus);
        const determinedStatus: DeliveryReceipt['status'] = hasAnyPending ? 'Partially Delivered' : 'Delivered';

        return {
          ...r,
          status: determinedStatus,
          deliveredDate: dateVal,
          inTransitDate: r.inTransitDate || r.date,
          items: updatedItems,
          hardwareItems: r.hardwareItems ? updatedItems : undefined,
          deliveryHistory: deliveryHistory
        };
      }
      return r;
    });

    setReceipts(updated);
    localStorage.setItem('aralinks_delivery_receipts', JSON.stringify(updated));

    const targetDR = updated.find(r => r.id === drId);
    if (isSupabaseConfigured && targetDR) {
      try {
        const { error } = await supabase
          .from('delivery_receipts')
          .update({
            status: targetDR.status === 'In Transit' ? 'In transit' : targetDR.status,
            delivered_date: dateVal,
            in_transit_date: targetDR.inTransitDate || targetDR.date,
            hardware_items: targetDR.hardwareItems || targetDR.items,
            delivery_history: deliveryHistory,
            updated_at: new Date().toISOString()
          })
          .eq('id', drId);
        if (error) console.warn('Failed to update delivery receipt item validation in Supabase:', error);
      } catch (err) {
        console.warn('Error during Supabase item validation update:', err);
      }
    }

    await syncSchoolMonitoringWithDRs(updated);

    const currentDR = updated.find(r => r.id === drId);
    const determinedStatus = currentDR ? currentDR.status : 'Delivered';
    showSuccess('Delivery Processed', `Delivery receipt ${drId} status processed as ${determinedStatus}.`);

    if (selectedDR?.id === drId) {
      setSelectedDR(prev => {
        if (!prev) return null;
        const sourceItems = prev.hardwareItems || prev.items || [];

        const updatedItems = sourceItems.map(origItem => {
          const itemHistory = deliveryHistory.filter(h => 
            h.itemId === origItem.id || 
            (origItem.item_code && h.item_code === origItem.item_code)
          );
          const deliveredQty = itemHistory.filter(h => h.deliveryStatus === 'Delivered').reduce((sum, h) => sum + h.qty, 0);
          const cancelledQty = itemHistory.filter(h => h.deliveryStatus === 'Cancelled').reduce((sum, h) => sum + h.qty, 0);
          const processedQty = deliveredQty + cancelledQty;

          let itemStatus: 'Pending' | 'Delivered' | 'Cancelled' = 'Pending';
          if (processedQty >= origItem.qty) {
            if (cancelledQty >= origItem.qty) {
              itemStatus = 'Cancelled';
            } else {
              itemStatus = 'Delivered';
            }
          }

          return {
            ...origItem,
            deliveryStatus: itemStatus
          };
        });

        const hasAnyPending = updatedItems.some(item => item.deliveryStatus === 'Pending' || !item.deliveryStatus);
        const determinedStatus: DeliveryReceipt['status'] = hasAnyPending ? 'Partially Delivered' : 'Delivered';

        return {
          ...prev,
          status: determinedStatus,
          deliveredDate: dateVal,
          inTransitDate: prev.inTransitDate || prev.date,
          items: updatedItems,
          hardwareItems: prev.hardwareItems ? updatedItems : undefined,
          deliveryHistory: deliveryHistory
        };
      });
    }

    setItemValidationPrompt(null);
  };

  const handleConfirmStatusDate = async () => {
    if (!statusDatePrompt) return;
    const { drId, newStatus, dateVal } = statusDatePrompt;

    const isTransit = newStatus?.toLowerCase() === 'in transit';

    const originalDR = receipts.find(r => r.id === drId);
    if (!originalDR) return;

    const oldStatusLower = (originalDR.status || '').toLowerCase();
    const isTransitioningToTransit = isTransit && (oldStatusLower !== 'in transit' && oldStatusLower !== 'delivered');

    const updated = receipts.map(r => {
      if (r.id === drId) {
        if (isTransit) {
          return {
            ...r,
            status: 'In Transit' as const,
            inTransitDate: dateVal,
            deliveredDate: undefined
          };
        } else {
          return {
            ...r,
            status: newStatus,
            deliveredDate: dateVal,
            inTransitDate: r.inTransitDate || r.date // Fallback to acceptance/created date if empty
          };
        }
      }
      return r;
    });

    setReceipts(updated);
    localStorage.setItem('aralinks_delivery_receipts', JSON.stringify(updated));

    const targetDR = updated.find(r => r.id === drId);
    if (isSupabaseConfigured && targetDR) {
      try {
        const { error } = await supabase
          .from('delivery_receipts')
          .update({
            status: targetDR.status === 'In Transit' ? 'In transit' : targetDR.status,
            in_transit_date: targetDR.inTransitDate || null,
            delivered_date: targetDR.deliveredDate || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', drId);
        if (error) console.warn('Failed to update delivery status date in Supabase:', error);

        // Deduct inventory stock and write transactions if transitioning to transit
        if (isTransitioningToTransit) {
          const currentUser = localStorage.getItem('aralinks_user') || 'System';
          const hardwareItems = targetDR.hardwareItems || targetDR.items || [];

          for (const item of hardwareItems) {
            let itemCode = item.item_code;
            let itemName = item.description;

            if (!itemCode) {
              const { data: matchedEquip } = await supabase
                .from('equipment')
                .select('item_code, description')
                .eq('description', item.description)
                .limit(1);
              if (matchedEquip && matchedEquip.length > 0) {
                itemCode = matchedEquip[0].item_code;
                itemName = matchedEquip[0].description;
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

            // Fallback if needed
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
                  to_location: targetDR.schoolName,
                  quantity: dLoc.qty,
                  transaction_type: 'Delivery',
                  reference_id: drId,
                  created_by: currentUser,
                  reason: `Delivered to School: ${targetDR.schoolName} via DR ${drId}`
                }]);

              if (txError) throw txError;
            }
          }
        }
      } catch (err) {
        console.warn('Error during Supabase status date update & stock deduction:', err);
      }
    }

    await syncSchoolMonitoringWithDRs(updated);
    showSuccess('Status Updated', `Delivery receipt ${drId} status changed to ${newStatus} on ${dateVal}.`);

    if (selectedDR?.id === drId) {
      setSelectedDR(prev => {
        if (!prev) return null;
        if (isTransit) {
          return { ...prev, status: 'In Transit', inTransitDate: dateVal, deliveredDate: undefined };
        } else {
          return { ...prev, status: newStatus, deliveredDate: dateVal, inTransitDate: prev.inTransitDate || prev.date };
        }
      });
    }

    setStatusDatePrompt(null);
  };

  const handleSaveTargetDate = async () => {
    if (!selectedDRForTargetDate) return;
    
    const updated = receipts.map(r => {
      if (r.id === selectedDRForTargetDate.id) {
        return {
          ...r,
          targetDeliveryDate: targetDateInput
        };
      }
      return r;
    });
    
    setReceipts(updated);
    localStorage.setItem('aralinks_delivery_receipts', JSON.stringify(updated));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('delivery_receipts')
          .update({
            target_delivery_date: targetDateInput,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedDRForTargetDate.id);
        if (error) console.warn('Failed to update target delivery date in Supabase:', error);
      } catch (err) {
        console.warn('Error during Supabase target delivery date update:', err);
      }
    }

    await syncSchoolMonitoringWithDRs(updated);
    
    showSuccess('Target Date Updated', `Target delivery date for ${selectedDRForTargetDate.id} set to ${targetDateInput ? formatDate(targetDateInput) : 'None'}.`);
    
    if (selectedDR?.id === selectedDRForTargetDate.id) {
      setSelectedDR(prev => prev ? { ...prev, targetDeliveryDate: targetDateInput } : null);
    }
    
    setSelectedDRForTargetDate(null);
  };

  // Export List action Simulation
  const handleExportList = () => {
    showSuccess(
      'Data Export Successful',
      'Delivery Receipts metrics and acceptances exported to Excel/CSV format correctly.'
    );
  };

  // PDF Download simulation
  const handleExportPDF = (drId: string) => {
    showSuccess(
      `PDF Compilation Triggered`,
      `The printable layout of DR ${drId} has been prepared and downloaded safely.`
    );
  };

  // Triggering physical local native printer format
  const handlePrintDR = (drId: string) => {
    showInfo(
      'Print spooler loaded',
      `Preparing high-contrast printer layout margins for active receipt ${drId}.`
    );
    window.print();
  };

  // Real-time statistic aggregation
  const statistics = useMemo(() => {
    const totalReceipts = receipts.length;
    
    // Pending Acceptance means status of 'Ready for delivery' or 'In Transit'
    const pendingAcceptance = receipts.filter(
      r => {
        const s = r.status?.toLowerCase();
        return s === 'ready for delivery' || s === 'in transit';
      }
    ).length;

    // Completed Deliveries means status of 'Delivered' or 'Partially Delivered'
    const completedDeliveries = receipts.filter(
      r => {
        const s = r.status?.toLowerCase();
        return s === 'delivered' || s === 'partially delivered';
      }
    ).length;

    // Sum of delivered items
    const totalDeliveredItems = receipts.reduce((sum, r) => {
      const s = r.status?.toLowerCase();
      if (s === 'delivered') {
        return sum + r.totalItems;
      } else if (s === 'partially delivered') {
        const sourceItems = r.hardwareItems || r.items;
        const deliveredCount = sourceItems ? sourceItems.filter(item => item.deliveryStatus === 'Delivered').length : r.totalItems;
        return sum + deliveredCount;
      }
      return sum;
    }, 0);

    return {
      totalReceipts,
      pendingAcceptance,
      completedDeliveries,
      totalDeliveredItems
    };
  }, [receipts]);

  // Filtering Logic
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      // Search by DR Number
      const matchesDR = r.id.toLowerCase().includes(searchDR.toLowerCase().trim());
      
      // Search by School
      const matchesSchool = r.schoolName.toLowerCase().includes(searchSchool.toLowerCase().trim());
      
      // Status Filter
      const matchesStatus = statusFilter === 'All' || 
        r.status === statusFilter ||
        (statusFilter?.toLowerCase() === 'in transit' && r.status?.toLowerCase() === 'in transit') ||
        (statusFilter?.toLowerCase() === 'ready for delivery' && r.status?.toLowerCase() === 'ready for delivery') ||
        (statusFilter?.toLowerCase() === 'delivered' && r.status?.toLowerCase() === 'delivered') ||
        (statusFilter?.toLowerCase() === 'partially delivered' && r.status?.toLowerCase() === 'partially delivered');
      
      // Agent Filter
      const matchesAgent = agentFilter === 'All' || r.agent === agentFilter;

      // Date Range Filter
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && r.date >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && r.date <= endDate;
      }

      return matchesDR && matchesSchool && matchesStatus && matchesAgent && matchesDate;
    });
  }, [receipts, searchDR, searchSchool, statusFilter, agentFilter, startDate, endDate]);

  const getStatusBadge = (dr: DeliveryReceipt) => {
    const status = dr.status?.toLowerCase() || '';
    switch (status) {
      case 'delivered':
        return {
          label: 'Delivered',
          bg: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
          icon: <CheckCircle2 size={12} className="text-emerald-505" />
        };
      case 'partially delivered':
        return {
          label: 'Partially Delivered',
          bg: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
          icon: <CheckCircle2 size={12} className="text-sky-550" />
        };
      case 'in transit':
      case 'in_transit':
        return {
          label: dr.inTransitDate ? `In Transit (${formatDate(dr.inTransitDate)})` : 'In Transit',
          bg: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
          icon: <Truck size={12} className="text-indigo-500" />
        };
      case 'ready for delivery':
      case 'ready_for_delivery':
      default:
        return {
          label: 'Ready for delivery',
          bg: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
          icon: <Clock size={12} className="text-amber-500" />
        };
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric'
    });
  };

  return (
    <div className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative no-scrollbar print:p-0">
      {/* Header section with top action triggers */}
      <div className="mx-2 lg:mx-4 mt-2 print:hidden">
        <PageHeader 
          title="Delivery Receipt Management" 
          description="Manage delivered equipment, installations, replacements, and delivery acceptance records." 
          isDarkMode={isDarkMode}
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportList}
                className={`px-4 py-2.5 rounded-xl border text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileDown size={14} />
                Export
              </button>
              
              <button
                onClick={handleCreateDR}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
                style={{
                  backgroundColor: 'var(--brand-accent)',
                  boxShadow: '0 4px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 60%)'
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Create Delivery Receipt
              </button>
            </div>
          }
        />
      </div>



      {/* ADVANCED MULTI-INPUT FILTERS AREA */}
      <div className="mx-2 lg:mx-4 mt-6 p-5 rounded-2xl border shadow-sm print:hidden transition-all duration-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 border-b border-b-slate-105 dark:border-b-slate-800 pb-3 mb-4.5">
          <Filter size={15} className="text-brand-orange" />
          <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Search Filters Panel</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* DR Input Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Search DR Number</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-405 dark:text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search DR..."
                value={searchDR}
                onChange={(e) => setSearchDR(e.target.value)}
                className={`w-full pl-9 pr-3.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange/40 ${
                  isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                }`}
              />
            </div>
          </div>

          {/* School Name Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Search School</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-405 dark:text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search School name..."
                value={searchSchool}
                onChange={(e) => setSearchSchool(e.target.value)}
                className={`w-full pl-9 pr-3.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange/40 ${
                  isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                }`}
              />
            </div>
          </div>

          {/* Agent Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Agent Representative</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange/40 ${
                isDarkMode ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50 border-slate-205 text-slate-800'
              }`}
            >
              <option value="All">All Representatives</option>
              {uniqueAgents.map(ag => (
                <option key={ag} value={ag}>{ag}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status Condition</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-brand-orange/40 ${
                isDarkMode ? 'bg-slate-950 border-slate-805 text-slate-100' : 'bg-slate-50 border-slate-205 text-slate-800'
              }`}
            >
              <option value="All">All Status Options</option>
              <option value="Ready for delivery">Ready for delivery</option>
              <option value="In Transit">In Transit</option>
              <option value="Partially Delivered">Partially Delivered</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>

          {/* Date range pickers */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date Period Bounds</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                title="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-2 py-1 rounded-lg border text-[10px] focus:outline-none ${
                  isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                }`}
              />
              <span className="text-[10px] text-slate-400 font-bold">to</span>
              <input
                type="date"
                title="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-2 py-1 rounded-lg border text-[10px] focus:outline-none ${
                  isDarkMode ? 'bg-slate-950 border-slate-805 text-white' : 'bg-slate-50 border-slate-205 text-slate-800'
                }`}
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="p-1 rounded bg-slate-105 hover:bg-slate-202 text-slate-400 hover:text-slate-650"
                  title="Clear Dates"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1.3: MAIN TABLE OF DELIVERY RECEIPTS */}
      <div className={`mx-2 lg:mx-4 rounded-xl shadow-sm overflow-hidden border flex flex-col mb-10 mt-6 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto select-none custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800/40 border-slate-870' : 'bg-slate-50/70 border-slate-102'}`}>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">DR No.</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">School Monitoring ID</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">Date Created</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">School name</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">Project</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {filteredReceipts.map((dr) => {
                const badge = getStatusBadge(dr);
                return (
                  <tr 
                    key={dr.id}
                    className={`group transition-all duration-200 border-l-4 border-transparent hover:border-brand-orange ${
                      isDarkMode ? 'hover:bg-slate-800/25' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* DR Number */}
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2">
                        <FileCheck size={16} className="text-brand-orange shrink-0" />
                        <span className={`text-[13.5px] font-black tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-850'}`}>
                          {dr.id}
                        </span>
                      </div>
                    </td>

                    {/* School Monitoring ID */}
                    <td className="px-6 py-4.5">
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                        {dr.schoolMonitoringId || dr.school_monitoring_id || '-'}
                      </span>
                    </td>

                    {/* Date Created */}
                    <td className="px-6 py-4.5 font-mono text-[12.5px] font-bold text-slate-500 dark:text-slate-400">
                      {formatDate(dr.date)}
                    </td>

                    {/* School name */}
                    <td className="px-6 py-4.5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2.5 max-w-[240px]">
                          <Building2 size={16} className={`shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          <span className={`text-[13.5px] font-bold tracking-tight truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`} title={dr.schoolName}>
                            {dr.schoolName}
                          </span>
                        </div>
                        {dr.targetDeliveryDate && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-500 dark:text-amber-400 font-bold font-mono mt-1 ml-6.5">
                            <Calendar size={11} className="stroke-[2.5]" />
                            <span>Target: {formatDate(dr.targetDeliveryDate)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Project */}
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-1.5 max-w-[180px]">
                        <Briefcase size={15} className="text-slate-400 dark:text-slate-505 shrink-0" />
                        <span className="text-[13.5px] text-slate-500 dark:text-slate-420 truncate" title={dr.project}>
                          {dr.project}
                        </span>
                      </div>
                    </td>

                    {/* Status condition */}
                    <td className="px-6 py-4.5 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full w-fit border text-[10.5px] font-black tracking-widest uppercase shadow-xs transition-all duration-300 group-hover:scale-105 ${badge.bg}`}>
                          {badge.icon}
                          {badge.label}
                        </div>
                        <button
                          type="button"
                          onClick={() => setHistoryDR(dr)}
                          className={`text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1 transition-all rounded-lg px-2 py-0.5 border ${
                            isDarkMode
                              ? 'text-slate-400 border-slate-800 hover:text-brand-orange hover:border-brand-orange hover:bg-brand-orange/5'
                              : 'text-slate-500 border-slate-100 hover:text-brand-orange hover:border-brand-orange hover:bg-brand-orange/5'
                          } cursor-pointer`}
                          title="View status transaction history"
                        >
                          <History size={11} className="stroke-[2.5]" />
                          <span>History</span>
                        </button>
                      </div>
                    </td>

                    {/* Interactive table actions */}
                    <td className="px-6 py-4.5 text-center print:hidden">
                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                        {/* Preview template button */}
                        <button
                          onClick={() => setSelectedDR(dr)}
                          className={`h-8 w-8 rounded-xl border transition-all hover:scale-105 cursor-pointer flex items-center justify-center shrink-0 ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-800 text-slate-350 hover:text-brand-orange hover:bg-slate-800' 
                              : 'bg-white border-slate-150 text-slate-600 hover:text-brand-orange hover:bg-slate-50'
                          }`}
                          title="Preview template"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Target Delivery Date Action Button */}
                        {dr.status === 'Ready for delivery' && (
                          <button
                            onClick={() => {
                              setSelectedDRForTargetDate(dr);
                              setTargetDateInput(dr.targetDeliveryDate || '');
                            }}
                            className={`h-8 w-8 rounded-xl border transition-all hover:scale-105 cursor-pointer flex items-center justify-center shrink-0 ${
                              isDarkMode 
                                ? 'bg-slate-950 border-slate-800 text-amber-400 hover:text-amber-305 hover:bg-amber-500/10' 
                                : 'bg-white border-slate-150 text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                            }`}
                            title="Set Target Delivery Date"
                          >
                            <Calendar size={15} />
                          </button>
                        )}

                        {/* Ready for delivery or In Transit -> display button to change/update In Transit date */}
                        {(dr.status === 'Ready for delivery' || dr.status === 'In Transit') && (
                          <button
                            onClick={() => handleChangeStatus(dr.id, 'In Transit')}
                            className={`h-8 w-8 rounded-xl border transition-all hover:scale-105 cursor-pointer flex items-center justify-center shrink-0 ${
                              dr.status === 'In Transit'
                                ? isDarkMode
                                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20'
                                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:text-indigo-850 hover:bg-indigo-100'
                                : isDarkMode 
                                  ? 'bg-slate-950 border-slate-800 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10' 
                                  : 'bg-white border-slate-150 text-indigo-600 hover:text-indigo-750 hover:bg-indigo-50'
                            }`}
                            title={dr.status === 'In Transit' ? "Change/Update In Transit Date" : "Mark as In Transit"}
                          >
                            <Truck size={15} />
                          </button>
                        )}

                        {/* In Transit or Partially Delivered -> display icon status for mark as delivered */}
                        {(dr.status === 'In Transit' || dr.status === 'Partially Delivered') && (
                          <button
                            onClick={() => handleChangeStatus(dr.id, 'Delivered')}
                            className={`h-8 w-8 rounded-xl border transition-all hover:scale-105 cursor-pointer flex items-center justify-center shrink-0 ${
                              isDarkMode 
                                ? 'bg-slate-950 border-slate-800 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10' 
                                : 'bg-white border-slate-150 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title="Mark as Delivered"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}

                        {/* Delivered -> display button to view delivered transaction history */}
                        {dr.status === 'Delivered' && (
                          <button
                            onClick={() => {
                              const existingHistory = (dr as any).deliveryHistory || [];
                              setItemValidationPrompt({
                                drId: dr.id,
                                dateVal: dr.deliveredDate || '',
                                items: (dr.hardwareItems || dr.items || []).map(item => ({
                                  id: item.id || Math.random().toString(),
                                  item_code: item.item_code,
                                  description: item.description,
                                  qty: item.qty,
                                  uom: item.uom,
                                  serialNumber: item.serialNumber,
                                  deliveryStatus: item.deliveryStatus || 'Delivered',
                                  selectedQty: 0
                                })),
                                deliveryHistory: existingHistory
                              });
                            }}
                            className={`h-8 w-8 rounded-xl border transition-all hover:scale-105 cursor-pointer flex items-center justify-center shrink-0 ${
                              isDarkMode 
                                ? 'bg-slate-950 border-slate-805 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10' 
                                : 'bg-white border-slate-150 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title="View Delivered Items Transaction History"
                          >
                            <History size={15} />
                          </button>
                        )}

                        {/* Edit button */}
                        <button
                          onClick={() => handleEditDR(dr.id)}
                          disabled={dr.status === 'Delivered' || dr.status === 'Partially Delivered'}
                          className={`h-8 w-8 rounded-xl border transition-all hover:scale-105 flex items-center justify-center shrink-0 ${
                            dr.status === 'Delivered' || dr.status === 'Partially Delivered'
                              ? 'opacity-40 cursor-not-allowed border-transparent text-slate-400'
                              : isDarkMode 
                                ? 'bg-slate-950 border-slate-800 text-slate-350 hover:text-blue-400 hover:bg-slate-800 cursor-pointer' 
                                : 'bg-white border-slate-150 text-slate-600 hover:text-blue-500 hover:bg-slate-50 cursor-pointer'
                          }`}
                          title={dr.status === 'Delivered' || dr.status === 'Partially Delivered' ? "Cannot edit processed deliveries" : "Edit template"}
                        >
                          <Edit3 size={15} />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteDR(dr.id)}
                          className={`h-8 w-8 rounded-xl border transition-all hover:scale-105 cursor-pointer flex items-center justify-center shrink-0 ${
                            isDarkMode 
                              ? 'bg-slate-950 border-slate-805 text-slate-400 hover:text-red-500 hover:bg-red-500/10' 
                              : 'bg-white border-slate-150 text-slate-405 hover:text-red-550 hover:bg-red-50/80'
                          }`}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredReceipts.length === 0 && (
            <div className={`p-16 flex flex-col items-center justify-center text-center ${isDarkMode ? 'opacity-15' : 'opacity-25'}`}>
              <Activity size={72} strokeWidth={1} className="text-brand-orange mb-4 animate-bounce" />
              <p className="text-base font-black tracking-[0.3em] uppercase">No Delivery Receipts Listed</p>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                No matching receipts met your specific querying and criteria selections. Try checking keywords or clearing bounds.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* STEP 1.4: DELIVERY RECEIPT DETAILS PREVIEW SLIDE-OVER MODAL */}
      <AnimatePresence>
        {selectedDR && (
          <>
            {/* Backdrop layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedDR(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[1000] print:hidden"
            />

            {/* Centered Modal Container */}
            <div className="fixed inset-0 z-[1001] flex items-center justify-center p-2 sm:p-4 md:p-6 print:relative print:p-0 overflow-y-auto">
              {/* Centered Modal Dialog */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className={`w-full max-w-4xl max-h-[92vh] print:max-h-none shadow-2xl rounded-2xl flex flex-col border font-sans print:w-full print:border-none print:shadow-none print:p-0 print:relative ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
                }`}
              >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 print:hidden">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-[9px] font-black uppercase text-brand-orange tracking-widest font-mono">
                    PHOENIX PUBLIC HOUSE RECEIPT PREVIEW
                  </span>
                  <div className="flex items-center gap-2">
                    <FileCheck size={18} className="text-brand-orange" />
                    <h3 className="text-lg font-black tracking-normal leading-tight">
                      {selectedDR.id}
                    </h3>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedDR(null)}
                  className={`p-2 rounded-xl border transition-colors ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-805 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-505 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                  title="Close panel"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Receipt Form Sheet Body */}
              <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-slate-100 dark:bg-slate-950 custom-scrollbar print:p-0 print:bg-white space-y-4">
                
                {/* Paper sheet */}
                <div className="border border-slate-200 dark:border-slate-800 bg-white text-zinc-900 p-6 md:p-8 shadow-md rounded-2xl relative select-none print:shadow-none print:border-none print:p-0 max-w-3xl mx-auto font-sans">
                  
                  {/* Header Branded Logo Section */}
                  <div className="flex items-center justify-center mb-1 pb-1">
                    <img 
                      src="https://www.phoenix.com.ph/wp-content/uploads/2026/06/Screenshot-2026-06-04-093703.png"
                      alt="Phoenix Publishing House Logo Header"
                      className="w-full object-contain max-h-[85px]"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Document Title & Top Right Date Blocks */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2.5">
                    <div className="w-full sm:w-1/4" />
                    <div className="w-full sm:w-2/4 text-center">
                      <h2 className="text-[14px] font-black tracking-widest text-zinc-900 uppercase font-sans">
                        DELIVERY ACCEPTANCE
                      </h2>
                    </div>

                    {/* Box container for Date and DR No. matching paper sketch */}
                    <div className="w-full sm:w-1/4 flex justify-center sm:justify-end">
                      <div className="border border-zinc-500 rounded-sm overflow-hidden shrink-0 text-center text-[10px] w-[165px] leading-tight bg-white">
                        <div className="border-b border-zinc-500 p-1 flex items-center justify-between px-2 bg-zinc-50">
                          <span className="font-bold text-zinc-500 uppercase">Date:</span>
                          <span className="font-mono font-bold text-zinc-800">
                            {selectedDR.date ? new Date(selectedDR.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '--/--/----'}
                          </span>
                        </div>
                        <div className="p-1 flex items-center justify-between px-2 bg-zinc-100/50">
                          <span className="font-bold text-zinc-500 uppercase">DR No.</span>
                          <span className="font-mono font-bold text-zinc-900 tracking-wider">
                            {selectedDR.id}
                          </span>
                        </div>
                        {(selectedDR as any).targetDeliveryDate && (
                          <div className="p-1 flex items-center justify-between px-2 bg-amber-50/70 border-t border-zinc-400">
                            <span className="font-bold text-amber-700 uppercase">Target:</span>
                            <span className="font-mono font-bold text-amber-800">
                              {new Date((selectedDR as any).targetDeliveryDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Client information fields grid */}
                  <div className="grid grid-cols-12 gap-y-2 text-[10px] text-left mt-4 pb-4 border-b border-zinc-300">
                    
                    <div className="col-span-12 sm:col-span-7 flex flex-col pr-0 sm:pr-4 justify-end text-left">
                      <div className="flex items-end">
                        <span className="w-24 shrink-0 font-bold text-zinc-700">Delivered to</span>
                        <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                        <span className="font-black text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1">
                          {selectedDR.schoolName}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">Client Code</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-mono font-bold text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                        {selectedDR.clientCode || 'C00000231(GS)'}
                      </span>
                    </div>

                    <div className="col-span-12 sm:col-span-7 flex items-end pr-0 sm:pr-4">
                      <span className="w-24 shrink-0 font-bold text-zinc-700">Address</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1">
                        {selectedDR.address || 'ASSUMPTION ROAD, 2600 BAGUIO CITY, BEN'}
                      </span>
                    </div>
                    <div className="col-span-12 sm:col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">Agent</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-semibold text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                        {selectedDR.agent || 'Team Gina'}
                      </span>
                    </div>

                    <div className="col-span-12 sm:col-span-7 flex items-end pr-0 sm:pr-4">
                      <span className="w-24 shrink-0 font-bold text-zinc-700">Contact Person</span>
                      <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                      <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                        {selectedDR.contactPerson || <span className="text-zinc-300">__________________________________________</span>}
                      </span>
                    </div>
                    <div className="col-span-12 sm:col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">Project</span>
                      <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                      <span className="font-bold text-zinc-950 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                        {selectedDR.project}
                      </span>
                    </div>

                    <div className="col-span-12 sm:col-span-7 flex items-end pr-0 sm:pr-4">
                      <span className="w-24 shrink-0 font-bold text-zinc-700">Contact No.</span>
                      <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                      <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                        {selectedDR.contactNo || <span className="text-zinc-300">__________________________________________</span>}
                      </span>
                    </div>
                    <div className="col-span-12 sm:col-span-5 flex items-end">
                      <span className="w-20 shrink-0 font-bold text-zinc-700">MOA</span>
                      <span className="font-semibold text-zinc-505 mr-1.5">:</span>
                      <span className="font-semibold text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate">
                        {selectedDR.moa || 'S.Y. 2023 TO S.Y. 2024 TO S.Y. 2025-26'}
                      </span>
                    </div>
                  </div>

                  {/* HARDWARE ITEMS TABLE (Matches physical style closely) */}
                  <div className="mt-4 text-[9.5px] text-left overflow-x-auto">
                    <table className="w-full border-collapse border border-zinc-400 min-w-[500px]">
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
                        <tr className="border-b border-zinc-300 font-bold text-zinc-850 bg-zinc-50/70">
                          <td className="border-r border-zinc-300 py-1 text-center"></td>
                          <td className="border-r border-zinc-300 py-1 text-center"></td>
                          <td colSpan={3} className="px-3 py-1 font-black uppercase tracking-wider text-[8.5px] text-zinc-700">
                            Hardware
                          </td>
                        </tr>

                        {(selectedDR.hardwareItems || selectedDR.items || []).map((hw: any, idx: number) => {
                          const isCancelled = hw.deliveryStatus === 'Cancelled';
                          return (
                            <tr key={hw.id || idx} className={`border-b border-zinc-200 transition-all ${isCancelled ? 'opacity-40 italic bg-zinc-50' : ''}`}>
                              <td className="border-r border-zinc-300 px-2.5 py-1 text-center font-bold font-mono text-zinc-800">
                                {isCancelled ? (
                                  <span className="text-red-650 font-sans text-[7.5px] font-black uppercase tracking-wider block">CNCLD</span>
                                ) : (
                                  hw.qty
                                )}
                              </td>
                              <td className={`border-r border-zinc-300 px-2.5 py-1 text-center text-zinc-500 font-sans ${isCancelled ? 'line-through text-zinc-400' : ''}`}>{hw.unit || hw.uom || 'PCS'}</td>
                              <td className={`border-r border-zinc-300 px-3 py-1 font-black text-zinc-900 truncate max-w-[210px] ${isCancelled ? 'line-through text-zinc-400' : ''}`} title={hw.description}>
                                {hw.description || '------'}
                              </td>
                              <td className={`border-r border-zinc-300 px-3 py-1 font-mono text-[9px] text-zinc-500 whitespace-normal break-words ${isCancelled ? 'line-through text-zinc-400 font-mono' : ''}`} title={hw.specifications || hw.serialNumber}>
                                {(() => {
                                  const serialsVal = hw.specifications || hw.serialNumber;
                                  return serialsVal || '------';
                                })()}
                              </td>
                              <td className={`px-3 py-1 text-zinc-650 truncate max-w-[140px] ${isCancelled ? 'line-through text-zinc-400' : ''}`} title={hw.remarks}>
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
                          );
                        })}
                        {/* Fill empty lines up to 6 rows for that notepad look */}
                        {Array.from({ length: Math.max(0, 6 - (selectedDR.hardwareItems || selectedDR.items || []).length) }).map((_, i) => (
                          <tr key={`empty-hw-${i}`} className="h-[21px] border-b border-zinc-200">
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
                  {selectedDR.remarks && (
                    <div className="mt-3.5 p-2 rounded border border-zinc-200 text-left text-[8.5px] leading-relaxed text-zinc-500 font-sans">
                      <span className="font-extrabold text-[#FF6A00] uppercase block mb-0.5">Dispatcher / Routing Notes:</span>
                      {selectedDR.remarks}
                    </div>
                  )}

                  {/* SIGNATURE FIELDS AT THE BOTTOM (A high-fidelity 2x2 paper document signatory section) */}
                  <div className="mt-6 pt-4 border-t border-zinc-300 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-5 text-left leading-snug text-[10px]">
                    
                    {/* Row 1 Column 1: Prepared */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-600 block">Prepared by/ Date:</span>
                      </div>
                      <div className="h-14 border border-dashed border-zinc-200 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                        {selectedDR.signatoryPrepared?.signatureImage ? (
                          <img src={selectedDR.signatoryPrepared.signatureImage} alt="Prepared Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                        ) : (
                          <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                            <PenTool size={10} className="text-zinc-400" />
                            <span className="text-[7.5px] font-bold uppercase">SIGNED ELECTRONICALLY</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center font-sans">
                        <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none">
                          {selectedDR.signatoryPrepared?.name || selectedDR.issuedBy || 'Sarah Connor'}
                        </span>
                        <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                      </div>
                    </div>

                    {/* Row 1 Column 2: Delivered/Installed */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-600 block">Delivered/Installed by/ Date:</span>
                      </div>
                      <div className="h-14 border border-dashed border-zinc-200 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                        {selectedDR.signatoryDelivered?.signatureImage ? (
                          <img src={selectedDR.signatoryDelivered.signatureImage} alt="Delivered Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                        ) : (
                          <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                            <PenTool size={10} className="text-zinc-400" />
                            <span className="text-[7.5px] font-bold uppercase">SIGNED ELECTRONICALLY</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center font-sans">
                        <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[240px] mx-auto text-[10px] uppercase tracking-wide leading-none">
                          C/O DID STAFF: {selectedDR.signatoryDelivered?.name || selectedDR.deliveredBy || 'JOHN ROBERT PAGALA'}
                        </span>
                        <span className="text-[8px] text-zinc-405 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature/Date</span>
                      </div>
                    </div>

                    {/* Row 2 Column 1: Approved */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-600 block">Approved by/ Date:</span>
                      </div>
                      <div className="h-14 border border-dashed border-zinc-200 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                        {selectedDR.signatoryApproved?.signatureImage ? (
                          <img src={selectedDR.signatoryApproved.signatureImage} alt="Approved Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                        ) : (
                          <div className="text-zinc-400 text-center font-mono opacity-50 flex items-center gap-1">
                            <PenTool size={10} className="text-zinc-400" />
                            <span className="text-[7.5px] font-bold uppercase">SIGNED ELECTRONICALLY</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center font-sans">
                        <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none">
                          {selectedDR.signatoryApproved?.name || 'JERALD DELA CRUZ'}
                        </span>
                        <span className="text-[8px] text-zinc-405 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                      </div>
                    </div>

                    {/* Row 2 Column 2: Checked and Received */}
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-zinc-650 block">CHECKED and Received target:</span>
                      </div>
                      <div className="h-14 border border-dashed border-zinc-205 bg-zinc-50/50 rounded overflow-hidden flex items-center justify-center">
                        {selectedDR.signatoryCheckedReceived?.signatureImage ? (
                          <img src={selectedDR.signatoryCheckedReceived.signatureImage} alt="Received Sig" className="object-contain h-full w-44 opacity-95 scale-100" />
                        ) : selectedDR.receivedBy ? (
                          <div className="text-zinc-500 text-center font-medium text-[8px] uppercase">
                            {selectedDR.receivedBy}
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-[9px] italic">No physical signature</span>
                        )}
                      </div>
                      <div className="text-center font-sans">
                        <span className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none text-brand-orange">
                          {selectedDR.receivedBy || selectedDR.signatoryCheckedReceived?.name || 'Awaiting Client Signature'}
                        </span>
                        <span className="text-[8px] text-zinc-405 font-bold uppercase tracking-wider mt-1 block">Printed Name/Signature</span>
                      </div>
                    </div>

                  </div>

                </div>
              </div>

              {/* Action slide-over footer */}
              <div className={`p-4 border-t flex items-center justify-between gap-3 shrink-0 print:hidden ${
                isDarkMode ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-150'
              }`}>
                <button
                  onClick={() => setSelectedDR(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Close Detail
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handlePrintDR(selectedDR.id)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0081f1] text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer text-left font-sans"
                  >
                    <Printer size={14} />
                    Print
                  </button>

                  <button
                    onClick={() => handleExportPDF(selectedDR.id)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer text-left font-sans"
                  >
                    <FileDown size={14} />
                    Export PDF
                  </button>

                  <button
                    onClick={() => handleEditDR(selectedDR.id)}
                    disabled={selectedDR.status === 'Delivered' || selectedDR.status === 'Partially Delivered'}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all font-sans ${
                      selectedDR.status === 'Delivered' || selectedDR.status === 'Partially Delivered'
                        ? 'bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-brand-orange text-white hover:opacity-90 cursor-pointer active:scale-95'
                    }`}
                    title={selectedDR.status === 'Delivered' || selectedDR.status === 'Partially Delivered' ? "Cannot edit processed deliveries" : "Edit template"}
                  >
                    <Edit3 size={14} />
                    Edit Record
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
          </>
        )}
      </AnimatePresence>

      {/* Target Delivery Date Prompt Dialog */}
      <AnimatePresence>
        {selectedDRForTargetDate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDRForTargetDate(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
            />
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl border p-5 shadow-xl text-left ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Configure Schedule</h4>
                  <p className="text-xs font-bold mt-0.5">Target Delivery Date</p>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed font-bold text-slate-400 mb-3.5">
                Designate the targeted delivery destination arrival date for receipt <strong className="text-brand-orange">{selectedDRForTargetDate.id}</strong> ({selectedDRForTargetDate.schoolName}).
              </p>

              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Target Delivery Date</label>
                  <input
                    type="date"
                    value={targetDateInput}
                    onChange={(e) => setTargetDateInput(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-xs border bg-transparent font-medium outline-none transition-all ${
                      isDarkMode 
                        ? 'border-slate-800 focus:border-brand-orange text-white placeholder-slate-655' 
                        : 'border-slate-200 focus:border-brand-orange text-slate-800 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pr-0.5 pt-4.5 border-t dark:border-slate-800 mt-4.5">
                <button
                  onClick={() => setSelectedDRForTargetDate(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTargetDate}
                  className="px-4 py-1.5 rounded-xl text-xs font-black uppercase text-white shadow-xl bg-brand-orange flex items-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all hover:opacity-90"
                >
                  Save Schedule
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Date Prompt Dialog */}
      <AnimatePresence>
        {statusDatePrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStatusDatePrompt(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl border p-5 shadow-xl text-left ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className={`p-2 rounded-xl ${statusDatePrompt.newStatus === 'In Transit' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'}`}>
                  {statusDatePrompt.newStatus === 'In Transit' ? <Truck size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Change Status</h4>
                  <p className="text-xs font-bold mt-0.5">Select Date for {statusDatePrompt.newStatus}</p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  You are changing the delivery status of receipt <strong className="text-brand-orange">{statusDatePrompt.drId}</strong> to <strong className={statusDatePrompt.newStatus === 'In Transit' ? 'text-indigo-500' : 'text-emerald-500'}>{statusDatePrompt.newStatus}</strong>. Please confirm the corresponding operation date below.
                </p>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date Effective</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={statusDatePrompt.dateVal}
                      onChange={(e) => setStatusDatePrompt(prev => prev ? { ...prev, dateVal: e.target.value } : null)}
                      className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-1 ${
                        statusDatePrompt.newStatus === 'In Transit' 
                          ? 'focus:ring-indigo-500 dark:bg-slate-950 border-slate-350 dark:border-slate-800' 
                          : 'focus:ring-emerald-500 dark:bg-slate-950 border-slate-350 dark:border-slate-800'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatusDatePrompt(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-705' : 'bg-slate-100 text-slate-600 hover:bg-slate-150'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStatusDate}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black text-white shadow-sm hover:opacity-90 transition-opacity ${
                    statusDatePrompt.newStatus === 'In Transit' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-600 shadow-emerald-250'
                  }`}
                >
                  Confirm Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction History Timeline Modal */}
      <AnimatePresence>
        {historyDR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryDR(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl border p-5 shadow-xl text-left overflow-hidden ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3.5 mb-4 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-orange/10 text-brand-orange">
                    <History size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                      Receipt History
                    </h3>
                    <p className="text-[11px] font-mono font-bold text-slate-400 mt-0.5">
                      DR No. {historyDR.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryDR(null)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800' 
                      : 'bg-slate-550 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                  title="Close history modal"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mb-5">
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  Timeline of transaction state events for client: <strong className="text-brand-orange">{historyDR.schoolName}</strong>:
                </p>                {/* Vertical Timeline Aligned per transaction states */}
                {(() => {
                  const isDelivered = historyDR.status === 'Delivered' || historyDR.status === 'Partially Delivered';
                  const isInTransit = historyDR.status === 'In Transit' || isDelivered;
                  
                  // For Ready For Delivery, date is always historyDR.date
                  const readyDate = historyDR.date;
                  
                  // For In Transit, if delivered, guarantee we have date. If inTransitDate is empty, fallback to the record date
                  const inTransitDateVal = historyDR.inTransitDate || (isInTransit ? historyDR.date : undefined);
                  
                  // For Delivered, if delivered, we must have a date. Fallback to inTransitDateVal or historyDR.date
                  const deliveredDateVal = historyDR.deliveredDate || (isDelivered ? (historyDR.inTransitDate || historyDR.date) : undefined);
                  
                  return (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-850">
                      
                      {/* Step 1: Ready for delivery */}
                      <div className="relative">
                        {/* Circle marker */}
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-amber-500 bg-white dark:bg-slate-900 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                            <Clock size={11} />
                            Ready for delivery
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-650 dark:text-slate-350 mt-1">
                            {formatDate(readyDate)}
                          </p>
                        </div>
                      </div>

                      {/* Step 2: In Transit */}
                      <div className="relative">
                        {/* Circle marker */}
                        <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          inTransitDateVal 
                            ? 'border-indigo-500 bg-white dark:bg-slate-900' 
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955'
                        }`}>
                          {inTransitDateVal && <div className="w-1.5 h-1.5 rounded-full bg-indigo-505" />}
                        </div>
                        <div>
                          <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            inTransitDateVal ? 'text-indigo-505' : 'text-slate-400'
                          }`}>
                            <Truck size={11} />
                            In Transit
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-400 mt-1">
                            {inTransitDateVal ? (
                              <span className="text-slate-650 dark:text-slate-350 font-semibold">{formatDate(inTransitDateVal)}</span>
                            ) : (
                              <span className="italic font-normal text-slate-400">Pending</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Step 3: Delivered */}
                      <div className="relative">
                        {/* Circle marker */}
                        <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          deliveredDateVal 
                            ? 'border-emerald-500 bg-white dark:bg-slate-900' 
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955'
                        }`}>
                          {deliveredDateVal && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </div>
                        <div>
                          <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            deliveredDateVal ? 'text-emerald-500' : 'text-slate-400'
                          }`}>
                            <CheckCircle2 size={11} />
                            {historyDR.status === 'Partially Delivered' ? 'Partially Delivered' : 'Delivered'}
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-400 mt-1">
                            {deliveredDateVal ? (
                              <span className="text-slate-650 dark:text-slate-350 font-semibold">{formatDate(deliveredDateVal)}</span>
                            ) : (
                              <span className="italic font-normal text-slate-400">Pending</span>
                            )}
                          </p>
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setHistoryDR(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-105 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item-Level Delivery Status Confirmation Modal */}
      <AnimatePresence>
        {itemValidationPrompt && (
          <div className="fixed inset-0 z-[1002] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemValidationPrompt(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            {/* Modal Container */}
            {(() => {
              const activeReceipt = receipts.find(r => r.id === itemValidationPrompt.drId);
              const isAlreadyDelivered = activeReceipt?.status === 'Delivered';

              return (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className={`relative w-full max-w-2xl rounded-2xl border p-6 shadow-xl text-left flex flex-col max-h-[85vh] ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-150 text-slate-800'
                  }`}
                >
                  {/* Modal Header */}
                  <div className="flex items-center gap-2.5 mb-4 border-b pb-3 border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-brand-orange">
                      <CheckSquare size={20} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isAlreadyDelivered ? 'Delivered Items Transaction History' : 'Process Item Acceptance'}
                      </h4>
                      <p className="text-xs font-bold mt-0.5 text-slate-400">
                        DR: {itemValidationPrompt.drId} • {isAlreadyDelivered ? 'Historical log of all delivered/cancelled items' : 'Confirm status of each item'}
                      </p>
                    </div>
                  </div>              {/* Items List - Scrollable */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 my-3 py-1 text-xs">
                {(() => {
                  const pendingItemsWithRemaining = itemValidationPrompt.items.map(item => {
                    const itemHistory = (itemValidationPrompt.deliveryHistory || []).filter(h => 
                      h.itemId === item.id || 
                      (item.item_code && h.item_code === item.item_code)
                    );
                    const processedQty = itemHistory.reduce((sum, h) => sum + h.qty, 0);
                    const remainingQty = Math.max(0, item.qty - processedQty);
                    return {
                      ...item,
                      remainingQty
                    };
                  }).filter(item => item.remainingQty > 0);

                  const historyList = itemValidationPrompt.deliveryHistory || [];

                  // Group history list by date
                  const groupedHistory: { [date: string]: typeof historyList } = {};
                  historyList.forEach(h => {
                    const d = h.date || itemValidationPrompt.dateVal || new Date().toISOString().substring(0, 10);
                    if (!groupedHistory[d]) {
                      groupedHistory[d] = [];
                    }
                    groupedHistory[d].push(h);
                  });

                  // Sort dates descending
                  const sortedDates = Object.keys(groupedHistory).sort((a, b) => b.localeCompare(a));

                  return (
                    <>
                      {/* Pending Acceptance List */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">
                            Pending Acceptance ({pendingItemsWithRemaining.length})
                          </span>
                        </div>
                        {pendingItemsWithRemaining.length === 0 ? (
                          <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-950/20">
                            No pending items left. Review history below.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {pendingItemsWithRemaining.map((item, idx) => {
                              const currentSelectedQty = item.selectedQty !== undefined 
                                ? Math.min(item.selectedQty, item.remainingQty) 
                                : item.remainingQty;

                              return (
                                <div
                                  key={item.id || idx}
                                  className="p-3 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-805"
                                >
                                  <div className="space-y-1 text-left flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase bg-slate-100 text-slate-705 dark:bg-slate-800 dark:text-slate-400">
                                        {item.item_code}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400">
                                        Req: {item.qty} {item.uom}
                                      </span>
                                      <span className="text-[9.5px] px-1.5 py-0.2 rounded font-extrabold text-amber-600 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15">
                                        Remaining: {item.remainingQty} {item.uom}
                                      </span>
                                    </div>
                                    <h5 className="font-black uppercase tracking-wide text-slate-805 dark:text-slate-200">
                                      {item.description}
                                    </h5>
                                    {item.serialNumber && (
                                      <div className="text-[10px] text-slate-405 font-mono">
                                        S/N: {item.serialNumber}
                                      </div>
                                    )}
                                  </div>

                                  {/* Action & Quantity Selection Area */}
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                                    {/* Quantity Selection Input */}
                                    <div className="flex items-center gap-1 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
                                      <span className="text-[10px] px-1 font-bold text-slate-400 select-none">Qty:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        max={item.remainingQty}
                                        value={currentSelectedQty}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value);
                                          setItemValidationPrompt(prev => {
                                            if (!prev) return null;
                                            return {
                                              ...prev,
                                              items: prev.items.map(it => it.id === item.id ? { ...it, selectedQty: isNaN(val) ? undefined : val } : it)
                                            };
                                          });
                                        }}
                                        className="w-14 px-1 py-0.5 text-center text-xs font-black rounded border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-orange"
                                      />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5">
                                      {/* Delivered Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!itemValidationPrompt.dateVal) {
                                            showWarning('Delivery Date Required', 'Please select a valid overall delivery date first.');
                                            return;
                                          }
                                          if (currentSelectedQty === undefined || isNaN(currentSelectedQty) || currentSelectedQty <= 0) {
                                            showWarning('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
                                            return;
                                          }
                                          if (currentSelectedQty > item.remainingQty) {
                                            showWarning('Quantity Exceeded', `Cannot process more than the remaining quantity of ${item.remainingQty}.`);
                                            return;
                                          }

                                          const newEntry = {
                                            id: Math.random().toString(),
                                            itemId: item.id,
                                            item_code: item.item_code || '',
                                            description: item.description,
                                            qty: currentSelectedQty,
                                            uom: item.uom || 'PCS',
                                            serialNumber: item.serialNumber,
                                            deliveryStatus: 'Delivered' as const,
                                            date: itemValidationPrompt.dateVal || new Date().toISOString().substring(0, 10)
                                          };

                                          setItemValidationPrompt(prev => {
                                            if (!prev) return null;
                                            const computedRemaining = item.remainingQty - currentSelectedQty;
                                            return {
                                              ...prev,
                                              deliveryHistory: [...prev.deliveryHistory, newEntry],
                                              items: prev.items.map(it => it.id === item.id ? { ...it, selectedQty: computedRemaining > 0 ? computedRemaining : undefined } : it)
                                            };
                                          });
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                                      >
                                        <CheckCircle2 size={12} />
                                        Delivered
                                      </button>

                                      {/* Cancel Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!itemValidationPrompt.dateVal) {
                                            showWarning('Delivery Date Required', 'Please select a valid overall delivery date first.');
                                            return;
                                          }
                                          if (currentSelectedQty === undefined || isNaN(currentSelectedQty) || currentSelectedQty <= 0) {
                                            showWarning('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
                                            return;
                                          }
                                          if (currentSelectedQty > item.remainingQty) {
                                            showWarning('Quantity Exceeded', `Cannot process more than the remaining quantity of ${item.remainingQty}.`);
                                            return;
                                          }

                                          const newEntry = {
                                            id: Math.random().toString(),
                                            itemId: item.id,
                                            item_code: item.item_code || '',
                                            description: item.description,
                                            qty: currentSelectedQty,
                                            uom: item.uom || 'PCS',
                                            serialNumber: item.serialNumber,
                                            deliveryStatus: 'Cancelled' as const,
                                            date: itemValidationPrompt.dateVal || new Date().toISOString().substring(0, 10)
                                          };

                                          setItemValidationPrompt(prev => {
                                            if (!prev) return null;
                                            const computedRemaining = item.remainingQty - currentSelectedQty;
                                            return {
                                              ...prev,
                                              deliveryHistory: [...prev.deliveryHistory, newEntry],
                                              items: prev.items.map(it => it.id === item.id ? { ...it, selectedQty: computedRemaining > 0 ? computedRemaining : undefined } : it)
                                            };
                                          });
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                      >
                                        <XCircle size={12} />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Transaction History grouped by date (No back to pending revert) */}
                      {historyList.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                              <History size={12} className="text-slate-405" />
                              Transaction History ({historyList.length})
                            </span>
                          </div>
                          
                          <div className="space-y-4">
                            {sortedDates.map((dateStr) => {
                              const itemsOnDate = groupedHistory[dateStr];
                              return (
                                <div key={dateStr} className="space-y-2">
                                  {/* Date Banner */}
                                  <div className="flex items-center gap-1.5 py-0.5">
                                    <div className="h-px bg-slate-100 dark:bg-slate-850 flex-1" />
                                    <span className="font-black text-slate-400 dark:text-slate-500 text-[9px] tracking-wider uppercase px-2 py-0.5 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200/40 dark:border-slate-800">
                                      {formatDate ? formatDate(dateStr) : dateStr}
                                    </span>
                                    <div className="h-px bg-slate-100 dark:bg-slate-850 flex-1" />
                                  </div>

                                  {/* History List for this specific date */}
                                  <div className="space-y-1.5">
                                    {itemsOnDate.map((item, idx) => {
                                      const isDelivered = item.deliveryStatus === 'Delivered';
                                      return (
                                        <div
                                          key={item.id || idx}
                                          className={`p-2.5 rounded-xl border transition-all duration-350 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs ${
                                            isDelivered
                                              ? 'bg-emerald-500/5 border-emerald-500/15 text-slate-800 dark:text-slate-105'
                                              : 'bg-red-500/5 border-red-500/15 text-slate-805 dark:text-slate-110'
                                          }`}
                                        >
                                          <div className="space-y-0.5 text-left flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-black uppercase ${
                                                isDelivered
                                                  ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400'
                                                  : 'bg-red-100/80 text-red-800 dark:bg-red-500/15 dark:text-red-400'
                                              }`}>
                                                {item.item_code}
                                              </span>
                                              <span className="text-[9.5px] font-semibold text-slate-400">Qty: {item.qty} {item.uom}</span>
                                              <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                                                isDelivered
                                                  ? 'text-emerald-600'
                                                  : 'text-red-600'
                                              }`}>
                                                {item.deliveryStatus}
                                              </span>
                                            </div>
                                            <h5 className="font-bold uppercase tracking-wide truncate max-w-[320px] text-[11px] text-slate-700 dark:text-slate-300">
                                              {item.description}
                                            </h5>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Delivery Date effective */}
              <div className="mt-4 p-4 border-t border-slate-105 dark:border-slate-800 space-y-3 shrink-0 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Overall Delivery Date</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Specify effective date when goods are processed</span>
                  </div>
                  <div className="relative w-full sm:w-48">
                    <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={itemValidationPrompt.dateVal}
                      disabled={isAlreadyDelivered}
                      onChange={(e) => setItemValidationPrompt(prev => prev ? { ...prev, dateVal: e.target.value } : null)}
                      className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold dark:bg-slate-950 border-slate-350 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-orange ${
                        isAlreadyDelivered ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Info block displaying expected final status */}
                {(() => {
                  const sourceItems = itemValidationPrompt.items;
                  const totalRequestedQty = sourceItems.reduce((sum, i) => sum + i.qty, 0);
                  const processedHistory = itemValidationPrompt.deliveryHistory || [];
                  const totalDeliveredQty = processedHistory.filter(h => h.deliveryStatus === 'Delivered').reduce((sum, h) => sum + h.qty, 0);
                  const totalCancelledQty = processedHistory.filter(h => h.deliveryStatus === 'Cancelled').reduce((sum, h) => sum + h.qty, 0);
                  const totalProcessedQty = totalDeliveredQty + totalCancelledQty;
                  const totalPendingQty = Math.max(0, totalRequestedQty - totalProcessedQty);

                  const predictedStatus: DeliveryReceipt['status'] = (totalProcessedQty >= totalRequestedQty) ? 'Delivered' : 'Partially Delivered';

                  return (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="space-y-0.5 text-left w-full">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Estimated General Acceptance Status</span>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 self-start">
                            {predictedStatus}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-450">
                            ({totalDeliveredQty} Delivered, {totalCancelledQty} Cancelled, {totalPendingQty} Pending of {totalRequestedQty} total)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 text-[11px] pt-2">
                  {isAlreadyDelivered ? (
                    <button
                      type="button"
                      onClick={() => setItemValidationPrompt(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer bg-brand-orange hover:bg-brand-orange/90 active:scale-95 transition-all font-sans"
                      style={{ backgroundColor: 'var(--brand-accent)' }}
                    >
                      Close History
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setItemValidationPrompt(null)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold font-sans cursor-pointer ${
                          isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-150'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmItemValidation}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer bg-brand-orange hover:bg-brand-orange/90 active:scale-95 transition-all font-sans"
                        style={{ backgroundColor: 'var(--brand-accent)' }}
                      >
                        Confirm Delivery Status
                      </button>
                    </>
                  )}
                </div>
              </div>

                </motion.div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION DIALOG (Sleek custom modal) */}
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
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-455 border-b pb-3 mb-4 dark:border-slate-800">
                  <AlertTriangle size={20} className="animate-bounce" />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Confirm Permanent Deletion
                  </h3>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                  You are about to delete Delivery Receipt <span className="font-bold font-mono text-rose-500">{showDeleteConfirm}</span>. This operational action is irreversible. All associated items and records will be purged.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t dark:border-slate-800 mt-4">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteDR}
                    className="px-4 py-1.5 rounded-xl text-xs font-black uppercase text-white bg-rose-600 hover:bg-rose-700 shadow flex items-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
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

export default DeliveryReceiptManagement;
