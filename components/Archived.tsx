
import React, { useState, useEffect } from 'react';
import { Archive, FileText, Package, LayoutGrid, Box, Layers } from 'lucide-react';
import ArchivedRequestsList from './ArchivedRequestsList';
import ArchivedItems from './ArchivedItems';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ArchivedModuleProps {
  isDarkMode?: boolean;
}

const ArchivedModule: React.FC<ArchivedModuleProps> = ({ isDarkMode = false }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'items'>('requests');
  const [counts, setCounts] = useState({ requests: 0, items: 0 });

  const fetchCounts = async () => {
    if (!isSupabaseConfigured) return;

    const userRole = localStorage.getItem('aralinks_role') || 'Staff';
    const currentUser = localStorage.getItem('aralinks_user');
    const isAdmin = userRole.toLowerCase() === 'admin';

    try {
      let reqQuery = supabase.from('item_requests').select('*', { count: 'exact', head: true }).not('archived_at', 'is', null);
      let equipQuery = supabase.from('equipment').select('*', { count: 'exact', head: true }).not('archived_at', 'is', null);
      let bundleQuery = supabase.from('bundle_items').select('bundle, program, archived_by').not('archived_at', 'is', null);

      if (!isAdmin) {
        reqQuery = reqQuery.eq('archived_by', currentUser);
        equipQuery = equipQuery.eq('archived_by', currentUser);
        bundleQuery = bundleQuery.eq('archived_by', currentUser);
      }

      const [reqRes, equipRes, bundleRes] = await Promise.all([
        reqQuery,
        equipQuery,
        bundleQuery
      ]);

      // Correctly calculate unique bundles count
      const uniqueBundles = new Set();
      (bundleRes.data || []).forEach((item: any) => {
        uniqueBundles.add(`${item.bundle}-${item.program}`);
      });

      setCounts({
        requests: reqRes.count || 0,
        items: (equipRes.count || 0) + uniqueBundles.size
      });
    } catch (err) {
      console.error('Error fetching archived counts:', err);
    }
  };

  useEffect(() => {
    fetchCounts();

    // Subscribe to changes to keep counts updated in realtime
    const channel = supabase.channel('archived-vault-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_requests' }, () => {
        console.log('Realtime update: item_requests');
        fetchCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, () => {
        console.log('Realtime update: equipment');
        fetchCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bundle_items' }, () => {
        console.log('Realtime update: bundle_items');
        fetchCounts();
      })
      .subscribe((status) => {
        console.log('Vault subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className={`flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {/* Header Section */}
      <div className="mb-4">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' }}>
            <Archive size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">The Vault</h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase text-xs">
              Archived Records & Assets
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-[1.5rem] w-fit mb-4 shadow-inner">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-3 px-8 py-3 rounded-[1.2rem] text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap active:scale-95 ${
            activeTab === 'requests'
              ? 'text-white shadow-lg'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          style={activeTab === 'requests' ? { 
            backgroundColor: 'var(--brand-accent)',
            boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)'
          } : {}}
        >
          <FileText size={18} />
          <span>Requests</span>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
            activeTab === 'requests'
              ? 'bg-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`} style={activeTab === 'requests' ? { color: 'var(--brand-accent)' } : {}}>
            {counts.requests}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-3 px-8 py-3 rounded-[1.2rem] text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap active:scale-95 ${
            activeTab === 'items'
              ? 'text-white shadow-lg'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          style={activeTab === 'items' ? { 
            backgroundColor: 'var(--brand-accent)',
            boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)'
          } : {}}
        >
          <Package size={18} />
          <span>Items</span>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
            activeTab === 'items'
              ? 'bg-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`} style={activeTab === 'items' ? { color: 'var(--brand-accent)' } : {}}>
            {counts.items}
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-grow min-h-0">
        {activeTab === 'requests' ? (
          <ArchivedRequestsList isDarkMode={isDarkMode} onRefreshCounts={fetchCounts} />
        ) : (
          <ArchivedItems isDarkMode={isDarkMode} onRefreshCounts={fetchCounts} />
        )}
      </div>
    </div>
  );
};

export default ArchivedModule;
