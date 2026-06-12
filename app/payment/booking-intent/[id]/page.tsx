"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Calendar, Clock, Users, CreditCard, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";

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
  const handlePayment = async () => {
    if (!intent) return;
    setPaying(true);
    setError("");

    try {
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
            <h2 className="text-2xl font-black text-emerald-600">Payment Successful!</h2>
            <p className="text-sm font-bold text-gray-500 px-4">
              Your booking is processed and slot is confirmed. A WhatsApp ticket has been dispatched to *{intent?.phone}*.
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
              This booking request has expired because payment was not completed within the 15-minute reservation window. Please request a new slot.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 h-12 w-full rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-black text-gray-700 transition"
            >
              Back to Home
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

              {/* Price Details */}
              <div className="border-t pt-3 border-gray-200 flex justify-between items-center">
                <span className="text-sm font-black text-gray-400 uppercase">Total Amount</span>
                <span className="text-2xl font-black text-[var(--primary)]">₹{intent.price}</span>
              </div>
            </div>

            {/* Countdown Badge */}
            {timeLeft && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex justify-between items-center text-xs font-bold text-amber-800">
                <span>Reservation holds for:</span>
                <span className="bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-mono font-black">{timeLeft}</span>
              </div>
            )}

            {error && <p className="text-xs font-black text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}

            <button
              onClick={handlePayment}
              disabled={paying}
              className="h-16 w-full rounded-full bg-[var(--primary)] hover:opacity-95 active:scale-95 text-base font-black text-white transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{paying ? "Processing Order..." : `Pay ₹${intent.price}`}</span>
            </button>

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
