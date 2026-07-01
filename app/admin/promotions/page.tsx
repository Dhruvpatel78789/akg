"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Tag, Percent, Calendar, Hourglass, CheckSquare, Square, ToggleLeft, ToggleRight } from "lucide-react";

type Promotion = {
  _id: string;
  type: "TEXT" | "IMAGE" | "VIDEO";
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  altText?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  placement: string;
  targetAudience: "ALL" | "VISITOR" | "PLAYER" | "MEMBER" | "COIN_USER" | "COMPANY_USER" | "ADMIN";
  priority: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  fullDay: boolean;
  active: boolean;
};

type Coupon = {
  _id: string;
  code: string;
  type: "FLAT" | "PERCENTAGE";
  value: number;
  minBookingAmount: number;
  maxDiscount: number;
  expiryDate?: string;
  active: boolean;
  hidden?: boolean;
  usageLimit: number;
  usedCount: number;
  applicableOnMembership?: boolean;
};

type Offer = {
  _id: string;
  name: string;
  discountType: "FLAT" | "PERCENTAGE";
  value: number;
  active: boolean;
  daysOfWeek: number[];
  startHour?: number;
  endHour?: number;
};

const tabOptions = ["Ads & Promos", "Discount Coupons", "Auto-Offers"] as const;
type Tab = typeof tabOptions[number];

