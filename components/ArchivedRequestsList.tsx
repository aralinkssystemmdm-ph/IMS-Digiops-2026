
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, RotateCcw, Loader2, FileText, ArrowUp, Archive, MapPin, Tag, CheckCircle2, Clock, Info, X, User, Building2, CalendarDays, AlertCircle, Eye, Zap, Layers } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase, cleanPONumber } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import RequestPreviewModal from './RequestPreviewModal';
import PermanentDeleteModal from './PermanentDeleteModal';
import { useNotification } from './NotificationProvider';

interface ArchivedRequestsListProps {
  isDarkMode?: boolean;
  onRefreshCounts?: () => void;
}

const ArchivedRequestsList: React.FC<ArchivedRequestsListProps> = ({ isDarkMode = false, onRefreshCounts }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<RequestData | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<any | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const userRole = localStorage.getItem('aralinks_role') || 'Staff';
  const currentUser = localStorage.getItem('aralinks_user');
  const isAdmin = userRole === 'Admin' || userRole === 'SUPERADMIN';
  const [viewMode, setViewMode] = useState<'my' | 'all'>(isAdmin ? 'all' : 'my');
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchArchived = useCallback(async (showLoading = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    
    if (showLoading) setLoading(true);
    
    try {
      let query = supabase
        .from('item_requests')
        .select(`
          *,
          request_items (*)
        `)
        .not('archived_at', 'is', null);

      if (!isAdmin || viewMode === 'my') {
        query = query.eq('archived_by', currentUser);
      }

      const { data, error } = await query.order('archived_at', { ascending: false });

      if (error) {
        console.error('Error fetching archived requests:', error);
      } else if (data) {
        setRequests(data.map((req: any) => ({
          id: req.control_no,
          ticketNo: req.ticket_no,
          schoolName: req.school_name,
          requestType: req.request_type,
          date: req.date, 
          requestedBy: req.requested_by,
          archiverName: req.archived_by || 'Admin',
          status: req.status || 'Archived',
          purpose: req.purpose,
          program: req.program,
          poNumber: req.po_number,
          remarks: req.remarks,
          attachment: req.attachment,
          deliveredAt: req.delivered_at,
          created_at: req.created_at,
          archived_at: req.archived_at,
          archived_by: req.archived_by,
          items: (req.request_items || []).map((item: any) => ({
            id: item.id,
            qty: item.qty,
            uom: item.uom,
            item: item.item,
            code: item.code
          }))
        } as any)));
      }
    } catch (err) {
      console.error('Failed to fetch archived:', err);
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

  const handleRestore = async (controlNo: string) => {
    if (!isSupabaseConfigured) return;
    
    const requestToRestore = requests.find(r => r.id === controlNo);
    const targetStatus = requestToRestore?.deliveredAt ? (requestToRestore.status === 'Partially Delivered' ? 'Partially Delivered' : 'Delivered') : 'Pending';

    setProcessingId(controlNo);
    try {
      const { error } = await supabase
        .from('item_requests')
        .update({ 
          status: targetStatus, 
          archived_by: null, 
          archived_at: null 
        })
        .eq('control_no', controlNo);

      if (error) throw error;
      
      showSuccess('Restored', 'Requisition has been restored to active list.');
      setRequests(prev => prev.filter(r => r.id !== controlNo));
      if (onRefreshCounts) onRefreshCounts();
    } catch (err: any) {
      console.error('Restore error:', err);
      showError('Error', err.message || 'Failed to restore requisition.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!isSupabaseConfigured || !requestToDelete) return;
    
    const controlNo = requestToDelete.id;
    setProcessingId(controlNo);
    try {
      // 1. Revert Inventory Stocks
      const { data: transactions } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('reference_id', controlNo);

      if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
          if (tx.transaction_type === 'Delivery') {
            const { data: stock } = await supabase
              .from('item_location_stocks')
              .select('id, quantity, brand_new_qty')
              .eq('item_code', tx.item_code)
              .eq('location', tx.to_location)
              .maybeSingle();

            if (stock) {
              await supabase
                .from('item_location_stocks')
                .update({
                  quantity: Math.max(0, stock.quantity - tx.quantity),
                  brand_new_qty: Math.max(0, (stock.brand_new_qty || 0) - tx.quantity)
                })
                .eq('id', stock.id);
            }
          }
        }
        // Delete transactions
        await supabase.from('stock_transactions').delete().eq('reference_id', controlNo);
      }

      // 2. Delete item serials
      await supabase.from('item_serials').delete().eq('request_id', controlNo);

      // 3. Delete request items
      await supabase.from('request_items').delete().eq('request_control_no', controlNo);

      // 4. Delete the request itself
      const { error } = await supabase
        .from('item_requests')
        .delete()
        .eq('control_no', controlNo);

      if (error) throw error;
      
      showDelete('Permanently Deleted', 'Requisition and associated inventory records have been removed.');
      setRequests(prev => prev.filter(r => r.id !== controlNo));
      setIsDeleteModalOpen(false);
      setRequestToDelete(null);
      if (onRefreshCounts) onRefreshCounts();
    } catch (err: any) {
      console.error('Deletion error:', err);
      showError('Error', err.message || 'Failed to remove requisition permanently.');
      fetchArchived(false);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Role-Based Access Control Filtering
      if (!isAdmin && req.archived_by !== currentUser) return false;

      return searchQuery.trim() === '' || 
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        req.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.archiverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.ticketNo && req.ticketNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (req.poNumber && req.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (req.program && req.program.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [requests, searchQuery, isAdmin, viewMode, currentUser]);

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
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
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 px-6">
        <div className="relative group flex-grow max-w-md">
          <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} style={{ color: searchQuery ? 'var(--brand-accent)' : undefined }}>
            <Search size={18} className="group-hover:scale-110 transition-transform" />
          </div>
          <input
            type="text"
            placeholder="Search archived requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-11 pr-4 py-2.5 rounded-lg text-sm font-medium border transition-all outline-none ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-white' 
                : 'bg-white border-slate-200 text-slate-900'
            }`}
            style={{ 
              borderColor: searchQuery ? 'var(--brand-accent)' : undefined,
              boxShadow: searchQuery ? '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 90%)' : undefined,
              '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)'
            } as any}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">View:</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'my' | 'all')}
            className={`h-10 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider outline-none transition-all cursor-pointer ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-slate-300' 
                : 'bg-white border-slate-200 text-slate-600'
            }`}
            style={{ 
              borderColor: viewMode !== (isAdmin ? 'all' : 'my') ? 'var(--brand-accent)' : undefined,
              color: viewMode !== (isAdmin ? 'all' : 'my') ? 'var(--brand-accent)' : undefined
            } as any}
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
        ) : filteredRequests.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <Archive className="text-slate-300" size={40} />
            </div>
            <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              No Archived Requests
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs text-sm font-medium">
              {searchQuery ? 'No requests match your search criteria.' : 'The request archive is currently empty.'}
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
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">School</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">REQ NO</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">PO</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Archived Date</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Archived By</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                  {filteredRequests.map((req, i) => (
                    <tr 
                      key={req.id}
                      style={{ animationDelay: `${i * 30}ms` }}
                      className={`group transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/50 animate-in fade-in slide-in-from-top-2 duration-300`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-[13px] font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {req.schoolName}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {req.program || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <FileText size={12} style={{ color: 'var(--brand-accent)' }} />
                          <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                            {req.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Layers size={12} className="text-slate-400" />
                          <span className={`text-[11px] font-bold ${isDarkMode ? (req.poNumber ? 'text-slate-300' : 'text-slate-500 italic') : (req.poNumber ? 'text-slate-600' : 'text-slate-400 italic')}`}>
                            {req.poNumber ? cleanPONumber(req.poNumber) : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-slate-400" />
                          <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatDateTime(req.archived_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <div className="flex flex-col">
                            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {req.archiverName === currentUser ? 'You' : req.archiverName}
                            </span>
                            {req.archiverName === currentUser && (
                              <span className="text-[9px] font-black uppercase tracking-tighter opacity-70" style={{ color: 'var(--brand-accent)' }}>Self</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setPreviewRequest(req);
                              setIsPreviewOpen(true);
                            }}
                            className={`p-2 rounded-xl transition-all shadow-sm ${
                              isDarkMode 
                                ? 'bg-slate-800 text-slate-400 hover:text-[#2563EB] hover:bg-[#2563EB]/10' 
                                : 'bg-slate-50 text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF]'
                            }`}
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleRestore(req.id)}
                              disabled={processingId === req.id}
                              className={`p-2 rounded-xl transition-all shadow-sm ${
                                isDarkMode 
                                  ? 'bg-slate-800 text-slate-400 hover:text-[#2563EB] hover:bg-[#2563EB]/10' 
                                  : 'bg-slate-50 text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF]'
                              }`}
                              title="Restore"
                            >
                              {processingId === req.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <RotateCcw size={16} />
                              )}
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setRequestToDelete(req);
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

      {previewRequest && (
        <RequestPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewRequest(null);
          }}
          request={previewRequest}
          isDarkMode={isDarkMode}
        />
      )}

      <PermanentDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setRequestToDelete(null);
        }}
        onConfirm={handlePermanentDelete}
        controlNo={requestToDelete?.id || ''}
        schoolName={requestToDelete?.schoolName}
        isDeleting={!!processingId}
        isDarkMode={isDarkMode}
        type="request"
      />

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

export default ArchivedRequestsList;
