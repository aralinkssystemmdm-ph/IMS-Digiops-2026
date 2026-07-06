
import React from 'react';
import { X, AlertTriangle, Trash2, Loader2, School } from 'lucide-react';

interface SchoolDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  schoolName: string;
  isDeleting: boolean;
}

const SchoolDeleteModal: React.FC<SchoolDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  schoolName,
  isDeleting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[420px] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
            <School size={32} className="opacity-20 absolute" />
            <AlertTriangle size={40} className="relative z-10" />
          </div>
          
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Remove School?</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 px-4">
            Are you sure you want to delete <span className="font-black text-slate-800 underline decoration-[#FE4E02]/30 decoration-4 underline-offset-4">{schoolName}</span>? 
            This will permanently remove the record from the directory.
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
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete Permanently
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-500 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default SchoolDeleteModal;
