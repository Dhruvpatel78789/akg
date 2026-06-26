"use client";

export const dynamic = "force-dynamic";

import { ArrowLeft, Home, CreditCard, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import { parseIST } from "@/lib/time";

type Plan = {
  _id: string;
  name: string;
  type: "FIXED" | "COINS";
  price: number;
  coinsAmount?: number;
  bonusCoins?: number;
  gameName?: string;
  durations?: Array<{
    label: string;
    finalPrice: number;
  }>;
};

type Game = {
  _id: string;
  name: string;
};

function UnifiedPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Common Params
  const type = searchParams.get("type") || "plan"; // "plan" or "booking"

  // Plan Params
  const planId = searchParams.get("planId") || "";
  const durationIndex = Number(searchParams.get("durationIndex") || 0);
  const planStartTime = searchParams.get("startTime") || "";
  const planEndTime = searchParams.get("endTime") || "";

  // Booking Params
  const bookingId = searchParams.get("bookingId") || "";
  const gameId = searchParams.get("gameId") || "";
  const bookingDate = searchParams.get("date") || "";
  const bookingStartTime = searchParams.get("startTime") || "";
  const bookingEndTime = searchParams.get("endTime") || "";
  const playersCount = Number(searchParams.get("playersCount") || 1);
  const coinCost = Number(searchParams.get("coinCost") || 0);
  const reason = searchParams.get("reason") || "";
  const limitMessage = searchParams.get("message") || "";

  // Component State
  const [plan, setPlan] = useState<Plan | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  // Pay at Counter Config
  const [payAtCounterWindow, setPayAtCounterWindow] = useState(30);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"RAZORPAY" | "PAY_AT_COUNTER">("RAZORPAY");

  // Load Settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setPayAtCounterWindow(data.settings.payAtCounterWindowMinutes ?? 30);
        }
      })
      .catch((err) => console.error("Failed to load settings", err));
  }, []);

  const isPayAtCounterAllowed = useMemo(() => {
    if (type !== "booking") return false;
    if (!bookingDate || !bookingStartTime) return false;

    const bookingStart = parseIST(bookingDate, bookingStartTime);

    const diffMs = bookingStart.getTime() - Date.now();
    const diffMins = diffMs / (60 * 1000);

    return diffMins <= payAtCounterWindow && diffMins >= -15;
  }, [type, bookingDate, bookingStartTime, payAtCounterWindow]);

  // Promotion State
  const [promotions, setPromotions] = useState<any[]>([]);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState("");

  const selectedGameName = useMemo(() => {
    return games.find((g) => g._id === gameId)?.name || "Sport Session";
  }, [games, gameId]);

  // Check visitor flow status
  const isVisitor = searchParams.get("visitorFlow") === "true";

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        if (type === "plan" && planId) {
          const res = await fetch(`/api/plans/${planId}`);
          const data = await res.json();
          if (res.ok && data.plan) {
            setPlan(data.plan);
          } else {
            setError(data.message || "Failed to load plan details");
          }
        } else if (type === "booking") {
          const res = await fetch("/api/games");
          const data = await res.json();
          if (res.ok && data.success) {
            setGames(data.games || []);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Network error while loading checkout details");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [type, planId]);

  // Load promotions on init for displaying on payment success
  useEffect(() => {
    fetch("/api/promotions?placement=BOOKING_SUCCESS")
      .then((res) => res.json())
      .then((data) => {
        if (data.promotions) {
          setPromotions(data.promotions);
        }
      })
      .catch((err) => console.error("Failed to load ads/offers", err));
  }, []);

  // Auto-redirect to dashboard 3 seconds after successful payment/booking
  useEffect(() => {
    if (paymentSuccess) {
      const timer = setTimeout(() => {
        router.replace("/player/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess, router]);

  // Price Calculation
  const amountToPay = useMemo(() => {
    if (type === "plan" && plan) {
      if (plan.type === "COINS") {
        return plan.price;
      }
      return plan.durations?.[durationIndex]?.finalPrice || 0;
    }
    if (type === "booking") {
      // Booking cash price is equal to the coin cost (1 coin = 1 rupee)
      return coinCost;
    }
    return 0;
  }, [type, plan, durationIndex, coinCost]);

  // Discount Coupons
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const base = amountToPay;
    let disc = 0;
    if (appliedCoupon.type === "FLAT") {
      disc = appliedCoupon.value;
    } else if (appliedCoupon.type === "PERCENTAGE") {
      disc = (base * appliedCoupon.value) / 100;
      if (appliedCoupon.maxDiscount > 0 && disc > appliedCoupon.maxDiscount) {
        disc = appliedCoupon.maxDiscount;
      }
    }
    return Math.min(disc, base);
  }, [appliedCoupon, amountToPay]);

  const finalAmountToPay = useMemo(() => {
    return Math.max(0, amountToPay - discountAmount);
  }, [amountToPay, discountAmount]);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/player/coupons/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          bookingAmount: amountToPay,
          isMembershipPurchase: type === "plan",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon({
          _id: data.couponId,
          code: data.code,
          type: data.discountAmount === data.finalAmount ? "FLAT" : "PERCENTAGE",
          value: data.discountAmount,
        });
      } else {
        setCouponError(data.message || "Invalid coupon code");
      }
    } catch {
      setCouponError("Network issue applying coupon code");
    } finally {
      setCouponLoading(false);
    }
  }

  async function finalizePayment(razorpayOrderId: string) {
    try {
      if (type === "plan") {
        const response = await fetch("/api/player/membership/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            durationIndex,
            startTime: planStartTime,
            endTime: planEndTime,
            razorpayOrderId,
            couponId: appliedCoupon?._id || undefined,
          }),
        });

        if (response.status === 401 || response.status === 403) {
          router.replace("/auth/login");
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Plan purchase failed");
        }

        setPaymentSuccess(true);
      } else if (type === "booking") {
        const response = await fetch("/api/player/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            gameId,
            date: bookingDate,
            startTime: bookingStartTime,
            endTime: bookingEndTime,
            playersCount,
            razorpayOrderId,
            couponId: appliedCoupon?._id || undefined,
            paymentMethod: selectedPaymentMethod,
          }),
        });

        if (response.status === 401 || response.status === 403) {
          router.replace("/auth/login");
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Booking creation failed");
        }

        if (data.booking?._id) {
          setSuccessBookingId(data.booking._id);
        }
        setPaymentSuccess(true);
      }
    } catch (err: any) {
      console.error("Finalization failed:", err);
      setError(err.message || "Booking or plan finalization failed");
      setPaying(false);
    }
  }

    async function handlePayment() {
    setPaying(true);
    setError("");

    try {
      const amount = finalAmountToPay;
      if (selectedPaymentMethod === "PAY_AT_COUNTER") {
        await finalizePayment("order_counter_payment_" + Math.random().toString(36).substring(2, 10));
        return;
      }
      if (amount <= 0) {
        // Free purchase due to coupon
        await finalizePayment("order_free_coupon_" + Math.random().toString(36).substring(2, 10));
        return;
      }

      // 1. Create payment order on server
      const createOrderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          purpose: type === "plan" ? "MEMBERSHIP" : "MEMBER_BOOKING",
          metadata: {
            type,
            planId,
            durationIndex: String(durationIndex),
            bookingId,
            gameId,
            date: bookingDate,
            startTime: bookingStartTime,
            endTime: bookingEndTime,
          },
        }),
      });

      const orderData = await createOrderRes.json();
      if (!createOrderRes.ok || !orderData.success) {
        throw new Error(orderData.message || "Failed to create payment order");
      }

      // Check if it's a mock payment (fallback)
      if (orderData.orderId.startsWith("order_mock_")) {
        // Automatically verify mock payment
        const verifyRes = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: "pay_mock_" + Math.random().toString(36).substring(2, 10),
            razorpaySignature: "mock_signature_bypass",
          }),
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.message || "Mock payment verification failed");
        }

        // Finalize transaction on backend
        await finalizePayment(orderData.orderId);
        return;
      }

      // 2. Open Razorpay checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Akshar Game Zone",
        description: type === "plan" ? `Plan Purchase` : `Booking Payment`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            setPaying(true);
            // Verify signature on backend
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.message || "Payment verification failed");
            }

            // Finalize transaction on backend
            await finalizePayment(response.razorpay_order_id);
          } catch (err: any) {
            setError(err.message || "Verification failed");
            setPaying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
        prefill: {
          name: "",
          email: "",
          contact: "",
        },
        theme: {
          color: "#03210f",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Payment process failed");
      setPaying(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto max-w-md">
        <header className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <ArrowLeft size={24} className="text-[var(--primary)]" />
          </button>
          <h1 className="text-3xl font-black text-[var(--primary)]">
            Checkout
          </h1>
          <Link
            href="/player/dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <Home size={23} className="text-[var(--primary)]" />
          </Link>
        </header>

        {loading ? (
          <p className="mt-8 font-black text-[var(--primary)] animate-pulse">Loading checkout details...</p>
        ) : paymentSuccess ? (
          <div className="mt-6 space-y-6">
            {/* Payment Success Card */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck size={36} />
              </div>
              <h2 className="text-2xl font-black text-[var(--primary)]">
                {selectedPaymentMethod === "PAY_AT_COUNTER" ? "Slot Reserved!" : "Payment Successful!"}
              </h2>
              <p className="text-sm font-semibold text-[var(--text-muted)] leading-relaxed">
                {selectedPaymentMethod === "PAY_AT_COUNTER"
                  ? "Your slot has been reserved. Please pay at the counter before your session starts. Your session will start only after payment is confirmed by staff."
                  : "Thank you for your transaction. Your booking/plan has been successfully activated."}
              </p>
              
              {type === "booking" && successBookingId && (
                <button
                  onClick={() => {
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) return;
                    const html = `
                      <html>
                        <head>
                          <title>Booking Receipt - ${successBookingId}</title>
                          <style>
                            body { font-family: sans-serif; padding: 40px; color: #111; line-height: 1.5; }
                            .receipt { border: 2px solid #03210f; padding: 30px; border-radius: 15px; max-width: 500px; margin: 0 auto; }
                            h1 { margin-bottom: 5px; color: #03210f; font-size: 24px; text-align: center; }
                            hr { border: 0; border-top: 1px dashed #ccc; margin: 20px 0; }
                            p { margin: 8px 0; font-size: 14px; }
                            .font-black { font-weight: bold; }
                          </style>
                        </head>
                        <body>
                          <div class="receipt">
                            <h1>Akshar Game Zone Receipt</h1>
                            <p style="text-align: center; font-size: 12px; color: #666;">Booking Reference: ${successBookingId}</p>
                            <hr />
                            <p><strong>Game:</strong> ${selectedGameName}</p>
                            <p><strong>Date:</strong> ${bookingDate || new Date().toLocaleDateString("en-IN")}</p>
                            <p><strong>Time:</strong> ${bookingStartTime} - ${bookingEndTime}</p>
                            <p><strong>Players Count:</strong> ${playersCount}</p>
                            <p><strong>Paid Amount:</strong> ₹${amountToPay}</p>
                            <hr />
                            <p style="text-align: center; font-size: 12px; font-weight: bold;">Thank you for playing at Akshar Game Zone!</p>
                          </div>
                        </body>
                      </html>
                    `;
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.print();
                  }}
                  className="w-full h-11 bg-[#EDEBE2] rounded-full text-xs font-black text-[var(--primary)] hover:opacity-95"
                >
                  Print Booking Receipt (PDF)
                </button>
              )}
            </div>

            {/* Promotions section (Ads & Offers) */}
            {promotions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                  Special Promotions & Offers
                </h3>
                <div className="grid gap-4">
                  {promotions.map((promo) => (
                    <div
                      key={promo._id}
                      style={{ backgroundColor: promo.backgroundColor || "#D7E528" }}
                      className="rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]"
                    >
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider bg-black/10 px-2 py-0.5 rounded-full text-[var(--primary)] inline-block mb-2">
                          {promo.type}
                        </span>
                        <h4 className="text-lg font-black text-[var(--primary)] leading-snug">
                          {promo.title}
                        </h4>
                        {promo.subtitle && (
                          <p className="text-xs font-semibold text-[var(--primary)]/80 mt-1">
                            {promo.subtitle}
                          </p>
                        )}
                      </div>
                      
                      {promo.mediaUrl && promo.type === "IMAGE" && (
                        <img
                          src={promo.mediaUrl}
                          alt={promo.altText || promo.title || "Ad"}
                          className="mt-3 rounded-2xl w-full h-32 object-cover border border-black/5"
                        />
                      )}

                      {promo.mediaUrl && promo.type === "VIDEO" && (
                        <video
                          src={promo.mediaUrl}
                          className="mt-3 rounded-2xl w-full h-32 object-cover border border-black/5"
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                router.replace("/player/dashboard");
              }}
              className="h-16 w-full rounded-full bg-[var(--primary)] text-lg font-black text-white hover:opacity-95 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Go to Dashboard</span>
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            
            {/* Purchase Details Container */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
              <p className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                Paying For
              </p>

              {type === "plan" && plan && (
                <div>
                  <h2 className="text-2xl font-black text-[var(--primary)]">
                    {plan.name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
                    {plan.type === "FIXED"
                      ? `Fixed Membership (${plan.gameName}) - Duration: ${plan.durations?.[durationIndex]?.label}`
                      : `Coins Recharge (+${(plan.coinsAmount || 0) + (plan.bonusCoins || 0)} coins)`}
                  </p>
                  {plan.type === "FIXED" && (planStartTime || planEndTime) && (
                    <p className="mt-2 text-xs font-black text-[var(--primary)] bg-[#EDEBE2] inline-block px-3 py-1.5 rounded-full">
                      Slot: {planStartTime} - {planEndTime}
                    </p>
                  )}
                </div>
              )}

              {type === "booking" && (
                <div>
                  <h2 className="text-2xl font-black text-[var(--primary)]">
                    {selectedGameName} Session
                  </h2>
                  <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
                    Date: {bookingDate} • Time: {bookingStartTime} - {bookingEndTime}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
                    Players: {playersCount}
                  </p>
                  
                  {/* Warning Reason Block */}
                  {limitMessage && (
                    <div className="mt-3 p-3 rounded-2xl bg-amber-50 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                      {limitMessage}
                    </div>
                  )}
                </div>
              )}

              <hr className="border-gray-100 my-4" />

              {/* Coupon Application Box */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] font-black uppercase text-gray-400">Apply Discount Coupon</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ENTER COUPON CODE"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={couponLoading || !!appliedCoupon}
                    className="h-10 flex-1 border border-black/5 bg-gray-50 rounded-xl px-3 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60"
                  />
                  {appliedCoupon ? (
                    <button
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode("");
                      }}
                      className="h-10 bg-red-50 text-red-700 hover:bg-red-100 font-black text-xs px-4 rounded-xl border border-red-200 transition"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="h-10 bg-[var(--primary)] text-white disabled:opacity-55 font-black text-xs px-4 rounded-xl hover:opacity-90 active:scale-95 transition"
                    >
                      {couponLoading ? "Checking..." : "Apply"}
                    </button>
                  )}
                </div>
                {couponError && (
                  <p className="text-[10px] font-bold text-rose-600">
                    ⚠️ {couponError}
                  </p>
                )}
                {appliedCoupon && (
                  <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    ✓ Coupon <strong>{appliedCoupon.code}</strong> applied! You saved ₹{discountAmount}.
                  </p>
                )}
              </div>

              <hr className="border-gray-100 my-4" />

              {appliedCoupon && (
                <div className="flex justify-between items-center text-xs font-semibold text-gray-500 mb-2">
                  <span>Price Before Coupon</span>
                  <span className="line-through">₹{amountToPay}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline">
                <span className="text-sm font-black text-[var(--primary)]">
                  {appliedCoupon ? "Adjusted Total Price" : "Total Price"}
                </span>
                <span className="text-3xl font-black text-[var(--primary)]">
                  ₹{finalAmountToPay}
                </span>
              </div>
            </div>

            {/* Payment Option Selection Toggle */}
            {isPayAtCounterAllowed && (
              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-3 text-left">
                <p className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                  Select Payment Option
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("RAZORPAY")}
                    className={`h-12 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                      selectedPaymentMethod === "RAZORPAY"
                        ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                        : "bg-gray-50 text-[var(--primary)] border-black/5 hover:bg-gray-100"
                    }`}
                  >
                    Pay Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("PAY_AT_COUNTER")}
                    className={`h-12 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                      selectedPaymentMethod === "PAY_AT_COUNTER"
                        ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                        : "bg-gray-50 text-[var(--primary)] border-black/5 hover:bg-gray-100"
                    }`}
                  >
                    Pay at Counter
                  </button>
                </div>
              </div>
            )}

            {/* Information Card based on Payment Mode */}
            {selectedPaymentMethod === "PAY_AT_COUNTER" ? (
              <div className="rounded-[2rem] bg-amber-50 p-5 text-center space-y-3 border border-amber-100 text-amber-900">
                <div className="flex justify-center">
                  <Clock size={32} />
                </div>
                <h3 className="text-sm font-black">
                  Pay at Counter Requested
                </h3>
                <p className="text-xs font-semibold leading-relaxed">
                  Your reservation will be held. Please pay at the zone counter prior to checking in. Staff will activate your session once payment is received.
                </p>
              </div>
            ) : (
              <div className="rounded-[2rem] bg-[#EDEBE2] p-5 text-center space-y-3">
                <div className="flex justify-center text-[var(--primary)]">
                  <CreditCard size={32} />
                </div>
                <h3 className="text-sm font-black text-[var(--primary)]">
                  Secure Test Gateway Enabled
                </h3>
                <p className="text-xs font-semibold text-[var(--text-muted)] leading-relaxed">
                  Clicking Make Payment will simulate a successful Razorpay callback and immediately activate your membership or secure your booking.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm font-black text-red-500 rounded-2xl bg-red-50 p-4">
                {error}
              </p>
            )}

            <button
              onClick={handlePayment}
              disabled={paying}
              className="h-16 w-full rounded-full bg-[var(--primary)] text-lg font-black text-white hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
            >
              {paying ? (
                <span>Processing...</span>
              ) : selectedPaymentMethod === "PAY_AT_COUNTER" ? (
                <>
                  <ShieldCheck size={20} />
                  <span>Confirm & Reserve Slot</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={20} />
                  <span>Make Payment</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default function UnifiedPaymentPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--background)] px-4 py-6">
        <section className="mx-auto max-w-md">
          <p className="font-black text-[var(--primary)] animate-pulse">Loading payment details...</p>
        </section>
      </main>
    }>
      <UnifiedPaymentForm />
    </Suspense>
  );
}
