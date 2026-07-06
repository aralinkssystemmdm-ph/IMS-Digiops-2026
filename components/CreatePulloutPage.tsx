import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Building2, 
  CalendarDays, 
  ChevronDown, 
  Search, 
  Plus, 
  Trash2, 
  User, 
  Users as UsersIcon, 
  Tag, 
  FileText, 
  Check, 
  Box, 
  PlusCircle, 
  X, 
  ArrowLeft, 
  Save, 
  Send, 
  Eye, 
  Paperclip, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Wrench, 
  Edit3,
  Calendar,
  PenTool,
  Download,
  Printer
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotification } from './NotificationProvider';

// Types inside CreatePullout
interface EquipmentRecord {
  item_code: string;
  description: string;
  is_serialized: boolean;
  uom: string;
}

interface SchoolRecord {
  name: string;
  customer_code?: string;
  location?: string;
  sales_team?: string;
  is_buffer: boolean;
}

interface PulloutItemRow {
  id: string; // Dynamic ID
  item_code: string;
  qty: string;
  unit: string;
  description: string;
  serial_number: string;
  status: 'Good' | 'For Disposal' | 'Defective Under Warranty' | 'Defective Out of Warranty';
  storage_location: string;
  remarks: string;
  is_serialized_flag?: boolean; // fetched from equip record
}

interface SignatoryData {
  name: string;
  date_signed: string;
  signature_image?: string; // Base64 encoded drawn or uploaded image
}

interface AttachmentFile {
  name: string;
  size: string;
  type: string;
  base64Src?: string;
}

