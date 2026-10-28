import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Visitor } from '../../types';
import { useApp } from '../../context/AppContext';
import { retryImport } from '../../lib/chunkReload';
import { supabase, isSupabaseConfigured, getFunctionErrorMessage } from '../../lib/supabase';
import { normalizeDigits, normalizePhone, isValidMobile } from '../../context/utils';
import { getTehranDateParts } from '../../utils/dateUtils';
import {
  FileSpreadsheet,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  AlertCircle,
  Copy,
  Check,
  Pause,
  Play,
  RotateCcw,
  Store,
  Users,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Filter,
  Eye,
  Info,
  BookmarkPlus,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface ExcelStoreImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitors: Visitor[];
}

interface RawRowData {
  __rowNum: number;
  [key: string]: any;
}

interface ColumnMapping {
  nameCol: string;
  ownerCol: string;
  mobileCol: string;
  landlineCol: string;
  addressCol: string;
}

export interface ProcessedStoreRow {
  index: number;
  rawRow: number;
  name: string;
  owner: string;
  phone: string; // Valid 09xxxxxxxxx
  landline: string; // Raw landline
  address: string;
  validationStatus: 'valid' | 'invalid' | 'duplicate';
  validationMessage?: string;
  // Execution result fields
  status?: 'created' | 'duplicate' | 'invalid' | 'error';
  password?: string;
  resultMessage?: string;
}

export interface SmsTemplateItem {
  id: string;
  title: string;
  text: string;
  isSystem?: boolean;
}

export const STORAGE_LAST_SMS_TEMPLATE = 'barfroosh_last_sms_template';
export const STORAGE_SMS_TEMPLATES = 'barfroosh_sms_templates';
export const STORAGE_LAST_SMS_LINK = 'barfroosh_last_sms_link';

export const DEFAULT_SMS_TEMPLATES: SmsTemplateItem[] = [
  {
    id: 'default_standard',
    title: 'استاندارد بارفروش (پیش‌فرض)',
    text: '{owner} عزیز، فروشگاه {name} به بارفروش دعوت شد. ورود: {link} نام کاربری: {phone} رمز: {password}',
    isSystem: true,
  },
  {
    id: 'default_short',
    title: 'کوتاه (۱ پیامک)',
    text: '{name} عزیز، پنل بارفروش شما فعال شد. ورود: {link} کاربری: {phone} رمز: {password}',
    isSystem: true,
  },
  {
    id: 'default_formal',
    title: 'رسمی و اداری',
    text: 'جناب آقای/سرکار خانم {owner}؛ پنل سفارش‌گیری {name} در سامانه بارفروش آماده بهره‌برداری است. نشانی: {link} کلمه عبور: {password}',
    isSystem: true,
  },
  {
    id: 'default_welcome_bonus',
    title: 'دعوت همراه با پاداش عضویت',
    text: '{owner} عزیز، حساب فروشگاه {name} در بارفروش فعال شد. همراه با پاداش عضویت باشگاه مشتریان! ورود: {link} کاربری: {phone} رمز: {password}',
    isSystem: true,
  },
];

const BATCH_SIZE = 40;
const DEFAULT_LINK = 'https://Barfroosh.ir';
const DEFAULT_TEMPLATE = DEFAULT_SMS_TEMPLATES[0].text;

