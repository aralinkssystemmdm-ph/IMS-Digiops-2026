
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, RotateCcw, Loader2, Package, Box, Layers, Filter, ChevronDown, CheckSquare, Square, Info, X, Zap, AlertCircle, Archive, User, ArrowUp, Eye } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';
import PermanentDeleteModal from './PermanentDeleteModal';
import { useNotification } from './NotificationProvider';

interface ArchivedItemsProps {
  isDarkMode?: boolean;
  onRefreshCounts?: () => void;
}

const ArchivedItems: React.FC<ArchivedItemsProps> = ({ isDarkMode = false, onRefreshCounts }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [activeTab, setActiveTab] = useState<'equipment' | 'bundle'>('equipment');
  const [equipment, setEquipment] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const userRole = localStorage.getItem('aralinks_role') || 'Staff';
  const currentUser = localStorage.getItem('aralinks_user');
  const isAdmin = userRole === 'Admin' || userRole === 'SUPERADMIN';
  const [viewMode, setViewMode] = useState<'my' | 'all'>(isAdmin ? 'all' : 'my');
  const [viewedBundle, setViewedBundle] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const groupedBundles = useMemo(() => {
    const groups: { [key: string]: any } = {};
    bundles.forEach(item => {
      const key = `${item.bundle}-${item.program}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          item_code: item.bundle, // Using bundle name as code for display
          description: `Grouped bundle with ${item.program} program`,
          bundle: item.bundle,
          program: item.program,
          archived_at: item.archived_at,
          archived_by: item.archived_by,
          items: []
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [bundles]);

  const fetchArchived = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    if (showLoading) setLoading(true);
    
    try {
      let equipQuery = supabase.from('equipment').select('*').not('archived_at', 'is', null);
      let bundleQuery = supabase.from('bundle_items').select('*').not('archived_at', 'is', null);

      if (!isAdmin || viewMode === 'my') {
        equipQuery = equipQuery.eq('archived_by', currentUser);
        bundleQuery = bundleQuery.eq('archived_by', currentUser);
      }

      const [equipResponse, bundleResponse] = await Promise.all([
        equipQuery.order('archived_at', { ascending: false }),
        bundleQuery.order('archived_at', { ascending: false })
      ]);

      if (equipResponse.error) console.error('Error fetching archived equipment:', equipResponse.error);
      if (bundleResponse.error) console.error('Error fetching archived bundles:', bundleResponse.error);

      if (equipResponse.data) setEquipment(equipResponse.data);
      if (bundleResponse.data) setBundles(bundleResponse.data);
    } catch (err) {
      console.error('Failed to fetch archived items:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, viewMode, currentUser]);

  useEffect(() => {
    fetchArchived(true);
  }, [fetchArchived, viewMode]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollTop(containerRef.current.scrollTop > 300);
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleRestore = async (id: string, type: 'equipment' | 'bundle') => {
    if (!isSupabaseConfigured) return;
    
    setProcessingId(id);
    try {
      if (type === 'equipment') {
        const { error } = await supabase
          .from('equipment')
          .update({ 
            archived_by: null, 
            archived_at: null 
          })
          .eq('item_code', id);

        if (error) throw error;
        setEquipment(prev => prev.filter(item => (item.item_code || item.code) !== id));
      } else {
        // Grouped restore for bundle
        const bundleToRestore = groupedBundles.find(b => b.id === id);
        if (!bundleToRestore) throw new Error('Bundle not found');

        const { error } = await supabase
          .from('bundle_items')
          .update({ 
            archived_by: null, 
            archived_at: null 
          })
          .eq('bundle', bundleToRestore.bundle)
          .eq('program', bundleToRestore.program);

        if (error) throw error;
        setBundles(prev => prev.filter(item => `${item.bundle}-${item.program}` !== id));
        setIsViewModalOpen(false);
        setViewedBundle(null);
      }
      
      showSuccess('Restored', 'Item has been restored to active inventory.');
      if (onRefreshCounts) onRefreshCounts();
    } catch (err: any) {
      console.error('Restore error:', err);
      showError('Error', err.message || 'Failed to restore item.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!isSupabaseConfigured || !itemToDelete) return;
    
    const id = activeTab === 'equipment' ? (itemToDelete.item_code || itemToDelete.code) : itemToDelete.id;
    setProcessingId(id);
    try {
      if (activeTab === 'equipment') {
        const { error } = await supabase
          .from('equipment')
          .delete()
          .eq('item_code', id);

        if (error) throw error;
        setEquipment(prev => prev.filter(item => (item.item_code || item.code) !== id));
      } else {
        // Grouped delete for bundle
        const { error } = await supabase
          .from('bundle_items')
          .delete()
          .eq('bundle', itemToDelete.bundle)
          .eq('program', itemToDelete.program);

        if (error) throw error;
        setBundles(prev => prev.filter(item => `${item.bundle}-${item.program}` !== id));
      }
      
      showDelete('Permanently Deleted', 'Item has been removed from the database.');
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      if (onRefreshCounts) onRefreshCounts();
    } catch (err: any) {
      console.error('Deletion error:', err);
      showError('Error', err.message || 'Failed to remove item permanently.');
    } finally {
      setProcessingId(null);
    }
  };

  const counts = useMemo(() => {
    return {
      equipment: equipment.length,
      bundle: groupedBundles.length
    };
  }, [equipment, groupedBundles]);

  const filteredItems = useMemo(() => {
    const items = activeTab === 'equipment' ? equipment : groupedBundles;
    return items.filter(item => {
      // Role-Based Access Control Filtering
      if (!isAdmin && item.archived_by !== currentUser) return false;
      
      const matchesSearch = 
        searchQuery.trim() === '' || 
        (item.item_code || item.code || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.bundle && item.bundle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.program && item.program.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.archived_by && item.archived_by.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSearch;
    });
  }, [equipment, bundles, activeTab, searchQuery, isAdmin, viewMode, currentUser]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'equipment'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            style={activeTab === 'equipment' ? { color: 'var(--brand-accent)' } : {}}
          >
            <Box size={14} />
            <span>Equipment</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${
              activeTab === 'equipment'
                ? 'text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
             style={activeTab === 'equipment' ? { backgroundColor: 'var(--brand-accent)' } : {}}
            >
              {counts.equipment}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('bundle')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'bundle'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            style={activeTab === 'bundle' ? { color: 'var(--brand-accent)' } : {}}
          >
            <Layers size={14} />
            <span>Bundles</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${
              activeTab === 'bundle'
                ? 'text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
             style={activeTab === 'bundle' ? { backgroundColor: 'var(--brand-accent)' } : {}}
            >
              {counts.bundle}
            </span>
          </button>
        </div>

        <div className="relative group flex-grow max-w-md">
          <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-[var(--brand-accent)]' : 'text-slate-400 group-focus-within:text-[var(--brand-accent)]'}`}>
            <Search size={18} className="group-hover:scale-110 transition-transform" />
          </div>
          <input
            type="text"
            placeholder={`Search archived ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm font-bold border-2 transition-all outline-none ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-white border-slate-100 text-slate-800'
            }`}
            style={{ 
              borderColor: searchQuery ? 'var(--brand-accent)' : undefined,
              boxShadow: searchQuery ? '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 90%)' : undefined 
            } as any}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">View:</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'my' | 'all')}
            className={`h-11 px-3 rounded-2xl border-2 text-xs font-bold uppercase tracking-wider outline-none transition-all cursor-pointer ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-slate-300' 
                : 'bg-white border-slate-100 text-slate-600'
            }`}
            style={{ borderColor: viewMode !== (isAdmin ? 'all' : 'my') ? 'var(--brand-accent)' : undefined } as any}
          >
            <option value="my">My Records</option>
            {isAdmin && <option value="all">All Records</option>}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4" style={{ color: 'var(--brand-accent)' }} />
            <p className="font-bold tracking-widest uppercase text-xs">Syncing Vault...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <Archive className="text-slate-300" size={40} />
            </div>
            <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              No Archived {toTitleCase(activeTab)}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs text-sm font-medium">
              {searchQuery ? 'No items match your search criteria.' : `The ${activeTab} archive is currently empty.`}
            </p>
          </div>
        ) : (
          <div className={`flex-grow overflow-hidden border rounded-[2rem] flex flex-col mb-10 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
          }`}>
            <div className="flex-grow overflow-auto custom-scrollbar" ref={containerRef}>
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className={`${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {activeTab === 'equipment' ? 'Equipment Code' : 'Bundle Code/Name'}
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6">Item Description</th>
                    {activeTab === 'bundle' && (
                       <>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Program</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6">Bundle Name</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Items</th>
                       </>
                    )}
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Archived Date</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Archived By</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                  {filteredItems.map((item, i) => (
                    <tr 
                      key={`${activeTab === 'equipment' ? (item.item_code || item.code) : item.id}-${i}`}
                      style={{ animationDelay: `${i * 30}ms` }}
                      className={`group transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/50 animate-in fade-in slide-in-from-top-2 duration-300`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'
                          }`}>
                            {activeTab === 'equipment' ? <Box size={16} /> : <Layers size={16} />}
                          </div>
                          <span className={`text-[13px] font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                            {item.item_code || item.code}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className={`text-[13px] font-medium leading-relaxed truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title={item.description}>
                          {item.description}
                        </p>
                      </td>
                      {activeTab === 'bundle' && (
                        <>
                          <td className="px-6 py-4">
                            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {item.program}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {item.bundle}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Package size={14} style={{ color: 'var(--brand-accent)' }} />
                              <span className={`text-[11px] font-black`} style={{ color: 'var(--brand-accent)' }}>
                                {item.items.length} Items
                              </span>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-slate-400" />
                          <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatDate(item.archived_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <div className="flex flex-col">
                            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {item.archived_by === currentUser ? 'You' : (item.archived_by || 'Admin')}
                            </span>
                            {item.archived_by === currentUser && (
                              <span className="text-[9px] font-black uppercase tracking-tighter opacity-70" style={{ color: 'var(--brand-accent)' }}>Self</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {activeTab === 'bundle' && (
                            <button
                              onClick={() => {
                                setViewedBundle(item);
                                setIsViewModalOpen(true);
                              }}
                              className={`p-2 rounded-xl transition-all shadow-sm ${
                                isDarkMode 
                                  ? 'bg-slate-800 text-slate-400 hover:text-[#2563EB] hover:bg-[#2563EB]/10' 
                                  : 'bg-slate-50 text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF]'
                              }`}
                              title="View Items"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleRestore(activeTab === 'equipment' ? (item.item_code || item.code) : item.id, activeTab)}
                              disabled={processingId === (activeTab === 'equipment' ? (item.item_code || item.code) : item.id)}
                              className={`p-2 rounded-xl transition-all shadow-sm ${
                                isDarkMode 
                                  ? 'bg-slate-800 text-slate-400 hover:text-[#2563EB] hover:bg-[#2563EB]/10' 
                                  : 'bg-slate-50 text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF]'
                              }`}
                              title="Restore"
                            >
                              {processingId === (activeTab === 'equipment' ? (item.item_code || item.code) : item.id) ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <RotateCcw size={16} />
                              )}
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setItemToDelete(item);
                                setIsDeleteModalOpen(true);
                              }}
                              className={`p-2 rounded-xl transition-all shadow-sm ${
                                isDarkMode 
                                  ? 'bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-500/10' 
                                  : 'bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50'
                              }`}
                              title="Delete Permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <PermanentDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handlePermanentDelete}
        controlNo={itemToDelete?.code || itemToDelete?.bundle || ''}
        schoolName={activeTab === 'bundle' ? `Bundle: ${itemToDelete?.bundle}` : itemToDelete?.description || ''}
        isDeleting={!!processingId}
        isDarkMode={isDarkMode}
        type={activeTab === 'equipment' ? 'item' : 'bundle'}
      />

      {/* VIEW BUNDLE MODAL */}
      {isViewModalOpen && viewedBundle && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4`}>
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => {
              setIsViewModalOpen(false);
              setViewedBundle(null);
            }} 
          />
          <div 
            className={`relative w-full max-w-2xl rounded-[2.5rem] shadow-2xl border-2 overflow-hidden animate-in zoom-in-95 duration-300 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' }}>
                  <Layers size={24} />
                </div>
                <div>
                  <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{viewedBundle.bundle}</h3>
                  <p className="text-xs font-bold tracking-[0.2em] uppercase mt-0.5" style={{ color: 'var(--brand-accent)' }}>{viewedBundle.program} Program</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewedBundle(null);
                }}
                className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-6">
                <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Items Archive</h4>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase`}>
                  {viewedBundle.items.length} Total Items
                </span>
              </div>

              <div className="space-y-3">
                {viewedBundle.items.map((item: any, idx: number) => (
                  <div 
                    key={item.id}
                    className={`p-5 rounded-2xl border-2 transition-all ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-mono font-bold tracking-widest" style={{ color: 'var(--brand-accent)' }}>{item.item_code}</span>
                       <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                         item.is_serialized 
                           ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                           : 'bg-slate-400/10 text-slate-400 border border-slate-400/20'
                       }`}>
                         {item.is_serialized ? 'Serialized' : 'Non-Serialized'}
                       </span>
                    </div>
                    <p className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.description}</p>
                    <div className="mt-3 flex items-center gap-4">
                       <div className="flex items-center gap-1.5">
                         <Box size={12} className="text-slate-400" />
                         <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                           Qty: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-900'}>{item.qty} {item.uom || 'pcs'}</span>
                         </span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 flex justify-end gap-3">
              <button
                onClick={() => handleRestore(viewedBundle.id, 'bundle')}
                disabled={processingId === viewedBundle.id}
                className="px-6 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-accent)', boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 70%)' }}
              >
                {processingId === viewedBundle.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Restore Bundle
              </button>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewedBundle(null);
                }}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-20 z-[60] w-12 h-12 text-white rounded-full flex items-center justify-center shadow-3xl hover:opacity-80 transition-all hover:scale-110 active:scale-90 animate-in fade-in zoom-in duration-300"
          style={{ backgroundColor: 'var(--brand-accent)' }}
        >
          <ArrowUp size={20} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default ArchivedItems;
