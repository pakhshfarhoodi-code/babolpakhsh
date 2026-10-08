import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Check, AlertCircle, Loader2 } from 'lucide-react';

interface LocationPickerModalProps {
  isOpen: boolean;
  initial?: { lat: number; lng: number } | null;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

const DEFAULT_CENTER: [number, number] = [36.5518, 52.6786]; // Babol, Mazandaran
const DEFAULT_ZOOM = 13;

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  initial,
  onConfirm,
  onClose,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccessMsg, setGeoSuccessMsg] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setGeoError(null);
      setGeoSuccessMsg(null);
      setIsLocating(false);
      return;
    }

    if (!mapContainerRef.current) return;

    const initialCenter: [number, number] =
      initial && typeof initial.lat === 'number' && typeof initial.lng === 'number'
        ? [initial.lat, initial.lng]
        : DEFAULT_CENTER;

    const initialZoom = initial ? 16 : DEFAULT_ZOOM;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!mapInstanceRef.current) return;
    const center = mapInstanceRef.current.getCenter();
    const roundedLat = Math.round(center.lat * 1e6) / 1e6;
    const roundedLng = Math.round(center.lng * 1e6) / 1e6;
    onConfirm(roundedLat, roundedLng);
    onClose();
  };

  const handleLocateMe = () => {
    setGeoError(null);
    setGeoSuccessMsg(null);

    if (!navigator.geolocation) {
      setGeoError('این مرورگر از GPS پشتیبانی نمی‌کند؛ نقشه را دستی جابه‌جا کنید.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setGeoError(null);
        setGeoSuccessMsg(
          'موقعیت شما پیدا شد. اگر سنجاق روی فروشگاه شماست، «تأیید موقعیت» را بزنید. در غیر این صورت نقشه را جابه‌جا کنید.'
        );
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(
            [pos.coords.latitude, pos.coords.longitude],
            17
          );
        }
      },
      (err) => {
        setIsLocating(false);
        setGeoSuccessMsg(null);
        let errorMsg = 'یافتن موقعیت ممکن نشد؛ نقشه را دستی جابه‌جا کنید.';
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = 'اجازه‌ی دسترسی به موقعیت داده نشد. در تنظیمات گوشی اجازه بدهید، یا نقشه را دستی جابه‌جا کنید.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMsg = 'موقعیت در دسترس نیست. GPS گوشی را روشن کنید یا نقشه را دستی جابه‌جا کنید.';
        } else if (err.code === err.TIMEOUT) {
          errorMsg = 'یافتن موقعیت طول کشید. دوباره تلاش کنید یا نقشه را دستی جابه‌جا کنید.';
        }
        setGeoError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 animate-in fade-in duration-200">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 z-10 shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              انتخاب موقعیت فروشگاه روی نقشه
            </h2>
            <p className="text-[11px] text-slate-400">
              موقعیت دقیق فروشگاه را روی نقشه مشخص کنید.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          aria-label="بستن"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Prominent GPS Button & Instructions Above Map */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2 z-10 shrink-0 shadow-sm">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>در حال یافتن موقعیت...</span>
            </>
          ) : (
            <>
              <span className="text-base">📍</span>
              <span>پیدا کردن موقعیت من (GPS)</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-400 leading-relaxed text-center px-1">
          برای دقت بیشتر، GPS گوشی را روشن کنید و داخل یا جلوی فروشگاه باشید. یا نقشه را با انگشت جابه‌جا کنید تا سنجاق روی فروشگاه شما قرار بگیرد.
        </p>

        {/* Success Alert */}
        {geoSuccessMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1 leading-relaxed">{geoSuccessMsg}</span>
            <button
              type="button"
              onClick={() => setGeoSuccessMsg(null)}
              className="text-emerald-400 hover:text-emerald-200 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {geoError && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1 leading-relaxed">{geoError}</span>
            <button
              type="button"
              onClick={() => setGeoError(null)}
              className="text-amber-400 hover:text-amber-200 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Map Area with Fixed Center Pin */}
      <div className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Center Pin Indicator */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[500]">
          <div className="flex flex-col items-center -translate-y-1/2 select-none">
            <div className="relative flex items-center justify-center">
              <MapPin className="w-10 h-10 text-amber-500 fill-amber-500/25 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] stroke-[2.2]" />
              <div className="absolute w-2 h-2 rounded-full bg-amber-300 top-[11px]"></div>
            </div>
            {/* Ground shadow dot */}
            <div className="w-2.5 h-1 bg-slate-950/70 rounded-full mt-[-2px] blur-[1px]"></div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <footer className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 z-10 shrink-0 shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
        >
          انصراف
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 max-w-xs flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>تأیید موقعیت</span>
        </button>
      </footer>
    </div>
  );
};