const CreatePulloutPage: React.FC<{ isDarkMode?: boolean }> = ({ isDarkMode = false }) => {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();

  // Loading States
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentRecord[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false);

  // Search Drodowns state
  const [schoolSearch, setSchoolSearch] = useState('');
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const schoolDropdownRef = useRef<HTMLDivElement>(null);

  // Section 1: Form Fields states
  const [pulloutNo, setPulloutNo] = useState('');
  const [dateOfRequest, setDateOfRequest] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<SchoolRecord | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [agent, setAgent] = useState('');
  const [team, setTeam] = useState('');
  const [project, setProject] = useState('');
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [ticketNo, setTicketNo] = useState('');
  const [area, setArea] = useState('');

  // Section 2: Items state
  const [itemRows, setItemRows] = useState<PulloutItemRow[]>([
    {
      id: 'row-initial',
      item_code: '',
      qty: '1',
      unit: 'PCS',
      description: '',
      serial_number: '',
      status: 'Defective Under Warranty',
      storage_location: 'Return Bin',
      remarks: ''
    }
  ]);
  const [itemSearchQuery, setItemSearchQuery] = useState<{ [rowId: string]: string }>({});
  const [openItemDropdownId, setOpenItemDropdownId] = useState<string | null>(null);
  const itemDropdownRefs = useRef<{ [rowId: string]: HTMLDivElement | null }>({});

  // Section 3: Signatories state
  const [signatories, setSignatories] = useState<{
    prepared: SignatoryData;
    approved: SignatoryData;
    checked: SignatoryData;
    pulled_out: SignatoryData;
    assisted: SignatoryData;
  }>({
    prepared: { name: localStorage.getItem('aralinks_fullname') || '', date_signed: new Date().toISOString().substring(0, 10) },
    approved: { name: '', date_signed: new Date().toISOString().substring(0, 10) },
    checked: { name: '', date_signed: new Date().toISOString().substring(0, 10) },
    pulled_out: { name: '', date_signed: new Date().toISOString().substring(0, 10) },
    assisted: { name: '', date_signed: new Date().toISOString().substring(0, 10) }
  });

  // Active Signature Canvas Dialog
  const [drawingSignatory, setDrawingSignatory] = useState<keyof typeof signatories | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Section 4: Attachments state
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation States
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Preview overlay state
  const [isPrintPreviewActive, setIsPrintPreviewActive] = useState(false);

  // Edit Mode state & parameters
  const { pulloutId } = useParams();
  const isEditMode = !!pulloutId;
  const [originalPullout, setOriginalPullout] = useState<any>(null);
  const [auditTrail, setAuditTrail] = useState<Array<{ editedBy: string; dateModified: string; changesMade: string }>>([]);

  // Auto Generate Pullout No
  useEffect(() => {
    if (isEditMode) return; // Do not auto generate values if editing an existing request

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    setPulloutNo(`PL-${yyyy}${mm}${dd}-${random}`);
    setDateOfRequest(`${yyyy}-${mm}-${dd}`);

    // Pre-fill Prep name with local user
    const savedUser = localStorage.getItem('aralinks_fullname') || '';
    if (savedUser) {
      setSignatories(prev => ({
        ...prev,
        prepared: { ...prev.prepared, name: savedUser }
      }));
    }
  }, [isEditMode]);

  // Load existing pullout for edit mode
  useEffect(() => {
    if (!pulloutId || schools.length === 0) return;

    const saved = localStorage.getItem('aralinks_pullout_requests');
    if (!saved) return;

    try {
      const list = JSON.parse(saved);
      const match = list.find((p: any) => p.id === pulloutId);
      if (match) {
        setOriginalPullout(match);
        setPulloutNo(match.id);
        setDateOfRequest(match.date);
        
        // Match existing school or construct virtual school record
        const matchedSchool = schools.find(s => s.name.toLowerCase() === match.schoolName.toLowerCase()) || {
          name: match.schoolName,
          customer_code: match.customerCode || '',
          location: match.address || '',
          sales_team: match.team || '',
          is_buffer: false
        };

        setSelectedSchool(matchedSchool);
        setSchoolSearch(matchedSchool.name);
        setCustomerCode(match.customerCode || matchedSchool.customer_code || '');
        setAddress(match.address || matchedSchool.location || '');
        setContactPerson(match.contactPerson || '');
        setAgent(match.agent || match.initiatedBy || '');
        setTeam(match.team || matchedSchool.sales_team || '');
        setProject(match.project || '');
        setSchoolYear(match.schoolYear || '2026-2027');
        setTicketNo(match.ticketNo || '');
        setArea(match.area || '');

        // Load item rows
        if (match.itemRows && match.itemRows.length > 0) {
          setItemRows(match.itemRows);
        } else if (match.items && match.items.length > 0) {
          // If editing a standard sample mock, transform its basic item records to full item rows
          const mappedRows = match.items.map((it: any, index: number) => {
            const equip = equipmentList.find(e => e.description === it.name) || {
              item_code: 'EQ-GEN-' + (index + 1),
              uom: 'PCS',
              is_serialized: true
            };
            return {
              id: `row-loaded-${index}-${Date.now()}`,
              item_code: equip.item_code,
              qty: String(it.qty),
              unit: equip.uom,
              description: it.name,
              serial_number: it.serialNumber || 'SN-' + (100000 + Math.floor(Math.random() * 900000)),
              status: (it.category || 'Defective Under Warranty') as any,
              storage_location: 'Return Bin',
              remarks: it.remarks || ''
            };
          });
          setItemRows(mappedRows);
        }

        // Load signatories
        if (match.signatories) {
          setSignatories(match.signatories);
        } else {
          setSignatories({
            prepared: { name: match.initiatedBy || localStorage.getItem('aralinks_fullname') || '', date_signed: match.date },
            approved: { name: '', date_signed: match.date },
            checked: { name: '', date_signed: match.date },
            pulled_out: { name: '', date_signed: match.date },
            assisted: { name: '', date_signed: match.date }
          });
        }

        // Load attachments
        if (match.attachments) {
          setAttachments(match.attachments);
        } else {
          setAttachments([]);
        }

        // Load audit trail
        if (match.auditTrail) {
          setAuditTrail(match.auditTrail);
        }
      }
    } catch (e) {
      console.error('Error parsed for pullout edit:', e);
    }
  }, [pulloutId, schools, equipmentList]);

  // Fetch Supabase data for lookup
  useEffect(() => {
    let active = true;
    const loadFields = async () => {
      setIsLoadingDB(true);
      try {
        if (!isSupabaseConfigured) {
          // Mock seed data
          if (active) {
            setSchools([
              { name: 'Ateneo de Manila University', customer_code: 'ATC-2201', location: 'Katipunan Ave, Quezon City', sales_team: 'NCR-East Team', is_buffer: false },
              { name: 'De La Salle University', customer_code: 'DLC-3401', location: 'Taft Ave, Manila', sales_team: 'NCR-South Team', is_buffer: false },
              { name: 'University of Santo Tomas', customer_code: 'UST-5109', location: 'España Blvd, Sampaloc, Manila', sales_team: 'NCR-Central Team', is_buffer: false },
              { name: 'Far Eastern University', customer_code: 'FEU-4202', location: 'Nicanor Reyes St, Sampaloc, Manila', sales_team: 'NCR-Central Team', is_buffer: false },
              { name: 'Mapua University', customer_code: 'MAP-1105', location: 'Muralla St, Intramuros, Manila', sales_team: 'NCR-West Team', is_buffer: false }
            ]);
            setEquipmentList([
              { item_code: 'EQ-TAB-01', description: 'Aralinks Tablet Book Lite', is_serialized: true, uom: 'PCS' },
              { item_code: 'EQ-AP-02', description: 'Aralinks Access Point V2', is_serialized: true, uom: 'UNIT' },
              { item_code: 'EQ-LAP-03', description: 'Aralinks Laptop Pro V3', is_serialized: true, uom: 'PCS' },
              { item_code: 'EQ-SIB-75', description: 'Aralinks Smart Interactive Board 75"', is_serialized: true, uom: 'SET' },
              { item_code: 'EQ-VRG-02', description: 'Aralinks VR Headset G2', is_serialized: true, uom: 'PCS' },
              { item_code: 'EQ-CB-05', description: 'Standard CAT6 Cable 10m', is_serialized: false, uom: 'PCS' },
              { item_code: 'EQ-PLG-12', description: 'Aralinks Smart Plug Outlet', is_serialized: false, uom: 'PCS' }
            ]);
          }
          setIsLoadingDB(false);
          return;
        }

        // Parallel fetches
        const [schoolsRes, equipRes] = await Promise.all([
          supabase.from('schools').select('name, customer_code, location, sales_team, is_buffer').order('name'),
          supabase.from('equipment').select('item_code, description, is_serialized, uom').is('archived_at', null).order('description')
        ]);

        if (active) {
          if (schoolsRes.data) setSchools(schoolsRes.data as SchoolRecord[]);
          if (equipRes.data) setEquipmentList(equipRes.data as EquipmentRecord[]);
        }
      } catch (e) {
        console.error('Failed to pre-fetch values:', e);
      } finally {
        if (active) setIsLoadingDB(false);
      }
    };

    loadFields();
    return () => { active = false; };
  }, []);

  // Click outside listener for dropdowns
  useEffect(() => {
    const clickOutside = (event: MouseEvent) => {
      if (schoolDropdownRef.current && !schoolDropdownRef.current.contains(event.target as Node)) {
        setIsSchoolDropdownOpen(false);
      }
      
      if (openItemDropdownId) {
        const rowRef = itemDropdownRefs.current[openItemDropdownId];
        if (rowRef && !rowRef.contains(event.target as Node)) {
          setOpenItemDropdownId(null);
        }
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => { document.removeEventListener('mousedown', clickOutside); };
  }, [openItemDropdownId]);

  // Handle school change and auto-fill records
  const handleSelectSchool = (school: SchoolRecord) => {
    setSelectedSchool(school);
    setSchoolSearch(school.name);
    setCustomerCode(school.customer_code || '');
    setAddress(school.location || '');
    setTeam(school.sales_team || '');
    setArea(school.location ? school.location.split(',').pop()?.trim() || '' : '');
    setIsSchoolDropdownOpen(false);
  };

  // Filtered Schools
  const filteredSchools = useMemo(() => {
    return schools.filter(s => 
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      (s.customer_code && s.customer_code.toLowerCase().includes(schoolSearch.toLowerCase()))
    );
  }, [schools, schoolSearch]);

  // Section 2 Table management
  const handleAddRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    setItemRows([
      ...itemRows,
      {
        id: newId,
        item_code: '',
        qty: '1',
        unit: 'PCS',
        description: '',
        serial_number: '',
        status: 'Defective Under Warranty',
        storage_location: 'Return Bin',
        remarks: ''
      }
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (itemRows.length === 1) {
      showWarning('Row Required', 'Pullout requests require at least 1 item line.');
      return;
    }
    setItemRows(itemRows.filter(r => r.id !== rowId));
  };

  const updateItemRow = (rowId: string, field: keyof PulloutItemRow, val: string) => {
    setItemRows(itemRows.map(r => {
      if (r.id !== rowId) return r;

      if (field === 'qty') {
        const cleaned = val.replace(/[^0-9]/g, '');
        return { ...r, qty: cleaned };
      }

      if (field === 'description') {
        // Look up corresponding equipment
        const found = equipmentList.find(eq => eq.description === val);
        if (found) {
          return {
            ...r,
            description: val,
            item_code: found.item_code,
            unit: found.uom || 'PCS',
            is_serialized_flag: found.is_serialized,
            serial_number: found.is_serialized ? r.serial_number : 'N/A'
          };
        }
        return { ...r, description: val, item_code: '', is_serialized_flag: false };
      }

      return { ...r, [field]: val };
    }));
  };

  const getFilteredEquipment = (rowId: string) => {
    const query = itemSearchQuery[rowId] || '';
    return equipmentList.filter(eq => 
      eq.description.toLowerCase().includes(query.toLowerCase()) ||
      eq.item_code.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);
  };

  // Section 3: Canvas Signatures scribble helpers
  const handleOpenScribbler = (key: keyof typeof signatories) => {
    setDrawingSignatory(key);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = isDarkMode ? '#FFFFFF' : '#030712';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
        }
      }
    }, 100);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawScribble = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingSignatory) return;
    
    // Check if canvas is empty before saving
    const empty = isCanvasBlank(canvas);
    if (empty) {
      showWarning('Blank Canvas', 'Please draw a signature before clicking save, or click cancel.');
      return;
    }

    const base64 = canvas.toDataURL('image/png');
    setSignatories(prev => ({
      ...prev,
      [drawingSignatory]: {
        ...prev[drawingSignatory],
        signature_image: base64
      }
    }));
    setDrawingSignatory(null);
    showSuccess('Signature Saved', 'Digital signature updated successfully in the form state.');
  };

  const isCanvasBlank = (canvas: HTMLCanvasElement) => {
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() === blank.toDataURL();
  };

  const handleUploadSignatureFile = (key: keyof typeof signatories, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showError('Invalid File', 'Please upload an image file (PNG/JPG) for the signature.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        setSignatories(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            signature_image: base64
          }
        }));
        showSuccess('Signature Uploaded', 'Drawn signatory image attached correctly.');
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSignatoryField = (key: keyof typeof signatories, field: 'name' | 'date_signed', value: string) => {
    setSignatories(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Section 4: Attachments drag & upload
  const fileToBlobBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const uploadAttachmentFiles = async (e: React.ChangeEvent<HTMLInputElement> | DragEvent) => {
    let files: File[] = [];
    if ('dataTransfer' in e) {
      if (e.dataTransfer?.files) {
        files = Array.from(e.dataTransfer.files);
      }
    } else if (e.target?.files) {
      files = Array.from(e.target.files);
    }

    const validNewFiles: AttachmentFile[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showWarning('File Exceeded Size', `File "${file.name}" is over 5MB.`);
        continue;
      }
      try {
        const base64Src = await fileToBlobBase64(file);
        validNewFiles.push({
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: file.type || 'application/octet-stream',
          base64Src
        });
      } catch (err) {
        console.error('File conversion err:', err);
      }
    }

    if (validNewFiles.length > 0) {
      setAttachments([...attachments, ...validNewFiles]);
      showSuccess('Files Added', `${validNewFiles.length} file(s) attached successfully.`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Section 5: SUBMIT VALIDATE & STORAGE SAVING
  const validateForm = () => {
    if (!selectedSchool) {
      showWarning('Fields Required', 'Please choose a School Name from the searchable dropdown.');
      return false;
    }
    if (!customerCode.trim()) {
      showWarning('Fields Required', 'Customer Code is a required field.');
      return false;
    }

    // Row validations
    for (let i = 0; i < itemRows.length; i++) {
      const row = itemRows[i];
      if (!row.item_code || !row.description) {
        showWarning('Incomplete Item Line', `Line #${i + 1} has no item selected. Select from searchable description.`);
        return false;
      }
      if (row.is_serialized_flag && !row.serial_number.trim()) {
        showWarning('Missing Serial Number', `Line #${i + 1} ("${row.description}") is a serialized unit and requires a Serial Number.`);
        return false;
      }
      const qtyN = parseFloat(row.qty);
      if (isNaN(qtyN) || qtyN <= 0) {
        showWarning('Invalid Quantity', `Line #${i + 1} requires a valid quantity greater than zero.`);
        return false;
      }
    }

    // Check prepared signatory name
    if (!signatories.prepared.name.trim()) {
      showWarning('Signatory Missing', 'The "Prepared By" name cannot be empty.');
      return false;
    }

    return true;
  };

  const getChangesMade = (original: any) => {
    if (!original) return 'Initial baseline values declared';
    const changes: string[] = [];
    if (original.schoolName !== (selectedSchool?.name || '')) {
      changes.push(`School: "${original.schoolName || ''}" -> "${selectedSchool?.name || ''}"`);
    }
    if ((original.customerCode || '') !== customerCode) {
      changes.push(`Customer Code: "${original.customerCode || ''}" -> "${customerCode}"`);
    }
    if ((original.ticketNo || '') !== ticketNo) {
      changes.push(`Ticket No: "${original.ticketNo || ''}" -> "${ticketNo}"`);
    }
    if ((original.contactPerson || '') !== contactPerson) {
      changes.push(`Contact: "${original.contactPerson || ''}" -> "${contactPerson}"`);
    }
    if ((original.area || '') !== area) {
      changes.push(`Area: "${original.area || ''}" -> "${area}"`);
    }
    if ((original.project || '') !== project) {
      changes.push(`Project: "${original.project || ''}" -> "${project}"`);
    }
    
    const originalItemCount = original.itemRows?.length || original.items?.length || 0;
    if (originalItemCount !== itemRows.length) {
      changes.push(`Equipments list count changed (${originalItemCount} rows to ${itemRows.length} rows)`);
    } else {
      let isItemSpecChanged = false;
      itemRows.forEach((row, idx) => {
        const origDesc = original.itemRows?.[idx]?.description || original.items?.[idx]?.name || '';
        const origQty = original.itemRows?.[idx]?.qty || String(original.items?.[idx]?.qty) || '0';
        const origSn = original.itemRows?.[idx]?.serial_number || original.items?.[idx]?.serialNumber || '';
        if (row.description !== origDesc || row.qty !== origQty || row.serial_number !== origSn) {
          isItemSpecChanged = true;
        }
      });
      if (isItemSpecChanged) {
        changes.push('Items, quantities, or serial number specifications changed');
      }
    }

    if (changes.length === 0) {
      return 'No major fields edited (re-saved form)';
    }
    return changes.join(', ');
  };

  const handleSaveDraft = () => {
    setAttemptedSubmit(true);
    if (!validateForm()) return;

    // Parse items
    const pulloutItems = itemRows.map(r => ({
      name: r.description,
      qty: parseInt(r.qty) || 1,
      category: r.status
    }));

    // Audit entries
    const editor = localStorage.getItem('aralinks_fullname') || 'Authorized User';
    const newAuditLog = isEditMode ? [
      ...auditTrail,
      {
        editedBy: editor,
        dateModified: new Date().toISOString().substring(0, 16).replace('T', ' '),
        changesMade: getChangesMade(originalPullout)
      }
    ] : [];

    const nextPulloutRecord = {
      id: pulloutNo,
      schoolName: selectedSchool?.name || '',
      date: dateOfRequest,
      status: isEditMode ? (originalPullout?.status || 'Pending') : 'Pending',
      totalItems: pulloutItems.reduce((acc, it) => acc + it.qty, 0),
      initiatedBy: signatories.prepared.name,
      remarks: `DRAFT. Customer Code: ${customerCode}. Address: ${address}. Contacts: ${contactPerson}.`,
      items: pulloutItems,
      
      // Secondary fields to support full form reload
      selectedSchool,
      customerCode,
      address,
      contactPerson,
      agent,
      team,
      project,
      schoolYear,
      ticketNo,
      area,
      itemRows,
      signatories,
      attachments,
      auditTrail: newAuditLog
    };

    // Store in LocalStorage
    const saved = localStorage.getItem('aralinks_pullout_requests');
    let list = [];
    if (saved) {
      try {
        list = JSON.parse(saved);
      } catch (e) {
        list = [];
      }
    }

    if (isEditMode) {
      const index = list.findIndex((x: any) => x.id === pulloutId);
      if (index !== -1) {
        list[index] = nextPulloutRecord;
      } else {
        list = [nextPulloutRecord, ...list];
      }
    } else {
      list = [nextPulloutRecord, ...list];
    }
    localStorage.setItem('aralinks_pullout_requests', JSON.stringify(list));

    showSuccess('Draft Code Saved', `Draft Pullout ${pulloutNo} stored successfully inside local system.`);
    navigate('/pullout');
  };

  const handleSubmitRequest = () => {
    setAttemptedSubmit(true);
    if (!validateForm()) return;

    // Parse items
    const pulloutItems = itemRows.map(r => ({
      name: r.description,
      qty: parseInt(r.qty) || 1,
      category: r.status
    }));

    // Audit entries
    const editor = localStorage.getItem('aralinks_fullname') || 'Authorized User';
    const newAuditLog = isEditMode ? [
      ...auditTrail,
      {
        editedBy: editor,
        dateModified: new Date().toISOString().substring(0, 16).replace('T', ' '),
        changesMade: getChangesMade(originalPullout)
      }
    ] : [];

    const nextPulloutRecord = {
      id: pulloutNo,
      schoolName: selectedSchool?.name || '',
      date: dateOfRequest,
      status: 'Pending' as const,
      totalItems: pulloutItems.reduce((acc, it) => acc + it.qty, 0),
      initiatedBy: signatories.prepared.name,
      remarks: `Ticket: ${ticketNo || 'N/A'}. Contacts: ${contactPerson}. Project: ${project}. Area: ${area}.`,
      items: pulloutItems,
      
      // Secondary fields to restore form
      selectedSchool,
      customerCode,
      address,
      contactPerson,
      agent,
      team,
      project,
      schoolYear,
      ticketNo,
      area,
      itemRows,
      signatories,
      attachments,
      auditTrail: newAuditLog
    };

    // Store in LocalStorage
    const saved = localStorage.getItem('aralinks_pullout_requests');
    let list = [];
    if (saved) {
      try {
        list = JSON.parse(saved);
      } catch (e) {
        list = [];
      }
    }

    if (isEditMode) {
      const index = list.findIndex((x: any) => x.id === pulloutId);
      if (index !== -1) {
        list[index] = nextPulloutRecord;
      } else {
        list = [nextPulloutRecord, ...list];
      }
    } else {
      list = [nextPulloutRecord, ...list];
    }
    localStorage.setItem('aralinks_pullout_requests', JSON.stringify(list));

    showSuccess('Pullout Request Updated', `Pullout record ${pulloutNo} generated successfully and synced.`);
    navigate('/pullout');
  };

  return (
    <div className="w-full h-full overflow-y-auto pr-2 pb-16 animate-in fade-in duration-500 no-scrollbar relative font-sans">
      
      {/* Page Header with Back Button */}
      <div className="mx-2 lg:mx-4 mt-2 mb-6">
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <button 
            onClick={() => navigate('/pullout')}
            className={`p-2 rounded-xl transition-colors cursor-pointer border ${
              isDarkMode ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-600'
            }`}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-slate-400">Back to List</span>
        </div>
        
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {isEditMode ? 'Edit Pullout' : 'Create Pullout Request'}
            </h1>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-1.5 leading-none">
              {isEditMode ? 'Modify and verify existing equipment pullout details' : 'Establish and verify equipment list retrievals'}
            </p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsPrintPreviewActive(!isPrintPreviewActive)}
              className={`px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
                isPrintPreviewActive 
                  ? 'bg-brand-orange border-brand-orange text-white' 
                  : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Eye size={14} />
              {isPrintPreviewActive ? 'Edit Form' : 'Form Print Preview'}
            </button>
            <button
              onClick={() => window.print()}
              className={`px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Printer size={14} />
              Print Form
            </button>
            <button
              onClick={handleSaveDraft}
              className={`px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Save size={14} />
              Save Draft
            </button>
            <button
              onClick={handleSubmitRequest}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--brand-accent)',
                boxShadow: '0 4px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 60%)'
              }}
            >
              <Send size={14} />
              {isEditMode ? 'Update Pullout' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>

      <div className={`mx-2 lg:mx-4 space-y-6 ${isPrintPreviewActive ? 'hidden' : 'block'} print:hidden`}>

        {/* SECTION 1: REQUEST INFORMATION */}
        <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Building2 size={18} className="text-brand-orange" />
            <h3 className="text-base font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
              Section 1: Request Information
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Auto Gen Pullout Code */}
            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pullout No. <span className="text-slate-500 font-normal">(Auto)</span>
              </label>
              <input 
                type="text" 
                value={pulloutNo} 
                readOnly 
                className={`w-full h-11 px-4 border rounded-xl font-mono text-sm font-black focus:outline-none cursor-default ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}
              />
            </div>

            {/* Date Input */}
            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Date
              </label>
              <input 
                type="date" 
                value={dateOfRequest}
                onChange={(e) => setDateOfRequest(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none transition-colors ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-brand-orange' : 'bg-white border-slate-200 text-slate-800 focus:border-brand-orange'
                }`}
              />
            </div>

            {/* School Name Searchable Selector */}
            <div className="space-y-1.5 col-span-1 relative" ref={schoolDropdownRef}>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                School Name <span className="text-brand-orange">*</span>
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Search and lookup school..."
                  value={schoolSearch}
                  onChange={(e) => {
                    setSchoolSearch(e.target.value);
                    setIsSchoolDropdownOpen(true);
                  }}
                  onFocus={() => setIsSchoolDropdownOpen(true)}
                  className={`w-full h-11 pl-4 pr-10 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all ${
                    attemptedSubmit && !selectedSchool ? 'border-red-500' : isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
                  {schoolSearch && (
                    <button 
                      onClick={() => {
                        setSchoolSearch('');
                        setSelectedSchool(null);
                        setCustomerCode('');
                        setAddress('');
                        setTeam('');
                        setArea('');
                      }} 
                      className="hover:text-red-500"
                    >
                      <X size={15} />
                    </button>
                  )}
                  <ChevronDown size={14} />
                </div>
              </div>

              {isSchoolDropdownOpen && (
                <div className={`absolute z-50 left-0 right-0 mt-2 max-h-56 overflow-y-auto border rounded-xl shadow-xl divide-y ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 divide-slate-800' : 'bg-white border-slate-100 divide-slate-100'
                }`}>
                  {filteredSchools.length > 0 ? (
                    filteredSchools.map((s, index) => (
                      <button
                        key={`${s.name}-${index}`}
                        onClick={() => handleSelectSchool(s)}
                        className={`w-full text-left px-4 py-3 flex flex-all flex-col transition-colors cursor-pointer ${
                          isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-sm font-bold block truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{s.name}</span>
                        {s.customer_code && (
                          <span className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{s.customer_code}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3.5 text-xs text-slate-400 text-center italic">
                      No schools found matching search
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* School details forms in grid inputs */}
            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Customer Code <span className="text-brand-orange">*</span>
              </label>
              <input 
                type="text" 
                placeholder="Enter customer code"
                value={customerCode}
                onChange={(e) => setCustomerCode(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-brand-orange ${
                  attemptedSubmit && !customerCode.trim() ? 'border-red-500' : isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1 md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Address
              </label>
              <input 
                type="text" 
                placeholder="Lookup or enter address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Contact Person
              </label>
              <input 
                type="text" 
                placeholder="Printed name of school contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Agent / Handler
              </label>
              <input 
                type="text" 
                placeholder="System handler name"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Team
              </label>
              <input 
                type="text" 
                placeholder="e.g. Sales Team / NCR Team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Project
              </label>
              <input 
                type="text" 
                placeholder="Active project name"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                MOA (SY)
              </label>
              <input 
                type="text" 
                placeholder="e.g. 2026-2027"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Ticket No / Reference
              </label>
              <input 
                type="text" 
                placeholder="Reference issue code"
                value={ticketNo}
                onChange={(e) => setTicketNo(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1.5 col-span-1 md:col-span-3">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Area Group
              </label>
              <input 
                type="text" 
                placeholder="Provincial area details"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className={`w-full h-11 px-4 border rounded-xl text-sm font-bold focus:outline-none focus:border-brand-orange ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PULLOUT ITEMS TABLE */}
        <div className={`p-6 rounded-xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Box size={18} className="text-[#3b82f6]" />
              <h3 className="text-base font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
                Section 2: Pullout Items
              </h3>
            </div>
            <button
              onClick={handleAddRow}
              className="px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border text-white"
              style={{ backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)' }}
            >
              <PlusCircle size={14} />
              Add Line Item
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left min-w-[1250px]">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[25%]">Item Description <span className="text-brand-orange">*</span></th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[10%]">Item Code</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[8%] text-center">Qty <span className="text-brand-orange">*</span></th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[8%] text-center">Unit</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[15%]">Serial Number</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[18%]">Status Option</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[12%]">Storage Loc.</th>
                  <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[15%]">Issue / Remarks</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[6%] text-center">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {itemRows.map((row, idx) => (
                  <tr key={row.id} className={isDarkMode ? 'hover:bg-slate-950/30' : 'hover:bg-slate-50/50'}>
                    
                    {/* Description Selector Search dropdown */}
                    <td className="px-4 py-3 text-sm font-semibold relative">
                      <div 
                        className="relative" 
                        ref={el => { itemDropdownRefs.current[row.id] = el; }}
                      >
                        <input 
                          type="text"
                          placeholder="Search items database..."
                          value={itemSearchQuery[row.id] !== undefined ? itemSearchQuery[row.id] : row.description}
                          onChange={(e) => {
                            setItemSearchQuery({ ...itemSearchQuery, [row.id]: e.target.value });
                            setOpenItemDropdownId(row.id);
                          }}
                          onFocus={() => {
                            setItemSearchQuery({ ...itemSearchQuery, [row.id]: row.description });
                            setOpenItemDropdownId(row.id);
                          }}
                          className={`w-full h-10 px-3 border rounded-lg text-xs font-bold focus:outline-none transition-colors ${
                            attemptedSubmit && (!row.item_code || !row.description) 
                              ? 'border-red-500 bg-red-500/5' 
                              : isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-brand-orange' : 'bg-white border-slate-200 text-slate-800 focus:border-brand-orange'
                          }`}
                        />
                        {openItemDropdownId === row.id && (
                          <div className={`absolute z-40 left-0 right-0 mt-1 max-h-48 overflow-y-auto border rounded-xl shadow-xl divide-y ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 divide-slate-800' : 'bg-white border-slate-100 divide-slate-100'
                          }`}>
                            {getFilteredEquipment(row.id).map((eq, sIdx) => (
                              <button
                                key={`${eq.item_code}-${sIdx}`}
                                onClick={() => {
                                  updateItemRow(row.id, 'description', eq.description);
                                  setItemSearchQuery({ ...itemSearchQuery, [row.id]: eq.description });
                                  setOpenItemDropdownId(null);
                                }}
                                className={`w-full text-left px-3 py-2 flex flex-col transition-all cursor-pointer ${
                                  isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                                }`}
                              >
                                <span className={`text-xs font-bold block truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{eq.description}</span>
                                <span className="text-[9px] font-mono font-black text-slate-400 mt-0.5 uppercase tracking-wide">
                                  {eq.item_code} • {eq.is_serialized ? 'Serialized' : 'Bulk'}
                                </span>
                              </button>
                            ))}
                            {getFilteredEquipment(row.id).length === 0 && (
                              <div className="px-3 py-2 text-center text-slate-400 text-[10px] italic">
                                No records found matching query
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Item Code */}
                    <td className="px-3 py-3 font-mono text-xs font-black text-slate-500">
                      {row.item_code || <span className="italic font-normal opacity-50">Empty</span>}
                    </td>

                    {/* Quantity */}
                    <td className="px-3 py-3 text-center">
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={row.qty}
                        onChange={(e) => updateItemRow(row.id, 'qty', e.target.value)}
                        className={`w-16 h-10 px-2.5 text-center border rounded-lg text-xs font-bold focus:outline-none transition-colors ${
                          attemptedSubmit && (!row.qty || parseInt(row.qty) <= 0)
                            ? 'border-red-500'
                            : isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </td>

                    {/* Unit measurement */}
                    <td className="px-3 py-3 text-center">
                      <input 
                        type="text" 
                        placeholder="e.g. PCS"
                        value={row.unit}
                        onChange={(e) => updateItemRow(row.id, 'unit', e.target.value)}
                        className={`w-16 h-10 px-2 text-center border rounded-lg text-xs font-bold focus:outline-none transition-colors ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </td>

                    {/* Serial Numbers (Only edit if descriptive allows serialization) */}
                    <td className="px-3 py-3 text-sm">
                      <input 
                        type="text" 
                        placeholder={row.is_serialized_flag === false ? 'Bulk (N/A)' : 'Input unique serial...'}
                        disabled={row.is_serialized_flag === false}
                        value={row.serial_number}
                        onChange={(e) => updateItemRow(row.id, 'serial_number', e.target.value)}
                        className={`w-full h-10 px-3 border rounded-lg text-xs font-bold focus:outline-none transition-colors ${
                          attemptedSubmit && row.is_serialized_flag && !row.serial_number.trim()
                            ? 'border-red-500 bg-red-500/5'
                            : row.is_serialized_flag === false 
                              ? isDarkMode ? 'bg-slate-800/40 border-slate-800 text-slate-500 italic' : 'bg-slate-50 border-slate-100 text-slate-400 italic'
                              : isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-brand-orange' : 'bg-white border-slate-200 text-slate-800 focus:border-brand-orange'
                        }`}
                      />
                    </td>

                    {/* Item Status dropdown */}
                    <td className="px-3 py-3">
                      <select 
                        value={row.status}
                        onChange={(e) => updateItemRow(row.id, 'status', e.target.value as any)}
                        className={`w-full h-10 px-2.5 border rounded-lg text-xs font-bold focus:outline-none focus:border-brand-orange transition-all ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="Good">Good</option>
                        <option value="For Disposal">For Disposal</option>
                        <option value="Defective Under Warranty">Defective Under Warranty</option>
                        <option value="Defective Out of Warranty">Defective Out of Warranty</option>
                      </select>
                    </td>

                    {/* Storage Destination */}
                    <td className="px-3 py-3">
                      <input 
                        type="text" 
                        value={row.storage_location}
                        onChange={(e) => updateItemRow(row.id, 'storage_location', e.target.value)}
                        className={`w-full h-10 px-3 border rounded-lg text-xs font-bold focus:outline-none focus:border-brand-orange transition-colors ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </td>

                    {/* Remarks Input */}
                    <td className="px-3 py-3">
                      <input 
                        type="text" 
                        placeholder="Provide details..."
                        value={row.remarks}
                        onChange={(e) => updateItemRow(row.id, 'remarks', e.target.value)}
                        className={`w-full h-10 px-3 border rounded-lg text-xs font-bold focus:outline-none focus:border-brand-orange transition-colors ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </td>

                    {/* Delete item line */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className={`p-2 rounded-lg border transition-all hover:scale-110 cursor-pointer ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-rose-500 hover:bg-rose-500/10' 
                            : 'bg-white border-slate-100 text-rose-500 hover:bg-rose-50'
                        }`}
                        title="Delete Line"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: SIGNATORIES */}
        <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <PenTool size={18} className="text-[#a855f7]" />
            <h3 className="text-base font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
              Section 3: Signatories
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            
            {/* Iterative signatory boxes */}
            {(Object.keys(signatories) as Array<keyof typeof signatories>).map((sigKey) => {
              const labelMap = {
                prepared: 'Prepared By (Sender)',
                approved: 'Approved By (Manager)',
                checked: 'Checked and Verified By',
                pulled_out: 'Pulled Out By (Hauler)',
                assisted: 'Assisted / Acknowledged By'
              };
              const sig = signatories[sigKey];

              return (
                <div 
                  key={sigKey} 
                  className={`p-4.5 rounded-xl border flex flex-col justify-between gap-4 ${
                    isDarkMode ? 'bg-slate-950/20 border-slate-800 hover:border-slate-700' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-tight">
                      {labelMap[sigKey]}
                    </span>

                    {/* Name input */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Name</label>
                      <input 
                        type="text" 
                        placeholder={`Printed Name...`}
                        value={sig.name}
                        onChange={(e) => updateSignatoryField(sigKey, 'name', e.target.value)}
                        className={`w-full h-8 px-2.5 border rounded-lg text-xs font-bold focus:outline-none focus:border-brand-orange transition-colors ${
                          attemptedSubmit && sigKey === 'prepared' && !sig.name.trim()
                            ? 'border-red-500'
                            : isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Date signed */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Date Signed</label>
                      <input 
                        type="date" 
                        value={sig.date_signed}
                        onChange={(e) => updateSignatoryField(sigKey, 'date_signed', e.target.value)}
                        className={`w-full h-8 px-2.5 border rounded-lg text-xs font-bold focus:outline-none focus:border-brand-orange transition-colors ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>

                  {/* DIGITAL SIGNATURE SPACE */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide block">Digital Signature</label>
                    <div className={`h-24 w-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all ${
                      sig.signature_image 
                        ? 'bg-white border-brand-orange/20' 
                        : isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}>
                      {sig.signature_image ? (
                        <>
                          <img 
                            src={sig.signature_image} 
                            alt={`${String(sigKey)} Signature`} 
                            className="h-full object-contain max-w-full p-2 grayscale dark:invert transition-all"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={() => {
                              setSignatories(prev => ({
                                ...prev,
                                [sigKey]: { ...prev[sigKey], signature_image: undefined }
                              }));
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:scale-110 active:scale-95 cursor-pointer shadow"
                          >
                            <X size={10} strokeWidth={3} />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 p-2 text-center select-none">
                          <span className="text-[10px] font-bold text-slate-400">No Signature</span>
                          <div className="flex gap-1.5 justify-center">
                            <button
                              onClick={() => handleOpenScribbler(sigKey)}
                              className={`px-2 py-1 text-[8px] tracking-widest font-black uppercase rounded border transition-colors ${
                                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              Draw
                            </button>
                            <label className={`px-2 py-1 text-[8px] tracking-widest font-black uppercase rounded border transition-colors cursor-pointer ${
                              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                            }`}>
                              Browse
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => handleUploadSignatureFile(sigKey, e)}
                                className="hidden" 
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}

          </div>
        </div>

        {/* SECTION 4: ATTACHMENTS */}
        <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-205'}`}>
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Paperclip size={18} className="text-brand-orange" />
            <h3 className="text-base font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
              Section 4: Attachments
            </h3>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              uploadAttachmentFiles(e as any);
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDraggingFile 
                ? 'bg-brand-orange/5 border-brand-orange' 
                : isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={uploadAttachmentFiles}
              multiple
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="p-3 rounded-full bg-brand-orange/10 text-brand-orange">
                <Upload size={22} />
              </div>
              <div>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  Drag and drop files here, or <span className="text-brand-orange cursor-pointer hover:underline" onClick={() => fileInputRef.current?.click()}>Browse files</span>
                </p>
                <p className="text-xs font-semibold text-slate-400 mt-1">Supports images, PDF, excel sheets up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {attachments.map((file, idx) => (
                <div 
                  key={`${file.name}-${idx}`}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                    isDarkMode ? 'bg-slate-950 border-slate-850 hover:bg-slate-900' : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <FileText size={16} />
                    </div>
                    <div className="text-left font-sans truncate text-xs">
                      <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{file.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 font-bold">{file.size}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeAttachment(idx)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer border-none bg-transparent"
                    title="Remove Attachment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 5: AUDIT TRAIL / REVISION HISTORY */}
        {isEditMode && (
          <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <Wrench size={18} className="text-brand-orange" />
              <h3 className="text-base font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
                Revision Audit History
              </h3>
            </div>

            {auditTrail.length > 0 ? (
              <div className="space-y-4">
                {auditTrail.map((log, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-xl border text-xs leading-relaxed flex flex-col gap-2.5 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-150 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-left">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-zinc-500 uppercase">
                          {log.editedBy.substring(0, 2)}
                        </div>
                        <span className="font-extrabold text-slate-700 dark:text-slate-200">{log.editedBy}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">{log.dateModified}</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-left font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-brand-orange block mb-1">Changes Tracked:</span>
                      {log.changesMade}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-400 italic text-center py-4">
                No previous edit logs and audit trail entries exist for this pullout record.
              </p>
            )}
          </div>
        )}

        {/* SECTION 5: ACTION FOOTER BUTTONS */}
        <div className={`p-4.5 rounded-xl border flex items-center justify-between flex-wrap gap-4 ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
        }`}>
          <button
            onClick={() => navigate('/pullout')}
            className={`px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest cursor-pointer transition-colors ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Cancel Form
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPrintPreviewActive(!isPrintPreviewActive)}
              className={`px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
                isPrintPreviewActive 
                  ? 'bg-brand-orange border-brand-orange text-white' 
                  : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Eye size={14} />
              {isPrintPreviewActive ? 'Edit Form' : 'Form Print Preview'}
            </button>
            <button
              onClick={handleSaveDraft}
              className={`px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Save size={14} />
              Save Draft
            </button>
            <button
              onClick={handleSubmitRequest}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--brand-accent)',
                boxShadow: '0 4px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 60%)'
              }}
            >
              <Send size={14} />
              {isEditMode ? 'Update Pullout' : 'Submit Pullout'}
            </button>
          </div>
        </div>

      </div>

      {/* DRAWING SIGNATURE DIALOG (CANVAS ACCRUER) */}
      {drawingSignatory && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setDrawingSignatory(null)} />
          <div className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <h3 className="text-base font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide mb-2">
              Draw Digital Signature
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-normal">
              Use your mouse, trackpad, or touch-screen finger to draft your formal signature on the canvas board below.
            </p>

            <div className={`border-2 border-dashed rounded-xl overflow-hidden relative h-56 transition-all ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <canvas
                ref={canvasRef}
                width={480}
                height={220}
                onMouseDown={startDrawing}
                onMouseMove={drawScribble}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={drawScribble}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair block"
              />
              <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 pointer-events-none rounded bg-black/50 text-[8px] font-black tracking-widest text-slate-300 uppercase">
                Drawing Board Canvas
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                onClick={clearCanvasSignature}
                className={`px-3 py-1.5 border rounded-lg text-[10px] font-black tracking-widest uppercase cursor-pointer transition-colors ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Clear Slate
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setDrawingSignatory(null)}
                  className={`px-4 py-2 border rounded-lg text-[10px] font-black tracking-widest uppercase cursor-pointer transition-colors ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveCanvasSignature}
                  className="px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-md active:scale-95 border cursor-pointer transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)' }}
                >
                  Confirm Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INLINE HIGH-FIDELITY PULLOUT REQUEST PREVIEW (ALIGNED WITH DR STYLE) */}
      <div className={`mx-2 lg:mx-4 print:block ${isPrintPreviewActive ? 'block' : 'hidden'}`}>
        <div className="flex flex-col gap-4">
          
          {/* Top banner controls shown only in print preview mode */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold print:hidden leading-normal">
            <span>
              ℹ️ High-fidelity layout rendering. This matches the exact template form when printed.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPrintPreviewActive(false)}
                className={`px-3.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-zinc-200 hover:bg-slate-50'
                }`}
              >
                Go back to Editor
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <Download size={12} />
                Print Form
              </button>
            </div>
          </div>

          <div className="printable-form-container max-w-4xl w-full mx-auto border border-zinc-350 p-8 bg-white relative shadow-sm rounded-2xl print:shadow-none print:border-none print:p-0 text-zinc-900 font-sans">
            
            {/* Header branding logo section (Screenshot requested by user) */}
            <div className="flex items-center justify-center mb-1 pb-1">
              <img 
                src="https://www.phoenix.com.ph/wp-content/uploads/2026/06/Screenshot-2026-06-04-093703.png"
                alt="Phoenix Publishing House Logo Header"
                className="w-full object-contain max-h-[85px]"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Document title & top right date blocks */}
            <div className="flex items-center justify-between mt-2.5">
              <div className="w-1/4" />
              <div className="w-2/4 text-center">
                <h2 className="text-[14px] font-black tracking-widest text-zinc-900 uppercase font-sans">
                  PULLOUT REQUEST SLIP
                </h2>
              </div>

              {/* Box container for Date and Pullout No. matching paper sketch */}
              <div className="w-1/4 flex justify-end">
                <div className="border border-zinc-500 rounded-sm overflow-hidden shrink-0 text-center text-[10px] w-[165px] leading-tight">
                  <div className="border-b border-zinc-500 p-1 flex items-center justify-between px-2 bg-zinc-50">
                    <span className="font-bold text-zinc-500 uppercase font-sans">Date:</span>
                    <span className="font-mono font-bold text-zinc-800">
                      {dateOfRequest ? new Date(dateOfRequest).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '--/--/----'}
                    </span>
                  </div>
                  <div className="p-1 flex items-center justify-between px-2 bg-zinc-100/50">
                    <span className="font-bold text-zinc-500 uppercase font-sans">Pullout No.</span>
                    <span className="font-mono font-bold text-zinc-900 tracking-wider">
                      {pulloutNo || 'DRAFT-XXXX'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Client information fields grid */}
            <div className="grid grid-cols-12 gap-y-2 text-[10px] text-left mt-4 pb-4 border-b border-zinc-300">
              
              <div className="col-span-7 flex items-end pr-4">
                <span className="w-24 shrink-0 font-bold text-zinc-700">School</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-black text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1 uppercase font-sans">
                  {selectedSchool?.name || <span className="text-zinc-305 italic font-normal">N/A</span>}
                </span>
              </div>
              <div className="col-span-5 flex items-end">
                <span className="w-20 shrink-0 font-bold text-zinc-700">Customer Code</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-mono font-bold text-zinc-900 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                  {customerCode || <span className="text-zinc-200">------</span>}
                </span>
              </div>

              <div className="col-span-7 flex items-end pr-4">
                <span className="w-24 shrink-0 font-bold text-zinc-700">Address</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-medium text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 truncate pl-1 uppercase font-sans">
                  {address || <span className="text-zinc-200">------</span>}
                </span>
              </div>
              <div className="col-span-5 flex items-end">
                <span className="w-20 shrink-0 font-bold text-zinc-700">Agent</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-semibold text-zinc-850 border-b border-zinc-300 flex-grow pb-0.5 pl-1 uppercase font-sans">
                  {agent || <span className="text-zinc-200">------</span>}
                </span>
              </div>

              <div className="col-span-7 flex items-end pr-4">
                <span className="w-24 shrink-0 font-bold text-zinc-700">Contact Person</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-medium text-zinc-800 border-b border-zinc-350 flex-grow pb-0.5 pl-1 truncate font-sans">
                  {contactPerson || <span className="text-zinc-300">__________________________________________</span>}
                </span>
              </div>
              <div className="col-span-5 flex items-end">
                <span className="w-20 shrink-0 font-bold text-zinc-700">Project</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-bold text-zinc-950 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate uppercase font-sans">
                  {project || <span className="text-zinc-200">------</span>}
                </span>
              </div>

              {/* Extra row for Ticket No & Area */}
              <div className="col-span-7 flex items-end pr-4">
                <span className="w-24 shrink-0 font-bold text-zinc-700 font-sans">Ticket No.</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-mono font-bold text-zinc-800 border-b border-zinc-300 flex-grow pb-0.5 pl-1">
                  {ticketNo || <span className="text-zinc-200">------</span>}
                </span>
              </div>
              <div className="col-span-5 flex items-end">
                <span className="w-20 shrink-0 font-bold text-zinc-700 font-sans">Area</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-bold text-zinc-850 border-b border-zinc-300 flex-grow pb-0.5 pl-1 uppercase font-sans">
                  {area || <span className="text-zinc-200">------</span>}
                </span>
              </div>

              {/* MOA SY */}
              <div className="col-span-12 flex items-end mt-1">
                <span className="w-24 shrink-0 font-bold text-zinc-700 font-sans">MOA (SY)</span>
                <span className="font-semibold text-zinc-500 mr-1.5">:</span>
                <span className="font-semibold text-zinc-805 border-b border-zinc-300 flex-grow pb-0.5 pl-1 truncate font-sans">
                  {schoolYear || <span className="text-zinc-200">------</span>}
                </span>
              </div>

            </div>

            {/* ITEMS GRID WITH NESTED STATUS CHECKBOX SUB-COLUMNS */}
            <div className="mt-4 text-[9.5px] text-left">
              <table className="w-full border-collapse border border-zinc-400">
                <thead>
                  <tr className="bg-zinc-100 text-[8.5px] font-black uppercase text-zinc-650 border-b border-zinc-400">
                    <th rowSpan={2} className="border-r border-zinc-400 px-3 py-2 text-center uppercase tracking-wider w-[14%] font-sans">ITEM CODE</th>
                    <th rowSpan={2} className="border-r border-zinc-400 px-1.5 py-2 text-center uppercase tracking-wider w-[7%] font-sans">Quantity</th>
                    <th rowSpan={2} className="border-r border-zinc-400 px-1.5 py-2 text-center uppercase tracking-wider w-[7%] font-sans">Unit</th>
                    <th rowSpan={2} className="border-r border-zinc-400 px-3 py-2 uppercase tracking-wider w-[24%] font-sans text-left">Item</th>
                    <th rowSpan={2} className="border-r border-zinc-400 px-3 py-2 uppercase tracking-wider w-[16%] font-sans text-left">Specifications / Serial</th>
                    <th colSpan={3} className="border-r border-zinc-400 px-1 py-1 text-center tracking-wider text-[8px] uppercase font-sans">Status of the item</th>
                    <th rowSpan={2} className="border-r border-zinc-400 px-2.5 py-2 uppercase tracking-wider w-[10%] font-sans text-left">To be stored at</th>
                    <th rowSpan={2} className="px-2.5 py-2 uppercase tracking-wider w-[14%] font-sans text-left">Issue / Remarks</th>
                  </tr>
                  <tr className="bg-zinc-100 text-[7px] font-black uppercase text-center border-b border-zinc-400">
                    <th className="border-r border-zinc-400 px-1 py-1 w-[5%] text-zinc-600 font-sans">GOOD</th>
                    <th className="border-r border-zinc-400 px-1 py-1 w-[5%] font-extrabold text-blue-900 font-sans">DISPOSAL</th>
                    <th className="border-r border-zinc-400 px-1 py-1 w-[6%] text-rose-800 font-sans">WARRANTY</th>
                  </tr>
                </thead>
                <tbody className="text-[9.5px]">
                  {/* Category row */}
                  <tr className="border-b border-zinc-300 font-bold text-zinc-800 bg-zinc-50/70">
                    <td className="border-r border-zinc-400"></td>
                    <td className="border-r border-zinc-400"></td>
                    <td className="border-r border-zinc-400"></td>
                    <td colSpan={7} className="px-3 py-1 font-black uppercase tracking-wider text-[8.5px] text-zinc-700 font-sans">
                      Pullout Items
                    </td>
                  </tr>

                  {itemRows.map((row, idx) => {
                    const isGood = row.status === 'Good';
                    const isDisposal = row.status === 'For Disposal';
                    const isWarrantyDefective = row.status === 'Defective Under Warranty' || row.status === 'Defective Out of Warranty';

                    return (
                      <tr key={row.id} className="border-b border-zinc-200">
                        <td className="border-r border-zinc-400 px-3 py-2 font-mono font-bold text-center text-zinc-900">{row.item_code || '---'}</td>
                        <td className="border-r border-zinc-400 px-1.5 py-2 font-bold text-center text-zinc-900 font-mono">{row.qty || '0'}</td>
                        <td className="border-r border-zinc-400 px-1.5 py-2 font-extrabold text-zinc-600 text-center uppercase font-sans">{row.unit || 'PCS'}</td>
                        <td className="border-r border-zinc-400 px-3 py-2 font-black text-zinc-900 truncate max-w-[200px]" title={row.description}>{row.description || <span className="opacity-40 italic font-normal text-zinc-400">Empty row</span>}</td>
                        <td className="border-r border-zinc-400 px-3 py-2 font-mono text-zinc-700">{row.serial_number || 'N/A'}</td>
                        
                        {/* GOOD column */}
                        <td className="border-r border-zinc-400 px-1 py-2 text-center">
                          {isGood ? (
                            <span className="inline-block text-emerald-600 font-extrabold text-sm leading-none">✓</span>
                          ) : (
                            <span className="text-zinc-150 inline-block font-hairline select-none opacity-20"></span>
                          )}
                        </td>

                        {/* FOR DISPOSAL column */}
                        <td className="border-r border-zinc-400 px-1 py-2 text-center">
                          {isDisposal ? (
                            <span className="inline-block text-[#3b82f6] font-extrabold text-sm leading-none">✓</span>
                          ) : (
                            <span className="text-zinc-150 inline-block font-hairline select-none opacity-20"></span>
                          )}
                        </td>

                        {/* DEFECTIVE WARRANTY column */}
                        <td className="border-r border-zinc-400 px-1 py-2 text-center">
                          {isWarrantyDefective ? (
                            <span className="inline-block text-rose-600 font-extrabold text-sm leading-none">✓</span>
                          ) : (
                            <span className="text-zinc-150 inline-block font-hairline select-none opacity-20"></span>
                          )}
                        </td>

                        <td className="border-r border-zinc-400 px-2.5 py-2 text-zinc-700 leading-tight truncate max-w-[90px] font-sans">{row.storage_location || 'Return Bin'}</td>
                        <td className="px-2.5 py-2 text-xs italic text-zinc-700 select-all font-semibold leading-tight font-sans">{row.remarks || '---'}</td>
                      </tr>
                    );
                  })}

                  {/* Clean End row indicator *nothing follows* */}
                  <tr className="border-b border-zinc-300">
                    <td colSpan={10} className="py-2 text-center text-[10px] font-black text-zinc-400 tracking-[0.2em] italic bg-zinc-50/50">
                      &quot;nothing follows&quot;
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SIGNATORIES PANEL */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-5 text-left leading-snug text-[10px] mt-6 pt-4 border-t border-zinc-300 font-sans">
              
              {/* Prepared by */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase text-zinc-600 block">Prepared by/Date:</span>
                </div>
                <div 
                  onClick={() => {
                    setDrawingSignatory('prepared');
                    setIsPrintPreviewActive(false);
                  }}
                  className="relative flex items-center justify-center h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer overflow-hidden transition-all"
                  title="Click to sign signature screen"
                >
                  {signatories.prepared.signature_image ? (
                    <img 
                      src={signatories.prepared.signature_image} 
                      alt="Prepared Signature" 
                      className="object-contain h-full w-44 opacity-95 scale-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-zinc-305 text-[9px] italic">Sign here</span>
                  )}
                </div>
                <div className="text-center font-sans">
                  <p className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none py-0.5">
                    {signatories.prepared.name || 'Sarah Connor'}
                  </p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">
                    Printed Name/Signature/Date: {signatories.prepared.date_signed || ''}
                  </p>
                </div>
              </div>

              {/* Approved by */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase text-zinc-600 block">Approved by/Date:</span>
                </div>
                <div 
                  onClick={() => {
                    setDrawingSignatory('approved');
                    setIsPrintPreviewActive(false);
                  }}
                  className="relative flex items-center justify-center h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer overflow-hidden transition-all"
                  title="Click to sign signature screen"
                >
                  {signatories.approved.signature_image ? (
                    <img 
                      src={signatories.approved.signature_image} 
                      alt="Approved Signature" 
                      className="object-contain h-full w-44 opacity-95 scale-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-zinc-305 text-[9px] italic font-sans">Sign here</span>
                  )}
                </div>
                <div className="text-center font-sans">
                  <p className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none py-0.5">
                    {signatories.approved.name || <span className="opacity-0">---</span>}
                  </p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">
                    Printed Name/Signature/Date: {signatories.approved.date_signed || ''}
                  </p>
                </div>
              </div>

              {/* Checked and verified status */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase text-zinc-600 block font-sans">Checked and verified items status by/Date:</span>
                </div>
                <div 
                  onClick={() => {
                    setDrawingSignatory('checked');
                    setIsPrintPreviewActive(false);
                  }}
                  className="relative flex items-center justify-center h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer overflow-hidden transition-all"
                  title="Click to sign signature screen"
                >
                  {signatories.checked.signature_image ? (
                    <img 
                      src={signatories.checked.signature_image} 
                      alt="Checked Signature" 
                      className="object-contain h-full w-44 opacity-95 scale-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-zinc-305 text-[9px] italic font-sans font-normal">Sign here</span>
                  )}
                </div>
                <div className="text-center font-sans">
                  <p className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none py-0.5">
                    {signatories.checked.name || <span className="opacity-0">---</span>}
                  </p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">
                    Printed Name/Signature/Date: {signatories.checked.date_signed || ''}
                  </p>
                </div>
              </div>

              {/* Pulled out by */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase text-zinc-600 block">Pulled out by: /Date:</span>
                </div>
                <div 
                  onClick={() => {
                    setDrawingSignatory('pulled_out');
                    setIsPrintPreviewActive(false);
                  }}
                  className="relative flex items-center justify-center h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer overflow-hidden transition-all"
                  title="Click to sign signature screen"
                >
                  {signatories.pulled_out.signature_image ? (
                    <img 
                      src={signatories.pulled_out.signature_image} 
                      alt="Pulled Out Signature" 
                      className="object-contain h-full w-44 opacity-95 scale-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-zinc-305 text-[9px] italic font-sans font-normal">Sign here</span>
                  )}
                </div>
                <div className="text-center font-sans">
                  <p className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none py-0.5">
                    {signatories.pulled_out.name || <span className="opacity-0">---</span>}
                  </p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">
                    Printed Name/Signature/Date: {signatories.pulled_out.date_signed || ''}
                  </p>
                </div>
              </div>

              {/* Pull out assisted */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase text-zinc-650 block">Pull out assisted/acknowledged by:</span>
                </div>
                <div 
                  onClick={() => {
                    setDrawingSignatory('assisted');
                    setIsPrintPreviewActive(false);
                  }}
                  className="relative flex items-center justify-center h-14 border border-dashed border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer overflow-hidden transition-all"
                  title="Click to sign signature screen"
                >
                  {signatories.assisted.signature_image ? (
                    <img 
                      src={signatories.assisted.signature_image} 
                      alt="Assisted Signature" 
                      className="object-contain h-full w-44 opacity-95 scale-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-zinc-305 text-[9px] italic font-sans font-normal">Sign here</span>
                  )}
                </div>
                <div className="text-center font-sans">
                  <p className="font-extrabold text-zinc-900 border-b border-zinc-400 block pb-0.5 max-w-[200px] mx-auto text-[10px] uppercase tracking-wide leading-none py-0.5">
                    {signatories.assisted.name || <span className="opacity-0">---</span>}
                  </p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 block">
                    Printed Name/Signature/Date: {signatories.assisted.date_signed || ''}
                  </p>
                </div>
              </div>

              {/* Big red RECEIVED stamp effect */}
              <div className="pt-4 flex justify-end">
                <div className="border-3 border-dashed border-rose-600/35 px-4 py-1.5 rounded rotate-[-9deg] pointer-events-none select-none text-center shadow-xs font-sans">
                  <span className="text-rose-600/35 text-xs font-black tracking-[0.25em] leading-tight block uppercase">RECEIVED</span>
                  <span className="text-rose-600/30 font-bold text-[6px] block uppercase mt-0.5">ARALINKS RETRIEVED BASE</span>
                </div>
              </div>

            </div>

            {/* FOOTER MESSAGES */}
            <div className="mt-8 pt-3.5 border-t border-zinc-300 text-[8px] text-zinc-400 font-mono">
              <div className="flex justify-between items-center font-bold">
                <span>* Please fill up remarks field if necessary</span>
                <span className="lowercase">page 1 of 1</span>
                <span>cc: PPH I.T. Dept., Customer</span>
              </div>
              <p className="text-center font-extrabold text-rose-650/80 mt-2 uppercase tracking-wide text-[8px]">
                Note: Pls. prepare two (2) copies. 1 copy for school and 1 copy for Aralinks IT (PPH)
              </p>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default CreatePulloutPage;