export default function AdminPromotionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Ads & Promos");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // States
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [promoForm, setPromoForm] = useState({
    type: "TEXT" as "TEXT" | "IMAGE" | "VIDEO",
    title: "",
    subtitle: "",
    description: "",
    ctaText: "",
    ctaLink: "",
    mediaUrl: "",
    thumbnailUrl: "",
    altText: "",
    backgroundColor: "#D7E528",
    textColor: "#000000",
    accentColor: "#F5F4EC",
    placement: "PLAYER_DASHBOARD_TOP",
    targetAudience: "ALL" as "ALL" | "VISITOR" | "PLAYER" | "MEMBER" | "COIN_USER" | "COMPANY_USER" | "ADMIN",
    priority: 0,
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    daysOfWeek: [] as number[],
    fullDay: true,
    active: true,
  });

  const [couponForm, setCouponForm] = useState({
    code: "",
    type: "PERCENTAGE" as "FLAT" | "PERCENTAGE",
    value: 0,
    minBookingAmount: 0,
    maxDiscount: 0,
    expiryDate: "",
    active: true,
    hidden: false,
    usageLimit: 0,
    applicableOnMembership: false,
  });

  const [offerForm, setOfferForm] = useState({
    name: "",
    discountType: "PERCENTAGE" as "FLAT" | "PERCENTAGE",
    value: 0,
    active: true,
    daysOfWeek: [] as number[],
    startHour: 10,
    endHour: 17,
  });

  // Loaders
  async function loadPromotions() {
    try {
      const response = await fetch("/api/admin/promotions");
      const data = await response.json();
      setPromotions(data.promotions || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadCoupons() {
    try {
      const response = await fetch("/api/admin/coupons");
      const data = await response.json();
      setCoupons(data.coupons || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadOffers() {
    try {
      const response = await fetch("/api/admin/offers");
      const data = await response.json();
      setOffers(data.offers || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadPromotions();
    loadCoupons();
    loadOffers();
  }, []);

  // Creation & Editing logic
  async function createPromotion(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const url = editingId ? `/api/admin/promotions/${editingId}` : "/api/admin/promotions";
      const method = editingId ? "PATCH" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promoForm),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message || `Failed to ${editingId ? "update" : "create"} promotion`);
        return;
      }
      setMessage(`Promotion ${editingId ? "updated" : "created"} successfully!`);
      setPromoForm({
        type: "TEXT",
        title: "",
        subtitle: "",
        description: "",
        ctaText: "",
        ctaLink: "",
        mediaUrl: "",
        thumbnailUrl: "",
        altText: "",
        backgroundColor: "#D7E528",
        textColor: "#000000",
        accentColor: "#F5F4EC",
        placement: "PLAYER_DASHBOARD_TOP",
        targetAudience: "ALL",
        priority: 0,
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        daysOfWeek: [],
        fullDay: true,
        active: true,
      });
      setEditingId(null);
      loadPromotions();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeletePromo(id: string) {
    if (!confirm("Are you sure you want to delete this promotion?")) return;
    try {
      const response = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      if (response.ok) {
        setMessage("Promotion deleted successfully");
        loadPromotions();
      } else {
        const data = await response.json();
        setMessage(data.message || "Failed to delete promotion");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleActive(promo: Promotion) {
    try {
      const response = await fetch(`/api/admin/promotions/${promo._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !promo.active }),
      });
      if (response.ok) {
        loadPromotions();
      }
    } catch (err) {
      console.error(err);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    setUploadLoading(true);
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPromoForm((prev) => ({ ...prev, mediaUrl: data.url }));
      } else {
        alert(data.message || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Upload error");
    } finally {
      setUploadLoading(false);
    }
  };

  const togglePromoDay = (dayNum: number) => {
    setPromoForm((prev) => {
      const index = prev.daysOfWeek.indexOf(dayNum);
      if (index > -1) {
        return { ...prev, daysOfWeek: prev.daysOfWeek.filter((d) => d !== dayNum) };
      } else {
        return { ...prev, daysOfWeek: [...prev.daysOfWeek, dayNum] };
      }
    });
  };

  async function createCoupon(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...couponForm,
        code: couponForm.code.toUpperCase(),
        expiryDate: couponForm.expiryDate ? new Date(couponForm.expiryDate).toISOString() : undefined,
      };
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message || "Failed to create coupon");
        return;
      }
      setMessage("Coupon created successfully!");
      setCouponForm({
        code: "",
        type: "PERCENTAGE",
        value: 0,
        minBookingAmount: 0,
        maxDiscount: 0,
        expiryDate: "",
        active: true,
        hidden: false,
        usageLimit: 0,
        applicableOnMembership: false,
      });
      loadCoupons();
    } catch (err) {
      console.error(err);
    }
  }

  async function createOffer(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerForm),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message || "Failed to create auto-offer");
        return;
      }
      setMessage("Auto-offer created successfully!");
      setOfferForm({
        name: "",
        discountType: "PERCENTAGE",
        value: 0,
        active: true,
        daysOfWeek: [],
        startHour: 10,
        endHour: 17,
      });
      loadOffers();
    } catch (err) {
      console.error(err);
    }
  }

  // Deletions
  async function handleDeleteCoupon(id: string) {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      const response = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
      if (response.ok) {
        setMessage("Coupon deleted");
        loadCoupons();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteOffer(id: string) {
    if (!confirm("Are you sure you want to delete this offer?")) return;
    try {
      const response = await fetch(`/api/admin/offers/${id}`, { method: "DELETE" });
      if (response.ok) {
        setMessage("Auto-offer deleted");
        loadOffers();
      }
    } catch (err) {
      console.error(err);
    }
  }

  const toggleDay = (dayNum: number) => {
    setOfferForm((prev) => {
      const index = prev.daysOfWeek.indexOf(dayNum);
      if (index > -1) {
        return { ...prev, daysOfWeek: prev.daysOfWeek.filter((d) => d !== dayNum) };
      } else {
        return { ...prev, daysOfWeek: [...prev.daysOfWeek, dayNum] };
      }
    });
  };

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <section className="min-w-0 pb-10">
      <h1 className="text-4xl font-black text-[var(--primary)]">Promotions & Discounts</h1>
      <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
        Configure banner advertisements, coupon codes, and time-based auto discounts.
      </p>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5">
          {message}
        </p>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b pb-3 border-gray-100">
        {tabOptions.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setMessage("");
            }}
            className={`rounded-full px-4 py-2 text-xs font-black ${
              activeTab === tab
                ? "bg-[var(--primary)] text-white"
                : "bg-white text-[var(--primary)] ring-1 ring-black/5"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 1: Ads & Promos */}
      {activeTab === "Ads & Promos" && (
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-5 space-y-6">
            <form onSubmit={createPromotion} className="bg-white p-6 rounded-2xl ring-1 ring-black/5 space-y-5 text-left">
              <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plus size={16} /> {editingId ? "Edit Promotion" : "Add Promotion"}
                </span>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setPromoForm({
                        type: "TEXT",
                        title: "",
                        subtitle: "",
                        description: "",
                        ctaText: "",
                        ctaLink: "",
                        mediaUrl: "",
                        thumbnailUrl: "",
                        altText: "",
                        backgroundColor: "#D7E528",
                        textColor: "#000000",
                        accentColor: "#F5F4EC",
                        placement: "PLAYER_DASHBOARD_TOP",
                        targetAudience: "ALL",
                        priority: 0,
                        startDate: "",
                        endDate: "",
                        startTime: "",
                        endTime: "",
                        daysOfWeek: [],
                        fullDay: true,
                        active: true,
                      });
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-red-500"
                  >
                    Cancel Edit
                  </button>
                )}
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Type</span>
                  <select
                    value={promoForm.type}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, type: e.target.value as any }))}
                    className="h-11 rounded-xl bg-gray-50 border px-3 font-bold outline-none"
                  >
                    <option value="TEXT">Text only</option>
                    <option value="IMAGE">Image card</option>
                    <option value="VIDEO">Video player</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Placement</span>
                  <select
                    value={promoForm.placement}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, placement: e.target.value }))}
                    className="h-11 rounded-xl bg-gray-50 border px-3 font-bold outline-none"
                  >
                    <option value="HOME_HERO">Homepage Hero Carousel</option>
                    <option value="HOME_BELOW_OPTIONS">Home below options</option>
                    <option value="MEMBERSHIP_TOP">Membership screen top</option>
                    <option value="MEMBERSHIP_PLAN_CARD">Membership Plan card</option>
                    <option value="VISITOR_BOOKING_TOP">Visitor booking top</option>
                    <option value="VISITOR_BOOKING_PAYMENT">Visitor booking payment</option>
                    <option value="PLAYER_DASHBOARD_TOP">Player dashboard top</option>
                    <option value="PLAYER_DASHBOARD_AFTER_PLAYTIME">Player dashboard after playtime</option>
                    <option value="COMPANY_DASHBOARD_TOP">Company dashboard top</option>
                    <option value="BOOKING_SUCCESS">Booking Success screen</option>
                    <option value="PAYMENT_PAGE_TOP">Payment screen top</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Title {promoForm.type !== "TEXT" && "(Optional)"}</span>
                <input
                  required={promoForm.type === "TEXT"}
                  value={promoForm.title}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Subtitle (Optional)</span>
                <input
                  value={promoForm.subtitle}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              {promoForm.type === "TEXT" && (
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Description (Optional)</span>
                  <textarea
                    value={promoForm.description}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="p-3 rounded-xl bg-gray-50 border font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">CTA Text (Optional)</span>
                  <input
                    value={promoForm.ctaText}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, ctaText: e.target.value }))}
                    placeholder="e.g. Register Now"
                    className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">CTA Link / Redirect URI (Optional)</span>
                  <input
                    value={promoForm.ctaLink}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, ctaLink: e.target.value }))}
                    placeholder="/player/membership"
                    className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </label>
              </div>

              {promoForm.type !== "TEXT" && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-gray-400 block">Media Upload / Storage</span>
                  <div className="flex gap-2 items-center">
                    <input
                      type="file"
                      accept={promoForm.type === "IMAGE" ? "image/*" : "video/*"}
                      onChange={handleFileUpload}
                      className="hidden"
                      id="device-media-upload"
                    />
                    <label
                      htmlFor="device-media-upload"
                      className="h-11 px-4 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 cursor-pointer font-black text-xs transition"
                    >
                      {uploadLoading ? "Uploading to Cloudinary..." : "Choose File"}
                    </label>
                    <input
                      required
                      value={promoForm.mediaUrl}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, mediaUrl: e.target.value }))}
                      placeholder="Or enter URL directly"
                      className="h-11 flex-1 rounded-xl bg-gray-50 border px-4 font-bold outline-none text-xs focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              )}

              {promoForm.type === "IMAGE" && (
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Alt Text (Accessibility)</span>
                  <input
                    value={promoForm.altText}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, altText: e.target.value }))}
                    className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </label>
              )}

              {promoForm.type === "TEXT" && (
                <div className="grid grid-cols-3 gap-2">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Background</span>
                    <input
                      type="color"
                      value={promoForm.backgroundColor}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                      className="h-11 w-full rounded-xl cursor-pointer bg-gray-50 border p-1"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Text Color</span>
                    <input
                      type="color"
                      value={promoForm.textColor}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, textColor: e.target.value }))}
                      className="h-11 w-full rounded-xl cursor-pointer bg-gray-50 border p-1"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Accent Color</span>
                    <input
                      type="color"
                      value={promoForm.accentColor}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, accentColor: e.target.value }))}
                      className="h-11 w-full rounded-xl cursor-pointer bg-gray-50 border p-1"
                    />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Target Audience</span>
                  <select
                    value={promoForm.targetAudience}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, targetAudience: e.target.value as any }))}
                    className="h-11 rounded-xl bg-gray-50 border px-3 font-bold outline-none"
                  >
                    <option value="ALL">All Visitors & Players</option>
                    <option value="VISITOR">Unregistered Visitors Only</option>
                    <option value="PLAYER">Registered Players Only</option>
                    <option value="MEMBER">Active Plan Members Only</option>
                    <option value="COIN_USER">Users with coin balance Only</option>
                    <option value="COMPANY_USER">Company Employees Only</option>
                    <option value="ADMIN">Admins Only</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Display Priority (weight)</span>
                  <input
                    type="number"
                    value={promoForm.priority}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                    className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </label>
              </div>

              {/* Scheduling section */}
              <div className="border-t pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-gray-400">Validity Schedule</span>
                  <button
                    type="button"
                    onClick={() => setPromoForm((prev) => ({ ...prev, fullDay: !prev.fullDay }))}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[var(--primary)]"
                  >
                    {promoForm.fullDay ? <CheckSquare size={14} /> : <Square size={14} />} Full Day (No Hours)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Start Date</span>
                    <input
                      type="date"
                      value={promoForm.startDate ? promoForm.startDate.split("T")[0] : ""}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none text-xs focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">End Date</span>
                    <input
                      type="date"
                      value={promoForm.endDate ? promoForm.endDate.split("T")[0] : ""}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none text-xs focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </label>
                </div>

                {!promoForm.fullDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1">
                      <span className="text-[10px] font-black uppercase text-gray-400">Start Time</span>
                      <input
                        type="time"
                        value={promoForm.startTime}
                        onChange={(e) => setPromoForm((prev) => ({ ...prev, startTime: e.target.value }))}
                        className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none text-xs focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[10px] font-black uppercase text-gray-400">End Time</span>
                      <input
                        type="time"
                        value={promoForm.endTime}
                        onChange={(e) => setPromoForm((prev) => ({ ...prev, endTime: e.target.value }))}
                        className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none text-xs focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    </label>
                  </div>
                )}

                <div className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Days Of Week (Optional)</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {weekdays.map((day, idx) => {
                      const selected = promoForm.daysOfWeek.includes(idx);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => togglePromoDay(idx)}
                          className={`text-[10px] font-black px-2 py-1.5 rounded-lg border transition ${
                            selected
                              ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                              : "bg-gray-50 text-gray-500 border-gray-150"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button className="h-12 w-full rounded-full bg-[var(--primary)] text-xs font-black text-white hover:opacity-90 active:scale-95 transition">
                {editingId ? "Save Changes" : "Create Promotion"}
              </button>
            </form>

            {/* LIVE PREVIEW COMPONENT */}
            <div className="bg-white p-6 rounded-2xl ring-1 ring-black/5 text-left space-y-3">
              <h4 className="text-xs font-black uppercase text-gray-400 border-b pb-1">Live Visual Preview</h4>
              <article
                className="relative h-40 overflow-hidden rounded-[2rem] p-5 flex flex-col justify-end shadow-sm ring-1 ring-black/5"
                style={{
                  background: promoForm.type === "TEXT"
                    ? (promoForm.backgroundColor || "linear-gradient(135deg, #D7E528, #F5F4EC)")
                    : "black",
                }}
              >
                {/* Media Background Preview */}
                {promoForm.type === "IMAGE" && promoForm.mediaUrl && (
                  <img
                    src={promoForm.mediaUrl}
                    alt={promoForm.altText || "Preview"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

                {promoForm.type === "VIDEO" && promoForm.mediaUrl && (
                  <video
                    src={promoForm.mediaUrl}
                    className="absolute inset-0 h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                )}

                <div className="absolute inset-0 bg-black/10" />

                <div className="relative z-10 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">
                    {promoForm.targetAudience}
                  </p>

                  <h2
                    className="text-xl font-black leading-tight mt-1"
                    style={{ color: promoForm.type === "TEXT" ? (promoForm.textColor || "#FFFFFF") : "#FFFFFF" }}
                  >
                    {promoForm.title || "Ad Title Preview"}
                  </h2>
                  
                  {promoForm.subtitle && (
                    <p
                      className="mt-1 text-xs font-semibold"
                      style={{ color: promoForm.type === "TEXT" ? (promoForm.accentColor || "rgba(255,255,255,0.75)") : "rgba(255,255,255,0.75)" }}
                    >
                      {promoForm.subtitle}
                    </p>
                  )}
                </div>
              </article>
            </div>
          </div>

          <div className="xl:col-span-7 bg-white p-6 rounded-2xl ring-1 ring-black/5 text-left">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-3 mb-4">Current Active Ads & Offers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b text-gray-400 font-bold uppercase">
                    <th className="py-2">Promo Details</th>
                    <th>Placement</th>
                    <th>Audience</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((p) => (
                    <tr key={p._id} className="border-b last:border-0 font-bold text-gray-700">
                      <td className="py-3">
                        <div className="font-black text-[var(--primary)] text-sm">{p.title || "(No title)"}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{p.type}</div>
                      </td>
                      <td className="text-[10px]">{p.placement}</td>
                      <td>
                        <span className="bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">
                          {p.targetAudience}
                        </span>
                      </td>
                      <td>{p.priority}</td>
                      <td>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className="focus:outline-none transition active:scale-90"
                        >
                          {p.active ? (
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-[10px]">Active</span>
                          ) : (
                            <span className="text-gray-400 bg-gray-50 px-2 py-1 rounded-full text-[10px]">Disabled</span>
                          )}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(p._id);
                              setPromoForm({
                                type: p.type,
                                title: p.title || "",
                                subtitle: p.subtitle || "",
                                description: p.description || "",
                                ctaText: p.ctaText || "",
                                ctaLink: p.ctaLink || "",
                                mediaUrl: p.mediaUrl || "",
                                thumbnailUrl: p.thumbnailUrl || "",
                                altText: p.altText || "",
                                backgroundColor: p.backgroundColor || "#D7E528",
                                textColor: p.textColor || "#000000",
                                accentColor: p.accentColor || "#F5F4EC",
                                placement: p.placement,
                                targetAudience: p.targetAudience,
                                priority: p.priority,
                                startDate: p.startDate ? p.startDate.split("T")[0] : "",
                                endDate: p.endDate ? p.endDate.split("T")[0] : "",
                                startTime: p.startTime || "",
                                endTime: p.endTime || "",
                                daysOfWeek: p.daysOfWeek || [],
                                fullDay: p.fullDay ?? true,
                                active: p.active,
                              });
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePromo(p._id)}
                            className="text-xs text-red-600 hover:text-red-900 bg-red-50 px-2.5 py-1 rounded-lg"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {promotions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400 font-bold">
                        No active advertisements or offers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Discount Coupons */}
      {activeTab === "Discount Coupons" && (
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <form onSubmit={createCoupon} className="xl:col-span-5 bg-white p-6 rounded-2xl ring-1 ring-black/5 space-y-4">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2 flex items-center gap-2">
              <Tag size={16} /> Create Coupon Code
            </h3>

            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400">Coupon Code</span>
              <input
                required
                placeholder="e.g. SAVE20"
                value={couponForm.code}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, code: e.target.value }))}
                className="h-11 rounded-xl bg-gray-50 border px-4 font-black outline-none focus:ring-1 focus:ring-[var(--primary)] uppercase"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Discount Type</span>
                <select
                  value={couponForm.type}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, type: e.target.value as any }))}
                  className="h-11 rounded-xl bg-gray-50 border px-3 font-bold outline-none"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FLAT">Flat Rate (₹)</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Value</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={couponForm.value}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Min booking (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={couponForm.minBookingAmount}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, minBookingAmount: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Max Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={couponForm.maxDiscount}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, maxDiscount: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Expiry Date</span>
                <input
                  type="date"
                  value={couponForm.expiryDate}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)] text-xs"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Total Usage Limit</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0 = Unlimited"
                  value={couponForm.usageLimit}
                  onChange={(e) => setCouponForm((prev) => ({ ...prev, usageLimit: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 py-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={couponForm.applicableOnMembership}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, applicableOnMembership: e.target.checked }))}
                className="h-4.5 w-4.5 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-xs font-bold text-gray-700">Allow on Membership Plan Purchase</span>
            </label>

            <label className="flex items-center gap-2 py-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={couponForm.hidden}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, hidden: e.target.checked }))}
                className="h-4.5 w-4.5 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-xs font-bold text-gray-700">Hide Coupon in Dropdown Menu (requires manual entry)</span>
            </label>

            <button className="h-12 w-full rounded-full bg-[var(--primary)] text-xs font-black text-white hover:opacity-90 active:scale-95 transition">
              Create Coupon Code
            </button>
          </form>

          <div className="xl:col-span-7 bg-white p-6 rounded-2xl ring-1 ring-black/5">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-3 mb-4">Active Coupon Codes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[550px]">
                <thead>
                  <tr className="border-b text-gray-400 font-bold uppercase">
                    <th className="py-2">Code</th>
                    <th>Value</th>
                    <th>Min Spend</th>
                    <th>Membership?</th>
                    <th>Hidden?</th>
                    <th>Limit / Used</th>
                    <th>Expiry</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c._id} className="border-b last:border-0 font-bold text-gray-700">
                      <td className="py-3 font-black text-[var(--primary)] select-all">{c.code}</td>
                      <td>{c.type === "PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}</td>
                      <td>₹{c.minBookingAmount || 0}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${c.applicableOnMembership ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-gray-100 text-gray-600"}`}>
                          {c.applicableOnMembership ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${c.hidden ? "bg-amber-50 text-amber-800 border border-amber-100" : "bg-gray-100 text-gray-600"}`}>
                          {c.hidden ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>{c.usageLimit > 0 ? `${c.usedCount} / ${c.usageLimit}` : `${c.usedCount} used`}</td>
                      <td>{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString("en-IN") : "Never"}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteCoupon(c._id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition"
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
        </div>
      )}

      {/* TAB 3: Auto-Offers */}
      {activeTab === "Auto-Offers" && (
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <form onSubmit={createOffer} className="xl:col-span-5 bg-white p-6 rounded-2xl ring-1 ring-black/5 space-y-4">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2 flex items-center gap-2">
              <Percent size={16} /> Set Automatic Offer
            </h3>

            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400">Offer Name / Description</span>
              <input
                required
                placeholder="e.g. Wednesday Happy Hour"
                value={offerForm.name}
                onChange={(e) => setOfferForm((prev) => ({ ...prev, name: e.target.value }))}
                className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Discount Type</span>
                <select
                  value={offerForm.discountType}
                  onChange={(e) => setOfferForm((prev) => ({ ...prev, discountType: e.target.value as any }))}
                  className="h-11 rounded-xl bg-gray-50 border px-3 font-bold outline-none"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FLAT">Flat Rate (₹)</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Value</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={offerForm.value}
                  onChange={(e) => setOfferForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>
            </div>

            {/* Weekly Days selection */}
            <div className="grid gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400">Applicable Weekdays</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {weekdays.map((day, idx) => {
                  const selected = offerForm.daysOfWeek.includes(idx);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`text-[10px] font-black px-2 py-1.5 rounded-lg border transition ${
                        selected
                          ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                          : "bg-gray-50 text-gray-500 border-gray-150"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hour slot selection */}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Start Hour (24h)</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={offerForm.startHour}
                  onChange={(e) => setOfferForm((prev) => ({ ...prev, startHour: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">End Hour (24h)</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={offerForm.endHour}
                  onChange={(e) => setOfferForm((prev) => ({ ...prev, endHour: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-gray-50 border px-4 font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>
            </div>

            <button className="h-12 w-full rounded-full bg-[var(--primary)] text-xs font-black text-white hover:opacity-90 active:scale-95 transition">
              Create Automatic Offer
            </button>
          </form>

          <div className="xl:col-span-7 bg-white p-6 rounded-2xl ring-1 ring-black/5">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-3 mb-4">Active Happy Hour / Auto-Offers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[550px]">
                <thead>
                  <tr className="border-b text-gray-400 font-bold uppercase">
                    <th className="py-2">Offer Name</th>
                    <th>Value</th>
                    <th>Days</th>
                    <th>Hours Window</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o._id} className="border-b last:border-0 font-bold text-gray-700">
                      <td className="py-3 font-black text-[var(--primary)]">{o.name}</td>
                      <td>{o.discountType === "PERCENTAGE" ? `${o.value}%` : `₹${o.value}`}</td>
                      <td className="text-[10px] text-indigo-700">
                        {o.daysOfWeek && o.daysOfWeek.length > 0
                          ? o.daysOfWeek.map((d) => weekdays[d]).join(", ")
                          : "Everyday"}
                      </td>
                      <td>
                        {o.startHour !== undefined && o.endHour !== undefined
                          ? `${String(o.startHour).padStart(2, "0")}:00 - ${String(o.endHour).padStart(2, "0")}:00`
                          : "All Hours"}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteOffer(o._id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition"
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
        </div>
      )}
    </section>
  );
}