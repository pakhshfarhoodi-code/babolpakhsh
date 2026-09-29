import React, { useState, useMemo } from 'react';
import { Product, ProductLike, Supermarket } from '../../types';
import {
  X,
  Heart,
  Sparkles,
  Phone,
  User,
  Store,
  MapPin,
  Calendar,
  Search,
  Copy,
  Check,
  Package,
} from 'lucide-react';
import { formatPrice } from './helpers';

interface MarketTestLikesModalProps {
  product: Product;
  likes: ProductLike[];
  supermarkets: Supermarket[];
  onClose: () => void;
  onToggleMarketTest?: () => void;
}

export const MarketTestLikesModal: React.FC<MarketTestLikesModalProps> = ({
  product,
  likes,
  supermarkets,
  onClose,
  onToggleMarketTest,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPhones, setCopiedPhones] = useState(false);

  // Map likes with detailed supermarket information
  const detailedLikes = useMemo(() => {
    return likes.map((like) => {
      const sm = supermarkets.find((s) => s.id === like.supermarket_id);
      return {
        ...like,
        storeName: like.supermarket_name || sm?.name || 'فروشگاه نامشخص',
        ownerName: like.supermarket_owner || sm?.owner || '—',
        phone: like.supermarket_phone || sm?.phone || '—',
        region: sm?.address || '—',
        dateStr: like.created_at
          ? new Date(like.created_at).toLocaleDateString('fa-IR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
      };
    });
  }, [likes, supermarkets]);

  // Filtered by search term
  const filteredLikes = useMemo(() => {
    if (!searchTerm.trim()) return detailedLikes;
    const term = searchTerm.toLowerCase().trim();
    return detailedLikes.filter(
      (item) =>
        item.storeName.toLowerCase().includes(term) ||
        item.ownerName.toLowerCase().includes(term) ||
        item.phone.includes(term) ||
        item.region.toLowerCase().includes(term)
    );
  }, [detailedLikes, searchTerm]);

  // Handle copying all phone numbers to clipboard
  const handleCopyPhones = () => {
    const phones = detailedLikes
      .map((item) => item.phone)
      .filter((p) => p && p !== '—')
      .join(', ');

    if (!phones) return;

    navigator.clipboard.writeText(phones);
    setCopiedPhones(true);
    setTimeout(() => setCopiedPhones(false), 3000);
  };

  const totalStores = supermarkets.length || 1;
  const likePercentage = Math.round((likes.length / totalStores) * 100);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-0 my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Package className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-slate-100 truncate">
                  {product.name}
                </h3>
                {product.is_market_test && (
                  <span className="px-2 py-0.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    <span>تست بازار فعال</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                گزارش بازخورد و علاقه‌مندی فروشگاه‌ها به این کالا • قیمت فروشگاه: {formatPrice(product.price)} تومان
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Stat Summary Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Stat 1: Total Likes */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Heart className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">مجموع لایک‌های ثبت‌شده</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-rose-400 font-mono">
                  {likes.length.toLocaleString('fa-IR')}
                </span>
                <span className="text-[11px] text-slate-500">فروشگاه</span>
              </div>
            </div>
          </div>

          {/* Stat 2: Engagement Percentage */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">درصد استقبال بازار</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-violet-300 font-mono">
                  {likePercentage.toLocaleString('fa-IR')}٪
                </span>
                <span className="text-[11px] text-slate-500">
                  از {supermarkets.length.toLocaleString('fa-IR')} فروشگاه
                </span>
              </div>
            </div>
          </div>

          {/* Stat 3: Market Test Switch Action */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
            <div>
              <span className="text-xs text-slate-400 block font-medium">وضعیت تست بازار</span>
              <span className={`text-xs font-bold block mt-0.5 ${product.is_market_test ? 'text-violet-400' : 'text-slate-400'}`}>
                {product.is_market_test ? 'به زودی (نمایش با لایک)' : 'کالای عادی'}
              </span>
            </div>
            {onToggleMarketTest && (
              <button
                type="button"
                onClick={onToggleMarketTest}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  product.is_market_test
                    ? 'bg-violet-600 hover:bg-violet-500 text-white border-violet-500'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {product.is_market_test ? 'غیرفعال‌سازی تست' : 'فعال‌سازی تست'}
              </button>
            )}
          </div>
        </div>

        {/* Toolbar: Search and Export Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-900/80 border-b border-slate-800/80 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در نام فروشگاه، مدیر یا شماره تماس..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {detailedLikes.length > 0 && (
            <button
              type="button"
              onClick={handleCopyPhones}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
              title="کپی شماره تلفن تمام فروشگاه‌های علاقه‌مند جهت ارسال پیامک اطلاع‌رسانی"
            >
              {copiedPhones ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">شماره‌ها کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>کپی شماره‌ها برای اطلاع‌رسانی</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Content: List of Liked Supermarkets */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
          {filteredLikes.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
                <Heart className="w-7 h-7 text-slate-600" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-bold text-sm text-slate-300">
                  {searchTerm ? 'فروشگاهی با این مشخصات یافت نشد' : 'هنوز لایکی برای این کالا ثبت نشده است'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {searchTerm
                    ? 'عبارت جستجو را تغییر دهید یا فیلتر را پاک کنید.'
                    : 'با فعال بودن وضعیت «تست بازار»، این کالا در کاتالوگ فروشگاه‌ها همراه با برچسب «به زودی» نمایش داده می‌شود. به محض این‌که فروشگاهی دکمه لایک را بزند، مشخصات آن در این لیست قرار خواهد گرفت.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-center w-12">#</th>
                    <th className="py-2.5 px-3 font-semibold">نام فروشگاه</th>
                    <th className="py-2.5 px-3 font-semibold">مسئول / مدیر</th>
                    <th className="py-2.5 px-3 font-semibold">شماره تماس</th>
                    <th className="py-2.5 px-3 font-semibold hidden md:table-cell">منطقه / آدرس</th>
                    <th className="py-2.5 px-3 font-semibold text-center">زمان ثبت لایک</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                  {filteredLikes.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 text-center text-slate-500 font-mono font-bold">
                        {(idx + 1).toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          <span className="font-bold text-slate-100">{item.storeName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{item.ownerName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {item.phone && item.phone !== '—' ? (
                          <a
                            href={`tel:${item.phone}`}
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono dir-ltr font-bold hover:underline"
                          >
                            <Phone className="w-3 h-3 text-blue-400" />
                            <span>{item.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate max-w-xs">{item.region}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{item.dateStr}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {likes.length > 0
              ? `نمایش ${filteredLikes.length.toLocaleString('fa-IR')} از ${likes.length.toLocaleString('fa-IR')} فروشگاه علاقه‌مند`
              : 'صفر لایک ثبت شده'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