// Helper to extract first valid Iranian mobile number from a string/cell
export function extractFirstValidMobile(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = normalizeDigits(String(value).trim());
  if (!str) return null;

  // Search regex across the whole cell
  const regex = /(?:(?:\+?98|0098)?0?|0)?(9\d{9})(?!\d)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    const candidate = '0' + match[1];
    if (/^09\d{9}$/.test(candidate)) {
      return candidate;
    }
  }

  // Tokenize by common delimiters
  const tokens = str.split(/[\s,،/\\;\-\|\n\r]+/);
  for (const token of tokens) {
    const cleaned = normalizePhone(token);
    if (/^09\d{9}$/.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

// Clean and normalize column header for matching
function cleanHeader(h: string): string {
  return String(h || '')
    .replace(/[\s\u200c\u200b\u200e\u200f]+/g, ' ')
    .trim()
    .toLowerCase();
}

// Format message template
export function formatStoreMessage(
  template: string,
  store: { name: string; owner?: string; phone: string; password?: string },
  link: string = DEFAULT_LINK
): string {
  const effectiveOwner = store.owner?.trim() ? store.owner.trim() : 'همکار گرامی';
  return template
    .replace(/\{name\}/g, store.name || '')
    .replace(/\{owner\}/g, effectiveOwner)
    .replace(/\{phone\}/g, store.phone || '')
    .replace(/\{password\}/g, store.password || '')
    .replace(/\{link\}/g, link || DEFAULT_LINK);
}

export const ExcelStoreImportModal: React.FC<ExcelStoreImportModalProps> = ({
  isOpen,
  onClose,
  visitors,
}) => {
  if (!isOpen) return null;
  return <ExcelStoreImportModalInner onClose={onClose} visitors={visitors} />;
};

const ExcelStoreImportModalInner: React.FC<Omit<ExcelStoreImportModalProps, 'isOpen'>> = ({
  onClose,
  visitors,
}) => {
  const { refreshData, showToast } = useApp();

  // Wizard Steps: 1: upload & preview, 2: mapping & settings, 3: importing, 4: results
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRowData[]>([]);

  // Column mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    nameCol: '',
    ownerCol: '',
    mobileCol: '',
    landlineCol: '',
    addressCol: '',
  });

  // Settings
  const [batchTag, setBatchTag] = useState<string>(() => {
    const parts = getTehranDateParts(new Date());
    if (parts) {
      return `import-${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    }
    return `import-${new Date().toISOString().slice(0, 10)}`;
  });
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>(''); // '' = مستقیم (Direct)

  // Link & Message Template with localStorage persistence
  const [linkUrl, setLinkUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_SMS_LINK);
      if (saved && saved.trim()) return saved.trim();
    } catch {
      // ignore
    }
    return DEFAULT_LINK;
  });

  const [smsTemplates, setSmsTemplates] = useState<SmsTemplateItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SMS_TEMPLATES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const custom = parsed.filter((t: any) => !t.isSystem);
          return [...DEFAULT_SMS_TEMPLATES, ...custom];
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SMS_TEMPLATES;
  });

  const [messageTemplate, setMessageTemplate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_SMS_TEMPLATE);
      if (saved && saved.trim()) return saved;
    } catch {
      // ignore
    }
    return DEFAULT_TEMPLATE;
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_SMS_TEMPLATE);
      if (saved) {
        const match = DEFAULT_SMS_TEMPLATES.find((t) => t.text.trim() === saved.trim());
        if (match) return match.id;
      }
    } catch {
      // ignore
    }
    return 'default_standard';
  });

  const [isAddingNewTemplate, setIsAddingNewTemplate] = useState<boolean>(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState<string>('');

  // Sanitized rows (computed from rawRows and mapping)
  const [processedRows, setProcessedRows] = useState<ProcessedStoreRow[]>([]);

  // Execution states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const shouldStopRef = useRef(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [allResults, setAllResults] = useState<ProcessedStoreRow[]>([]);

  // Safety & Export states
  const [hasDownloadedExport, setHasDownloadedExport] = useState(false);
  const [isClosePromptOpen, setIsClosePromptOpen] = useState(false);
  const [resultFilter, setResultFilter] = useState<'all' | 'created' | 'duplicate' | 'error' | 'invalid'>('all');

  // Prevent accidental tab closing if passwords exist and haven't been exported
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasCreated = allResults.some((r) => r.status === 'created');
      if (hasCreated && !hasDownloadedExport) {
        e.preventDefault();
        e.returnValue = 'رمزهای عبور موقت ایجاد شده هنوز دانلود نشده‌اند و در صورت بستن صفحه از بین خواهند رفت.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [allResults, hasDownloadedExport]);

  // File Upload and Parsing Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let XLSX: typeof import('xlsx');
    try {
      XLSX = await retryImport(() => import('xlsx'));
    } catch (importErr) {
      console.error('Failed to load xlsx:', importErr);
      showToast('بارگذاری ماژول اکسل ناموفق بود، اینترنت را بررسی و دوباره تلاش کنید', 'error');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Parse sheet to array of objects
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
        if (!rawJson || rawJson.length < 2) {
          showToast('فایل اکسل خالی است یا سرفصل‌های ستون‌ها یافت نشد.', 'error');
          return;
        }

        // Header row
        const headers: string[] = (rawJson[0] || []).map((h: any) => String(h || '').trim());
        setRawHeaders(headers);

        // Data rows
        const parsedRows: RawRowData[] = [];
        for (let r = 1; r < rawJson.length; r++) {
          const rowArr = rawJson[r];
          // Check if row has at least one non-empty value
          const hasData = rowArr && rowArr.some((val: any) => String(val || '').trim() !== '');
          if (hasData) {
            const rowObj: RawRowData = { __rowNum: r + 1 };
            headers.forEach((hdr, idx) => {
              rowObj[hdr] = rowArr[idx] !== undefined ? rowArr[idx] : '';
            });
            parsedRows.push(rowObj);
          }
        }

        setRawRows(parsedRows);

        // Auto-detect column mapping
        const autoMap: ColumnMapping = {
          nameCol: '',
          ownerCol: '',
          mobileCol: '',
          landlineCol: '',
          addressCol: '',
        };

        const nameAliases = ['نام صنف', 'نام فروشگاه', 'نام سوپرمارکت', 'عنوان فروشگاه', 'فروشگاه', 'نام', 'صنف'];
        const ownerAliases = ['مدیریت', 'مالک', 'صاحب', 'نام مالک', 'صاحب فروشگاه', 'نام مدیر', 'مدیر'];
        const mobileAliases = ['موبایل', 'تلفن همراه', 'شماره موبایل', 'شماره همراه', 'همراه'];
        const landlineAliases = ['تلفن', 'تلفن ثابت', 'شماره تلفن', 'شماره ثابت', 'ثابت'];
        const addressAliases = ['آدرس', 'نشانی', 'ادرس', 'محل'];

        headers.forEach((h) => {
          const cleanH = cleanHeader(h);

          if (!autoMap.nameCol && nameAliases.some((alias) => cleanH.includes(cleanHeader(alias)))) {
            autoMap.nameCol = h;
          } else if (!autoMap.ownerCol && ownerAliases.some((alias) => cleanH.includes(cleanHeader(alias)))) {
            autoMap.ownerCol = h;
          } else if (!autoMap.mobileCol && mobileAliases.some((alias) => cleanH.includes(cleanHeader(alias)))) {
            autoMap.mobileCol = h;
          } else if (!autoMap.landlineCol && landlineAliases.some((alias) => cleanH.includes(cleanHeader(alias)))) {
            autoMap.landlineCol = h;
          } else if (!autoMap.addressCol && addressAliases.some((alias) => cleanH.includes(cleanHeader(alias)))) {
            autoMap.addressCol = h;
          }
        });

        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        console.error('Error reading excel file:', err);
        showToast('خطا در خواندن فایل اکسل. لطفاً ساختار فایل را بررسی کنید.', 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Re-process rawRows whenever mapping changes
  useEffect(() => {
    if (!rawRows.length || !mapping.nameCol) {
      setProcessedRows([]);
      return;
    }

    const seenMobiles = new Set<string>();
    const processed: ProcessedStoreRow[] = [];

    rawRows.forEach((row, idx) => {
      const rawName = String(row[mapping.nameCol] || '').trim();
      const rawOwner = mapping.ownerCol ? String(row[mapping.ownerCol] || '').trim() : '';
      const rawMobileCell = mapping.mobileCol ? row[mapping.mobileCol] : '';
      const rawLandlineCell = mapping.landlineCol ? row[mapping.landlineCol] : '';
      const rawAddress = mapping.addressCol ? String(row[mapping.addressCol] || '').trim() : '';

      // 1. First attempt to extract mobile from mobile column
      let validMobile = extractFirstValidMobile(rawMobileCell);

      // 2. If not found, attempt to extract mobile from landline column
      if (!validMobile && rawLandlineCell) {
        validMobile = extractFirstValidMobile(rawLandlineCell);
      }

      // Always pass raw landline string
      const landline = rawLandlineCell !== null && rawLandlineCell !== undefined
        ? normalizeDigits(String(rawLandlineCell)).trim()
        : '';

      const baseRow: ProcessedStoreRow = {
        index: idx + 1,
        rawRow: row.__rowNum,
        name: rawName,
        owner: rawOwner,
        phone: validMobile || normalizePhone(String(rawMobileCell || '')),
        landline,
        address: rawAddress,
        validationStatus: 'valid',
      };

      // Validation Rules
      if (!rawName) {
        baseRow.validationStatus = 'invalid';
        baseRow.validationMessage = 'بدون نام صنف';
      } else if (!validMobile) {
        baseRow.validationStatus = 'invalid';
        baseRow.validationMessage = 'بدون موبایل معتبر';
      } else if (seenMobiles.has(validMobile)) {
        baseRow.validationStatus = 'duplicate';
        baseRow.validationMessage = 'شماره موبایل تکراری در فایل';
      } else {
        seenMobiles.add(validMobile);
        baseRow.validationStatus = 'valid';
      }

      processed.push(baseRow);
    });

    setProcessedRows(processed);
  }, [rawRows, mapping]);

  // Counts of valid, invalid, duplicate
  const validRows = useMemo(
    () => processedRows.filter((r) => r.validationStatus === 'valid'),
    [processedRows]
  );
  const invalidRows = useMemo(
    () => processedRows.filter((r) => r.validationStatus === 'invalid'),
    [processedRows]
  );
  const duplicateFileRows = useMemo(
    () => processedRows.filter((r) => r.validationStatus === 'duplicate'),
    [processedRows]
  );

  // Live message preview calculation
  const previewStore = useMemo(() => {
    return (
      validRows[0] || {
        name: 'سوپرمارکت نمونه',
        owner: 'محمد حسینی',
        phone: '09111234567',
        password: '******',
      }
    );
  }, [validRows]);

  const previewMessageText = useMemo(() => {
    return formatStoreMessage(
      messageTemplate,
      {
        name: previewStore.name,
        owner: previewStore.owner,
        phone: previewStore.phone || '09111234567',
        password: '******',
      },
      linkUrl
    );
  }, [messageTemplate, previewStore, linkUrl]);

  // Persian SMS Segment Calculation: 70 chars per part
  const smsSegments = Math.ceil(previewMessageText.length / 70) || 1;

  // Template & Link persistence handlers
  const handleTemplateChange = (newVal: string) => {
    setMessageTemplate(newVal);
    try {
      localStorage.setItem(STORAGE_LAST_SMS_TEMPLATE, newVal);
    } catch {
      // ignore
    }
    const match = smsTemplates.find((t) => t.text.trim() === newVal.trim());
    setSelectedTemplateId(match ? match.id : 'custom');
  };

  const handleLinkChange = (newVal: string) => {
    setLinkUrl(newVal);
    try {
      localStorage.setItem(STORAGE_LAST_SMS_LINK, newVal);
    } catch {
      // ignore
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'custom') return;
    const found = smsTemplates.find((t) => t.id === templateId);
    if (found) {
      setMessageTemplate(found.text);
      try {
        localStorage.setItem(STORAGE_LAST_SMS_TEMPLATE, found.text);
      } catch {
        // ignore
      }
    }
  };

  const handleSaveAsNewTemplate = () => {
    const trimmedTitle = newTemplateTitle.trim();
    if (!trimmedTitle) {
      showToast('لطفاً عنوان قالب را وارد کنید.', 'error');
      return;
    }
    if (!messageTemplate.trim()) {
      showToast('متن قالب نمی‌تواند خالی باشد.', 'error');
      return;
    }
    const newId = `custom_${Date.now()}`;
    const newTpl: SmsTemplateItem = {
      id: newId,
      title: trimmedTitle,
      text: messageTemplate,
      isSystem: false,
    };
    const updated = [...smsTemplates, newTpl];
    setSmsTemplates(updated);
    setSelectedTemplateId(newId);
    try {
      const customOnly = updated.filter((t) => !t.isSystem);
      localStorage.setItem(STORAGE_SMS_TEMPLATES, JSON.stringify(customOnly));
      localStorage.setItem(STORAGE_LAST_SMS_TEMPLATE, messageTemplate);
    } catch {
      // ignore
    }
    setNewTemplateTitle('');
    setIsAddingNewTemplate(false);
    showToast(`قالب «${trimmedTitle}» با موفقیت ذخیره شد.`, 'success');
  };

  const handleDeleteTemplate = (templateId: string) => {
    const tplToDelete = smsTemplates.find((t) => t.id === templateId);
    if (!tplToDelete || tplToDelete.isSystem) return;
    const updated = smsTemplates.filter((t) => t.id !== templateId);
    setSmsTemplates(updated);
    try {
      const customOnly = updated.filter((t) => !t.isSystem);
      localStorage.setItem(STORAGE_SMS_TEMPLATES, JSON.stringify(customOnly));
    } catch {
      // ignore
    }
    setSelectedTemplateId('custom');
    showToast(`قالب «${tplToDelete.title}» حذف شد.`, 'info');
  };

  // Insert Variable helper into message textarea
  const insertVariable = (variable: string) => {
    handleTemplateChange(messageTemplate + variable);
  };

  // Execution: Start Import
  const handleStartImport = async () => {
    if (!validRows.length) {
      showToast('هیچ ردیف معتبری برای ورود یافت نشد.', 'error');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      showToast('ارتباط با سرور برقرار نیست یا پایگاه داده پیکربندی نشده است.', 'error');
      return;
    }

    setIsConfirmModalOpen(false);
    setStep(3);
    setIsImporting(true);
    setIsPaused(false);
    shouldStopRef.current = false;

    // Batches
    const batches: ProcessedStoreRow[][] = [];
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      batches.push(validRows.slice(i, i + BATCH_SIZE));
    }

    setTotalBatches(batches.length);
    setCurrentBatchIndex(0);
    setProcessedCount(0);
    setCreatedCount(0);
    setDuplicateCount(0);
    setErrorCount(0);

    const accumulatedResults: ProcessedStoreRow[] = [];

    // Also include pre-calculated invalid and duplicate-in-file rows in final results
    const preFilteredFailures: ProcessedStoreRow[] = [
      ...duplicateFileRows.map((r) => ({
        ...r,
        status: 'duplicate' as const,
        resultMessage: 'تکراری در فایل اکسل',
      })),
      ...invalidRows.map((r) => ({
        ...r,
        status: 'invalid' as const,
        resultMessage: r.validationMessage || 'نامعتبر',
      })),
    ];

    try {
      for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        if (shouldStopRef.current) {
          showToast('عملیات ورود توسط کاربر متوقف شد.', 'info');
          break;
        }

        setCurrentBatchIndex(bIdx + 1);
        const currentBatch = batches[bIdx];

        const payloadRows = currentBatch.map((r) => ({
          index: r.index,
          name: r.name,
          owner: r.owner,
          phone: r.phone,
          landline: r.landline,
          address: r.address,
        }));

        // Send batch with 1 automatic retry on network failure
        let batchResponse: any = null;
        let attempt = 1;

        while (attempt <= 2) {
          try {
            const { data, error } = await supabase.functions.invoke('import-stores', {
              body: {
                rows: payloadRows,
                batch: batchTag,
                assigned_visitor_id: selectedVisitorId || null,
              },
            });

            if (error) throw error;
            batchResponse = data;
            break;
          } catch (batchErr) {
            console.warn(`[Batch ${bIdx + 1}] Attempt ${attempt} failed:`, batchErr);
            if (attempt === 1) {
              attempt++;
              await new Promise((res) => setTimeout(res, 1200));
            } else {
              // Failed after 2 attempts
              const errMsg = await getFunctionErrorMessage(batchErr, 'خطا در ارتباط با سرور.');
              currentBatch.forEach((r) => {
                accumulatedResults.push({
                  ...r,
                  status: 'error',
                  resultMessage: errMsg,
                });
              });
              setErrorCount((prev) => prev + currentBatch.length);
              setProcessedCount((prev) => prev + currentBatch.length);
            }
          }
        }

        // Process successful batch response
        if (batchResponse?.results && Array.isArray(batchResponse.results)) {
          const resultsMap = new Map<number, any>();
          batchResponse.results.forEach((resItem: any) => {
            resultsMap.set(resItem.index, resItem);
          });

          currentBatch.forEach((row) => {
            const res = resultsMap.get(row.index);
            if (res) {
              const status = res.status || 'created';
              const processedRowResult: ProcessedStoreRow = {
                ...row,
                status,
                password: res.password,
                resultMessage: res.message,
              };
              accumulatedResults.push(processedRowResult);

              if (status === 'created') setCreatedCount((c) => c + 1);
              else if (status === 'duplicate') setDuplicateCount((d) => d + 1);
              else setErrorCount((e) => e + 1);
            } else {
              // Fallback
              accumulatedResults.push({
                ...row,
                status: 'error',
                resultMessage: 'پاسخی از سرور برای این ردیف دریافت نشد',
              });
              setErrorCount((e) => e + 1);
            }
          });

          setProcessedCount((prev) => prev + currentBatch.length);
        }
      }
    } catch (generalErr) {
      console.error('Fatal import error:', generalErr);
      showToast('خطای غیرمنتظره در پردازش دسته‌ها رخ داد.', 'error');
    } finally {
      setIsImporting(false);
      const finalAll = [...accumulatedResults, ...preFilteredFailures];
      setAllResults(finalAll);
      setStep(4);
      refreshData();
    }
  };

  const handleStopImport = () => {
    shouldStopRef.current = true;
    setIsPaused(true);
  };

  // Excel Downloads
  const handleDownloadExcel = async (onlyFailed = false) => {
    const rowsToExport = onlyFailed
      ? allResults.filter((r) => r.status !== 'created')
      : allResults;

    if (rowsToExport.length === 0) {
      showToast('ردیفی برای خروجی اکسل یافت نشد.', 'info');
      return;
    }

    let XLSX: typeof import('xlsx');
    try {
      XLSX = await retryImport(() => import('xlsx'));
    } catch (importErr) {
      console.error('Failed to load xlsx:', importErr);
      showToast('بارگذاری ماژول اکسل ناموفق بود، اینترنت را بررسی و دوباره تلاش کنید', 'error');
      return;
    }

    const exportData = rowsToExport.map((r) => {
      const isCreated = r.status === 'created';
      const filledMessage = isCreated
        ? formatStoreMessage(
            messageTemplate,
            {
              name: r.name,
              owner: r.owner,
              phone: r.phone,
              password: r.password || '',
            },
            linkUrl
          )
        : '';

      let statusLabel = 'ناموفق';
      if (r.status === 'created') statusLabel = 'ثبت موفق';
      else if (r.status === 'duplicate') statusLabel = `تکراری (${r.resultMessage || ''})`;
      else if (r.status === 'invalid') statusLabel = `نامعتبر (${r.resultMessage || ''})`;
      else if (r.status === 'error') statusLabel = `خطا: ${r.resultMessage || ''}`;

      return {
        'نام صنف': r.name || '',
        'مدیریت': r.owner || '',
        'موبایل': r.phone || '',
        'رمز': isCreated ? r.password || '' : '',
        'پیام': filledMessage,
        'وضعیت': statusLabel,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!dir'] = 'rtl';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, onlyFailed ? 'ناموفق‌ها' : 'فروشگاه‌ها');

    const fileNameOutput = onlyFailed
      ? `failed-stores-${Date.now()}.xlsx`
      : `imported-stores-${Date.now()}.xlsx`;

    XLSX.writeFile(workbook, fileNameOutput);
    setHasDownloadedExport(true);
    showToast('فایل اکسل با موفقیت دانلود شد.', 'success');
  };

  // Safe Close Request
  const handleRequestClose = () => {
    const hasCreated = allResults.some((r) => r.status === 'created');
    if (step === 4 && hasCreated && !hasDownloadedExport) {
      setIsClosePromptOpen(true);
      return;
    }
    onClose();
  };

  // Filtered results for view in step 4
  const filteredResults = useMemo(() => {
    if (resultFilter === 'all') return allResults;
    if (resultFilter === 'created') return allResults.filter((r) => r.status === 'created');
    if (resultFilter === 'duplicate') return allResults.filter((r) => r.status === 'duplicate');
    if (resultFilter === 'error') return allResults.filter((r) => r.status === 'error');
    if (resultFilter === 'invalid') return allResults.filter((r) => r.status === 'invalid');
    return allResults;
  }, [allResults, resultFilter]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in select-none"
      dir="rtl"
    >
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-xs space-y-5 my-auto max-h-[94vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                ورود دسته‌جمعی فروشگاه‌ها از اکسل
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                بارگذاری اکسل، تطبیق ستون‌ها، پاکسازی شماره‌ها و ساخت سریع حساب کاربری
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isImporting}
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Upload File */}
        {step === 1 && (
          <div className="space-y-5 py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-750 hover:border-emerald-500/70 bg-slate-950/60 rounded-3xl p-8 text-center cursor-pointer transition space-y-3 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition mx-auto flex items-center justify-center border border-emerald-500/20">
                <Upload className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-slate-200">
                  برای انتخاب فایل اکسل یا CSV کلیک کنید یا آن را اینجا رها کنید
                </p>
                <p className="text-slate-400 text-[11px]">
                  پشتیبانی از فرمت‌های xlsx. و csv. با ستون‌های: نام صنف، تلفن، موبایل، مدیریت، آدرس
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-slate-300">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Info className="w-4 h-4" />
                <span>راهنمای ساختار ستون‌های اکسل:</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                سامانه به طور خودکار ستون‌های «نام صنف»، «موبایل»، «مدیریت»، «تلفن» و «آدرس» را شناسایی می‌کند.
                شماره‌های ورود اولویت‌دار از ستون موبایل و در صورت عدم وجود از ستون تلفن استخراج شده و ارقام فارسی به لاتین تبدیل می‌گردند.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Mapping, Preview & Settings */}
        {step === 2 && (
          <div className="space-y-5">
            {/* 1. File Preview (First 5 Rows) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  پیش‌نمایش ۵ ردیف اول فایل ({fileName})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setRawRows([]);
                    setRawHeaders([]);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  تعویض فایل
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-850 rounded-2xl max-h-44 bg-slate-950">
                <table className="w-full text-right border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0">
                      <th className="p-2 w-10 text-center font-mono">#</th>
                      {rawHeaders.map((h, i) => (
                        <th key={i} className="p-2 whitespace-nowrap font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 font-sans">
                    {rawRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/50">
                        <td className="p-2 text-center text-slate-500 font-mono">{rIdx + 1}</td>
                        {rawHeaders.map((h, cIdx) => (
                          <td key={cIdx} className="p-2 text-slate-300 truncate max-w-[160px]">
                            {String(row[h] || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Column Mapping Grid */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-200">تطبیق ستون‌های فایل با مشخصات فروشگاه:</span>
                <span className="text-[10px] text-amber-400">ستاره‌دار (*) اجباری است</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Store Name (Required) */}
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    نام فروشگاه (نام صنف) *
                  </label>
                  <select
                    value={mapping.nameCol}
                    onChange={(e) => setMapping((m) => ({ ...m, nameCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- انتخاب ستون --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile (Primary Login Phone) */}
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    موبایل (شماره ورود اولیه)
                  </label>
                  <select
                    value={mapping.mobileCol}
                    onChange={(e) => setMapping((m) => ({ ...m, mobileCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- انتخاب ستون --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Owner */}
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    مالک / مدیریت
                  </label>
                  <select
                    value={mapping.ownerCol}
                    onChange={(e) => setMapping((m) => ({ ...m, ownerCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- انتخاب ستون (اختیاری) --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Landline */}
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    تلفن ثابت (جایگزین موبایل و شماره ثابت)
                  </label>
                  <select
                    value={mapping.landlineCol}
                    onChange={(e) => setMapping((m) => ({ ...m, landlineCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- انتخاب ستون (اختیاری) --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    آدرس فروشگاه
                  </label>
                  <select
                    value={mapping.addressCol}
                    onChange={(e) => setMapping((m) => ({ ...m, addressCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- انتخاب ستون (اختیاری) --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Sanitization Summary Badges */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-slate-400 text-[11px] block">آماده ورود (معتبر)</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {validRows.length} فروشگاه
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="text-slate-400 text-[11px] block">شماره‌های تکراری فایل</span>
                <span className="text-base font-bold font-mono text-amber-400">
                  {duplicateFileRows.length} ردیف
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <span className="text-slate-400 text-[11px] block">فاقد نام یا موبایل</span>
                <span className="text-base font-bold font-mono text-rose-400">
                  {invalidRows.length} ردیف
                </span>
              </div>
            </div>

            {/* 4. Import Settings (Batch Tag, Visitor) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div>
                <label className="block text-slate-300 font-bold text-xs mb-1">
                  برچسب دسته (Batch Tag):
                </label>
                <input
                  type="text"
                  value={batchTag}
                  onChange={(e) => setBatchTag(e.target.value)}
                  placeholder="مثال: import-1405-07-22"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold text-xs mb-1">
                  ویزیتور پیش‌فرض:
                </label>
                <select
                  value={selectedVisitorId}
                  onChange={(e) => setSelectedVisitorId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">مستقیم (بدون ویزیتور اختصاصی)</option>
                  {visitors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.phone})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Message Template & Live Preview */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  قالب پیام دعوت (جهت ثبت در خروجی اکسل و پیامک):
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>لینک ورود:</span>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => handleLinkChange(e.target.value)}
                    className="bg-slate-900 border border-slate-750 rounded-lg px-2 py-0.5 text-slate-200 text-xs font-mono w-44 text-left focus:border-emerald-500 focus:outline-none"
                    placeholder="https://Barfroosh.ir"
                  />
                </div>
              </div>

              {/* Template Selector & Presets Toolbar */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <span className="text-[11px] text-slate-300 font-medium whitespace-nowrap flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      انتخاب قالب آماده:
                    </span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleSelectTemplate(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <optgroup label="قالب‌های پیش‌فرض سامانه">
                        {smsTemplates
                          .filter((t) => t.isSystem)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </optgroup>
                      {smsTemplates.some((t) => !t.isSystem) && (
                        <optgroup label="قالب‌های اختصاصی شما">
                          {smsTemplates
                            .filter((t) => !t.isSystem)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                              </option>
                            ))}
                        </optgroup>
                      )}
                      <option value="custom">متن دستی / ویرایش‌شده</option>
                    </select>

                    {/* Delete Custom Template button */}
                    {selectedTemplateId !== 'custom' &&
                      !smsTemplates.find((t) => t.id === selectedTemplateId)?.isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(selectedTemplateId)}
                          title="حذف این قالب اختصاصی"
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition border border-rose-500/30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>

                  {/* Add New Template Toggle */}
                  {!isAddingNewTemplate && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewTemplate(true)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition border border-slate-700 cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ذخیره به عنوان قالب جدید</span>
                    </button>
                  )}
                </div>

                {/* Inline Form to Save as New Template */}
                {isAddingNewTemplate && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800 animate-in fade-in">
                    <input
                      type="text"
                      value={newTemplateTitle}
                      onChange={(e) => setNewTemplateTitle(e.target.value)}
                      placeholder="عنوان قالب جدید (مثال: پیامک جشنواره پاییزه)..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 text-xs focus:border-emerald-500 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAsNewTemplate();
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsNewTemplate}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      ذخیره قالب
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewTemplate(false);
                        setNewTemplateTitle('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                )}
              </div>

              {/* Variable Insertion Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium">افزودن متغیر به متن:</span>
                {['{name}', '{owner}', '{phone}', '{password}', '{link}'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2 py-0.5 rounded-lg bg-slate-850 hover:bg-slate-750 text-emerald-300 text-[10px] font-mono cursor-pointer transition border border-slate-750"
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <textarea
                  value={messageTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-slate-100 text-xs focus:border-emerald-500 focus:outline-none leading-relaxed resize-none"
                  placeholder="متن پیامک دعوت را وارد کنید..."
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>آخرین متن ویرایش‌شده به‌صورت خودکار ذخیره شده و در باز و بسته کردن پنجره حفظ خواهد شد.</span>
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-850 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-bold">پیش‌نمایش پیام ردیف اول:</span>
                  <span className="text-slate-400 font-mono">
                    {previewMessageText.length} کاراکتر • {smsSegments} بخش پیامک فارسی
                  </span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed select-text font-sans bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                  {previewMessageText}
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
              >
                بازگشت
              </button>

              <button
                type="button"
                disabled={validRows.length === 0 || !mapping.nameCol}
                onClick={() => setIsConfirmModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <span>شروع ورود ({validRows.length} فروشگاه)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Progress View */}
        {step === 3 && (
          <div className="space-y-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/25">
              {isImporting && !isPaused ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Pause className="w-8 h-8 text-amber-400" />
              )}
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-base text-slate-100">
                {isPaused
                  ? 'عملیات موقتاً متوقف شد'
                  : 'در حال ایجاد حساب کاربری فروشگاه‌ها در سرور...'}
              </h4>
              <p className="text-slate-400 text-xs">
                دسته {currentBatchIndex} از {totalBatches} (دسته‌های ۴۰ تایی)
              </p>
            </div>

            {/* Progress Bar */}
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((processedCount / (validRows.length || 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>
                  {Math.round((processedCount / (validRows.length || 1)) * 100)}%
                </span>
                <span>
                  {processedCount} از {validRows.length}
                </span>
              </div>
            </div>

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                <span className="text-[10px] text-slate-400 block">ساخته شده</span>
                <span className="font-bold text-base text-emerald-400 font-mono">
                  {createdCount}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                <span className="text-[10px] text-slate-400 block">تکراری</span>
                <span className="font-bold text-base text-amber-400 font-mono">
                  {duplicateCount}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25">
                <span className="text-[10px] text-slate-400 block">خطا</span>
                <span className="font-bold text-base text-rose-400 font-mono">
                  {errorCount}
                </span>
              </div>
            </div>

            {/* Stop Button */}
            {isImporting && !isPaused && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleStopImport}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 mx-auto"
                >
                  <Pause className="w-4 h-4" />
                  <span>توقف (بعد از این دسته)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Final Results & Excel Download */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Prominent Warning Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-start gap-3 text-amber-200">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-xs text-amber-300">
                  توجه بسیار مهم: رمزها فقط همین‌جا نمایش داده می‌شوند و جای دیگر ذخیره نمی‌شوند!
                </p>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  جهت حفظ امنیت، رمزهای عبور تولید شده در هیچ پایگاه داده‌ای ثبت دائمی نمی‌شوند. حتماً پیش از بستن این پنجره، فایل اکسل خروجی را دانلود نمایید.
                </p>
              </div>
            </div>

            {/* Results Counters and Filters */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setResultFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    resultFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  همه ({allResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('created')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    resultFilter === 'created'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  ثبت موفق ({allResults.filter((r) => r.status === 'created').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('duplicate')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    resultFilter === 'duplicate'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-amber-300'
                  }`}
                >
                  تکراری ({allResults.filter((r) => r.status === 'duplicate').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('error')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    resultFilter === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-rose-300'
                  }`}
                >
                  خطا ({allResults.filter((r) => r.status === 'error').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('invalid')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    resultFilter === 'invalid'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  نامعتبر ({allResults.filter((r) => r.status === 'invalid').length})
                </button>
              </div>

              {/* Action Buttons: Downloads */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadExcel(true)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود فقط ناموفق‌ها</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadExcel(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/30"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود خروجی اکسل کامل</span>
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto border border-slate-850 rounded-2xl max-h-64 bg-slate-950">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0">
                    <th className="p-2.5 w-12 text-center font-mono">#</th>
                    <th className="p-2.5">نام صنف</th>
                    <th className="p-2.5">مدیریت</th>
                    <th className="p-2.5">موبایل</th>
                    <th className="p-2.5">رمز ورود</th>
                    <th className="p-2.5">وضعیت</th>
                    <th className="p-2.5">توضیح / خطا</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 font-sans">
                  {filteredResults.map((row, idx) => {
                    const isCreated = row.status === 'created';
                    const isDuplicate = row.status === 'duplicate';
                    const isErr = row.status === 'error';
                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-200">{row.name}</td>
                        <td className="p-2.5 text-slate-400">{row.owner || '—'}</td>
                        <td className="p-2.5 font-mono text-slate-300">{row.phone}</td>
                        <td className="p-2.5 font-mono text-emerald-400 font-bold select-all">
                          {isCreated ? row.password : '—'}
                        </td>
                        <td className="p-2.5">
                          {isCreated && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                              ثبت موفق
                            </span>
                          )}
                          {isDuplicate && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                              تکراری
                            </span>
                          )}
                          {isErr && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-bold text-[11px] border border-rose-500/30">
                              خطا
                            </span>
                          )}
                          {row.status === 'invalid' && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold text-[11px] border border-slate-700">
                              نامعتبر
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px]">
                          {row.resultMessage || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Finish */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                مجموع فروشگاه‌های وارد شده:{' '}
                <strong className="text-emerald-400 font-mono">
                  {allResults.filter((r) => r.status === 'created').length}
                </strong>
              </span>

              <button
                type="button"
                onClick={handleRequestClose}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition shadow-md shadow-blue-600/30"
              >
                پایان و بستن
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Before Starting Modal */}
      {isConfirmModalOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsConfirmModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-3xl p-5 sm:p-6 shadow-2xl text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-slate-100">تأیید شروع ساخت حساب‌ها</h4>
            </div>

            <div className="space-y-3 text-slate-300 leading-relaxed text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">تعداد فروشگاه‌های معتبر:</span>
                  <span className="font-bold font-mono text-emerald-400">{validRows.length} فروشگاه</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">برچسب دسته:</span>
                  <span className="font-mono text-slate-200">{batchTag}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">تعداد دسته‌ها:</span>
                  <span className="font-mono text-slate-200">{Math.ceil(validRows.length / BATCH_SIZE)} دسته ۴۰تایی</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300">
                <p className="font-bold text-xs">یادآوری مهم:</p>
                <p className="text-[11px] mt-0.5 text-amber-200/90">
                  فقط حساب کاربری این فروشگاه‌ها در سامانه ساخته می‌شود و هیچ پیامکی ارسال نمی‌شود. پس از اتمام، رمزهای ایجاد شده در قالب فایل اکسل در اختیار شما قرار می‌گیرند.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={handleStartImport}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>تأیید و شروع ورود</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Before Closing Un-downloaded Passwords Modal */}
      {isClosePromptOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsClosePromptOpen(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-rose-800/60 rounded-3xl p-5 sm:p-6 shadow-2xl text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-slate-100">رمزهای عبور هنوز دانلود نشده‌اند!</h4>
            </div>

            <p className="text-slate-300 leading-relaxed text-xs">
              رمزهای عبور ایجاد شده در هیچ کجای سرور ذخیره نشده‌اند و با بستن این صفحه برای همیشه از بین خواهند رفت.
              آیا مایل به دانلود فایل اکسل خروجی هستید؟
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsClosePromptOpen(false);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-400 font-bold transition cursor-pointer"
              >
                بستن بدون دانلود
              </button>

              <button
                type="button"
                onClick={() => {
                  handleDownloadExcel(false);
                  setIsClosePromptOpen(false);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود و بستن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
