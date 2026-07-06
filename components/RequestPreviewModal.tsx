
import React, { useRef } from 'react';
import { X, FileText, Printer, Paperclip, ExternalLink } from 'lucide-react';
import { toTitleCase, cleanPONumber, getBundleColor } from '../lib/utils';
import { RequestData } from './ItemsRequest';
import { useNotification } from './NotificationProvider';

interface RequestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData | null;
}

const RequestPreviewModal: React.FC<RequestPreviewModalProps> = ({ isOpen, onClose, request }) => {
  const { showWarning } = useNotification();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !request) return null;

  // Check if any item has a bundle name to determine if we should show the column
  const hasBundles = request.items?.some(item => item.bundle_name);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const windowPrint = window.open('', '', 'left=0,top=0,width=900,height=1000,toolbar=0,scrollbars=0,status=0');
    if (!windowPrint) {
      showWarning('Popup Blocked', 'Please allow popups to print the requisition slip.');
      return;
    }

    windowPrint.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${request.schoolName.toUpperCase()} REQUEST</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: letter; /* Short Bond Paper (8.5" x 11") */
              margin: 10mm;
            }
            body { 
              font-family: 'Inter', sans-serif; 
              color: black;
              background: white;
              margin: 0;
              padding: 0;
            }
            .requisition-table {
              width: 100%;
              border-collapse: collapse !important;
              border: 1px solid black !important;
            }
            .requisition-table th, .requisition-table td {
              border: 1px solid black !important;
              padding: 6px 10px !important;
              font-size: 11px !important;
            }
            @media print {
              .no-print { display: none !important; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="p-4">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    windowPrint.document.close();
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[#f1f5f9] dark:bg-slate-950 w-full max-w-[850px] h-[92vh] rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 dark:border-slate-800">
        
        {/* Toolbar Header */}
        <div className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0081f1] text-white rounded-xl flex items-center justify-center shadow-lg">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white tracking-tight leading-none">{toTitleCase('Requisition Slip')}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider">{toTitleCase('Short Bond Paper')}</span>
                <span className="text-[9px] font-bold text-slate-300 dark:text-slate-700">|</span>
                <span className="text-[9px] font-bold text-brand-orange tracking-wider">{request.id}</span>
                {request.ticketNo && (
                  <>
                    <span className="text-[9px] font-bold text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-[9px] font-bold text-brand-orange tracking-wider uppercase">TKT: {request.ticketNo}</span>
                  </>
                )}
                {request.poNumber && (
                  <>
                    <span className="text-[9px] font-bold text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-[9px] font-bold text-[#0081f1] tracking-wider uppercase">PO: {cleanPONumber(request.poNumber)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint} 
              className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white rounded-lg font-medium text-xs transition-all shadow-lg shadow-brand-orange/20 active:scale-95 flex items-center gap-2 uppercase tracking-wider"
            >
              <Printer size={16} /> {toTitleCase('Print Slip')}
            </button>
            <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1"></div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 dark:text-slate-500">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-grow overflow-y-auto p-12 bg-slate-200/40 dark:bg-slate-900/40">
          <div 
            ref={printRef}
            className="bg-white mx-auto w-full max-w-[794px] shadow-2xl p-[15mm] text-black"
            style={{ 
                fontFamily: "'Inter', sans-serif",
                minHeight: '1027px', // Visual ratio for Short Bond (8.5x11)
                lineHeight: '1.4'
            }}
          >
            {/* Header Content */}
            <div className="text-center mb-8">
              <h1 className="text-[15px] font-bold uppercase mb-0.5 tracking-tight">PPH DIGITAL MEDIA PRODUCTION INC.</h1>
              <h2 className="text-[12px] font-bold uppercase mb-5 tracking-widest">I.T. DEPARTMENT</h2>
              
              <div className="inline-block border-b-2 border-black pb-0.5 mb-8">
                <h3 className="text-[14px] font-bold uppercase tracking-[0.1em]">EQUIPMENT / SUPPLIES REQUISITION SLIP</h3>
              </div>

              <div className="flex justify-center gap-10 text-[11px] font-bold">
                <div className="flex items-center gap-2">
                   <div className="w-5 h-5 border border-black flex items-center justify-center text-[10px] font-black leading-none bg-black text-white">
                    X
                   </div>
                   <span className="tracking-wider">ARALINKS</span>
                </div>
              </div>
            </div>

            {/* Form Fields Section */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 mb-8 text-[11px]">
              <div className="space-y-1.5">
                <div className="flex items-end">
                  <span className="font-bold w-32 flex-shrink-0">Requested By:</span>
                  <span className="border-b border-black flex-grow pb-0 px-2 font-medium min-h-[16px]">{request.requestedBy}</span>
                </div>
                <div className="flex items-end">
                  <span className="font-bold w-32 flex-shrink-0">School Name:</span>
                  <span className="border-b border-black flex-grow pb-0 px-2 font-medium min-h-[16px]">{request.schoolName}</span>
                </div>
                <div className="flex items-end">
                  <span className="font-bold w-32 flex-shrink-0">Purpose of request:</span>
                  <span className="border-b border-black flex-grow pb-0 px-2 font-medium min-h-[16px]">{request.purpose}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-end">
                  <span className="font-bold w-32 flex-shrink-0">Control No:</span>
                  <span className="border-b border-black flex-grow pb-0 px-2 font-black min-h-[16px] uppercase tracking-widest">{request.id}</span>
                </div>
                <div className="flex items-end">
                  <span className="font-bold w-32 flex-shrink-0">Program:</span>
                  <span className="border-b border-black flex-grow pb-0 px-2 font-medium min-h-[16px] uppercase">{request.program}</span>
                </div>
                <div className="flex items-end">
                  <span className="font-bold w-32 flex-shrink-0">Date of Request:</span>
                  <span className="border-b border-black flex-grow pb-0 px-2 font-medium min-h-[16px]">{request.date}</span>
                </div>
              </div>
            </div>

            {/* Remarks Section - Moved below Date of Request as requested */}
            <div className="mb-6 text-[11px]">
              <div className="flex items-start">
                <span className="font-bold w-32 flex-shrink-0">Remarks:</span>
                <span className="border-b border-black flex-grow pb-1 px-2 font-medium min-h-[22px] italic text-[10px]">{request.remarks || '-'}</span>
              </div>
            </div>

            {/* Attachments Section (Visual Only on Preview, but shown for confirmation) */}
            {request.attachment && (
              <div className="mb-6 no-print">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Paperclip size={12} />
                  Supporting Documents ({request.attachment.split(',').length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {request.attachment.split(',').map((url, idx) => (
                    <a 
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-orange-50 hover:border-orange-200 hover:text-brand-orange transition-all"
                    >
                      <FileText size={12} />
                      Document {idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Requisition Table */}
            <div className="mb-8">
              <table className="w-full border-collapse border border-black text-[10px] requisition-table">
                <thead>
                  <tr className="bg-white">
                    <th className="w-16 text-center uppercase border border-black font-bold p-1 leading-tight">Qty<br/>Req.</th>
                    <th className="w-20 text-center uppercase border border-black font-bold p-1">UOM</th>
                    <th className="w-32 text-center uppercase border border-black font-bold p-1 whitespace-nowrap">Item Code</th>
                    <th className="text-left uppercase border border-black font-bold p-1 px-3">Description</th>
                    {hasBundles && (
                      <th className="w-40 text-left uppercase border border-black font-bold p-1 px-3 leading-tight">Type of<br/>Bundle</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {request.items && request.items.length > 0 ? (
                    request.items.map((item, idx) => (
                      <tr key={idx} className="h-[28px]">
                        <td className="text-center border border-black font-bold">{item.qty}</td>
                        <td className="text-center border border-black uppercase">{item.uom}</td>
                        <td className="text-center border border-black uppercase font-mono text-[9px]">{item.item_code}</td>
                        <td className="text-left border border-black uppercase px-3 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{item.item}</td>
                        {hasBundles && (
                          <td 
                            className="text-left border border-black uppercase px-3 text-[9px] font-bold"
                            style={{ color: item.bundle_name ? getBundleColor(item.bundle_name)?.bg || '#000000' : 'inherit' }}
                          >
                            {item.bundle_name || '-'}
                          </td>
                        )}
                      </tr>
                    ))
                  ) : null}

                  {/* Empty filler rows */}
                  {Array.from({ length: Math.max(0, 12 - (request.items?.length || 0)) }).map((_, i) => (
                    <tr key={`filler-${i}`} className="h-[28px]">
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      {hasBundles && <td className="border border-black"></td>}
                      <td className="border border-black"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-24 mt-12 px-6">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold mb-12">Noted by:</span>
                <div className="border-t border-black text-center pt-2">
                   <p className="text-[13px] font-bold uppercase mb-0.5 tracking-tight">Jerald Dela Cruz</p>
                   <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest leading-normal">
                     IT - DIGITAL OPERATION UNIT<br />
                     TEAM LEADER
                   </p>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold mb-12">Approved by:</span>
                <div className="border-t border-black text-center pt-2">
                   <p className="text-[13px] font-bold uppercase mb-0.5 tracking-tight">DEWEY PALLASIGUE</p>
                   <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Chief Technology Officer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestPreviewModal;
