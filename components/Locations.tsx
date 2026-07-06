
import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Loader2, Edit3, Trash2, Plus, X, Check, AlertCircle, Truck, Hash } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

interface Location {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at: string;
}

interface Supplier {
  id: string;
  supplier_name: string;
  created_at: string;
}

interface LocationsProps {
  isDarkMode?: boolean;
  userRole?: string | null;
}

const Locations: React.FC<LocationsProps> = ({ isDarkMode = false, userRole = 'Staff' }) => {
  const { showSuccess, showError, showDelete } = useNotification();
  const [activeTab, setActiveTab] = useState<'locations' | 'suppliers'>('locations');
  
  // Locations State
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDesc, setNewLocationDesc] = useState('');
  const [isAddingLoc, setIsAddingLoc] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocDesc, setEditLocDesc] = useState('');
  const [isUpdatingLoc, setIsUpdatingLoc] = useState(false);

  // Suppliers State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isAddingSup, setIsAddingSup] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupName, setEditSupName] = useState('');
  const [isUpdatingSup, setIsUpdatingSup] = useState(false);

  const fetchLocations = useCallback(async (showLoading = false) => {
    if (showLoading) setLocationsLoading(true);

    if (!isSupabaseConfigured) {
      setLocations([
        { id: '1', name: 'IT Basement', description: 'Central technology storage', is_active: true, created_at: new Date().toISOString() },
        { id: '2', name: 'Main Depot', description: 'Main distribution hub', is_active: true, created_at: new Date().toISOString() },
        { id: '3', name: 'Regional Center', description: 'Regional storage for South Luzon', is_active: true, created_at: new Date().toISOString() }
      ]);
      setLocationsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, description, is_active, created_at')
        .order('is_active', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setLocations(data);
    } catch (err: any) {
      console.error('Error in fetchLocations:', err);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async (showLoading = false) => {
    if (showLoading) setSuppliersLoading(true);

    if (!isSupabaseConfigured) {
      setSuppliers([
        { id: '1', supplier_name: 'Supplier Alpha', created_at: new Date().toISOString() },
        { id: '2', supplier_name: 'Global Tech Solutions', created_at: new Date().toISOString() },
        { id: '3', supplier_name: 'Metro Supply Co.', created_at: new Date().toISOString() }
      ]);
      setSuppliersLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('supplier')
        .select('*')
        .order('supplier_name', { ascending: true });

      if (error) {
        // If table doesn't exist yet, we'll just show empty
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          setSuppliers([]);
        } else {
          throw error;
        }
      }
      if (data) setSuppliers(data);
    } catch (err: any) {
      console.error('Error in fetchSuppliers:', err);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations(true);
    fetchSuppliers(true);

    if (isSupabaseConfigured) {
      const locChannel = supabase
        .channel('locations-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => fetchLocations(false))
        .subscribe();

      const supChannel = supabase
        .channel('suppliers-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier' }, () => fetchSuppliers(false))
        .subscribe();

      return () => {
        supabase.removeChannel(locChannel);
        supabase.removeChannel(supChannel);
      };
    }
  }, [fetchLocations, fetchSuppliers]);

  // CRUD handlers for Locations
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim() || !isSupabaseConfigured) return;

    const name = newLocationName.trim();
    if (locations.some(loc => loc.name.toLowerCase() === name.toLowerCase())) {
      showError('Duplicate Location', 'A location with this name already exists.');
      return;
    }

    setIsAddingLoc(true);
    try {
      const { error } = await supabase
        .from('locations')
        .insert([{ name, description: newLocationDesc.trim() || null, is_active: true }]);
      if (error) throw error;
      showSuccess('Location Added', `"${name}" has been added.`);
      setNewLocationName('');
      setNewLocationDesc('');
    } catch (err: any) {
      showError('Error', err.message || 'Failed to add location.');
    } finally {
      setIsAddingLoc(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation || !editLocName.trim() || !isSupabaseConfigured) return;
    const name = editLocName.trim();
    if (locations.some(loc => loc.id !== editingLocation.id && loc.name.toLowerCase() === name.toLowerCase())) {
      showError('Duplicate Location', 'Another location with this name already exists.');
      return;
    }

    setIsUpdatingLoc(true);
    try {
      const { error } = await supabase
        .from('locations')
        .update({ name, description: editLocDesc.trim() || null })
        .eq('id', editingLocation.id);
      if (error) throw error;
      showSuccess('Location Updated', 'The location details have been updated.');
      setEditingLocation(null);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to update location.');
    } finally {
      setIsUpdatingLoc(false);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: inUse } = await supabase
        .from('item_requests')
        .select('control_no')
        .eq('location', name)
        .limit(1);

      if (inUse && inUse.length > 0) {
        showError('Cannot Delete', 'This location is linked to active requests.');
        return;
      }

      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
      showDelete('Deleted', `"${name}" has been removed.`);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete location.');
    }
  };

  // CRUD handlers for Suppliers
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim() || !isSupabaseConfigured) return;

    const name = newSupplierName.trim();
    if (suppliers.some(sup => sup.supplier_name.toLowerCase() === name.toLowerCase())) {
      showError('Duplicate Supplier', 'A supplier with this name already exists.');
      return;
    }

    setIsAddingSup(true);
    try {
      const { error } = await supabase
        .from('supplier')
        .insert([{ supplier_name: name }]);
      if (error) throw error;
      showSuccess('Supplier Added', `"${name}" has been added.`);
      setNewSupplierName('');
    } catch (err: any) {
      showError('Error', err.message || 'Failed to add supplier.');
    } finally {
      setIsAddingSup(false);
    }
  };

  const handleUpdateSupplier = async () => {
    if (!editingSupplier || !editSupName.trim() || !isSupabaseConfigured) return;
    const name = editSupName.trim();
    if (suppliers.some(sup => sup.id !== editingSupplier.id && sup.supplier_name.toLowerCase() === name.toLowerCase())) {
      showError('Duplicate Supplier', 'Another supplier with this name already exists.');
      return;
    }

    setIsUpdatingSup(true);
    try {
      const { error } = await supabase
        .from('supplier')
        .update({ supplier_name: name })
        .eq('id', editingSupplier.id);
      if (error) throw error;
      showSuccess('Supplier Updated', 'The supplier has been updated.');
      setEditingSupplier(null);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to update supplier.');
    } finally {
      setIsUpdatingSup(false);
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!isSupabaseConfigured) return;
    try {
      // Check if supplier is used (Optional improvement: if you have a relation)
      const { error } = await supabase.from('supplier').delete().eq('id', id);
      if (error) throw error;
      showDelete('Deleted', `"${name}" has been removed.`);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to delete supplier.');
    }
  };

  return (
    <div className={`w-full h-full flex flex-col animate-in fade-in duration-500 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#F5F6F8]'}`}>
      
      {/* Tab/Toggle Section */}
      <div className="flex gap-2 mb-6 shrink-0">
        <button 
          onClick={() => setActiveTab('locations')}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
            activeTab === 'locations' 
              ? 'bg-[#FE4E02] text-white shadow-lg shadow-[#FE4E02]/20' 
              : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800'
          }`}
        >
          Locations
        </button>
        <button 
          onClick={() => setActiveTab('suppliers')}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
            activeTab === 'suppliers' 
              ? 'bg-[#FE4E02] text-white shadow-lg shadow-[#FE4E02]/20' 
              : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800'
          }`}
        >
          Suppliers
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-8 no-scrollbar">
        {activeTab === 'locations' ? (
          <React.Fragment>
            {userRole === 'Super admin' && (
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 ml-1">Register New Site</p>
                <div className={`p-6 md:p-8 rounded-[2rem] border-2 shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <form onSubmit={handleAddLocation} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location Name</label>
                        <div className="relative group">
                          <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <MapPin size={18} />
                          </div>
                          <input 
                            type="text" 
                            placeholder="e.g. Main Depot"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 focus:outline-none transition-all font-bold ${
                              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 123 Business Park"
                          value={newLocationDesc}
                          onChange={(e) => setNewLocationDesc(e.target.value)}
                          className={`w-full h-14 px-6 rounded-2xl border-2 focus:outline-none transition-all font-bold ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="submit"
                        disabled={isAddingLoc || !newLocationName.trim()}
                        className="h-14 px-10 bg-[#FE4E02] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                      >
                        {isAddingLoc ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        <span>Add Storage Location</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 ml-1">Existing Storage Infrastructure</p>
              {locationsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-[#FE4E02]" size={40} />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Syncing Locations...</p>
                </div>
              ) : locations.length > 0 ? (
                locations.map((loc) => (
                  <div key={loc.id} className={`group relative overflow-hidden rounded-[1.5rem] border-2 transition-all hover:shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
                      <div className="flex items-start md:items-center gap-5 flex-1">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} text-[#FE4E02]`}>
                          <MapPin size={24} strokeWidth={2.5} />
                        </div>
                        {editingLocation?.id === loc.id ? (
                          <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <input 
                                type="text" 
                                value={editLocName}
                                onChange={(e) => setEditLocName(e.target.value)}
                                className={`w-full h-10 px-4 rounded-xl border-2 font-bold text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                              />
                              <input 
                                type="text" 
                                value={editLocDesc}
                                onChange={(e) => setEditLocDesc(e.target.value)}
                                className={`w-full h-10 px-4 rounded-xl border-2 font-bold text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                              />
                            </div>
                            <div className="flex gap-3">
                              <button onClick={handleUpdateLocation} className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-2">
                                {isUpdatingLoc ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Save
                              </button>
                              <button onClick={() => setEditingLocation(null)} className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 rounded-lg font-bold text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-3">
                              <h4 className="text-lg font-black tracking-tight">{loc.name}</h4>
                              {!loc.is_active && <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded text-[9px] font-black uppercase tracking-widest">Inactive</span>}
                            </div>
                            <p className="text-sm font-bold text-slate-500 truncate">{loc.description || 'No address provided.'}</p>
                          </div>
                        )}
                      </div>
                      {!editingLocation && userRole === 'Super admin' && (
                        <div className="flex items-center gap-3 md:opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditingLocation(loc); setEditLocName(loc.name); setEditLocDesc(loc.description || ''); }} className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all"><Edit3 size={18} /></button>
                          <button onClick={() => handleDeleteLocation(loc.id, loc.name)} className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center">
                  <MapPin size={40} className="mx-auto text-slate-300 mb-3" />
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase">No Locations Found</h3>
                </div>
              )}
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {userRole === 'Super admin' && (
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 ml-1">Register New Supplier</p>
                <div className={`p-6 md:p-8 rounded-[2rem] border-2 shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <form onSubmit={handleAddSupplier} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier Name</label>
                      <div className="relative group">
                        <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Truck size={18} />
                        </div>
                        <input 
                          type="text" 
                          placeholder="e.g. Philippine Tech Corp"
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 focus:outline-none transition-all font-bold ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="submit"
                        disabled={isAddingSup || !newSupplierName.trim()}
                        className="h-14 px-10 bg-[#FE4E02] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                      >
                        {isAddingSup ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        <span>Add Supplier</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 ml-1">Management Suppliers</p>
              {suppliersLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-[#FE4E02]" size={40} />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Syncing Suppliers...</p>
                </div>
              ) : suppliers.length > 0 ? (
                suppliers.map((sup) => (
                  <div key={sup.id} className={`group relative overflow-hidden rounded-[1.5rem] border-2 transition-all hover:shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
                      <div className="flex items-start md:items-center gap-5 flex-1">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} text-[#FE4E02]`}>
                          <Truck size={24} strokeWidth={2.5} />
                        </div>
                        {editingSupplier?.id === sup.id ? (
                          <div className="flex-1 space-y-4">
                            <input 
                              type="text" 
                              value={editSupName}
                              onChange={(e) => setEditSupName(e.target.value)}
                              className={`w-full h-10 px-4 rounded-xl border-2 font-bold text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                            />
                            <div className="flex gap-3">
                              <button onClick={handleUpdateSupplier} className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-2">
                                {isUpdatingSup ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Save
                              </button>
                              <button onClick={() => setEditingSupplier(null)} className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 rounded-lg font-bold text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col min-w-0">
                            <h4 className="text-lg font-black tracking-tight">{sup.supplier_name}</h4>
                          </div>
                        )}
                      </div>
                      {!editingSupplier && userRole === 'Super admin' && (
                        <div className="flex items-center gap-3 md:opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditingSupplier(sup); setEditSupName(sup.supplier_name); }} className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all"><Edit3 size={18} /></button>
                          <button onClick={() => handleDeleteSupplier(sup.id, sup.supplier_name)} className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center">
                  <Truck size={40} className="mx-auto text-slate-300 mb-3" />
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase">No Suppliers Found</h3>
                </div>
              )}
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
};

export default Locations;

