
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, School, Plus, Loader2, ArrowUp, X, Check, Edit3, Filter, ChevronDown, CheckSquare, Square, Download, Activity, Clock, Users, Upload, FileSpreadsheet, Eye, Info, AlertCircle, FileUp, ShieldCheck, MapPin, Zap } from 'lucide-react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { toTitleCase } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface SchoolRecord {
  id: string;
  name: string;
  location?: string;
  customer_code?: string;
  sales_team?: string;
  is_buffer: boolean;
  created_at: string;
}

interface SchoolsProps {
  isDarkMode?: boolean;
  userRole?: string | null;
}

const Schools: React.FC<SchoolsProps> = ({ isDarkMode = false, userRole = 'Staff' }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [editingSchool, setEditingSchool] = useState<SchoolRecord | null>(null);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCustomerCode, setNewCustomerCode] = useState('');
  const [newSalesTeam, setNewSalesTeam] = useState('');
  const [salesTeamSearch, setSalesTeamSearch] = useState('');
  const [isSalesTeamDropdownOpen, setIsSalesTeamDropdownOpen] = useState(false);
  const salesTeamDropdownRef = useRef<HTMLDivElement>(null);
  const [isBuffer, setIsBuffer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(20);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Import States
  const [dragActive, setDragActive] = useState(false);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (salesTeamDropdownRef.current && !salesTeamDropdownRef.current.contains(event.target as Node)) {
        setIsSalesTeamDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSalesTeams = useMemo(() => {
    const teams = new Set<string>();
    schools.forEach(s => {
      if (s.sales_team && s.sales_team.trim()) {
        teams.add(s.sales_team.trim());
      }
    });
    return Array.from(teams).sort((a, b) => a.localeCompare(b));
  }, [schools]);

  const filteredSalesTeams = useMemo(() => {
    if (!salesTeamSearch) return allSalesTeams;
    return allSalesTeams.filter(team => 
      team.toLowerCase().includes(salesTeamSearch.toLowerCase())
    );
  }, [salesTeamSearch, allSalesTeams]);

  const fetchSchools = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setSchools(data as SchoolRecord[]);
    } catch (err) {
      console.error('Error fetching schools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools(true);

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('schools-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, () => fetchSchools(false))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchSchools]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollTop(containerRef.current.scrollTop > 300);
      }
    };
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  // CSV Parsing Logic
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportError("Please upload a valid CSV file.");
      return;
    }
    setImportedFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length < 1) {
        setImportError("CSV file appears to be empty.");
        return;
      }

      const headerRow = rows[0];
      const headers = headerRow.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('school') || h.includes('name'));
      const locIdx = headers.findIndex(h => h.includes('location'));
      const codeIdx = headers.findIndex(h => h.includes('code'));
      const salesIdx = headers.findIndex(h => h.includes('sales') || h.includes('team'));

      if (nameIdx === -1) {
        setImportError("CSV must contain a 'School' column.");
        return;
      }

      const seenNames = new Set<string>();
      const data = rows.slice(1).map(row => {
        const columns: string[] = [];
        let current = "";
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            columns.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        columns.push(current.trim());

        const name = columns[nameIdx]?.replace(/^"|"$/g, '').trim() || '';
        const loc = locIdx !== -1 ? columns[locIdx]?.replace(/^"|"$/g, '').trim() || '' : '';
        const code = codeIdx !== -1 ? columns[codeIdx]?.replace(/^"|"$/g, '').trim() || '' : '';
        const sales = salesIdx !== -1 ? columns[salesIdx]?.replace(/^"|"$/g, '').trim() || '' : '';

        if (name && !seenNames.has(name.toUpperCase())) {
          seenNames.add(name.toUpperCase());
          return { name, location: loc, customer_code: code, sales_team: sales };
        }
        return null;
      }).filter((item): item is { name: string, location: string, customer_code: string, sales_team: string } => item !== null);

      if (data.length === 0) {
        setImportError("No valid unique records found in the file.");
      }
      setParsedData(data);
    } catch (err) {
      console.error(err);
      setImportError("Failed to parse CSV file structure.");
    }
  };

  const triggerBulkImport = () => {
    setIsAdding(true);
    setActiveTab('import');
    setEditingSchool(null);
    setImportedFile(null);
    setParsedData([]);
    setIsBuffer(false);
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fileInputRef.current?.click();
    }, 100);
  };

  const handleAddSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    
    try {
      if (activeTab === 'manual') {
        const trimmed = newSchoolName.trim();
        if (!trimmed) throw new Error("School name is required");

        const { error } = await supabase.from('schools').insert([{ 
          name: trimmed, 
          location: newLocation.trim(),
          customer_code: newCustomerCode.trim(),
          sales_team: newSalesTeam.trim(),
          is_buffer: isBuffer 
        }]);
        if (error) {
          if (error.message.includes('unique constraint')) throw new Error("This school already exists.");
          throw error;
        }
      } else {
        if (parsedData.length === 0) throw new Error("No data to import.");
        
        const finalData = parsedData
          .filter(item => item.customer_code && item.customer_code.trim()) // Only import records with customer codes
          .map(item => ({ 
            name: item.name, 
            location: item.location,
            customer_code: item.customer_code.trim(),
            sales_team: item.sales_team,
            is_buffer: false 
          }));

        if (finalData.length === 0) throw new Error("No valid records with customer codes found.");

        const { error } = await supabase.from('schools').upsert(finalData, { onConflict: 'customer_code' });
        if (error) throw error;
        
        showSuccess('Success', `${finalData.length} schools imported successfully`);
      }

      setNewSchoolName('');
      setNewLocation('');
      setNewCustomerCode('');
      setNewSalesTeam('');
      setIsBuffer(false);
      setImportedFile(null);
      setParsedData([]);
      setIsAdding(false);
      if (activeTab === 'manual') {
        showSuccess('Success', 'School registered successfully');
      }
      fetchSchools(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to save school.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSchool = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingSchool || !newSchoolName.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ 
          name: newSchoolName.trim(), 
          location: newLocation.trim(),
          customer_code: newCustomerCode.trim(),
          sales_team: newSalesTeam.trim(),
          is_buffer: isBuffer
        })
        .eq('id', editingSchool.id);
      
      if (error) throw error;
      
      showSuccess('Success', 'School details updated successfully');
      setEditingSchool(null);
      setNewSchoolName('');
      setNewLocation('');
      setNewCustomerCode('');
      setNewSalesTeam('');
      setIsBuffer(false);
      fetchSchools(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to update school.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isSupabaseConfigured) return;
    
    setIsDeleting(true);
    try {
      if (isBulkDeleting) {
        const { error } = await supabase
          .from('schools')
          .delete()
          .in('id', Array.from(selectedIds));
        if (error) throw error;
        showDelete('Deleted', `${selectedIds.size} schools have been removed.`);
        setSelectedIds(new Set());
      } else if (schoolToDelete) {
        const { error } = await supabase
          .from('schools')
          .delete()
          .eq('id', schoolToDelete.id);
        if (error) throw error;
        showDelete('Deleted', 'School has been removed.');
      }
      
      setIsDeleteModalOpen(false);
      await fetchSchools(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete school.');
    } finally {
      setIsDeleting(false);
      setIsBulkDeleting(false);
      setSchoolToDelete(null);
    }
  };

  const triggerBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setSchoolToDelete(null);
    setIsDeleteModalOpen(true);
  };

  const handleSelectAll = () => {
    if (filteredSchools.length === 0) return;
    if (selectedIds.size === filteredSchools.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set<string>();
      filteredSchools.forEach(s => newSelected.add(s.id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const downloadDirectoryCSV = () => {
    const csvContent = "School,Customer Code,Location,Sales Team\n";
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Aralinks_Schools_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (s.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (s.customer_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (s.sales_team || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [schools, searchQuery]);

  const paginatedSchools = useMemo(() => {
    const effectiveItemsPerPage = itemsPerPage === 'all' ? filteredSchools.length : itemsPerPage;
    const startIndex = (currentPage - 1) * effectiveItemsPerPage;
    return filteredSchools.slice(startIndex, startIndex + effectiveItemsPerPage);
  }, [filteredSchools, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === 'all') return 1;
    return Math.ceil(filteredSchools.length / itemsPerPage);
  }, [filteredSchools.length, itemsPerPage]);

  const existingCustomerCodes = useMemo(() => {
    const codes = new Set<string>();
    schools.forEach(s => {
      if (s.customer_code) codes.add(s.customer_code.trim());
    });
    return codes;
  }, [schools]);

  const stats = useMemo(() => {
    const total = schools.length;
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const recent = schools.filter(s => new Date(s.created_at) >= last30Days).length;
    return { total, recent };
  }, [schools]);

  return (
    <>
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full overflow-y-auto pr-2 animate-in fade-in duration-500 relative" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="relative group w-full lg:w-fit">
          <div 
            className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
            style={{ color: 'var(--brand-accent)' }}
          >
            <Search size={18} className="group-hover:scale-110 transition-transform" />
          </div>
          <input 
            type="text" 
            placeholder="Search school registry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-11 pr-4 py-3 w-full lg:w-80 border rounded-lg focus:outline-none focus:ring-2 transition-all font-medium text-sm ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
                : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
            }`}
            style={{ '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)', borderColor: 'var(--brand-accent)' } as any}
          />
        </div>
        
        <div className="flex items-center w-full lg:w-auto gap-3">
          {userRole === 'Super admin' && (
            <button 
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedIds(new Set());
              }}
              className={`w-full lg:w-fit px-4 py-2 rounded-full text-sm font-bold border transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isSelectionMode 
                  ? 'text-white' 
                  : (isDarkMode 
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm')
              }`}
              style={isSelectionMode ? { backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)', boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)' } : {}}
            >
              <CheckSquare size={16} className={isSelectionMode ? 'animate-pulse' : ''} />
              <span>{isSelectionMode ? 'Cancel Selection' : 'Select'}</span>
            </button>
          )}

          {userRole === 'Super admin' && (
            <button 
              disabled={!isSupabaseConfigured || isAdding}
              onClick={() => { 
                setIsAdding(true); 
                setEditingSchool(null); 
                setNewSchoolName(''); 
                setNewLocation(''); 
                setNewCustomerCode('');
                setNewSalesTeam('');
                setIsBuffer(false);
                setActiveTab('manual'); 
                if (formRef.current) {
                  formRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }} 
              className="w-full lg:w-fit text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ 
                backgroundColor: 'var(--brand-accent)',
                boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)'
              }}
            >
              <Plus size={18} /> Register School
            </button>
          )}
        </div>
      </div>

      {(isAdding || editingSchool) && (
        <div ref={formRef} className={`rounded-[1.5rem] md:rounded-[2.0rem] p-6 md:p-8 mb-10 border shadow-3xl animate-in slide-in-from-top-4 duration-500 ${
          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4 md:gap-5">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.2rem] flex items-center justify-center ${
                editingSchool 
                  ? (isDarkMode ? 'bg-[#2563EB]/10 text-[#3B82F6]' : 'bg-[#EFF6FF] text-[#2563EB]') 
                  : (isDarkMode ? 'bg-orange-400/10 text-orange-400' : 'bg-orange-50 text-brand-orange')
              }`}
              style={!editingSchool ? { backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' } : {}}
              >
                {editingSchool ? <Edit3 size={20} md:size={24} /> : <School size={20} md:size={24} />}
              </div>
              <div>
                <h3 className={`text-base md:text-lg font-black tracking-tight mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                  {toTitleCase(editingSchool ? 'Update School Details' : 'Register New School')}
                </h3>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('Operational Directory Management')}</p>
              </div>
            </div>
            {!editingSchool && (
              <div className={`flex p-1 rounded-[1rem] md:rounded-[1.2rem] shadow-lg w-fit ${isDarkMode ? 'bg-slate-900' : 'bg-[#1a1a1a]'}`}>
                <button onClick={() => { setActiveTab('manual'); }} className="px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-bold tracking-widest transition-all" style={activeTab === 'manual' ? { backgroundColor: 'var(--brand-accent)', color: 'white' } : { color: 'rgba(255,255,255,0.4)' }}>{toTitleCase('Manual Entry')}</button>
                <button onClick={() => { setActiveTab('import'); }} className="px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-bold tracking-widest transition-all flex items-center gap-1.5" style={activeTab === 'import' ? { backgroundColor: 'color-mix(in srgb, var(--brand-accent), white 90%)', color: 'var(--brand-accent)' } : { color: 'rgba(255,255,255,0.4)' }}>
                  <Download size={12} />
                  {toTitleCase('Batch Sync')}
                </button>
              </div>
            )}
          </div>

          <form onSubmit={editingSchool ? handleUpdateSchool : handleAddSubmit} className="space-y-5 md:space-y-6">
            {(activeTab === 'manual' || editingSchool) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[11px] font-bold text-slate-400 tracking-[0.2em] px-2">{toTitleCase('Customer Code')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. CUST-001"
                    value={newCustomerCode}
                    onChange={(e) => setNewCustomerCode(e.target.value)}
                    className={`w-full px-4 md:px-5 py-2.5 md:py-3 border rounded-xl md:rounded-[1.2rem] text-sm md:text-base font-bold outline-none transition-all shadow-inner ${
                      isDarkMode 
                        ? 'bg-slate-900 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-emerald-500 focus:ring-emerald-500/5' 
                        : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/5'
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[11px] font-bold text-slate-400 tracking-[0.2em] px-2">{toTitleCase('Official School Name')}</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Saint Jude Catholic School"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    className={`w-full px-4 md:px-5 py-2.5 md:py-3 border rounded-xl md:rounded-[1.2rem] text-sm md:text-base font-bold outline-none transition-all shadow-inner ${
                      isDarkMode 
                        ? 'bg-slate-900 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-[#3B82F6] focus:ring-[#3B82F6]/5' 
                        : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white focus:border-[#2563EB] focus:ring-[#2563EB]/5'
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[11px] font-bold text-slate-400 tracking-[0.2em] px-2">{toTitleCase('Location')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Manila City / Silang"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className={`w-full px-4 md:px-5 py-2.5 md:py-3 border rounded-xl md:rounded-[1.2rem] text-sm md:text-base font-bold outline-none transition-all shadow-inner ${
                      isDarkMode 
                        ? 'bg-slate-900 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-orange-500 focus:ring-orange-500/5' 
                        : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white focus:border-brand-orange focus:ring-brand-orange/5'
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[11px] font-bold text-slate-400 tracking-[0.2em] px-2">{toTitleCase('Sales Team')}</label>
                  <div className="relative" ref={salesTeamDropdownRef}>
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="e.g. Team NCR"
                        value={newSalesTeam}
                        onChange={(e) => {
                          setNewSalesTeam(e.target.value);
                          setSalesTeamSearch(e.target.value);
                          if (!isSalesTeamDropdownOpen) setIsSalesTeamDropdownOpen(true);
                        }}
                        onFocus={() => setIsSalesTeamDropdownOpen(true)}
                        className={`w-full px-4 md:px-5 py-2.5 md:py-3 border rounded-xl md:rounded-[1.2rem] text-sm md:text-base font-bold outline-none transition-all shadow-inner ${
                          isDarkMode 
                            ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-purple-500' 
                            : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-purple-500'
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {newSalesTeam && (
                          <button 
                            type="button"
                            onClick={() => {
                              setNewSalesTeam('');
                              setSalesTeamSearch('');
                            }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <ChevronDown 
                          size={18} 
                          className={`text-slate-400 cursor-pointer transition-transform duration-300 ${isSalesTeamDropdownOpen ? 'rotate-180' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSalesTeamDropdownOpen(!isSalesTeamDropdownOpen);
                          }}
                        />
                      </div>
                    </div>

                    {isSalesTeamDropdownOpen && filteredSalesTeams.length > 0 && (
                      <div className={`absolute z-50 left-0 right-0 mt-2 p-2 border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'
                      }`}>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          <div className="grid grid-cols-1 gap-1">
                            <p className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Existing Teams</p>
                            {filteredSalesTeams.map((team) => (
                              <div
                                key={team}
                                onClick={() => {
                                  setNewSalesTeam(team);
                                  setSalesTeamSearch('');
                                  setIsSalesTeamDropdownOpen(false);
                                }}
                                className={`px-3 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-between group ${
                                  newSalesTeam === team
                                    ? (isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600')
                                    : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-600 hover:bg-slate-50 hover:text-purple-600')
                                }`}
                              >
                                <span>{team}</span>
                                {newSalesTeam === team && <Check size={14} />}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-5 px-2 md:px-4">
                  <button
                    type="button"
                    onClick={() => setIsBuffer(!isBuffer)}
                    className="flex items-center justify-center gap-2.5 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-[1.2rem] font-bold text-[10px] md:text-xs tracking-widest transition-all shadow-lg active:scale-95 border-2 w-full sm:w-fit"
                    style={isBuffer 
                      ? { backgroundColor: 'var(--brand-accent)', color: 'white', borderColor: 'var(--brand-accent)' } 
                      : (isDarkMode 
                          ? { backgroundColor: 'rgb(15 23 42)', color: 'rgb(100 116 139)', borderColor: 'rgb(51 65 85)' } 
                          : { backgroundColor: 'white', color: 'rgb(148 163 184)', borderColor: 'rgb(241 245 249)' })
                    }
                  >
                    {isBuffer ? <Zap size={16} fill="currentColor" /> : <School size={16} />}
                    {toTitleCase(isBuffer ? 'Buffer School Active' : 'Set as Buffer School')}
                  </button>
                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 tracking-widest max-w-full sm:max-w-[180px] leading-relaxed">
                    {toTitleCase('Toggle to mark this partner as a strategic reserve school.')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {!importedFile ? (
                  <div 
                    className={`relative border-2 border-dashed rounded-[3.5rem] p-16 flex flex-col items-center justify-center text-center transition-all cursor-pointer group
                      ${dragActive 
                        ? (isDarkMode ? 'border-[#3B82F6] bg-[#3B82F6]/5' : 'border-[#2563EB] bg-[#EFF6FF]') 
                        : (isDarkMode ? 'border-slate-700 bg-slate-900 hover:border-[#3B82F6]/50 hover:bg-slate-800/50' : 'border-slate-200 bg-slate-50 hover:border-[#2563EB]/50 hover:bg-slate-100/50')
                      }
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                    <div className="w-20 h-20 bg-[#2563EB] text-white rounded-[1.5rem] flex items-center justify-center mb-6 transition-all shadow-2xl shadow-[#2563EB]/20 group-hover:scale-110"><Upload size={40} /></div>
                    <p className={`font-bold text-xl tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{toTitleCase('Drop CSV file here')}</p>
                    <div className="flex flex-col items-center gap-4 mt-2">
                      <p className="text-slate-400 text-[11px] font-bold tracking-widest">{toTitleCase('Required Columns: "School", "Customer Code", "Location", "Sales Team"')}</p>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); downloadDirectoryCSV(); }}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all active:scale-95 group/export ${
                          isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                         <Download size={14} className="text-[#2563EB] group-hover/export:translate-y-0.5 transition-transform" />
                         <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Export CSV Template</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className={`flex items-center justify-between border p-6 rounded-[2rem] shadow-sm ${
                         isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'
                       }`}>
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><FileSpreadsheet size={28} /></div>
                          <div>
                            <p className={`font-bold text-lg tracking-tight truncate max-w-[200px] ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{importedFile.name}</p>
                            <p className="text-emerald-600 text-[10px] font-bold tracking-widest">{parsedData.length} {toTitleCase('records detected')}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => { setImportedFile(null); setParsedData([]); }} className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={24} /></button>
                      </div>

                      <div className={`flex items-center gap-6 px-8 py-6 rounded-[2rem] border shadow-inner group transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}>
                         <div className="w-12 h-12 rounded-[1.25rem] border-2 border-emerald-500 bg-emerald-500 text-white flex items-center justify-center shadow-md">
                            <ShieldCheck size={24} />
                         </div>
                          <div className="flex flex-col">
                             <span className={`text-[14px] font-bold tracking-widest ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{toTitleCase('Import Policy')}</span>
                             <p className="text-[11px] font-bold text-emerald-600 tracking-wider">
                                {toTitleCase('ALL IMPORTED SCHOOLS ARE ACTIVE')}
                             </p>
                          </div>
                      </div>
                    </div>

                    <div className={`rounded-[2.5rem] border overflow-hidden shadow-inner ${
                      isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div className={`px-8 py-5 border-b flex items-center justify-between ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-slate-100'
                      }`}>
                        <div className="flex items-center gap-3">
                          <Eye size={18} className="text-[#2563EB]" />
                          <span className="text-[11px] font-bold text-slate-500 tracking-[0.2em]">{toTitleCase('Batch Sync Preview')}</span>
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className={`sticky top-0 z-10 shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <tr>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest w-20">{toTitleCase('No.')}</th>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('Cust. Code')}</th>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('School')}</th>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('Location')}</th>
                              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest">{toTitleCase('Sales Team')}</th>
                               <th className="px-8 py-4 text-[10px] font-bold text-slate-400 tracking-widest text-center">{toTitleCase('Sync Status')}</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700 bg-slate-900' : 'divide-slate-100 bg-white'}`}>
                            {parsedData.map((row, i) => {
                              const isDuplicate = row.customer_code && existingCustomerCodes.has(row.customer_code.trim());
                              return (
                                <tr key={i} className={`group transition-all duration-300 ${
                                isDuplicate 
                                  ? (isDarkMode ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-red-50 hover:bg-red-100/50') 
                                  : (isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50')
                              }`}>
                                <td className="px-8 py-4 text-[13px] font-bold text-slate-300 group-hover:text-[#2563EB] transition-colors">{i + 1}</td>
                                <td className={`px-8 py-4 text-[12px] font-mono font-bold ${isDarkMode ? 'text-[#3B82F6]' : 'text-[#2563EB]'}`}>{row.customer_code || 'N/A'}</td>
                                <td className={`px-8 py-4 text-[14px] font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>{row.name}</td>
                                <td className={`px-8 py-4 text-[14px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{row.location || 'N/A'}</td>
                                 <td className={`px-8 py-4 text-[14px] font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{row.sales_team || 'N/A'}</td>
                                 <td className="px-8 py-4 text-center">
                                   {isDuplicate ? (
                                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-red-500/20 border border-red-400/50">
                                       <AlertCircle size={10} /> Already Exists
                                     </div>
                                   ) : (
                                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20 border border-emerald-400/50">
                                       <Check size={10} /> New Record
                                     </div>
                                   )}
                                 </td>
                               </tr>
                             );
                           })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                
                {importError && (
                  <div className={`flex items-start gap-4 p-6 rounded-[2rem] animate-in slide-in-from-top-2 border ${
                    isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    <AlertCircle size={24} className="shrink-0" />
                    <p className="text-sm font-bold leading-relaxed">{importError}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-4">
              <button 
                type="button"
                onClick={() => { 
                  setIsAdding(false); 
                  setEditingSchool(null); 
                  setNewSchoolName(''); 
                  setNewLocation(''); 
                  setNewCustomerCode('');
                  setNewSalesTeam('');
                  setIsBuffer(false); 
                  setImportedFile(null); 
                  setParsedData([]); 
                }}
                className={`px-6 py-3 font-bold tracking-widest transition-all text-xs ${
                  isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {toTitleCase('Dismiss')}
              </button>
              <button 
                type="submit"
                disabled={isSaving || (activeTab === 'manual' ? !newSchoolName.trim() : parsedData.length === 0)}
                className={`px-8 py-3 text-white rounded-xl md:rounded-[1.2rem] font-bold text-xs tracking-[0.2em] shadow-2xl active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2.5
                  ${editingSchool || activeTab === 'import' ? 'bg-[#2563EB] hover:bg-[#1E40AF]' : ''}
                `}
                style={!(editingSchool || activeTab === 'import') ? { backgroundColor: 'var(--brand-accent)' } : {}}
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {toTitleCase(editingSchool ? 'Commit Update' : activeTab === 'manual' ? 'Register School' : `Sync ${parsedData.length} Partners`)}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={`rounded-lg shadow-sm overflow-hidden border flex flex-col mb-10 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {loading ? (
          <div className="flex-grow flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-brand-orange" size={40} />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Directory...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  {isSelectionMode && (
                    <th className="px-4 py-4 w-12">
                      <button 
                        onClick={handleSelectAll}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selectedIds.size === filteredSchools.length && filteredSchools.length > 0 ? <CheckSquare size={14} className="text-brand-orange" /> : <Square size={14} className={isDarkMode ? 'text-slate-700' : 'text-slate-200'} />}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-4 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase">Cust. Code</th>
                  <th className="px-6 py-4 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase">School Name</th>
                  <th className="px-6 py-4 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase">Location</th>
                  <th className="px-6 py-4 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 whitespace-nowrap uppercase">Sales Team</th>
                  <th className="px-6 py-4 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 text-center whitespace-nowrap uppercase">Status</th>
                  {userRole === 'Super admin' ? (
                    <th className="px-6 py-4 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 text-center w-48 whitespace-nowrap uppercase">Actions</th>
                  ) : (
                    <th className="px-6 py-4 font-semibold text-[11px] tracking-wider text-gray-700 dark:text-slate-400 text-center w-32 whitespace-nowrap uppercase">Details</th>
                  )}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-50'}`}>
                {paginatedSchools.map((school, i) => {
                  const isSelected = selectedIds.has(school.id);
                  const isBufferActual = school.is_buffer === true || String(school.is_buffer) === 'true';

                  return (
                    <tr 
                      key={school.id} 
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={`group animate-ease-in-down transition-all duration-200 border-l-4 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-sm hover:scale-[1.005] cursor-pointer ${
                        isSelected 
                          ? (isDarkMode ? 'bg-[#2563EB]/10 border-l-[#2563EB]' : 'bg-[#EFF6FF] border-l-[#2563EB]') 
                          : 'border-l-transparent'
                      }`}
                    >
                      {isSelectionMode && userRole === 'Super admin' && (
                        <td className="px-4 py-3 md:py-4">
                          <button 
                            onClick={() => toggleSelection(school.id)}
                            className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-[#2563EB] border-[#2563EB] text-white' 
                                : (isDarkMode ? 'border-slate-700 text-slate-700 hover:border-[#2563EB]' : 'border-slate-200 text-slate-200 hover:border-[#2563EB]')
                            }`}
                          >
                            {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3 md:py-4">
                        <span className={`text-[12px] font-mono font-bold ${isDarkMode ? 'text-[#306ee8]' : 'text-[#2563EB]'}`}>
                          {school.customer_code || '---'}
                        </span>
                      </td>
                      <td className="px-4 py-3 md:py-4">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center group-hover:bg-[#2563EB]/10 group-hover:text-[#2563EB] group-hover:rotate-[360deg] transition-all duration-500 ${
                            isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-50 text-slate-400'
                          }`}>
                            <School size={16} md:size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-[13px] font-bold tracking-tight group-hover:text-[#2563EB] transition-colors ${
                              isDarkMode ? 'text-slate-100' : 'text-slate-800'
                            }`}>{school.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 md:py-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <div className="flex items-center gap-2 md:gap-3">
                          <MapPin size={12} md:size={14} className="text-brand-orange group-hover:animate-pulse" />
                          <span className="text-[12px] font-bold tracking-wider">
                            {school.location || toTitleCase('NOT DEFINED')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 md:py-4">
                        <div className="flex items-center gap-2">
                          <Users size={12} className="text-purple-500" />
                          <span className={`text-[12px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            {school.sales_team || '---'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 md:py-4">
                        <div className="flex justify-center">
                          {isBufferActual ? (
                            <div className={`flex items-center gap-2 px-3 md:px-4 py-1 md:py-1.5 border rounded-full w-fit shadow-sm group-hover:scale-110 transition-transform ${
                              isDarkMode ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-[#FE4E02] border-orange-100'
                            }`}>
                               <Zap size={10} md:size={12} fill="currentColor" />
                               <span className="text-[8px] md:text-[9px] font-bold tracking-[0.15em]">{toTitleCase('Buffer School')}</span>
                            </div>
                          ) : (
                            <div className={`flex items-center gap-2 px-3 md:px-4 py-1 md:py-1.5 border rounded-full w-fit shadow-sm group-hover:scale-110 transition-transform ${
                              isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                               <ShieldCheck size={10} md:size={12} />
                               <span className="text-[8px] md:text-[9px] font-bold tracking-[0.15em]">{toTitleCase('Active')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 md:py-4">
                        <div className="flex items-center justify-center gap-2 md:gap-3">
                          {userRole === 'Super admin' ? (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingSchool(school);
                                  setNewSchoolName(school.name);
                                  setNewLocation(school.location || '');
                                  setNewCustomerCode(school.customer_code || '');
                                  setNewSalesTeam(school.sales_team || '');
                                  setIsBuffer(school.is_buffer);
                                  setIsAdding(false);
                                  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className={`p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 group/btn ${
                                  isDarkMode ? 'text-slate-500 hover:text-[#3B82F6] hover:bg-[#3B82F6]/10' : 'text-slate-300 hover:text-[#2563EB] hover:bg-[#EFF6FF]'
                                }`}
                                title="Edit Details"
                              >
                                <Edit3 size={16} md:size={18} className="group-hover/btn:scale-110 transition-transform" />
                              </button>
                              <button 
                                onClick={() => { setSchoolToDelete(school); setIsBulkDeleting(false); setIsDeleteModalOpen(true); }}
                                className={`p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all active:scale-95 group/btn ${
                                  isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                                }`}
                                title="Remove Partner"
                              >
                                <Trash2 size={16} md:size={18} className="group-hover/btn:scale-110 transition-transform" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-50">View Only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredSchools.length === 0 && !loading && (
              <div className="flex-grow flex flex-col items-center justify-center py-40 opacity-20">
                 <School size={120} strokeWidth={1} className="mb-8" />
                 <p className="text-xl font-bold tracking-[0.5em]">{toTitleCase("No Partners Found")}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 mb-10 gap-4">
        <div className="flex items-center gap-4">
          <div className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {itemsPerPage === 'all' ? (
              `Showing all ${filteredSchools.length} records`
            ) : (
              `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, filteredSchools.length)} of ${filteredSchools.length} records`
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
              onClick={() => {
                setCurrentPage(prev => prev - 1);
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
                      onClick={() => {
                        setCurrentPage(pageNum);
                        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
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
              onClick={() => {
                setCurrentPage(prev => prev + 1);
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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

      {/* FLOATING ACTION BAR FOR SCHOOLS */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 sm:bottom-12 left-1/2 -translate-x-1/2 z-[80] bg-[#1a1a1a] px-6 sm:px-12 py-4 sm:py-6 rounded-2xl sm:rounded-[3rem] shadow-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 animate-in slide-in-from-bottom-10 duration-500 w-[90%] sm:w-auto">
           <div className="flex flex-col items-center text-center">
              <span className="text-[8px] sm:text-[10px] font-bold text-white/40 tracking-[0.25em]">{toTitleCase("Registry Selection")}</span>
              <span className="text-lg sm:text-2xl font-bold text-white tracking-tight">{selectedIds.size} {toTitleCase("Schools")}</span>
           </div>
           <div className="hidden sm:block w-[1px] h-10 bg-white/10"></div>
           <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <button 
                onClick={triggerBulkDelete}
                className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 text-[8px] sm:text-[11px] font-bold tracking-widest shadow-2xl shadow-red-500/30 transition-all active:scale-95"
              >
                <Trash2 size={14} sm:size={18} />
                {toTitleCase("Delete Registry")}
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl sm:rounded-2xl text-[8px] sm:text-[11px] font-bold tracking-widest transition-all"
              >
                {toTitleCase("Dismiss")}
              </button>
           </div>
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-20 z-[60] w-12 h-12 text-white rounded-full flex items-center justify-center shadow-3xl hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300 transition-all font-poppins"
          style={{ 
            backgroundColor: 'var(--brand-accent)',
            boxShadow: '0 10px 25px -5px color-mix(in srgb, var(--brand-accent), transparent 60%)'
          }}
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}

      <DeleteConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSchoolToDelete(null); setIsBulkDeleting(false); }}
        onConfirm={handleConfirmDelete}
        controlNo={schoolToDelete?.name || ''}
        schoolName={schoolToDelete?.location || ''}
        isDeleting={isDeleting}
        itemCount={isBulkDeleting ? selectedIds.size : undefined}
        isDarkMode={isDarkMode}
        type="school"
      />
    </div>
    </>
  );
};

export default Schools;
