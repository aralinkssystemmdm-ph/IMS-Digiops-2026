
import React from 'react';
import { X, Archive, Trash2, Loader2 } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  controlNo: string;
  schoolName?: string;
  isDeleting: boolean;
  itemCount?: number;
  isDarkMode?: boolean;
  type?: 'request' | 'item' | 'school' | 'bundle';
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  controlNo,
  schoolName,
  isDeleting,
  itemCount,
  isDarkMode = false,
  type = 'request'
}) => {
  if (!isOpen) return null;

  const isBulk = !!itemCount && itemCount > 1;
  
  const getTitle = () => {
    if (isBulk) return `Delete ${itemCount} Records?`;
    switch (type) {
      case 'item': return 'Are you sure you want to delete this item?';
      case 'school': return 'Delete Partner?';
      case 'bundle': return 'Delete Bundle?';
      default: return 'Delete Request?';
    }
  };

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
            {getTitle()}
          </h3>
          
          <p className={`text-sm font-medium leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isBulk ? (
              <>You are about to <span className="text-red-500 font-bold underline">permanently remove</span> <span className={`font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{itemCount} {getIdentifierLabel()} records</span>.</>
            ) : (
              <>You are about to <span className="text-red-500 font-bold underline">permanently delete</span> {getIdentifierLabel()} <span className={`font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{controlNo}</span>{schoolName ? <> for <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{schoolName}</span></> : ''}.</>
            )}
            <br />
            <span className="text-amber-600 font-bold">This will also remove all associated inventory transactions and serial numbers.</span>
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
                  Processing...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  {isBulk ? 'Confirm Bulk Delete' : 'Confirm Delete'}
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
              Cancel
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

export default DeleteConfirmationModal;
