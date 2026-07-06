
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ExcelJS from 'exceljs';
import { 
  Box, 
  Search, 
  Filter, 
  ArrowUp, 
  ArrowDown,
  Activity, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  ChevronRight,
  ShoppingCart,
  Info,
  X,
  Plus,
  History,
  ArrowRightLeft,
  Settings2,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
  PackageCheck,
  AlertCircle,
  Recycle,
  Download,
  Paperclip,
  RotateCcw
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import PageHeader from './PageHeader';
import AddStockModal from './AddStockModal';
import InventoryDetailsModal from './InventoryDetailsModal';
import SerialNumbersViewModal from './SerialNumbersViewModal';
import StockTransferModal from './StockTransferModal';
import StockAdjustmentModal from './StockAdjustmentModal';
import ProcessTransferModal from './ProcessTransferModal';

interface InventoryItem {
  item_code: string;
  item_name: string;
  total_quantity: number;
  critical_level: number;
  status: 'Available' | 'Critical';
  is_serialized?: boolean;
}

interface LocationStock {
  location: string;
  quantity: number;
  brand_new_qty?: number;
  used_qty?: number;
  defective_qty?: number;
  disposal_qty?: number;
}

interface TransferHistory {
  id: string;
  req_no: string;
  transfer_date: string;
  from_location: string;
  to_location: string;
  transferred_by: string;
  items: any[];
  program: string;
}

interface InventoryProps {
  onNavigate: (viewId: string, params?: any) => void;
  initialView?: 'list' | 'transfer';
  autoOpenTransfer?: boolean;
  isDarkMode?: boolean;
  userRole?: string | null;
}

const Inventory: React.FC<InventoryProps> = ({ 
  onNavigate, 
  initialView = 'list', 
  autoOpenTransfer = false, 
  isDarkMode = false,
  userRole = 'Staff'
}) => {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [conditionFilter, setConditionFilter] = useState('All Conditions');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [allLocationStocks, setAllLocationStocks] = useState<any[]>([]);
  const [isLocFilterOpen, setIsLocFilterOpen] = useState(false);
  const [isCondFilterOpen, setIsCondFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [transferCurrentPage, setTransferCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(20);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<'item_code' | 'item_name'>('item_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Modal states
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [locationStocks, setLocationStocks] = useState<LocationStock[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [expandedLoc, setExpandedLoc] = useState<string | null>(null);
  
  // New Modal States
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSerialViewModalOpen, setIsSerialViewModalOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedReqNo, setSelectedReqNo] = useState<string | null>(null);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'transfer'>(initialView);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [expandedSerials, setExpandedSerials] = useState<{ [key: string]: boolean }>({});
  const [poMatchItemCodes, setPoMatchItemCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!isHistoryModalOpen) {
      setExpandedSerials({});
    }
  }, [isHistoryModalOpen]);

  useEffect(() => {
    setViewMode(initialView);
    if (autoOpenTransfer) {
      setIsTransferModalOpen(true);
    }
  }, [initialView, autoOpenTransfer]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, locationFilter, conditionFilter]);

  useEffect(() => {
    setTransferCurrentPage(1);
  }, [viewMode]);

  const fetchHistoryLogs = useCallback(async (reqNo: string) => {
    if (!isSupabaseConfigured) return;
    setLoadingHistory(true);
    setSelectedReqNo(reqNo);
    try {
      const { data, error } = await supabase
        .from('transfer_requests')
        .select('*')
        .eq('req_no', reqNo)
        .order('id', { ascending: false });

      if (error) throw error;

      // Fetch serials for this request
      const { data: serialData } = await supabase
        .from('item_serials')
        .select('serial_number, item_code')
        .eq('request_id', reqNo);

      const logsWithSerials = (data || []).map(log => {
        const itemSerials = serialData?.filter(s => s.item_code === log.item_code).map(s => s.serial_number) || [];
        return { ...log, serial_numbers: itemSerials };
      });

      setHistoryLogs(logsWithSerials);
      setIsHistoryModalOpen(true);
    } catch (err) {
      console.error('Error fetching history logs:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchInventoryData = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);

    try {
      const { data: equipData, error: equipError } = await supabase
        .from('equipment')
        .select('item_code, is_serialized');

      const { data: locStocksData, error: locStocksError } = await supabase
        .from('item_location_stocks')
        .select('*');

      const { data, error } = await supabase
        .from('view_inventory_summary')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (locStocksData) {
        setAllLocationStocks(locStocksData);
        const uniqueLocs = Array.from(new Set(locStocksData.map(l => l.location.trim()))).sort();
        setAvailableLocations(uniqueLocs);
      }

      if (error) throw error;
      if (data) {
        // Map data to calculate status dynamically based on critical_level and add is_serialized
        const mappedData = data
          .map((item: any) => {
            const equip = equipData?.find(e => e.item_code === item.item_code);
            return {
              ...item,
              status: item.total_quantity <= (item.critical_level || 0) ? 'Critical' : 'Available',
              is_serialized: equip?.is_serialized || false
            };
          })
          .filter((item: any) => item.total_quantity > 0);
        setInventoryData(mappedData);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [sortField, sortDirection]);

  const fetchTransferRequests = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingTransfers(true);
    try {
      const { data, error } = await supabase
        .from('transfer_history')
        .select('*')
        .order('transfer_date', { ascending: false });

      if (error) {
        console.warn('Error fetching transfer history:', error.message);
        // Fallback to empty if table doesn't exist yet
        setTransferHistory([]);
        return;
      }

      if (data && data.length > 0) {
        const reqNos = data.map(r => r.req_no);
        const { data: serialData } = await supabase
          .from('item_serials')
          .select('serial_number, request_id')
          .in('request_id', reqNos);
        
        const transfersWithSerials = data.map(req => ({
          ...req,
          serial_numbers: serialData?.filter(s => s.request_id === req.req_no).map(s => s.serial_number) || []
        }));
        setTransferHistory(transfersWithSerials);
      } else {
        setTransferHistory([]);
      }
    } catch (err) {
      console.error('Error fetching transfer history:', err);
    } finally {
      setLoadingTransfers(false);
    }
  }, []);

  const fetchLocationBreakdown = useCallback(async (itemCode: string) => {
    setLoadingLocations(true);
    setExpandedLoc(null);
    try {
      const { data, error } = await supabase
        .from('item_location_stocks')
        .select('location, quantity, brand_new_qty, used_qty, defective_qty, disposal_qty')
        .eq('item_code', itemCode)
        .order('quantity', { ascending: false });

      if (error) throw error;
      if (data) {
        // Filter out zero quantities and consolidate similar location names
        const consolidated = data.reduce((acc, curr) => {
          if (curr.quantity <= 0) return acc;
          
          const normName = curr.location.toLowerCase().trim().replace(/[\s-]/g, '');
          const existing = acc.find(l => l.location.toLowerCase().trim().replace(/[\s-]/g, '') === normName);
          
          if (existing) {
            existing.quantity += curr.quantity;
            existing.brand_new_qty = (existing.brand_new_qty || 0) + (curr.brand_new_qty || 0);
            existing.used_qty = (existing.used_qty || 0) + (curr.used_qty || 0);
            existing.defective_qty = (existing.defective_qty || 0) + (curr.defective_qty || 0);
            existing.disposal_qty = (existing.disposal_qty || 0) + (curr.disposal_qty || 0);
          } else {
            acc.push({ ...curr });
          }
          return acc;
        }, [] as LocationStock[]);
        
        setLocationStocks(consolidated);
      }
    } catch (err) {
      console.error('Error fetching location breakdown:', err);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    fetchInventoryData(true);
    
    if (viewMode === 'transfer') {
      fetchTransferRequests();
    }
    
    // Real-time subscription
    const channel = supabase
      .channel('inventory-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_location_stocks' },
        () => {
          fetchInventoryData(false);
          // Also refresh breakdown if open
          if (isLocationModalOpen && selectedItem) {
            fetchLocationBreakdown(selectedItem.item_code);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transfer_history' },
        () => fetchTransferRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInventoryData, fetchTransferRequests, fetchLocationBreakdown, isLocationModalOpen, selectedItem, viewMode]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setPoMatchItemCodes([]);
      return;
    }

    const searchTransactions = async () => {
      try {
        // Search in stock_transactions for either PO:PO_NUMBER in reason or just the search query in reason/reference_id
        const { data, error } = await supabase
          .from('stock_transactions')
          .select('item_code')
          .or(`reason.ilike.%${searchQuery}%,reference_id.ilike.%${searchQuery}%`);
        
        if (error) throw error;
        
        if (data) {
          const codes = Array.from(new Set(data.map(d => d.item_code)));
          setPoMatchItemCodes(codes);
        }
      } catch (err) {
        console.error('Error searching transactions for PO:', err);
      }
    };

    const timer = setTimeout(searchTransactions, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredTransfers = useMemo(() => {
    return transferHistory;
  }, [transferHistory]);

  const handleViewLocations = (item: InventoryItem) => {
    setSelectedItem(item);
    fetchLocationBreakdown(item.item_code);
    setIsLocationModalOpen(true);
  };

  const handleAction = (action: string, item: InventoryItem) => {
    setSelectedItem(item);
    
    switch (action) {
      case 'details':
        setIsDetailsModalOpen(true);
        break;
      case 'transfer':
        setIsTransferModalOpen(true);
        break;
      case 'add':
        setIsRestockModalOpen(true);
        break;
      case 'adjust':
        setIsAdjustModalOpen(true);
        break;
    }
  };

  const counts = useMemo(() => {
    return {
      'All Statuses': inventoryData.length,
      'Available': inventoryData.filter(item => item.status === 'Available').length,
      'Critical': inventoryData.filter(item => item.status === 'Critical').length,
    };
  }, [inventoryData]);

  const filteredData = useMemo(() => {
    return inventoryData
      .map(item => {
        // Recalculate quantity based on current filters
        let filteredQty = item.total_quantity;
        
        if (locationFilter !== 'All Locations' || conditionFilter !== 'All Conditions') {
          const itemStocks = allLocationStocks.filter(s => s.item_code === item.item_code);
          
          let sum = 0;
          itemStocks.forEach(s => {
            // If location filter is on, only include that location
            if (locationFilter !== 'All Locations' && s.location !== locationFilter) return;
            
            if (conditionFilter === 'All Conditions') {
              sum += (s.quantity || 0);
            } else if (conditionFilter === 'Brand New') {
              sum += (s.brand_new_qty || 0);
            } else if (conditionFilter === 'Used') {
              sum += (s.used_qty || 0);
            } else if (conditionFilter === 'Defective') {
              sum += (s.defective_qty || 0);
            } else if (conditionFilter === 'Disposal') {
              sum += (s.disposal_qty || 0);
            }
          });
          filteredQty = sum;
        }

        return { 
          ...item, 
          total_quantity: filteredQty,
          // Recalculate status for this specific filtered amount if needed
          status: filteredQty <= (item.critical_level || 0) ? 'Critical' : 'Available'
        };
      })
      .filter(item => {
        const matchesSearch = 
          item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          poMatchItemCodes.includes(item.item_code);
        
        const matchesStatus = 
          statusFilter === 'All Statuses' || 
          item.status === statusFilter;

        // Only show items that have quantity based on filters
        const hasQuantity = item.total_quantity > 0;

        return matchesSearch && matchesStatus && hasQuantity;
      });
  }, [inventoryData, searchQuery, statusFilter, locationFilter, conditionFilter, allLocationStocks]);

  const handleSort = (field: 'item_code' | 'item_name') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const paginatedData = useMemo(() => {
    const effectiveItemsPerPage = itemsPerPage === 'all' ? filteredData.length : itemsPerPage;
    const startIndex = (currentPage - 1) * effectiveItemsPerPage;
    return filteredData.slice(startIndex, startIndex + effectiveItemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === 'all') return 1;
    return Math.ceil(filteredData.length / itemsPerPage);
  }, [filteredData.length, itemsPerPage]);

  const paginatedTransfers = useMemo(() => {
    const effectiveItemsPerPage = itemsPerPage === 'all' ? filteredTransfers.length : itemsPerPage;
    const startIndex = (transferCurrentPage - 1) * effectiveItemsPerPage;
    return filteredTransfers.slice(startIndex, startIndex + effectiveItemsPerPage);
  }, [filteredTransfers, transferCurrentPage, itemsPerPage]);

  const transferTotalPages = useMemo(() => {
    if (itemsPerPage === 'all') return 1;
    return Math.ceil(filteredTransfers.length / itemsPerPage);
  }, [filteredTransfers.length, itemsPerPage]);

  const exportToExcel = async () => {
    if (filteredData.length === 0) return;

    // Fetch all location stocks for breakdown and equipment/transaction info
    let locationBreakdownMap: { [key: string]: { [loc: string]: { brand_new: number, used: number, defective: number, disposal: number } } } = {};
    let serializedMap: { [key: string]: boolean } = {};
    let uomMap: { [key: string]: string } = {};
    let updatedAtMap: { [key: string]: string } = {};
    let updatedByMap: { [key: string]: string } = {};
    let equipmentCreatedAtMap: { [key: string]: string } = {};

    try {
      const itemCodes = filteredData.map(i => i.item_code);
      
      const [locResponse, equipResponse, txResponse] = await Promise.all([
        supabase
          .from('item_location_stocks')
          .select('item_code, location, quantity, brand_new_qty, used_qty, defective_qty, disposal_qty')
          .in('item_code', itemCodes),
        supabase
          .from('equipment')
          .select('item_code, is_serialized, uom, created_at')
          .in('item_code', itemCodes),
        supabase
          .from('stock_transactions')
          .select('item_code, created_at, created_by')
          .in('item_code', itemCodes)
          .order('created_at', { ascending: false })
      ]);

      if (!locResponse.error && locResponse.data) {
        locResponse.data.forEach(row => {
          if (!locationBreakdownMap[row.item_code]) {
            locationBreakdownMap[row.item_code] = {};
          }
          const locName = row.location.trim();
          locationBreakdownMap[row.item_code][locName] = {
            brand_new: row.brand_new_qty || 0,
            used: row.used_qty || 0,
            defective: row.defective_qty || 0,
            disposal: row.disposal_qty || 0
          };
        });
      }

      if (!equipResponse.error && equipResponse.data) {
        equipResponse.data.forEach(row => {
          serializedMap[row.item_code] = row.is_serialized === true || row.is_serialized === 'true';
          uomMap[row.item_code] = row.uom || 'N/A';
          equipmentCreatedAtMap[row.item_code] = row.created_at;
        });
      }

      if (!txResponse.error && txResponse.data) {
        txResponse.data.forEach(row => {
          if (!updatedAtMap[row.item_code]) {
            updatedAtMap[row.item_code] = row.created_at;
            updatedByMap[row.item_code] = row.created_by;
          }
        });
      }
    } catch (err) {
      console.error('Error fetching breakdown for Excel:', err);
    }

    // Headers and Column Config
    const headers = [
      "Item Code", 
      "Item Description", 
      "UOM",
      "Total Qty", 
      "IT Basement - Brand New",
      "IT Basement - Used",
      "IT Basement - Defective",
      "IT Basement - Disposal",
      "Areys Warehouse - Brand New",
      "Areys Warehouse - Used",
      "Areys Warehouse - Defective",
      "Areys Warehouse - Disposal",
      "Project 6 Warehouse - Brand New",
      "Project 6 Warehouse - Used",
      "Project 6 Warehouse - Defective",
      "Project 6 Warehouse - Disposal",
      "Silang Warehouse - Brand New",
      "Silang Warehouse - Used",
      "Silang Warehouse - Defective",
      "Silang Warehouse - Disposal"
    ];

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory');

    // Add headers
    const headerRow = worksheet.addRow(headers);
    
    // Style headers
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }
      };
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add data rows
    filteredData.forEach(item => {
      const itemCode = item.item_code || 'N/A';
      const itemLocs = locationBreakdownMap[itemCode] || {};
      
      const itBasement = itemLocs["IT Basement"] || { brand_new: 0, used: 0, defective: 0, disposal: 0 };
      const areysWarehouse = itemLocs["Areys Warehouse"] || { brand_new: 0, used: 0, defective: 0, disposal: 0 };
      const project6Warehouse = itemLocs["Project 6 Warehouse"] || { brand_new: 0, used: 0, defective: 0, disposal: 0 };
      const silangWarehouse = itemLocs["Silang Warehouse"] || { brand_new: 0, used: 0, defective: 0, disposal: 0 };

      const rowData = [
        itemCode,
        item.item_name || 'N/A',
        uomMap[itemCode] || 'N/A',
        item.total_quantity || 0,
        itBasement.brand_new,
        itBasement.used,
        itBasement.defective,
        itBasement.disposal,
        areysWarehouse.brand_new,
        areysWarehouse.used,
        areysWarehouse.defective,
        areysWarehouse.disposal,
        project6Warehouse.brand_new,
        project6Warehouse.used,
        project6Warehouse.defective,
        project6Warehouse.disposal,
        silangWarehouse.brand_new,
        silangWarehouse.used,
        silangWarehouse.defective,
        silangWarehouse.disposal
      ];

      const row = worksheet.addRow(rowData);
      
      // Style cells and add borders (the "boxes")
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Auto-size columns
    worksheet.columns.forEach((column, i) => {
      let maxLength = headers[i].length + 2;
      column.eachCell && column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength, 50); // Cap width at 50
    });

    // Set page setup for printing
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0, // Dynamic height
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
      }
    };

    // Generate output and trigger download
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `inventory-report-${dateStr}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Critical') {
      return {
        label: 'CRITICAL',
        icon: <AlertTriangle size={12} />,
        style: 'bg-red-500/10 text-red-500 border-red-500/20'
      };
    }
    return {
      label: 'AVAILABLE',
      icon: <CheckCircle2 size={12} />,
      style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    };
  };

  return (
    <div className="w-full h-full overflow-y-auto px-6 lg:px-12 pr-2 animate-in fade-in duration-500 relative">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mt-0 mb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 
              onClick={() => setViewMode('list')}
              className={`text-2xl md:text-3xl font-bold tracking-tight transition-all cursor-pointer ${
                viewMode === 'transfer' 
                  ? 'text-slate-400 dark:text-slate-500 hover:text-brand-orange' 
                  : ''
              }`}
              style={{ color: viewMode === 'list' ? 'var(--brand-header)' : undefined }}
            >
              Inventory
            </h1>
            {viewMode === 'transfer' && (
              <>
                <span className="text-xl md:text-2xl font-medium text-slate-300 dark:text-slate-700">&gt;</span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--brand-header)' }}>
                  Transfer History
                </h1>
              </>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 italic">
            Manage your inventory items and their stock levels across multiple locations.
          </p>
        </div>

        {viewMode === 'list' ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {userRole === 'Super admin' && (
              <button 
                onClick={() => setIsAddStockModalOpen(true)}
                className="px-6 py-3 text-white rounded-lg font-bold uppercase tracking-wider text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: 'var(--brand-accent)',
                  boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)'
                }}
              >
                <Plus size={18} />
                Add Initial Stock
              </button>
            )}

            <button 
              onClick={() => setViewMode('transfer')}
              className={`px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-xs shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 border ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={{ '--hover-text': 'var(--brand-accent)' } as any}
            >
              <ArrowRightLeft size={18} style={{ color: 'var(--brand-accent)' }} />
              <span className="hover:text-[var(--brand-accent)] transition-colors">
                {(userRole === 'Super admin' || userRole === 'Admin' || !userRole) ? 'Transfer Stocks' : 'View Transfer History'}
              </span>
            </button>

            <button 
              onClick={exportToExcel}
              disabled={filteredData.length === 0}
              className={`px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-xs shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 border ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50'
              }`}
            >
              <Download size={18} style={{ color: 'var(--brand-accent)' }} />
              <span>Export Report</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button 
              onClick={() => onNavigate('verified-transfer')}
              className="px-6 py-3 text-white rounded-lg font-bold uppercase tracking-wider text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ 
                backgroundColor: 'var(--brand-accent)',
                boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)'
              }}
            >
              <Plus size={18} />
              New Transfer
            </button>

            <button 
              onClick={() => setViewMode('list')}
              className={`p-3 rounded-lg transition-all border ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 mt-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative group flex-1 lg:flex-none">
            <div 
              className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
            >
              <Search size={18} className="group-hover:scale-110 transition-transform" style={{ color: 'var(--brand-accent)' }} />
            </div>
            <input 
              type="text" 
              placeholder={viewMode === 'list' ? "Search item code or name..." : "Search transfer req no or program..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-11 pr-4 py-3 w-full lg:w-80 border rounded-xl focus:outline-none focus:ring-4 transition-all font-medium text-sm ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
              }`}
              style={{ 
                '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)',
                borderColor: searchQuery ? 'var(--brand-accent)' : undefined
              } as any}
            />
          </div>

          {viewMode === 'list' ? (
            <>
              <div className="relative flex-1 lg:flex-none">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`w-full px-5 py-3 rounded-lg border transition-all flex items-center justify-between lg:justify-start gap-3 text-xs font-bold tracking-wider shadow-sm ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={16} style={{ color: 'var(--brand-accent)' }} />
                  {statusFilter === 'All Statuses' ? 'STATUS: ALL' : `STATUS: ${statusFilter.toUpperCase()}`}
                  <ChevronRight className={`ml-auto transition-transform duration-300 ${isFilterOpen ? 'rotate-90' : ''}`} size={14} />
                </button>
                
                {isFilterOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-full sm:w-64 rounded-lg shadow-xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 border ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    {['All Statuses', 'Available', 'Critical'].map((status) => {
                      const isActive = statusFilter === status;
                      return (
                        <button 
                          key={status}
                          onClick={() => { setStatusFilter(status); setIsFilterOpen(false); }}
                          className={`w-full text-left px-6 py-3 text-xs font-semibold tracking-wider transition-all flex items-center gap-3 group
                            ${isActive ? (isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900') : (isDarkMode ? 'text-slate-400' : 'text-slate-500') + ' hover:bg-white/5'}
                          `}
                          style={!isActive ? { '--hover-color': 'var(--brand-accent)' } as any : {}}
                        >
                          <div 
                            className={`w-2 h-2 rounded-full shrink-0 ${status === 'Critical' ? 'bg-red-500' : status === 'Available' ? 'bg-emerald-500' : ''}`}
                            style={status === 'All Statuses' ? { backgroundColor: 'var(--brand-accent)' } : {}}
                          />
                          <span className="flex-grow">{status}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Location Filter */}
              <div className="relative flex-1 lg:flex-none">
                <button 
                  onClick={() => setIsLocFilterOpen(!isLocFilterOpen)}
                  className={`w-full px-5 py-3 rounded-lg border transition-all flex items-center justify-between lg:justify-start gap-3 text-xs font-bold tracking-wider shadow-sm ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <MapPin size={16} style={{ color: 'var(--brand-accent)' }} />
                  {locationFilter === 'All Locations' ? 'LOCATION: ALL' : `LOCATION: ${locationFilter.toUpperCase()}`}
                  <ChevronRight className={`ml-auto transition-transform duration-300 ${isLocFilterOpen ? 'rotate-90' : ''}`} size={14} />
                </button>
                
                {isLocFilterOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-full sm:w-64 rounded-lg shadow-xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 border ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    <button 
                      onClick={() => { setLocationFilter('All Locations'); setIsLocFilterOpen(false); }}
                      className={`w-full text-left px-6 py-3 text-xs font-semibold tracking-wider transition-all flex items-center gap-3 group
                        ${locationFilter === 'All Locations' ? (isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900') : (isDarkMode ? 'text-slate-400' : 'text-slate-500') + ' hover:bg-white/5'}
                      `}
                    >
                      <MapPin size={14} style={{ color: 'var(--brand-accent)' }} />
                      <span>All Locations</span>
                    </button>
                    {availableLocations.map((loc) => {
                      const isActive = locationFilter === loc;
                      return (
                        <button 
                          key={loc}
                          onClick={() => { setLocationFilter(loc); setIsLocFilterOpen(false); }}
                          className={`w-full text-left px-6 py-3 text-xs font-semibold tracking-wider transition-all flex items-center gap-3 group
                            ${isActive ? (isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900') : (isDarkMode ? 'text-slate-400' : 'text-slate-500') + ' hover:bg-white/5'}
                          `}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0 bg-slate-300 dark:bg-slate-600" />
                          <span className="flex-grow">{loc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Condition Filter */}
              <div className="relative flex-1 lg:flex-none">
                <button 
                  onClick={() => setIsCondFilterOpen(!isCondFilterOpen)}
                  className={`w-full px-5 py-3 rounded-lg border transition-all flex items-center justify-between lg:justify-start gap-3 text-xs font-bold tracking-wider shadow-sm ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Activity size={16} style={{ color: 'var(--brand-accent)' }} />
                  {conditionFilter === 'All Conditions' ? 'CONDITION: ALL' : `CONDITION: ${conditionFilter.toUpperCase()}`}
                  <ChevronRight className={`ml-auto transition-transform duration-300 ${isCondFilterOpen ? 'rotate-90' : ''}`} size={14} />
                </button>
                
                {isCondFilterOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-full sm:w-64 rounded-lg shadow-xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 border ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  }`}>
                    {['All Conditions', 'Brand New', 'Used', 'Defective', 'Disposal'].map((cond) => {
                      const isActive = conditionFilter === cond;
                      return (
                        <button 
                          key={cond}
                          onClick={() => { setConditionFilter(cond); setIsCondFilterOpen(false); }}
                          className={`w-full text-left px-6 py-3 text-xs font-semibold tracking-wider transition-all flex items-center gap-3 group
                            ${isActive ? (isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900') : (isDarkMode ? 'text-slate-400' : 'text-slate-500') + ' hover:bg-white/5'}
                          `}
                        >
                          <div 
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              cond === 'Brand New' ? 'bg-emerald-500' : 
                              cond === 'Used' ? 'bg-blue-500' : 
                              cond === 'Defective' ? 'bg-orange-500' : 
                              cond === 'Disposal' ? 'bg-red-500' : 'bg-slate-300'
                            }`}
                          />
                          <span className="flex-grow">{cond}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reset Filters */}
              {(statusFilter !== 'All Statuses' || locationFilter !== 'All Locations' || conditionFilter !== 'All Conditions' || searchQuery !== '') && (
                <button
                  onClick={() => {
                    setStatusFilter('All Statuses');
                    setLocationFilter('All Locations');
                    setConditionFilter('All Conditions');
                    setSearchQuery('');
                  }}
                  className="px-5 py-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-bold tracking-wider hover:bg-red-100 dark:hover:bg-red-900/20 transition-all flex items-center gap-2 flex-1 lg:flex-none justify-center"
                  title="Clear all filters and search"
                >
                  <RotateCcw size={16} />
                  RESET ALL
                </button>
              )}
            </>
          ) : (
            searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-5 py-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-bold tracking-wider hover:bg-red-100 dark:hover:bg-red-900/20 transition-all flex items-center gap-2 flex-1 lg:flex-none justify-center"
              >
                <RotateCcw size={16} />
                CLEAR SEARCH
              </button>
            )
          )}
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
        <div className={`w-full rounded-lg shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin" style={{ color: 'var(--brand-accent)' }} size={48} />
            <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Loading Inventory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                  <th 
                    className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-400 text-left cursor-pointer group"
                    onClick={() => handleSort('item_code')}
                  >
                    <div className="flex items-center gap-2">
                      Item Code
                      <div className={`transition-all duration-300 ${sortField === 'item_code' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                        {sortField === 'item_code' && sortDirection === 'desc' ? <ArrowDown size={14} style={{ color: 'var(--brand-accent)' }} /> : <ArrowUp size={14} style={{ color: 'var(--brand-accent)' }} />}
                      </div>
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-400 text-left cursor-pointer group"
                    onClick={() => handleSort('item_name')}
                  >
                    <div className="flex items-center gap-2">
                      Item Description
                      <div className={`transition-all duration-300 ${sortField === 'item_name' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                        {sortField === 'item_name' && sortDirection === 'desc' ? <ArrowDown size={14} style={{ color: 'var(--brand-accent)' }} /> : <ArrowUp size={14} style={{ color: 'var(--brand-accent)' }} />}
                      </div>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-400 text-center">Total Qty</th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-400 text-center">Locations</th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-400 text-center">Status</th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-400 text-right pr-10">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {paginatedData.map((item, i) => {
                  const badge = getStatusBadge(item.status);
                  const isCritical = item.status === 'Critical';
                  
                  return (
                    <tr 
                      key={`${item.item_code}-${i}`} 
                      className={`group animate-ease-in-down transition-all duration-200 border-l-4 border-transparent hover:-translate-y-[2px] hover:shadow-lg ${
                        isCritical ? (isDarkMode ? 'bg-red-500/5' : 'bg-red-50/50') : ''
                      } ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                      style={{ 
                        animationDelay: `${i * 50}ms`,
                        borderLeftColor: 'color-mix(in srgb, var(--brand-accent), transparent 50%)' 
                      }}
                    >
                      <td className="px-6 py-4 text-left">
                        <span className={`text-sm font-black tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.item_code}</span>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center gap-3">
                          <Box size={16} style={{ color: 'var(--brand-accent)' }} />
                          <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.item_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-base font-bold ${isCritical ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.total_quantity}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <button 
                            onClick={() => handleViewLocations(item)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all border ${
                              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <MapPin size={12} />
                            VIEW LOCATIONS
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <button 
                            onClick={(e) => {
                              if (isCritical) {
                                e.stopPropagation();
                                setSelectedItem(item);
                                setIsReorderModalOpen(true);
                              }
                            }}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full w-fit shadow-sm border transition-all duration-300 ${isCritical ? 'cursor-pointer group-hover:scale-110' : ''} ${badge.style}`}
                          >
                             {badge.icon}
                             <span className="text-[10px] font-bold tracking-widest">{badge.label}</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right pr-10">
                        <div className="flex items-center justify-end gap-2 text-white">
                          <button 
                            onClick={() => handleAction('details', item)}
                            title="Transaction History"
                            className={`p-2 rounded-xl transition-all shadow-sm ${
                              isDarkMode 
                                ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-[#FE4E02]' 
                                : 'bg-slate-50 text-slate-400 hover:text-white hover:bg-[#FE4E02]'
                            }`}
                          >
                            <History size={18} />
                          </button>

                          {item.is_serialized && (
                            <button 
                              onClick={() => {
                                setSelectedItem(item);
                                setIsSerialViewModalOpen(true);
                              }}
                              title="View Serial Numbers"
                              className={`p-2 rounded-xl transition-all shadow-sm ${
                                isDarkMode 
                                  ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-brand-orange' 
                                  : 'bg-slate-50 text-slate-400 hover:text-white hover:bg-brand-orange'
                              }`}
                            >
                              <Eye size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredData.length === 0 && !loading && (
              <div className={`flex-grow flex flex-col items-center justify-center py-40 px-6 text-center ${isDarkMode ? 'opacity-10' : 'opacity-20'}`}>
                 <Activity size={120} strokeWidth={1} className={`mb-8 ${isDarkMode ? 'text-white' : ''}`} />
                 <p className={`text-lg font-bold uppercase tracking-[0.5em] ${isDarkMode ? 'text-white' : ''}`}>{toTitleCase('No Inventory Records Found')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination - Inventory List */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 mb-2 gap-4">
        <div className="flex items-center gap-4">
          <div className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {itemsPerPage === 'all' ? (
              `Showing all ${filteredData.length} records`
            ) : (
              `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, filteredData.length)} of ${filteredData.length} records`
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Display:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
                setItemsPerPage(val as number | 'all');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold border outline-none transition-all ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-300 focus:border-[#FE4E02]' 
                  : 'bg-white border-slate-200 text-slate-600 focus:border-[#FE4E02]'
              }`}
            >
              {[20, 50, 100, 300, 500].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
              <option value="all">All</option>
            </select>
          </div>
        </div>
        
        {totalPages > 1 && itemsPerPage !== 'all' && (
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className={`p-2 rounded-lg border transition-all ${
                currentPage === 1 
                  ? 'opacity-30 cursor-not-allowed' 
                  : (isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
              }`}
            >
              <ChevronDown size={18} className="rotate-90" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === pageNum
                          ? 'text-white'
                          : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')
                      }`}
                      style={currentPage === pageNum ? { backgroundColor: 'var(--brand-accent)' } : {}}
                    >
                      {pageNum}
                    </button>
                  );
                } else if ((pageNum === 2 && currentPage > 3) || (pageNum === totalPages - 1 && currentPage < totalPages - 2)) {
                  return <span key={pageNum} className="text-slate-400">...</span>;
                }
                return null;
              })}
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className={`p-2 rounded-lg border transition-all ${
                currentPage === totalPages 
                  ? 'opacity-30 cursor-not-allowed' 
                  : (isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
              }`}
            >
              <ChevronDown size={18} className="-rotate-90" />
            </button>
          </div>
        )}
      </div>

      {/* Location Breakdown Modal */}
      {isLocationModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setIsLocationModalOpen(false)} />
          <div className={`relative w-full max-w-xl rounded-[2.5rem] shadow-2xl border-2 border-brand-orange p-10 animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Location Breakdown</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{selectedItem.item_name}</p>
              </div>
              <button onClick={() => setIsLocationModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={28} />
              </button>
            </div>

            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {loadingLocations ? (
                <div className="flex flex-col items-center py-16 gap-4">
                  <Loader2 className="animate-spin text-brand-orange" size={40} />
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Loading Locations...</p>
                </div>
              ) : locationStocks.length > 0 ? (
                locationStocks.map((stock, idx) => (
                  <div 
                    key={idx} 
                    className={`p-6 rounded-3xl border transition-all ${
                      isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50/50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-brand-orange/20' : 'bg-brand-orange/10'}`}>
                          <MapPin size={20} className="text-brand-orange" />
                        </div>
                        <span className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{stock.location}</span>
                      </div>
                      <div className="px-4 py-1.5 bg-brand-orange rounded-full shadow-lg shadow-brand-orange/20">
                         <span className="text-sm font-black text-white">{stock.quantity} <span className="text-[10px] opacity-70 ml-1 uppercase">TOTAL</span></span>
                      </div>
                    </div>

                    <div className={`grid grid-cols-4 gap-2 p-1 rounded-2xl ${isDarkMode ? 'bg-slate-900/50' : 'bg-white'} border border-slate-100 dark:border-slate-800`}>
                      {[
                        { label: 'Brand New', value: stock.brand_new_qty, color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
                        { label: 'Used', value: stock.used_qty, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                        { label: 'Defective', value: stock.defective_qty, color: 'text-amber-500', bg: 'bg-amber-500/5' },
                        { label: 'Disposal', value: stock.disposal_qty, color: 'text-red-500', bg: 'bg-red-500/5' }
                      ].map((cond, cIdx) => (
                        <div key={cond.label} className={`flex flex-col items-center justify-center py-4 rounded-xl ${cond.bg}`}>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{cond.label}</p>
                          <p className={`text-lg font-black ${cond.color}`}>{cond.value || 0}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 opacity-30">
                  <MapPin size={64} className="mx-auto mb-4" />
                  <p className="text-sm font-bold uppercase tracking-[0.3em]">No Location Data</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsLocationModalOpen(false)}
              className="w-full mt-10 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-3xl font-black uppercase tracking-[0.25em] text-xs hover:bg-brand-orange hover:text-white transition-all shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reorder Reminder Modal */}
      {isReorderModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setIsReorderModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-[2rem] shadow-2xl border-2 ${isDarkMode ? 'border-red-500/50' : 'border-red-500'} p-8 animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black tracking-tight font-poppins">Critical Stock Alert</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedItem.item_name}</p>
              </div>
              <button onClick={() => setIsReorderModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className={`p-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-4 ${
              isDarkMode ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-100'
            }`}>
              <div className="w-16 h-16 shrink-0 rounded-full bg-red-500 flex items-center justify-center text-white shadow-xl shadow-red-500/30 mb-2">
                <AlertTriangle size={32} />
              </div>
              <div className="max-w-[240px]">
                <p className={`text-base font-bold leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Stock is below critical level (<span className="text-red-500 font-black">{selectedItem.critical_level}</span>)
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
               <button 
                onClick={() => {
                  setIsReorderModalOpen(false);
                  onNavigate('requests', { prefillItem: selectedItem.item_name, prefillCode: selectedItem.item_code });
                }}
                className="flex-grow py-4 bg-brand-orange text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl shadow-brand-orange/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <ShoppingCart size={16} />
                Create Request
              </button>
              <button 
                onClick={() => setIsReorderModalOpen(false)}
                className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      <AddStockModal 
        isOpen={isAddStockModalOpen}
        onClose={() => setIsAddStockModalOpen(false)}
        onSuccess={() => fetchInventoryData(false)}
        isDarkMode={isDarkMode}
      />

      {/* Action Modals */}
      {selectedItem && (
        <>
          <InventoryDetailsModal 
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            onUpdate={() => {
              fetchInventoryData(false);
              if (selectedItem) {
                fetchLocationBreakdown(selectedItem.item_code);
              }
            }}
            item={selectedItem}
            isDarkMode={isDarkMode}
            userRole={userRole}
          />
          <SerialNumbersViewModal
            isOpen={isSerialViewModalOpen}
            onClose={() => setIsSerialViewModalOpen(false)}
            item={selectedItem}
            isDarkMode={isDarkMode}
          />
          <StockTransferModal 
            isOpen={isTransferModalOpen}
            onClose={() => {
              setIsTransferModalOpen(false);
              onNavigate('inventory', { openTransfer: false });
            }}
            onSuccess={() => {
              fetchInventoryData(false);
              fetchTransferRequests();
              if (selectedItem) {
                fetchLocationBreakdown(selectedItem.item_code);
              }
            }}
            item={selectedItem || undefined}
            isDarkMode={isDarkMode}
          />
          <StockAdjustmentModal 
            isOpen={isRestockModalOpen}
            onClose={() => setIsRestockModalOpen(false)}
            onSuccess={() => {
              fetchInventoryData(false);
              if (selectedItem) {
                fetchLocationBreakdown(selectedItem.item_code);
              }
            }}
            item={selectedItem}
            mode="add"
            isDarkMode={isDarkMode}
          />
          <StockAdjustmentModal 
            isOpen={isAdjustModalOpen}
            onClose={() => setIsAdjustModalOpen(false)}
            onSuccess={() => {
              fetchInventoryData(false);
              if (selectedItem) {
                fetchLocationBreakdown(selectedItem.item_code);
              }
            }}
            item={selectedItem}
            mode="adjust"
            isDarkMode={isDarkMode}
          />
        </>
      )}
      </>
    ) : (
      <div className="animate-in slide-in-from-right-4 duration-500">
      {/* Transfer History Table */}
      <div className={`p-8 pt-6 rounded-[2rem] border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <th className="pb-4 pl-4 text-[11px] font-semibold text-gray-700 dark:text-slate-400 uppercase tracking-wider">Date Transferred</th>
                <th className="pb-4 text-[11px] font-semibold text-gray-700 dark:text-slate-400 uppercase tracking-wider">From Location To Location</th>
                <th className="pb-4 text-[11px] font-semibold text-gray-700 dark:text-slate-400 uppercase tracking-wider">Transfer By</th>
                <th className="pb-4 pr-4 text-right text-[11px] font-semibold text-gray-700 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {loadingTransfers ? (
                <tr>
                  <td colSpan={4} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Loader2 size={32} className="animate-spin text-brand-orange" />
                      <span className="text-xs font-bold uppercase tracking-widest">Loading history...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransfers.length > 0 ? (
                paginatedTransfers.map((req) => (
                  <tr key={req.id} className={`group hover:bg-brand-orange/5 transition-all ${
                    isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                  }`}>
                        <td className="py-5 pl-4">
                          <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {new Date(req.transfer_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-amber-500" />
                              <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{req.from_location}</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-300" />
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-emerald-500" />
                              <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{req.to_location}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-brand-orange/10 flex items-center justify-center text-[10px] font-black text-[#FE4E02]">
                               {req.transferred_by?.charAt(0).toUpperCase()}
                             </div>
                             <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{req.transferred_by}</span>
                          </div>
                        </td>
                        <td className="py-5 pr-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              onClick={() => fetchHistoryLogs(req.req_no)}
                              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#FE4E02] hover:text-white rounded-xl text-[10px] font-black tracking-widest transition-all"
                            >
                              <Eye size={14} />
                              VIEW LIST
                            </button>
                            {((userRole === 'Super admin' || (!userRole)) || (userRole === 'Admin' && (!req.req_no.startsWith('INIT-')))) && (
                              <button 
                                className={`p-2 rounded-xl transition-all bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-[#FE4E02] hover:text-white`}
                              >
                                <Settings2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <Box size={48} className="text-slate-400" />
                      <p className="text-sm font-bold uppercase tracking-[0.2em] italic">No Transfer History Records</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination - Transfer History */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 mt-4 gap-4">
          <div className="flex items-center gap-4">
            <div className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {itemsPerPage === 'all' ? (
                `Showing all ${filteredTransfers.length} records`
              ) : (
              `Showing ${((transferCurrentPage - 1) * (itemsPerPage === 'all' ? filteredTransfers.length : itemsPerPage)) + 1} to ${Math.min(transferCurrentPage * (itemsPerPage === 'all' ? filteredTransfers.length : itemsPerPage), filteredTransfers.length)} of ${filteredTransfers.length} records`
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Display:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
                  setItemsPerPage(val as number | 'all');
                  setTransferCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border outline-none transition-all ${
                  isDarkMode 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 focus:border-[#FE4E02]' 
                    : 'bg-white border-slate-200 text-slate-600 focus:border-[#FE4E02]'
                }`}
              >
                {[20, 50, 100, 300, 500].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {transferTotalPages > 1 && itemsPerPage !== 'all' && !loadingTransfers && (
            <div className="flex items-center gap-2">
              <button
                disabled={transferCurrentPage === 1}
                onClick={() => setTransferCurrentPage(prev => prev - 1)}
                className={`p-2 rounded-lg border transition-all ${
                  transferCurrentPage === 1 
                    ? 'opacity-30 cursor-not-allowed' 
                    : (isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
                }`}
              >
                <ChevronDown size={18} className="rotate-90" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(transferTotalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === transferTotalPages || (pageNum >= transferCurrentPage - 1 && pageNum <= transferCurrentPage + 1)) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setTransferCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          transferCurrentPage === pageNum
                            ? 'text-white'
                            : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')
                        }`}
                        style={transferCurrentPage === pageNum ? { backgroundColor: 'var(--brand-accent)' } : {}}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if ((pageNum === 2 && transferCurrentPage > 3) || (pageNum === transferTotalPages - 1 && transferCurrentPage < transferTotalPages - 2)) {
                    return <span key={pageNum} className="text-slate-400">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                disabled={transferCurrentPage === transferTotalPages}
                onClick={() => setTransferCurrentPage(prev => prev + 1)}
                className={`p-2 rounded-lg border transition-all ${
                  transferCurrentPage === transferTotalPages 
                    ? 'opacity-30 cursor-not-allowed' 
                    : (isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
                }`}
              >
                <ChevronDown size={18} className="-rotate-90" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )}
      {/* Transaction History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity" onClick={() => setIsHistoryModalOpen(false)} />
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border-2 border-emerald-500 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <History size={24} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Transfer Details</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ">Transfer ID: {selectedReqNo}</p>
                      {historyLogs.length > 0 && historyLogs[0].attachment && (
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                           <div className="flex items-center gap-1.5 group">
                              <Paperclip size={12} className="text-brand-orange" />
                              <div className="flex gap-2">
                                {historyLogs[0].attachment.split(',').map((url: string, idx: number) => (
                                  <a 
                                    key={idx}
                                    href={url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-[10px] font-black text-brand-orange hover:underline uppercase tracking-tighter"
                                  >
                                    Doc #{idx + 1}
                                  </a>
                                ))}
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className={`rounded-[2rem] border overflow-hidden shadow-sm ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'} border-b`}>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Item Details</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic text-center">Qty</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Source → Destination</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-inherit">
                      {loadingHistory ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 opacity-20" />
                          </td>
                        </tr>
                      ) : historyLogs.length > 0 ? (
                        historyLogs.flatMap((log: any) => 
                          (log.items || [{ item_name: log.item_name || 'N/A', item_code: log.item_code, quantity: log.quantity }]).map((item: any, idx: number) => (
                            <tr key={`${log.id}-${idx}`} className={`${isDarkMode ? 'hover:bg-slate-800/30 border-slate-800/50' : 'hover:bg-slate-50/50 border-slate-50'} transition-colors`}>
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                                    {item.item_name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">{item.item_code}</span>
                                  
                                  {/* Toggleable serials for transfer details */}
                                  {log.serial_numbers && log.serial_numbers.length > 0 && (
                                    <div className="mt-2">
                                      <button
                                        onClick={() => setExpandedSerials(prev => ({ ...prev, [`${log.id}-${idx}`]: !prev[`${log.id}-${idx}`] }))}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all"
                                      >
                                        <Box size={10} />
                                        {expandedSerials[`${log.id}-${idx}`] ? 'Hide' : 'View'} {log.serial_numbers.length} Serials
                                      </button>
                                      
                                      {expandedSerials[`${log.id}-${idx}`] && (
                                        <div className="mt-1.5 flex flex-wrap gap-1 p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                          {log.serial_numbers.map((sn: string) => (
                                            <span key={sn} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded text-[8px] font-mono font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
                                              {sn}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center">
                                <span className="text-sm font-black text-brand-orange">{item.quantity}</span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{log.from_location}</span>
                                  <ChevronRight size={10} className="text-slate-300" />
                                  <span className={`text-xs font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{log.to_location}</span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic font-bold uppercase tracking-widest text-xs">
                             No transfer items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Transfer Modal */}
      <ProcessTransferModal
        isOpen={isProcessModalOpen}
        onClose={() => {
          setIsProcessModalOpen(false);
          fetchTransferRequests();
        }}
        reqNo={selectedReqNo || ''}
        onNavigate={onNavigate}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default Inventory;
