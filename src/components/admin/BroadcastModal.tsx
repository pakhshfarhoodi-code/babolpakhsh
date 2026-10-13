import React, { useState, useRef } from 'react';
import { supabase, isSupabaseConfigured, getFunctionErrorMessage } from '../../lib/supabase';
import {
  Send,
  X,
  Users,
  Store,
  Truck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Check,
  RotateCcw,
  Image as ImageIcon,
  Trash2,
  Info,
} from 'lucide-react';

export type BroadcastChannel = 'eitaa' | 'telegram';
export type BroadcastAudience = 'all' | 'stores' | 'visitors' | 'admins';

interface ChannelStats {
  recipients?: number;
  sent?: number;
  failed?: number;
  capped?: boolean;
  aborted?: boolean;
  firstError?: string;
}

interface BroadcastResponseResult {
  eitaa?: ChannelStats;
  telegram?: ChannelStats;
}

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CompressedImageState {
  base64: string;
  previewUrl: string;
  originalFileName: string;
  fileSizeBytes: number;
}

const MAX_CHAR_COUNT_DEFAULT = 3500;
const MAX_CHAR_COUNT_IMAGE = 1024;
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_IMAGE_DIMENSION = 1280;

export const BroadcastModal: React.FC<BroadcastModalProps> = ({ isOpen, onClose }) => {
  // Form State
  const [selectedChannels, setSelectedChannels] = useState<BroadcastChannel[]>(['eitaa', 'telegram']);
  const [selectedAudience, setSelectedAudience] = useState<BroadcastAudience>('all');
  const [messageText, setMessageText] = useState('');

  // Image Attachment State
  const [selectedImage, setSelectedImage] = useState<CompressedImageState | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Counting / Preview State
  const [isCounting, setIsCounting] = useState(false);
  const [previewResult, setPreviewResult] = useState<BroadcastResponseResult | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  // Send & Confirmation State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<BroadcastResponseResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  if (!isOpen) return null;

  const currentMaxChars = selectedImage ? MAX_CHAR_COUNT_IMAGE : MAX_CHAR_COUNT_DEFAULT;

  const toggleChannel = (channel: BroadcastChannel) => {
    setSelectedChannels((prev) => {
      const exists = prev.includes(channel);
      if (exists) {
        return prev.filter((c) => c !== channel);
      } else {
        return [...prev, channel];
      }
    });
    setPreviewResult(null);
  };

  const handleAudienceChange = (aud: BroadcastAudience) => {
    setSelectedAudience(aud);
    setPreviewResult(null);
  };

  const audienceOptions: { id: BroadcastAudience; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'all',
      label: 'همه کاربران',
      desc: 'فروشگاه‌ها، ویزیتورها و مدیران متصل به ربات',
      icon: Users,
    },
    {
      id: 'stores',
      label: 'فروشگاه‌ها',
      desc: 'سوپرمارکت‌ها و مشتریان عضو ربات',
      icon: Store,
    },
    {
      id: 'visitors',
      label: 'ویزیتورها',
      desc: 'بازاریاب‌ها و پرسنل پخش',
      icon: Truck,
    },
    {
      id: 'admins',
      label: 'ادمین‌ها',
      desc: 'مدیران ارشد و حسابداران سیستم',
      icon: ShieldCheck,
    },
  ];

  // Client-side image compression and resizing using Canvas
  const processImageFile = (file: File): Promise<CompressedImageState> => {
    return new Promise((resolve, reject) => {
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
        return reject(new Error('لطفاً یک فایل تصویری با فرمت معتبر (JPG, PNG یا WebP) انتخاب نمایید.'));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر.'));
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) {
          return reject(new Error('داده‌های فایل تصویر قابل بارگذاری نیست.'));
        }

        const img = new Image();
        img.onerror = () => reject(new Error('تصویر انتخاب شده معتبر نیست یا قابل پردازش نمی‌باشد.'));
        img.onload = () => {
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            // Resize maintaining aspect ratio if larger than 1280px
            if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
              if (width > height) {
                height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
                width = MAX_IMAGE_DIMENSION;
              } else {
                width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
                height = MAX_IMAGE_DIMENSION;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              return reject(new Error('عدم پشتیبانی مرورگر از محیط گرافیکی جهت فشرده‌سازی تصویر.'));
            }

            // Fill white background for transparent PNG/WebP conversions to JPEG
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Export as image/jpeg with quality 0.8
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            // Pure base64 without data: prefix
            const pureBase64 = jpegDataUrl.replace(/^data:image\/[^;]+;base64,/, '');

            // Calculate byte size of base64
            const byteSize = Math.round((pureBase64.length * 3) / 4);

            if (byteSize > MAX_IMAGE_SIZE_BYTES) {
              return reject(
                new Error(
                  `حجم تصویر پس از فشرده‌سازی (${(byteSize / (1024 * 1024)).toFixed(1)} مگابایت) بیش از سقف مجاز ۳ مگابایت است. لطفاً تصویر کم‌حجم‌تری انتخاب نمایید.`
                )
              );
            }

            resolve({
              base64: pureBase64,
              previewUrl: jpegDataUrl,
              originalFileName: file.name,
              fileSizeBytes: byteSize,
            });
          } catch (err) {
            reject(err instanceof Error ? err : new Error('خطا در فشرده‌سازی تصویر.'));
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);
    setIsProcessingImage(true);

    try {
      const processed = await processImageFile(file);
      setSelectedImage(processed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در بارگذاری تصویر.';
      setImageError(msg);
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Recipient Count Handler (preview: true - no text and no image)
  const handleCountRecipients = async () => {
    if (selectedChannels.length === 0) {
      setCountError('حداقل یک کانال (ایتا یا تلگرام) را انتخاب کنید.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setCountError('اتصال به سرور برقرار نیست یا پایگاه داده پیکربندی نشده است.');
      return;
    }

    setIsCounting(true);
    setCountError(null);
    setPreviewResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('broadcast-message', {
        body: {
          channels: selectedChannels,
          audience: selectedAudience,
          preview: true,
        },
      });

      if (error) {
        const errMsg = await getFunctionErrorMessage(error, 'خطا در ارتباط با سرور جهت شمارش گیرندگان.');
        setCountError(errMsg);
        return;
      }

      if (data?.error) {
        setCountError(String(data.error));
        return;
      }

      const res = data?.result as BroadcastResponseResult;
      setPreviewResult(res || {});
    } catch (err) {
      const errMsg = await getFunctionErrorMessage(err, 'خطای غیرمنتظره در شمارش گیرندگان.');
      setCountError(errMsg);
    } finally {
      setIsCounting(false);
    }
  };

  // Open Confirmation Modal
  const handleRequestSend = () => {
    const hasContent = messageText.trim().length > 0 || Boolean(selectedImage);
    if (!hasContent || selectedChannels.length === 0) return;
    setSendError(null);
    setIsConfirmOpen(true);
  };

  // Confirm and Execute Broadcast Send (preview: false)
  const handleConfirmSend = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSendError('اتصال به سرور برقرار نیست یا پایگاه داده پیکربندی نشده است.');
      setIsConfirmOpen(false);
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const bodyPayload: Record<string, any> = {
        channels: selectedChannels,
        audience: selectedAudience,
        text: messageText.trim(),
        preview: false,
      };

      if (selectedImage?.base64) {
        bodyPayload.image = {
          base64: selectedImage.base64,
          mime: 'image/jpeg',
        };
      }

      const { data, error } = await supabase.functions.invoke('broadcast-message', {
        body: bodyPayload,
      });

      if (error) {
        const errMsg = await getFunctionErrorMessage(error, 'خطا در ارسال پیام به سرور.');
        setSendError(errMsg);
        setIsConfirmOpen(false);
        return;
      }

      if (data?.error) {
        setSendError(String(data.error));
        setIsConfirmOpen(false);
        return;
      }

      const res = data?.result as BroadcastResponseResult;
      setSendResult(res || {});
      setIsComplete(true);
      setIsConfirmOpen(false);
    } catch (err) {
      const errMsg = await getFunctionErrorMessage(err, 'خطای غیرمنتظره در ارسال پیام.');
      setSendError(errMsg);
      setIsConfirmOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetForm = () => {
    setMessageText('');
    setSelectedImage(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setPreviewResult(null);
    setCountError(null);
    setSendResult(null);
    setSendError(null);
    setIsComplete(false);
    setIsConfirmOpen(false);
  };

  const hasContent = messageText.trim().length > 0 || Boolean(selectedImage);
  const isNoChannel = selectedChannels.length === 0;
  const isOverLimit = messageText.length > currentMaxChars;
  const isSendDisabled =
    !hasContent ||
    isNoChannel ||
    isOverLimit ||
    isSending ||
    isCounting ||
    isProcessingImage;

  const hasCappedRecipients =
    (previewResult?.eitaa?.capped === true) ||
    (previewResult?.telegram?.capped === true) ||
    (sendResult?.eitaa?.capped === true) ||
    (sendResult?.telegram?.capped === true);

  // Check if any selected channel was aborted
  const hasAbortedChannel =
    Boolean(selectedChannels.includes('eitaa') && sendResult?.eitaa?.aborted) ||
    Boolean(selectedChannels.includes('telegram') && sendResult?.telegram?.aborted);

  const getAudienceLabel = (aud: BroadcastAudience) => {
    switch (aud) {
      case 'all': return 'همه کاربران';
      case 'stores': return 'فروشگاه‌ها';
      case 'visitors': return 'ویزیتورها';
      case 'admins': return 'ادمین‌ها';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-xs space-y-5 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                ارسال پیام به ایتا و تلگرام
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                اطلاع‌رسانی دسته‌جمعی به کاربران و اعضای فعال در ربات‌ها
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Notice if any */}
        {sendError && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-xs">خطا در ارسال پیام</p>
              <p className="text-[11px] leading-relaxed">{sendError}</p>
            </div>
          </div>
        )}

        {/* Capped 300 Recipients Warning */}
        {hasCappedRecipients && (
          <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-xs">محدودیت سقف گیرندگان (سقف ۳۰۰ نفر)</p>
              <p className="text-[11px] leading-relaxed">
                تعداد مخاطبان در یکی از کانال‌ها بیش از سقف مجاز است. جهت حفظ پایداری، در هر نوبت ارسال حداکثر ۳۰۰ نفر پیام دریافت می‌کنند.
              </p>
            </div>
          </div>
        )}

        {/* VIEW 1: Send Result Summary (if broadcast finished) */}
        {isComplete && sendResult ? (
          <div className="space-y-4 animate-in fade-in">
            {/* Top status banner: Alert if aborted, Success if all completed */}
            {hasAbortedChannel ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-center">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-rose-300">
                  ارسال پیام با توقف در برخی از کانال‌ها همراه شد
                </h4>
                <p className="text-slate-400 text-[11px]">
                  برخی کانال‌ها به دلیل بروز خطا در حین ارسال متوقف شدند. جزئیات هر کانال را در زیر بررسی نمایید:
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-emerald-300">
                  عملیات ارسال پیام با موفقیت خاتمه یافت
                </h4>
                <p className="text-slate-400 text-[11px]">
                  گزارش تفکیکی نتایج ارسال به ازای کانال‌های پیام‌رسان در زیر آورده شده است:
                </p>
              </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Eitaa Card */}
              {selectedChannels.includes('eitaa') && (
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    sendResult.eitaa?.aborted
                      ? 'bg-rose-950/20 border-rose-800/60'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-orange-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                      کانال ایتا
                    </span>
                    {sendResult.eitaa?.capped && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                        محدود به ۳۰۰
                      </span>
                    )}
                  </div>

                  {/* Red Alert if aborted */}
                  {sendResult.eitaa?.aborted && (
                    <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>ارسال این کانال متوقف شد</span>
                      </div>
                      {sendResult.eitaa.firstError && (
                        <p className="text-[10px] text-rose-200/90 leading-relaxed">
                          {sendResult.eitaa.firstError}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1 text-slate-300 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">تعداد کل گیرندگان:</span>
                      <span className="font-bold font-mono">{sendResult.eitaa?.recipients ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>ارسال موفق:</span>
                      <span className="font-bold font-mono">{sendResult.eitaa?.sent ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span>ناموفق:</span>
                      <span className="font-bold font-mono">{sendResult.eitaa?.failed ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Telegram Card */}
              {selectedChannels.includes('telegram') && (
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    sendResult.telegram?.aborted
                      ? 'bg-rose-950/20 border-rose-800/60'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-sky-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                      کانال تلگرام
                    </span>
                    {sendResult.telegram?.capped && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                        محدود به ۳۰۰
                      </span>
                    )}
                  </div>

                  {/* Red Alert if aborted */}
                  {sendResult.telegram?.aborted && (
                    <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>ارسال این کانال متوقف شد</span>
                      </div>
                      {sendResult.telegram.firstError && (
                        <p className="text-[10px] text-rose-200/90 leading-relaxed">
                          {sendResult.telegram.firstError}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1 text-slate-300 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">تعداد کل گیرندگان:</span>
                      <span className="font-bold font-mono">{sendResult.telegram?.recipients ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>ارسال موفق:</span>
                      <span className="font-bold font-mono">{sendResult.telegram?.sent ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span>ناموفق:</span>
                      <span className="font-bold font-mono">{sendResult.telegram?.failed ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions after complete */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ارسال پیام جدید</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition shadow-md shadow-blue-600/20"
              >
                بستن
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: Form Input View */
          <div className="space-y-5">
            {/* 1. Channel Selector */}
            <div className="space-y-2">
              <label className="block text-slate-300 font-bold text-xs">
                ۱. انتخاب کانال‌های ارسال:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Eitaa Checkbox */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer select-none transition ${
                    selectedChannels.includes('eitaa')
                      ? 'bg-orange-500/10 border-orange-500/40 text-slate-100 shadow-xs'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes('eitaa')}
                    onChange={() => toggleChannel('eitaa')}
                    disabled={isSending || isCounting}
                    className="w-4 h-4 rounded text-orange-500 accent-orange-500 focus:ring-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                    <span className="font-bold text-xs sm:text-sm">ربات ایتا (Eitaa)</span>
                  </div>
                </label>

                {/* Telegram Checkbox */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer select-none transition ${
                    selectedChannels.includes('telegram')
                      ? 'bg-sky-500/10 border-sky-500/40 text-slate-100 shadow-xs'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes('telegram')}
                    onChange={() => toggleChannel('telegram')}
                    disabled={isSending || isCounting}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                    <span className="font-bold text-xs sm:text-sm">ربات تلگرام (Telegram)</span>
                  </div>
                </label>
              </div>

              {selectedChannels.length === 0 && (
                <p className="text-[11px] text-rose-400 font-medium pt-0.5">
                  لطفاً حداقل یک پیام‌رسان را انتخاب نمایید.
                </p>
              )}
            </div>

            {/* 2. Audience Selector */}
            <div className="space-y-2">
              <label className="block text-slate-300 font-bold text-xs">
                ۲. انتخاب گروه مخاطبان:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {audienceOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedAudience === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isSending || isCounting}
                      onClick={() => handleAudienceChange(opt.id)}
                      className={`p-2.5 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500/60 text-white shadow-xs'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                        </span>
                      </div>
                      <div>
                        <div className={`font-bold text-xs ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Message Textarea & Counter */}
            <div className="space-y-1.5">
              {/* Image Caption Note if image is selected */}
              {selectedImage && (
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center gap-2 text-blue-300 text-[11px]">
                  <Info className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  <span>متن به‌صورت کپشن زیر عکس ارسال می‌شود (متن می‌تواند خالی باشد).</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold text-xs flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {selectedImage ? '۳. متن کپشن تصویر (اختیاری):' : '۳. متن پیام:'}
                  </span>
                </label>
                <div
                  className={`text-[11px] font-mono ${
                    isOverLimit
                      ? 'text-rose-400 font-bold'
                      : messageText.length > currentMaxChars - 100
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-500'
                  }`}
                >
                  {messageText.length} / {currentMaxChars}
                </div>
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={isSending}
                rows={4}
                maxLength={currentMaxChars}
                placeholder={
                  selectedImage
                    ? 'متن کپشن زیر تصویر را بنویسید (اختیاری)...'
                    : 'متن پیام اطلاع‌رسانی، شرایط تخفیف، اعلامیه‌های بار جدید یا بخشنامه‌های مرکز پخش را اینجا بنویسید...'
                }
                className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition leading-relaxed text-xs resize-y min-h-[100px] sm:min-h-[120px]"
              />

              {/* 3.1 Image Attachment Section */}
              <div className="pt-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageFileChange}
                  disabled={isSending || isProcessingImage}
                />

                {!selectedImage ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSending || isProcessingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span>در حال فشرده‌سازی عکس...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                          <span>افزودن عکس (اختیاری)</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-500">
                      فرمت‌های مجاز: JPG, PNG, WebP (بزرگترین ضلع تا ۱۲۸۰ پیکسل و سقف ۳ مگابایت)
                    </span>
                  </div>
                ) : (
                  /* Image Preview Card */
                  <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-750 bg-black/40 shrink-0 flex items-center justify-center">
                        <img
                          src={selectedImage.previewUrl}
                          alt="پیش‌نمایش عکس"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-slate-200 font-bold text-xs truncate">
                          {selectedImage.originalFileName}
                        </p>
                        <p className="text-slate-400 text-[10px] flex items-center gap-1.5">
                          <span>کیفیت JPEG 80%</span>
                          <span>•</span>
                          <span className="font-mono">
                            {(selectedImage.fileSizeBytes / 1024).toFixed(0)} KB
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSending}
                      onClick={handleRemoveImage}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف عکس</span>
                    </button>
                  </div>
                )}

                {imageError && (
                  <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-[11px] flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{imageError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Recipient Counting Section */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-xs text-slate-200">بررسی و شمارش گیرندگان</span>
                </div>

                <button
                  type="button"
                  disabled={isCounting || isSending || selectedChannels.length === 0}
                  onClick={handleCountRecipients}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
                >
                  {isCounting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span>در حال شمارش...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>شمارش گیرندگان</span>
                    </>
                  )}
                </button>
              </div>

              {/* Counting Error Feedback */}
              {countError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{countError}</span>
                </div>
              )}

              {/* Preview Result Summary */}
              {previewResult && (
                <div className="pt-2 border-t border-slate-850 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedChannels.includes('eitaa') && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[11px] text-orange-400 font-medium">گیرندگان ایتا</span>
                      <div className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1">
                        {previewResult.eitaa?.recipients ?? 0}
                        <span className="text-[10px] text-slate-400 font-normal">نفر</span>
                      </div>
                      {previewResult.eitaa?.capped && (
                        <div className="text-[9px] text-amber-400 font-semibold">محدود به سقف ۳۰۰</div>
                      )}
                    </div>
                  )}

                  {selectedChannels.includes('telegram') && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[11px] text-sky-400 font-medium">گیرندگان تلگرام</span>
                      <div className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1">
                        {previewResult.telegram?.recipients ?? 0}
                        <span className="text-[10px] text-slate-400 font-normal">نفر</span>
                      </div>
                      {previewResult.telegram?.capped && (
                        <div className="text-[9px] text-amber-400 font-semibold">محدود به سقف ۳۰۰</div>
                      )}
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-emerald-400 font-medium">مجموع گیرندگان</span>
                    <div className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1">
                      {(previewResult.eitaa?.recipients ?? 0) + (previewResult.telegram?.recipients ?? 0)}
                      <span className="text-[10px] text-slate-400 font-normal">نفر</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
              >
                انصراف
              </button>

              <button
                type="button"
                disabled={isSendDisabled}
                onClick={handleRequestSend}
                className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition shadow-lg ${
                  isSendDisabled
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
                title={
                  isNoChannel
                    ? 'ابتدا حداقل یک کانال را انتخاب کنید'
                    : !hasContent
                    ? 'متن پیام یا عکس را وارد کنید'
                    : 'ارسال پیام'
                }
              >
                <Send className="w-4 h-4" />
                <span>ارسال پیام</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog Step */}
      {isConfirmOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={(e) => {
            if (!isSending) {
              e.stopPropagation();
              setIsConfirmOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-3xl p-5 sm:p-6 shadow-2xl text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-slate-100">تأیید نهایی ارسال پیام سراسری</h4>
            </div>

            <p className="text-slate-300 leading-relaxed text-xs">
              لطفاً مشخصات پیام، تصویر و مخاطبان را مرور کنید. پس از تأیید، پیام بلافاصله در کانال‌های انتخاب‌شده به ربات‌ها ارسال می‌گردد.
            </p>

            {/* Review Parameters */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">کانال‌های منتخب:</span>
                <span className="font-bold flex items-center gap-1.5">
                  {selectedChannels.includes('eitaa') && (
                    <span className="text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">
                      ایتا
                    </span>
                  )}
                  {selectedChannels.includes('telegram') && (
                    <span className="text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                      تلگرام
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">گروه مخاطبان:</span>
                <span className="font-bold text-slate-200">
                  {getAudienceLabel(selectedAudience)}
                </span>
              </div>

              {previewResult && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-850">
                  <span className="text-slate-400">تعداد گیرندگان برآورد شده:</span>
                  <span className="font-bold font-mono text-emerald-400">
                    {(previewResult.eitaa?.recipients ?? 0) + (previewResult.telegram?.recipients ?? 0)} نفر
                  </span>
                </div>
              )}
            </div>

            {/* Attached Image Preview in Confirmation Dialog */}
            {selectedImage && (
              <div className="space-y-1">
                <span className="text-slate-400 text-[11px] font-medium">تصویر پیوست‌شده:</span>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-750 bg-black/50 shrink-0">
                    <img
                      src={selectedImage.previewUrl}
                      alt="عکس پیوست"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-slate-200 font-bold text-xs truncate">
                      {selectedImage.originalFileName}
                    </p>
                    <p className="text-emerald-400 text-[10px]">
                      فشرده‌سازی شده (JPEG 80%) • {(selectedImage.fileSizeBytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message Preview Box */}
            {messageText.trim() ? (
              <div className="space-y-1">
                <span className="text-slate-400 text-[11px] font-medium">
                  {selectedImage ? 'متن کپشن تصویر:' : 'پیش‌نمایش متن پیام:'}
                </span>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text font-sans">
                  {messageText}
                </div>
              </div>
            ) : (
              selectedImage && (
                <p className="text-slate-500 text-[11px] italic">
                  (پیام بدون کپشن متنی و فقط به صورت تصویر ارسال خواهد شد)
                </p>
              )
            )}

            {/* Confirm Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isSending}
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
              >
                ویرایش
              </button>

              <button
                type="button"
                disabled={isSending}
                onClick={handleConfirmSend}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال ارسال پیام...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تأیید و ارسال نهایی</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
