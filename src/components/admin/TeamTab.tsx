import React, { useState, useMemo } from 'react';
import { Visitor, Supermarket, Order } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Truck,
  Users,
  Store,
  Phone,
  MapPin,
  UserPlus,
  Search,
  Filter,
  ArrowRightLeft,
  X,
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  AtSign,
  ShieldCheck,
  Edit2,
  Trash2,
  User,
  Building,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { SupermarketRegisterModal } from '../SupermarketRegisterModal';

interface TeamTabProps {
  visitors: Visitor[];
  supermarkets: Supermarket[];
  orders: Order[];
}

export const TeamTab: React.FC<TeamTabProps> = ({
  visitors,
  supermarkets,
  orders,
}) => {
  const {
    createStaffAccount,
    updateSupermarket,
    deleteSupermarket,
    toggleSupermarketApproval,
    updateVisitor,
    deleteVisitor,
    resetSupermarketPassword,
    resetVisitorPassword,
  } = useApp();
  const [selectedVisitorFilter, setSelectedVisitorFilter] = useState<string | null>(null);
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isRegisterStoreModalOpen, setIsRegisterStoreModalOpen] = useState(false);
  const [togglingStoreId, setTogglingStoreId] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Password Reset State
  const [resettingPerson, setResettingPerson] = useState<{
    id: string;
    name: string;
    type: 'supermarket' | 'visitor';
    username?: string;
  } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const handleConfirmResetPassword = async () => {
    if (!resettingPerson) return;
    setIsResettingPassword(true);
    setResetPasswordError(null);
    try {
      const res = resettingPerson.type === 'supermarket'
        ? await resetSupermarketPassword(resettingPerson.id, '123456')
        : await resetVisitorPassword(resettingPerson.id, '123456');

      if (res.success) {
        const personName = resettingPerson.name;
        setResettingPerson(null);
        setToastNotification({
          type: 'success',
          message: `رمز عبور «${personName}» با موفقیت به 123456 تغییر یافت.`,
        });
      } else {
        setResetPasswordError(res.message || 'خطا در بازنشانی رمز عبور');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در بازنشانی رمز عبور';
      setResetPasswordError(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Edit Visitor State
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [visitorEditForm, setVisitorEditForm] = useState<{
    name: string;
    phone: string;
    region: string;
    username: string;
    is_active: boolean;
  }>({
    name: '',
    phone: '',
    region: '',
    username: '',
    is_active: true,
  });
  const [isUpdatingVisitor, setIsUpdatingVisitor] = useState(false);
  const [editVisitorError, setEditVisitorError] = useState<string | null>(null);
  const [editVisitorSuccess, setEditVisitorSuccess] = useState<string | null>(null);

  // Delete Visitor State
  const [deletingVisitor, setDeletingVisitor] = useState<Visitor | null>(null);
  const [isDeletingVisitor, setIsDeletingVisitor] = useState(false);
  const [deleteVisitorError, setDeleteVisitorError] = useState<string | null>(null);

  // Edit Supermarket State
  const [editingSupermarket, setEditingSupermarket] = useState<Supermarket | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    owner: string;
    phone: string;
    address: string;
    assigned_visitor_id: string;
    username: string;
    is_active: boolean;
  }>({
    name: '',
    owner: '',
    phone: '',
    address: '',
    assigned_visitor_id: '',
    username: '',
    is_active: true,
  });
  const [isUpdatingSupermarket, setIsUpdatingSupermarket] = useState(false);
  const [editSupermarketError, setEditSupermarketError] = useState<string | null>(null);
  const [editSupermarketSuccess, setEditSupermarketSuccess] = useState<string | null>(null);

  // Delete Supermarket State
  const [deletingSupermarket, setDeletingSupermarket] = useState<Supermarket | null>(null);
  const [isDeletingSupermarket, setIsDeletingSupermarket] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Check if invoice or order was previously issued for the supermarket being deleted
  const supermarketOrdersCount = useMemo(() => {
    if (!deletingSupermarket) return 0;
    return orders.filter((o) => o.supermarket_id === deletingSupermarket.id).length;
  }, [deletingSupermarket, orders]);

  const supermarketHasInvoices = supermarketOrdersCount > 0;

  // Check dependent stores and orders for the visitor being deleted
  const visitorSupermarketsCount = useMemo(() => {
    if (!deletingVisitor) return 0;
    return supermarkets.filter((s) => s.assigned_visitor_id === deletingVisitor.id).length;
  }, [deletingVisitor, supermarkets]);

  const visitorOrdersCount = useMemo(() => {
    if (!deletingVisitor) return 0;
    return orders.filter((o) => o.assigned_visitor_id === deletingVisitor.id).length;
  }, [deletingVisitor, orders]);

  const visitorHasInvoices = visitorOrdersCount > 0;

  // Staff Account Creation State
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<{
    name: string;
    phone: string;
    role: 'admin' | 'warehouse' | 'visitor';
    region: string;
    username: string;
    password: string;
  }>({
    name: '',
    phone: '',
    role: 'visitor',
    region: '',
    username: '',
    password: '',
  });

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setStaffSuccess(null);

    const name = staffForm.name.trim();
    const phone = staffForm.phone.trim();
    const role = staffForm.role;
    const region = staffForm.region.trim();
    const username = staffForm.username.trim();
    const password = staffForm.password;

    if (!name) {
      setStaffError('لطفاً نام و نام خانوادگی عضو تیم را وارد کنید.');
      return;
    }
    if (!phone) {
      setStaffError('لطفاً شماره تماس را وارد کنید.');
      return;
    }
    if (role === 'visitor' && !region) {
      setStaffError('لطفاً منطقه فعالیت ویزیتور را مشخص کنید.');
      return;
    }
    if (!username) {
      setStaffError('لطفاً نام کاربری را وارد کنید.');
      return;
    }
    if (password.length < 6) {
      setStaffError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setIsSubmittingStaff(true);
    try {
      const res = await createStaffAccount({
        name,
        phone,
        role,
        region: role === 'visitor' ? region : undefined,
        username,
        password,
      });

      if (!res.success) {
        setStaffError(res.error || 'خطا در ایجاد حساب کاربری.');
      } else {
        const successMsg = `حساب با نام کاربری ${res.username || username} ساخته شد.`;
        setStaffSuccess(successMsg);
        setTimeout(() => {
          setIsAddStaffOpen(false);
          setStaffForm({
            name: '',
            phone: '',
            role: 'visitor',
            region: '',
            username: '',
            password: '',
          });
          setStaffSuccess(null);
        }, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ساخت حساب';
      setStaffError(msg);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Open Edit Supermarket Modal
  const handleOpenEditSupermarket = (shop: Supermarket) => {
    setEditingSupermarket(shop);
    setEditForm({
      name: shop.name,
      owner: shop.owner,
      phone: shop.phone,
      address: shop.address,
      assigned_visitor_id: shop.assigned_visitor_id || '',
      username: shop.username || '',
      is_active: shop.is_active ?? true,
    });
    setEditSupermarketError(null);
    setEditSupermarketSuccess(null);
  };

  // Submit Edit Supermarket
  const handleUpdateSupermarketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupermarket) return;

    if (!editForm.name.trim()) {
      setEditSupermarketError('نام فروشگاه الزامی است.');
      return;
    }
    if (!editForm.owner.trim()) {
      setEditSupermarketError('نام صاحب فروشگاه الزامی است.');
      return;
    }
    if (!editForm.phone.trim()) {
      setEditSupermarketError('شماره تماس الزامی است.');
      return;
    }
    if (!editForm.address.trim()) {
      setEditSupermarketError('آدرس فروشگاه الزامی است.');
      return;
    }

    setIsUpdatingSupermarket(true);
    setEditSupermarketError(null);
    setEditSupermarketSuccess(null);

    try {
      const res = await updateSupermarket(editingSupermarket.id, {
        name: editForm.name,
        owner: editForm.owner,
        phone: editForm.phone,
        address: editForm.address,
        assigned_visitor_id: editForm.assigned_visitor_id,
        username: editForm.username,
        is_active: editForm.is_active,
      });

      if (res.success) {
        setEditSupermarketSuccess(res.message);
        setTimeout(() => {
          setEditingSupermarket(null);
          setEditSupermarketSuccess(null);
        }, 1200);
      } else {
        setEditSupermarketError(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای ناشناخته در ویرایش مشتری';
      setEditSupermarketError(msg);
    } finally {
      setIsUpdatingSupermarket(false);
    }
  };

  // Confirm Delete Supermarket
  const handleDeleteSupermarketConfirm = async () => {
    if (!deletingSupermarket) return;
    setIsDeletingSupermarket(true);
    setDeleteError(null);

    try {
      const res = await deleteSupermarket(deletingSupermarket.id);
      if (res.success) {
        setToastNotification({
          type: 'success',
          message: `فروشگاه «${deletingSupermarket.name}» با موفقیت حذف گردید.`,
        });
        setDeletingSupermarket(null);
      } else {
        setDeleteError(res.message);
        setToastNotification({
          type: 'error',
          message: res.message || 'خطا در حذف مشتری.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای ناشناخته در حذف مشتری';
      setDeleteError(msg);
      setToastNotification({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsDeletingSupermarket(false);
    }
  };

  // Visitor Edit & Delete Handlers
  const handleStartEditVisitor = (visitor: Visitor) => {
    setEditingVisitor(visitor);
    setVisitorEditForm({
      name: visitor.name || '',
      phone: visitor.phone || '',
      region: visitor.region || '',
      username: visitor.username || '',
      is_active: visitor.is_active ?? true,
    });
    setEditVisitorError(null);
    setEditVisitorSuccess(null);
  };

  const handleSaveVisitorEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisitor) return;

    if (!visitorEditForm.name.trim()) {
      setEditVisitorError('لطفاً نام و نام خانوادگی ویزیتور را وارد نمایید.');
      return;
    }
    if (!visitorEditForm.phone.trim()) {
      setEditVisitorError('لطفاً شماره همراه ویزیتور را وارد نمایید.');
      return;
    }

    setIsUpdatingVisitor(true);
    setEditVisitorError(null);
    setEditVisitorSuccess(null);

    try {
      const res = await updateVisitor(editingVisitor.id, {
        name: visitorEditForm.name.trim(),
        phone: visitorEditForm.phone.trim(),
        region: visitorEditForm.region.trim(),
        username: visitorEditForm.username.trim(),
        is_active: visitorEditForm.is_active,
      });

      if (res.success) {
        setEditVisitorSuccess('مشخصات ویزیتور با موفقیت بروزرسانی شد.');
        setTimeout(() => {
          setEditingVisitor(null);
          setEditVisitorSuccess(null);
        }, 1200);
      } else {
        setEditVisitorError(res.message || 'خطا در ویرایش ویزیتور');
      }
    } catch (err: unknown) {
      setEditVisitorError('خطایی در فرایند بروزرسانی ویزیتور رخ داد.');
    } finally {
      setIsUpdatingVisitor(false);
    }
  };

  const handleConfirmDeleteVisitor = async () => {
    if (!deletingVisitor) return;
    setIsDeletingVisitor(true);
    setDeleteVisitorError(null);

    try {
      const res = await deleteVisitor(deletingVisitor.id);
      if (res.success) {
        setToastNotification({
          type: 'success',
          message: `ویزیتور «${deletingVisitor.name}» با موفقیت حذف گردید.`,
        });
        setDeletingVisitor(null);
      } else {
        setDeleteVisitorError(res.message || 'خطا در حذف ویزیتور');
        setToastNotification({
          type: 'error',
          message: res.message || 'خطا در حذف ویزیتور.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطایی در فرایند حذف ویزیتور به وجود آمد.';
      setDeleteVisitorError(msg);
      setToastNotification({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsDeletingVisitor(false);
    }
  };

  // Quick Toggle Supermarket Approval / Active Check
  const handleToggleApproval = async (shop: Supermarket) => {
    setTogglingStoreId(shop.id);
    try {
      const res = await toggleSupermarketApproval(shop.id, shop.is_active !== false);
      if (res.success) {
        setToastNotification({
          type: 'success',
          message: res.newStatus
            ? `دسترسی فروشگاه «${shop.name}» تایید شد و می‌تواند وارد سامانه شود.`
            : `دسترسی فروشگاه «${shop.name}» به سامانه غیرفعال گردید.`,
        });
      } else {
        setToastNotification({
          type: 'error',
          message: res.message,
        });
      }
    } catch {
      setToastNotification({
        type: 'error',
        message: 'خطا در تغییر وضعیت تایید فروشگاه.',
      });
    } finally {
      setTogglingStoreId(null);
      setTimeout(() => setToastNotification(null), 3500);
    }
  };

  // Filtered supermarkets based on visitor click, search term, and approval status
  const filteredSupermarkets = useMemo(() => {
    return supermarkets.filter((shop) => {
      if (selectedVisitorFilter) {
        if (selectedVisitorFilter === 'direct') {
          if (shop.assigned_visitor_id && shop.assigned_visitor_id !== 'direct') {
            return false;
          }
        } else if (shop.assigned_visitor_id !== selectedVisitorFilter) {
          return false;
        }
      }
      if (storeStatusFilter === 'inactive' && shop.is_active !== false) {
        return false;
      }
      if (storeStatusFilter === 'active' && shop.is_active === false) {
        return false;
      }
      if (storeSearchTerm.trim()) {
        const term = storeSearchTerm.toLowerCase().trim();
        const matchName = shop.name.toLowerCase().includes(term);
        const matchOwner = shop.owner.toLowerCase().includes(term);
        const matchAddress = shop.address.toLowerCase().includes(term);
        const matchPhone = shop.phone.includes(term);
        if (!matchName && !matchOwner && !matchAddress && !matchPhone) return false;
      }
      return true;
    });
  }, [supermarkets, selectedVisitorFilter, storeStatusFilter, storeSearchTerm]);

  const pendingApprovalsCount = useMemo(() => {
    return supermarkets.filter((s) => s.is_active === false).length;
  }, [supermarkets]);

  const activeFilteredVisitor = visitors.find((v) => v.id === selectedVisitorFilter);

  return (
    <div className="space-y-6">
      {/* 2-Column Grid: Left Visitors Team, Right Supermarkets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitors Column */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">تیم ویزیتورها و ناوگان مویرگی</h3>
                <p className="text-xs text-slate-400 mt-0.5">{visitors.length} ویزیتور فعال</p>
              </div>
            </div>

            {/* Add Team Member Button */}
            <button
              type="button"
              onClick={() => {
                setStaffError(null);
                setStaffSuccess(null);
                setIsAddStaffOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ افزودن عضو تیم</span>
            </button>
          </div>

          {/* Visitor Cards & Direct Channel */}
          <div className="space-y-3">
            {/* Direct Purchase Channel Card */}
            {(() => {
              const directStores = supermarkets.filter(
                (s) => s.assigned_visitor_id === 'direct' || !s.assigned_visitor_id
              );
              const directOrders = orders.filter(
                (o) =>
                  o.assigned_visitor_id === 'direct' ||
                  !o.assigned_visitor_id ||
                  o.visitor_name?.includes('مستقیم')
              );
              const isSelected = selectedVisitorFilter === 'direct';

              return (
                <div
                  className={`p-3.5 rounded-xl border transition shadow-xs ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500/60'
                      : 'bg-slate-950 border-amber-800/40 hover:border-amber-700/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-amber-300">پخش مرکزی فرهودی (خرید مستقیم)</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-900/50 text-amber-300 border border-amber-800/50 font-bold">
                          فروش بدون واسطه ویزیتور
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">مدیریت مستقیم سفارشات توسط دفتر پخش مرکزی</p>
                    </div>

                    <div className="text-left space-y-0.5">
                      <span className="text-xs font-bold text-amber-300">
                        {directStores.length} فروشگاه
                      </span>
                      <p className="text-xs text-slate-400">
                        {directOrders.length} سفارش مستقیم
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-900 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedVisitorFilter(isSelected ? null : 'direct')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-800/40'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>
                        {isSelected ? 'حذف فیلتر و نمایش همه' : 'مشاهده فروشگاه‌های خرید مستقیم'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {visitors.map((visitor) => {
              const assignedStores = supermarkets.filter((s) => s.assigned_visitor_id === visitor.id);
              const visitorOrders = orders.filter((o) => o.assigned_visitor_id === visitor.id);
              const isSelected = selectedVisitorFilter === visitor.id;

              return (
                <div
                  key={visitor.id}
                  className={`p-3.5 rounded-xl border transition shadow-xs ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/50'
                      : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-100">{visitor.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-900/50 text-blue-300 border border-blue-800/50">
                          {visitor.region}
                        </span>
                        {visitor.is_active === false ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            غیرفعال
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            فعال
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <p className="text-xs text-slate-400 font-mono">{visitor.phone}</p>
                        <div className="inline-flex items-center gap-1.5 text-blue-300 font-mono text-xs bg-blue-950/70 px-2.5 py-0.5 rounded-lg border border-blue-500/40 font-bold shadow-xs">
                          <AtSign className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>
                            نام کاربری: {
                              visitor.username && !visitor.username.includes('-') && visitor.username.length < 25
                                ? visitor.username
                                : (visitor.phone || 'مشخص نشده')
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">
                        {assignedStores.length} فروشگاه
                      </span>
                      <p className="text-xs text-slate-400">
                        {visitorOrders.length} سفارش جاری
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-900 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedVisitorFilter(isSelected ? null : visitor.id)
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>
                        {isSelected ? 'حذف فیلتر و نمایش همه' : 'مشاهده فروشگاه‌های این ویزیتور'}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setResettingPerson({
                            id: visitor.id,
                            name: visitor.name,
                            type: 'visitor',
                            username: visitor.username,
                          });
                          setResetPasswordError(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
                        title="بازیابی رمز عبور ویزیتور به 123456"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>بازیابی رمز</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEditVisitor(visitor)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition flex items-center gap-1 cursor-pointer"
                        title="ویرایش مشخصات ویزیتور"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeletingVisitor(visitor);
                          setDeleteVisitorError(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition flex items-center gap-1 cursor-pointer"
                        title="حذف ویزیتور"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supermarkets Column */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">فهرست سوپرمارکت‌های طرف قرارداد</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {filteredSupermarkets.length} از {supermarkets.length} فروشگاه
                  </p>
                </div>
              </div>

              {/* Add Store Button */}
              <button
                type="button"
                onClick={() => setIsRegisterStoreModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ ثبت فروشگاه جدید</span>
              </button>
            </div>

            {/* Status Filter Tabs (All / Active / Inactive) */}
            <div className="flex items-center gap-1.5 mt-3 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStoreStatusFilter('all')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer text-center ${
                  storeStatusFilter === 'all'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                همه ({supermarkets.length})
              </button>

              <button
                type="button"
                onClick={() => setStoreStatusFilter('active')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer text-center ${
                  storeStatusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                دسترسی فعال ({supermarkets.filter((s) => s.is_active !== false).length})
              </button>

              <button
                type="button"
                onClick={() => setStoreStatusFilter('inactive')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer text-center ${
                  storeStatusFilter === 'inactive'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                غیرفعال ({supermarkets.filter((s) => s.is_active === false).length})
              </button>
            </div>

            {/* Filter banner if active */}
            {activeFilteredVisitor && (
              <div className="mt-3 p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60 text-xs flex items-center justify-between">
                <span className="text-blue-200">
                  در حال نمایش فروشگاه‌های ویزیتور:{' '}
                  <strong>{activeFilteredVisitor.name}</strong> ({activeFilteredVisitor.region})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedVisitorFilter(null)}
                  className="p-1 text-slate-400 hover:text-slate-100 rounded-md cursor-pointer"
                  title="نمایش همه فروشگاه‌ها"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Store search box */}
            <div className="relative mt-3">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={storeSearchTerm}
                onChange={(e) => setStoreSearchTerm(e.target.value)}
                placeholder="جستجوی نام فروشگاه، مالک، آدرس یا تلفن..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Toast feedback banner */}
            {toastNotification && (
              <div
                className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 ${
                  toastNotification.type === 'success'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  {toastNotification.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{toastNotification.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setToastNotification(null)}
                  className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Supermarket Cards List */}
            <div className="space-y-3 mt-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredSupermarkets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  فروشگاهی مطابق با فیلتر یافت نشد.
                </div>
              ) : (
                filteredSupermarkets.map((shop) => {
                  const assignedVisitor = visitors.find((v) => v.id === shop.assigned_visitor_id);
                  const isApproved = shop.is_active !== false;
                  const isTogglingThis = togglingStoreId === shop.id;

                  return (
                    <div
                      key={shop.id}
                      className={`p-3.5 rounded-xl border space-y-2 text-xs transition ${
                        !isApproved
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                          : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Top row: Name with Approval Tick Checkbox + Phone */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Approval Checkbox on Name */}
                          <button
                            type="button"
                            disabled={isTogglingThis}
                            onClick={() => handleToggleApproval(shop)}
                            title={
                              isApproved
                                ? 'کلیک کنید تا دسترسی فروشگاه غیرفعال شود'
                                : 'کلیک کنید تا دسترسی فروشگاه تایید و فعال شود'
                            }
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition cursor-pointer ${
                              isApproved
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs hover:bg-emerald-500'
                                : 'bg-slate-900 border-amber-500/80 text-amber-400 hover:bg-amber-500/20 animate-pulse'
                            } ${isTogglingThis ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {isTogglingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className={`w-3.5 h-3.5 stroke-[3] ${isApproved ? 'opacity-100' : 'opacity-40'}`} />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-sm text-slate-100 truncate">{shop.name}</p>
                              {!isApproved ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/50">
                                  غیرفعال
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                                  دسترسی فعال
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 mt-1.5 text-slate-400 flex-wrap">
                              <span>مدیریت: <strong className="text-slate-300 font-semibold">{shop.owner}</strong></span>
                              <div className="inline-flex items-center gap-1.5 text-amber-300 font-mono text-xs bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-500/40 font-bold shadow-xs">
                                <AtSign className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>
                                  نام کاربری: {
                                    shop.username && !shop.username.includes('-') && shop.username.length < 25
                                      ? shop.username
                                      : (shop.phone || 'مشخص نشده')
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs shrink-0">
                          {shop.phone}
                        </span>
                      </div>

                      {/* Address */}
                      <div className="flex items-start gap-1.5 text-slate-400 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="truncate">{shop.address}</span>
                      </div>

                      {/* Bottom row: Assigned Visitor + Approval Toggle Button + Edit & Delete Actions */}
                      <div className="mt-2.5 pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">ویزیتور اختصاصی:</span>
                          <select
                            dir="rtl"
                            value={shop.assigned_visitor_id || 'direct'}
                            onChange={async (e) => {
                              const newVisId = e.target.value;
                              const res = await updateSupermarket(shop.id, {
                                assigned_visitor_id: newVisId,
                              });
                              if (!res.success) {
                                setToastNotification({
                                  type: 'error',
                                  message: res.message || 'خطا در تغییر ویزیتور اختصاصی فروشگاه.',
                                });
                              } else {
                                setToastNotification({
                                  type: 'success',
                                  message: 'ویزیتور اختصاصی فروشگاه با موفقیت تغییر یافت.',
                                });
                              }
                            }}
                            className={`rounded-lg pr-2.5 pl-6 py-1 text-xs font-bold border focus:outline-none transition cursor-pointer text-right appearance-none ${
                              shop.assigned_visitor_id === 'direct' || !assignedVisitor
                                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-blue-300'
                            }`}
                            title="تغییر سریع ویزیتور اختصاصی فروشگاه"
                          >
                            <option value="direct" className="bg-slate-900 text-slate-100 py-1.5 px-3">خرید مستقیم از پخش مرکزی (بدون ویزیتور)</option>
                            {visitors.map((v) => (
                              <option key={v.id} value={v.id} className="bg-slate-900 text-slate-100 py-1.5 px-3">
                                {v.name} ({v.region || 'ویزیتور'}) - {v.phone}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Password Reset Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setResettingPerson({
                                id: shop.id,
                                name: shop.name,
                                type: 'supermarket',
                                username: shop.username,
                              });
                              setResetPasswordError(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition cursor-pointer"
                            title="بازیابی و تغییر رمز عبور مشتری به 123456"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                            <span>بازیابی رمز</span>
                          </button>

                          {/* Fast Quick Toggle Button */}
                          <button
                            type="button"
                            disabled={isTogglingThis}
                            onClick={() => handleToggleApproval(shop)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              isApproved
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            }`}
                            title={isApproved ? 'غیرفعال‌سازی دسترسی' : 'فعال‌سازی دسترسی'}
                          >
                            {isTogglingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                            <span>{isApproved ? 'دسترسی فعال' : 'فعال‌سازی دسترسی'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditSupermarket(shop)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-blue-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
                            title="ویرایش مشخصات مشتری"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>ویرایش</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeletingSupermarket(shop);
                              setDeleteError(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition cursor-pointer"
                            title="حذف مشتری"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Supermarket Register Modal */}
      <SupermarketRegisterModal
        isOpen={isRegisterStoreModalOpen}
        onClose={() => setIsRegisterStoreModalOpen(false)}
      />

      {/* Add Staff Account Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">افزودن عضو جدید تیم</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ایجاد حساب احراز هویت رسمی (ویزیتور یا انباردار)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingStaff) {
                    setIsAddStaffOpen(false);
                    setStaffError(null);
                    setStaffSuccess(null);
                  }
                }}
                disabled={isSubmittingStaff}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleStaffSubmit} className="p-5 space-y-4 overflow-y-auto">
              {staffSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{staffSuccess}</span>
                </div>
              )}

              {staffError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{staffError}</span>
                </div>
              )}

              {/* Role selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  نقش سازمانی <span className="text-rose-400">*</span>
                </label>
                <select
                  dir="rtl"
                  value={staffForm.role}
                  onChange={(e) =>
                    setStaffForm((prev) => ({
                      ...prev,
                      role: e.target.value as 'admin' | 'warehouse' | 'visitor',
                    }))
                  }
                  disabled={isSubmittingStaff}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-3.5 pl-8 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 text-right appearance-none cursor-pointer"
                >
                  <option value="admin" className="bg-slate-900 text-slate-100 py-1.5 px-3">مدیر جدید سامانه (ادمین با دسترسی کامل)</option>
                  <option value="warehouse" className="bg-slate-900 text-slate-100 py-1.5 px-3">انباردار (مدیریت سردخانه و موجودی)</option>
                  <option value="visitor" className="bg-slate-900 text-slate-100 py-1.5 px-3">ویزیتور (پخش و بازاریابی مویرگی)</option>
                </select>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نام و نام خانوادگی <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder=""
                    disabled={isSubmittingStaff}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    شماره همراه <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder=""
                    disabled={isSubmittingStaff}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Region (Only if role === 'visitor') */}
              {staffForm.role === 'visitor' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    منطقه تحت پوشش <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={staffForm.region}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, region: e.target.value }))}
                    placeholder=""
                    disabled={isSubmittingStaff}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    dir="rtl"
                  />
                </div>
              )}

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نام کاربری ورود <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={staffForm.username}
                      onChange={(e) =>
                        setStaffForm((prev) => ({ ...prev, username: e.target.value.trim() }))
                      }
                      placeholder=""
                      disabled={isSubmittingStaff}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 text-left font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    رمز عبور <span className="text-rose-400">*</span> (حداقل ۶ کاراکتر)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      type="password"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder=""
                      disabled={isSubmittingStaff}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 text-left font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddStaffOpen(false);
                    setStaffError(null);
                    setStaffSuccess(null);
                  }}
                  disabled={isSubmittingStaff}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingStaff ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ثبت حساب...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>ثبت و ساخت حساب</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supermarket Modal */}
      {editingSupermarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">ویرایش مشخصات مشتری</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editingSupermarket.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSupermarket(null);
                  setEditSupermarketError(null);
                  setEditSupermarketSuccess(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateSupermarketSubmit} className="p-4 space-y-4 overflow-y-auto">
              {/* Error Message */}
              {editSupermarketError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editSupermarketError}</span>
                </div>
              )}

              {/* Success Message */}
              {editSupermarketSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editSupermarketSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نام فروشگاه / سوپرمارکت <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Building className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder=""
                      disabled={isUpdatingSupermarket}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نام مالک یا مدیر <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={editForm.owner}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, owner: e.target.value }))}
                      placeholder=""
                      disabled={isUpdatingSupermarket}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    شماره تماس / همراه <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder=""
                      disabled={isUpdatingSupermarket}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    پشتیبان / ویزیتور اختصاصی
                  </label>
                  <select
                    dir="rtl"
                    value={editForm.assigned_visitor_id}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, assigned_visitor_id: e.target.value }))}
                    disabled={isUpdatingSupermarket}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-3.5 pl-8 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 text-right appearance-none cursor-pointer"
                  >
                    <option value="direct" className="bg-slate-900 text-slate-100 py-1.5 px-3">خرید مستقیم از پخش فرهودی</option>
                    {visitors.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900 text-slate-100 py-1.5 px-3">
                        {v.name} ({v.region})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  نام کاربری جهت ورود به سامانه
                </label>
                <div className="relative">
                  <AtSign className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value.trim() }))}
                    placeholder=""
                    disabled={isUpdatingSupermarket}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  آدرس دقیق <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                  <textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder=""
                    rows={2}
                    disabled={isUpdatingSupermarket}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-200">وضعیت همکاری</span>
                  <p className="text-[11px] text-slate-400">فعال بودن حساب مشتری برای ثبت سفارشات</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                    editForm.is_active
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {editForm.is_active ? 'فعال' : 'غیرفعال'}
                </button>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupermarket(null);
                    setEditSupermarketError(null);
                    setEditSupermarketSuccess(null);
                  }}
                  disabled={isUpdatingSupermarket}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSupermarket}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingSupermarket ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ذخیره تغییرات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supermarket Confirmation Modal */}
      {deletingSupermarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">حذف مشتری / فروشگاه</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  آیا از حذف فروشگاه <strong className="text-white font-bold">{deletingSupermarket.name}</strong> با مدیریت آقای/خانم {deletingSupermarket.owner} اطمینان دارید؟
                </p>
                <p className="text-[11px] text-rose-400/90 pt-1">
                  این عملیات غیرقابل بازگشت است و حساب کاربری این مشتری حذف خواهد شد.
                </p>
              </div>
            </div>

            {/* Dependent stats breakdown */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span>تعداد سفارش‌های ثبت‌شده برای این فروشگاه:</span>
                <span className="font-bold font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/40">
                  {supermarketOrdersCount} سفارش
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                سوابق فاکتورهای پیشین در سیستم حفظ شده و شناسه فروشگاه به عنوان بایگانی نامشخص علامت‌گذاری می‌شود.
              </p>
            </div>

            {/* Warning if invoice/order previously issued */}
            {supermarketHasInvoices && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>هشدار: قبلاً برای این مشتری / فروشگاه فاکتور صادر شده است!</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed pr-5">
                  اطلاعات و سوابق اقلام فاکتورهای پیشین در آرشیو ثبت می‌ماند، اما حساب کاربری مشتری به طور کامل حذف خواهد شد.
                </p>
              </div>
            )}

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingSupermarket(null);
                  setDeleteError(null);
                }}
                disabled={isDeletingSupermarket}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteSupermarketConfirm}
                disabled={isDeletingSupermarket}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingSupermarket ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تایید و حذف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Visitor Modal */}
      {editingVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">ویرایش مشخصات ویزیتور</h3>
                  <p className="text-xs text-slate-400 mt-0.5">ویرایش اطلاعات «{editingVisitor.name}»</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingVisitor(null);
                  setEditVisitorError(null);
                  setEditVisitorSuccess(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editVisitorError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editVisitorError}</span>
              </div>
            )}

            {editVisitorSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editVisitorSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveVisitorEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">نام و نام خانوادگی ویزیتور</label>
                <input
                  type="text"
                  value={visitorEditForm.name}
                  onChange={(e) => setVisitorEditForm({ ...visitorEditForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-hidden focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">شماره تماس</label>
                  <input
                    type="text"
                    value={visitorEditForm.phone}
                    onChange={(e) => setVisitorEditForm({ ...visitorEditForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-hidden focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">منطقه فعالیت</label>
                  <input
                    type="text"
                    value={visitorEditForm.region}
                    onChange={(e) => setVisitorEditForm({ ...visitorEditForm, region: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-hidden focus:border-amber-500"
                    placeholder="مثلاً: بابل و حومه"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">نام کاربری جهت ورود</label>
                <input
                  type="text"
                  value={visitorEditForm.username}
                  onChange={(e) => setVisitorEditForm({ ...visitorEditForm, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-hidden focus:border-amber-500 font-mono"
                  placeholder="آیدی ورود"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="visitor-active-toggle"
                  checked={visitorEditForm.is_active}
                  onChange={(e) => setVisitorEditForm({ ...visitorEditForm, is_active: e.target.checked })}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950"
                />
                <label htmlFor="visitor-active-toggle" className="text-xs text-slate-300 font-medium cursor-pointer">
                  حساب فعال است و اجازه ثبت سفارش دارد
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingVisitor(null);
                    setEditVisitorError(null);
                    setEditVisitorSuccess(null);
                  }}
                  disabled={isUpdatingVisitor}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingVisitor}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-amber-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingVisitor ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ذخیره تغییرات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Visitor Confirmation Modal */}
      {deletingVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">حذف ویزیتور</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  آیا از حذف ویزیتور <strong className="text-white font-bold">{deletingVisitor.name}</strong> (منطقه {deletingVisitor.region}) اطمینان دارید؟
                </p>
                <p className="text-[11px] text-rose-400/90 pt-1">
                  توجه: با حذف ویزیتور، فروشگاه‌های تحت پوشش وی باقی می‌مانند و می‌توانید آن‌ها را به ویزیتور دیگری اختصاص دهید.
                </p>
              </div>
            </div>

            {/* Dependent stats breakdown */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span>فروشگاه‌های تحت پوشش این ویزیتور:</span>
                <span className="font-bold font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
                  {visitorSupermarketsCount} فروشگاه
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>سفارش‌های ثبت‌شده با این ویزیتور:</span>
                <span className="font-bold font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/40">
                  {visitorOrdersCount} سفارش
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                پس از حذف، فروشگاه‌های تحت پوشش به حالت «خرید مستقیم از پخش مرکزی» درآمده و سوابق سفارشات حفظ می‌گردند.
              </p>
            </div>

            {/* Warning if invoice/order previously issued for this visitor */}
            {visitorHasInvoices && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>هشدار: قبلاً برای این شخص (ویزیتور) فاکتور صادر شده است!</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed pr-5">
                  سوابق فاکتورهای پیشین حفظ شده و سفارش‌های در جریان به پخش مرکزی منتقل می‌گردند.
                </p>
              </div>
            )}

            {deleteVisitorError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteVisitorError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingVisitor(null);
                  setDeleteVisitorError(null);
                }}
                disabled={isDeletingVisitor}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVisitor}
                disabled={isDeletingVisitor}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingVisitor ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تایید و حذف ویزیتور</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {resettingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">بازیابی رمز عبور</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  آیا از تغییر رمز عبور {resettingPerson.type === 'supermarket' ? 'فروشگاه / مشتری' : 'ویزیتور'}{' '}
                  <strong className="text-white font-bold">«{resettingPerson.name}»</strong> به رمز پیش‌فرض زیر اطمینان دارید؟
                </p>
              </div>
            </div>

            {/* New Password Box Display */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">رمز عبور جدید:</span>
              <div className="font-mono text-base font-black text-amber-400 tracking-wider">
                123456
              </div>
              {resettingPerson.username && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                  نام کاربری: <span className="text-slate-300 font-mono font-semibold">{resettingPerson.username}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              پس از تایید، کاربر می‌تواند با نام کاربری خود و رمز عبور <strong className="text-amber-300 font-mono">123456</strong> وارد سامانه شود.
            </p>

            {resetPasswordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetPasswordError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setResettingPerson(null);
                  setResetPasswordError(null);
                }}
                disabled={isResettingPassword}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                disabled={isResettingPassword}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-slate-950 font-black text-xs transition shadow-md shadow-amber-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>در حال تغییر رمز...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-slate-950" />
                    <span>تایید و تغییر رمز به 123456</span>
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

