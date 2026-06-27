"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Calendar, Clock, Users, CreditCard, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { parseIST } from "@/lib/time";

export default function BookingIntentPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [intent, setIntent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  const [payAtCounterWindow, setPayAtCounterWindow] = useState(30);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"RAZORPAY" | "PAY_AT_COUNTER">("RAZORPAY");
  const [hasAutoPaid, setHasAutoPaid] = useState(false);

  useEffect(() => {
    const autoPay = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("autoPay") === "true" : false;
    if (autoPay && !loading && !hasAutoPaid && intent?.razorpayOrderId) {
      setHasAutoPaid(true);
      const timer = setTimeout(() => {
        if (typeof window !== "undefined" && (window as any).Razorpay) {
          handlePayment();
        } else {
          setTimeout(() => {
            if (typeof window !== "undefined" && (window as any).Razorpay) {
              handlePayment();
            }
          }, 500);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, intent, hasAutoPaid]);

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
    if (!intent || !intent.date || !intent.startTime) return false;

    const bookingStart = parseIST(intent.date, intent.startTime);

    const diffMs = bookingStart.getTime() - Date.now();
    const diffMins = diffMs / (60 * 1000);

    return diffMins <= payAtCounterWindow && diffMins >= -15;
  }, [intent, payAtCounterWindow]);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Sync coupon details from intent metadata on load
  useEffect(() => {
    if (intent && intent.metadata) {
      const metadata = intent.metadata;
      const savedCode = metadata.couponCode || (metadata.get ? metadata.get("couponCode") : null);
      const savedDiscount = metadata.discount || (metadata.get ? metadata.get("discount") : null);
      if (savedCode && savedDiscount) {
        setAppliedCoupon({ code: savedCode });
        setDiscountAmount(Number(savedDiscount));
      }
    }
  }, [intent]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch(`/api/public/booking-intents/${id}/apply-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon({ code: couponCode.trim().toUpperCase() });
        setDiscountAmount(data.discountAmount);
        setIntent((prev: any) => ({
          ...prev,
          price: data.finalPrice,
          razorpayOrderId: data.razorpayOrderId,
        }));
      } else {
        setCouponError(data.message || "Invalid coupon code");
      }
    } catch {
      setCouponError("Network issue applying coupon code");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch(`/api/public/booking-intents/${id}/remove-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon(null);
        setCouponCode("");
        setDiscountAmount(0);
        setIntent((prev: any) => ({
          ...prev,
          price: data.finalPrice,
          razorpayOrderId: data.razorpayOrderId,
        }));
      } else {
        setCouponError(data.message || "Failed to remove coupon");
      }
    } catch {
      setCouponError("Network issue removing coupon code");
    } finally {
      setCouponLoading(false);
    }
  };

  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Fetch BookingIntent Details
  const fetchIntent = async () => {
    try {
      const res = await fetch(`/api/public/booking-intents/${id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setIntent(data.intent);
        setIsExpired(data.isExpired);
        if (data.intent.status === "CONFIRMED" || data.intent.status === "PAID") {
          setPaymentSuccess(true);
        }
      } else {
        setError(data.message || "Failed to load booking intent details");
      }
    } catch (err) {
      console.error(err);
      setError("Network error loading intent details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchIntent();
    }
  }, [id]);

  // Expiration timer logic
  useEffect(() => {
    if (!intent || isExpired || paymentSuccess) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(intent.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft("Expired");
        clearInterval(timer);
      } else {
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [intent, isExpired, paymentSuccess]);

  // Handle Pay Trigger
  const handlePayment = async (method: "RAZORPAY" | "PAY_AT_COUNTER" = "RAZORPAY") => {
    if (!intent) return;
    if (isExpired) {
      setError("This booking session has expired. Please create a new booking.");
      return;
    }
    setPaying(true);
    setError("");
    setSelectedPaymentMethod(method);

    try {
      if (method === "PAY_AT_COUNTER") {
        const res = await fetch(`/api/public/booking-intents/${id}/pay-at-counter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setPaymentSuccess(true);
        } else {
          setError(data.message || "Failed to confirm Pay at Counter booking");
        }
        setPaying(false);
        return;
      }
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_T0IyDcGXxS5Fr0";
      const orderId = intent.razorpayOrderId;

      // Handle mock checkout automatically
      if (orderId.startsWith("order_mock_") || keyId.startsWith("rzp_test_mock")) {
        const verifyRes = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId: orderId,
            razorpayPaymentId: "pay_mock_" + Math.random().toString(36).substring(2, 10),
            razorpaySignature: "mock_signature_bypass",
          }),
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.message || "Mock payment verification failed");
        }

        setPaymentSuccess(true);
        setPaying(false);
        return;
      }

      // Production Checkout Options
      const options = {
        key: keyId,
        amount: Math.round(intent.price * 100),
        currency: "INR",
        name: "Akshar Game Zone",
        description: `Voice/WA Booking: ${intent.gameName}`,
        order_id: orderId,
        prefill: {
          contact: intent.phone,
          name: intent.customerName || "Valued Customer",
        },
        handler: async function (response: any) {
          try {
            setPaying(true);
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
              throw new Error(verifyData.message || "Verification failed");
            }

            setPaymentSuccess(true);
          } catch (err: any) {
            setError(err.message || "Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
        theme: {
          color: "#D7E528",
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Payment trigger failed");
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-10 w-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-bold text-gray-500">Loading booking summary...</p>
      </main>
    );
  }

  if (error && !intent) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-full mb-4 ring-1 ring-red-100">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-black text-[var(--primary)]">Error</h1>
        <p className="mt-2 text-sm font-bold text-gray-500">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] py-10 px-4 flex justify-center items-center">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] p-6 shadow-xl ring-1 ring-black/5 text-center space-y-6">
        <h1 className="text-3xl font-black text-[var(--primary)]">Booking Checkout</h1>
        <p className="text-xs font-bold text-[var(--text-muted)]">Akshar Game Zone Ads & Voice Booking Channel</p>

        {paymentSuccess ? (
          <div className="py-6 space-y-4 animate-fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <CheckCircle size={36} />
            </div>
            <h2 className="text-2xl font-black text-emerald-600">
              {selectedPaymentMethod === "PAY_AT_COUNTER" ? "Slot Reserved!" : "Payment Successful!"}
            </h2>
            <p className="text-sm font-bold text-gray-500 px-4">
              {selectedPaymentMethod === "PAY_AT_COUNTER"
                ? "Your slot has been reserved. Please pay at the counter before your session starts. Your session will start only after payment is confirmed by staff."
                : `Your booking is processed and slot is confirmed. A WhatsApp ticket has been dispatched to *${intent?.phone}*.`}
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 h-12 w-full rounded-full bg-[var(--primary)] text-xs font-black text-white hover:opacity-95 transition"
            >
              Go to Home Page
            </button>
          </div>
        ) : isExpired ? (
          <div className="py-6 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-red-100">
              <AlertTriangle size={36} />
            </div>
            <h2 className="text-2xl font-black text-red-500">Slot Expired</h2>
            <p className="text-sm font-bold text-gray-500 px-4">
              This booking session has expired. Please create a new booking.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 h-12 w-full rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-black text-gray-700 transition"
            >
              Create New Booking
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Booking Details Card */}
            <div className="bg-gray-50 rounded-[2rem] p-5 border border-gray-100 text-left space-y-4">
              <div className="border-b pb-3 border-gray-200">
                <span className="text-[10px] font-black uppercase text-[var(--primary)] tracking-widest bg-[var(--primary)]/10 px-2.5 py-0.5 rounded-full inline-block">
                  {intent.gameName}
                </span>
                <h3 className="text-lg font-black text-[var(--primary)] mt-1.5">{intent.customerName || "Sport Booking"}</h3>
                <p className="text-xs font-bold text-gray-400">Phone: {intent.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[var(--primary)]" />
                  <div>
                    <span className="block text-[10px] uppercase text-gray-400 font-black">Date</span>
                    <span>{intent.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[var(--primary)]" />
                  <div>
                    <span className="block text-[10px] uppercase text-gray-400 font-black">Time Slot</span>
                    <span>{intent.startTime} - {intent.endTime}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[var(--primary)]" />
                  <div>
                    <span className="block text-[10px] uppercase text-gray-400 font-black">Players</span>
                    <span>{intent.playersCount} Players</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-[var(--primary)]" />
                  <div>
                    <span className="block text-[10px] uppercase text-gray-400 font-black">Source Channel</span>
                    <span className="uppercase">{intent.source} Flow</span>
                  </div>
                </div>
              </div>

              {/* Coupon Application Box */}
              <div className="border-t pt-4 border-gray-200 space-y-2 text-left">
                <span className="text-[10px] font-black uppercase text-gray-400">Apply Discount Coupon</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ENTER COUPON CODE"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={couponLoading || !!appliedCoupon}
                    className="h-10 flex-1 border border-black/5 bg-white rounded-xl px-3 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-60 text-[var(--primary)]"
                  />
                  {appliedCoupon ? (
                    <button
                      onClick={handleRemoveCoupon}
                      disabled={couponLoading}
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

              {/* Price Details */}
              <div className="border-t pt-3 border-gray-200 space-y-1.5">
                {appliedCoupon && (
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                    <span>Original Price</span>
                    <span className="line-through">₹{intent.price + discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-gray-400 uppercase">
                    {appliedCoupon ? "Adjusted Total" : "Total Amount"}
                  </span>
                  <span className="text-2xl font-black text-[var(--primary)]">₹{intent.price}</span>
                </div>
              </div>
            </div>

            {/* Countdown Badge */}
            {timeLeft && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex flex-col gap-2 text-xs font-bold text-amber-800 text-left">
                <span className="font-semibold text-center">Complete your payment within 10 minutes to confirm your booking.</span>
                <div className="flex justify-between items-center mt-1">
                  <span>Reservation holds for:</span>
                  <span className="bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-mono font-black">{timeLeft}</span>
                </div>
              </div>
            )}

            {error && <p className="text-xs font-black text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handlePayment("RAZORPAY")}
                disabled={paying}
                className="h-16 w-full rounded-full bg-[var(--primary)] hover:opacity-95 active:scale-95 text-base font-black text-white transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck size={20} />
                <span>{paying && selectedPaymentMethod === "RAZORPAY" ? "Processing..." : `Pay Online (₹${intent.price})`}</span>
              </button>

              {isPayAtCounterAllowed && (
                <button
                  onClick={() => handlePayment("PAY_AT_COUNTER")}
                  disabled={paying}
                  className="h-16 w-full rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-base font-black text-white transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Clock size={20} />
                  <span>{paying && selectedPaymentMethod === "PAY_AT_COUNTER" ? "Reserving..." : "Pay at Counter"}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Payments secured and processed via Razorpay gateway.</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
