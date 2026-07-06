
import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, PackageCheck, AlertCircle, Calendar, Hash, Tag, MapPin } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toTitleCase } from '../lib/utils';

interface SerialNumberInfo {
  id: string;
  serial_number: string;
  condition: string;
  created_at: string;
  status: string;
  location: string;
}

interface SerialNumbersViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    item_code: string;
    item_name: string;
  } | null;
  isDarkMode?: boolean;
}

const SerialNumbersViewModal: React.FC<SerialNumbersViewModalProps> = ({ 
  isOpen, 
  onClose, 
  item, 
  isDarkMode = false 
}) => {
  const [serials, setSerials] = useState<SerialNumberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && item?.item_code) {
      fetchSerials();
    }
  }, [isOpen, item]);

  const fetchSerials = async () => {
    if (!isSupabaseConfigured || !item) return;
    setLoading(true);
    try {
      // Fetch item_serials and join with their current location/status if possible
      // Actually, we'll fetch from item_serials and maybe join with something else if needed
      // Based on previous code, item_serials have serial_number, item_code, status, condition, created_at
      const { data, error } = await supabase
        .from('item_serials')
        .select('*')
        .eq('item_code', item.item_code)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSerials(data || []);
    } catch (err) {
      console.error('Error fetching serials:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSerials = serials.filter(s => 
    s.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className={`relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[2.5rem] shadow-3xl border animate-in zoom-in-95 duration-300 flex flex-col ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-brand-orange/10 flex items-center justify-center shrink-0">
              <PackageCheck className="text-brand-orange" size={28} />
            </div>
            <div>
              <h2 className={`text-2xl font-black tracking-tight uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Serial Numbers
              </h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 shrink-0">
                {item?.item_name} ({item?.item_code})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-3 rounded-2xl transition-all ${
              isDarkMode ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-800'
            }`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 py-4 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search serial numbers, conditions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-6 py-3.5 rounded-2xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-brand-orange/20 border ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-brand-orange' 
                  : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-brand-orange'
              }`}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="text-brand-orange animate-spin mb-4" size={40} />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading serial numbers...</p>
            </div>
          ) : filteredSerials.length > 0 ? (
            <div className={`overflow-hidden rounded-3xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">#</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Serial Number</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Condition</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Location</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSerials.map((s, idx) => (
                      <tr 
                        key={s.id || idx}
                        className={`transition-colors h-16 ${
                          isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-bold text-slate-400">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                              <Hash size={14} className="text-brand-orange" />
                            </div>
                            <span className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {s.serial_number}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest items-center gap-1.5 border ${
                            s.condition === 'Brand New' || s.condition === 'brand_new'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : s.condition === 'Used' || s.condition === 'used'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                              : s.condition === 'Defective' || s.condition === 'defective'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : s.condition === 'Disposal' || s.condition === 'disposal'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                          }`}>
                            <Tag size={10} />
                            {toTitleCase(s.condition || 'N/A')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <MapPin size={12} className="text-brand-orange" />
                            <span className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {s.location || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-[10px] font-black text-slate-400 uppercase">
                            <Calendar size={12} />
                            {new Date(s.created_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                <AlertCircle className="text-slate-300 dark:text-slate-600" size={40} />
              </div>
              <p className={`text-lg font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                No serial numbers found
              </p>
              <p className="text-sm text-slate-400 font-medium mt-2">
                Try adjusting your search criteria
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-xl border text-[11px] font-black tracking-widest ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-100 text-slate-600'
              }`}>
                TOTAL: {filteredSerials.length}
              </div>
            </div>
            <button
              onClick={onClose}
              className={`px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SerialNumbersViewModal;
