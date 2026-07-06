
import React from 'react';
import { X, Trash2, Loader2, AlertTriangle } from 'lucide-react';

import { toTitleCase } from '../lib/utils';

interface PermanentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  controlNo: string;
  schoolName?: string;
  isDeleting: boolean;
  isDarkMode?: boolean;
  type?: 'request' | 'item' | 'school' | 'bundle';
}

const PermanentDeleteModal: React.FC<PermanentDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  controlNo,
  schoolName,
  isDeleting,
  isDarkMode = false,
  type = 'request'
}) => {
  if (!isOpen) return null;

  const getIdentifierLabel = () => {
    switch (type) {
      case 'item': return 'item code';
      case 'school': return 'partner';
      case 'bundle': return 'bundle';
      default: return 'request';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className={`relative w-full max-w-[420px] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
        isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${
            isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'
          }`}>
            <Trash2 size={40} />
          </div>
          
          <h3 className={`text-2xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {toTitleCase('Permanent Delete?')}
          </h3>
          
          <p className={`text-sm font-medium leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            You are about to <span className="text-red-500 font-bold uppercase">permanently remove</span> {getIdentifierLabel()} <span className={`font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{controlNo}</span>{schoolName ? <> for <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{schoolName}</span></> : ''}.
            <br />
            <span className="flex items-center justify-center gap-1 mt-2 text-red-500 font-bold">
              <AlertTriangle size={14} />
              {toTitleCase('This action cannot be undone.')}
            </span>
          </p>

          <div className="flex flex-col w-full gap-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {toTitleCase('Deleting...')}
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  {toTitleCase('Confirm Permanent Delete')}
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
              }`}
            >
              {toTitleCase('Cancel')}
            </button>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className={`absolute top-6 right-6 p-2 transition-colors ${
            isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'
          }`}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default PermanentDeleteModal;
