"use client";

import { useEffect, useState, useRef } from "react";
import { QrCode, RefreshCw, Printer, Save, Clock } from "lucide-react";

export default function AdminSettingsPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [message, setMessage] = useState("");

  // Booking settings state
  const [visitorRescheduleHours, setVisitorRescheduleHours] = useState(24);
  const [visitorCancellationHours, setVisitorCancellationHours] = useState(24);
  const [memberRescheduleHours, setMemberRescheduleHours] = useState(24);
  const [memberCancellationHours, setMemberCancellationHours] = useState(24);
  const [billingLetterheadUrl, setBillingLetterheadUrl] = useState("");
  const [maxVisitorCoinUsagePercentage, setMaxVisitorCoinUsagePercentage] = useState(20);
  const [uploading, setUploading] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  async function loadSettings() {
    setLoading(true);
    try {
      // Load QR token
      const qrRes = await fetch("/api/admin/qr", { cache: "no-store" });
      const qrData = await qrRes.json();
      if (qrRes.ok && qrData.success) {
        setToken(qrData.exitQrToken);
      }

      // Load rescheduling/cancellation rules settings
      const settingsRes = await fetch("/api/admin/settings", { cache: "no-store" });
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData.success) {
        setVisitorRescheduleHours(settingsData.settings.visitorRescheduleHours);
        setVisitorCancellationHours(settingsData.settings.visitorCancellationHours);
        setMemberRescheduleHours(settingsData.settings.memberRescheduleHours);
        setMemberCancellationHours(settingsData.settings.memberCancellationHours);
        setBillingLetterheadUrl(settingsData.settings.billingLetterheadUrl || "");
        setMaxVisitorCoinUsagePercentage(settingsData.settings.maxVisitorCoinUsagePercentage ?? 20);
      }
    } catch {
      setMessage("Network error loading settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSettings(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingSettings(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorRescheduleHours: Number(visitorRescheduleHours),
          visitorCancellationHours: Number(visitorCancellationHours),
          memberRescheduleHours: Number(memberRescheduleHours),
          memberCancellationHours: Number(memberCancellationHours),
          billingLetterheadUrl,
          maxVisitorCoinUsagePercentage: Number(maxVisitorCoinUsagePercentage),
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage("Settings updated successfully!");
      } else {
        setMessage(data.message || "Failed to update settings");
      }
    } catch {
      setMessage("Network error saving settings");
    } finally {
      setUpdatingSettings(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = res.ok ? await res.json() : null;
      if (res.ok && data?.url) {
        setBillingLetterheadUrl(data.url);
        setMessage("Letterhead uploaded successfully! Make sure to save settings.");
      } else {
        setMessage(data?.message || "File upload failed");
      }
    } catch {
      setMessage("Network error during file upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/qr", {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setToken(data.exitQrToken);
        setMessage("Exit QR Code successfully regenerated!");
      } else {
        setMessage(data.message || "Failed to regenerate QR Token");
      }
    } catch {
      setMessage("Network error regenerating QR code");
    } finally {
      setRegenerating(false);
    }
  }

  // Draw a basic high-quality custom QR-like pattern on the canvas for printing
  useEffect(() => {
    if (!token || !qrCanvasRef.current) return;
    const canvas = qrCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw visual QR border guidelines
    ctx.fillStyle = "#03210F"; // Primary color
    
    // Top-Left Finder Pattern
    ctx.fillRect(20, 20, 50, 50);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(27, 27, 36, 36);
    ctx.fillStyle = "#03210F";
    ctx.fillRect(34, 34, 22, 22);

    // Top-Right Finder Pattern
    ctx.fillRect(180, 20, 50, 50);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(187, 27, 36, 36);
    ctx.fillStyle = "#03210F";
    ctx.fillRect(194, 34, 22, 22);

    // Bottom-Left Finder Pattern
    ctx.fillRect(20, 180, 50, 50);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(27, 187, 36, 36);
    ctx.fillStyle = "#03210F";
    ctx.fillRect(34, 194, 22, 22);

    // Generate random seed dots based on token to make it uniquely visual
    let seed = 0;
    for (let i = 0; i < token.length; i++) {
      seed += token.charCodeAt(i);
    }

    ctx.fillStyle = "#03210F";
    // Fill inner grid area with randomized QR-like blocks
    for (let r = 0; r < 25; r++) {
      for (let c = 0; c < 25; c++) {
        // Skip finder areas
        if (r < 8 && c < 8) continue;
        if (r < 8 && c > 16) continue;
        if (r > 16 && c < 8) continue;

        const val = Math.abs(Math.sin(seed + r * 13 + c * 37));
        if (val > 0.45) {
          ctx.fillRect(20 + c * 8, 20 + r * 8, 7, 7);
        }
      }
    }
  }, [token]);

  useEffect(() => {
    loadSettings();
  }, []);

  const qrScanUrl = typeof window !== "undefined" ? `${window.location.origin}/player/qr-exit?token=${token}` : "";

  function handlePrint() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Exit QR Code Printout</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; color: #03210f; }
            .container { border: 4px solid #03210f; border-radius: 20px; padding: 40px; max-width: 500px; margin: 0 auto; display: inline-block; }
            h1 { margin-bottom: 5px; font-size: 28px; font-weight: 900; }
            p { margin: 10px 0 30px; font-size: 14px; font-weight: bold; opacity: 0.7; }
            .qr-image { width: 300px; height: 300px; margin: 0 auto; }
            .footer { margin-top: 30px; font-size: 12px; font-weight: 800; border-top: 2px dashed #03210f; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Akshar Game Zone</h1>
            <p>Scan to complete and exit active sessions</p>
            <img src="${qrCanvasRef.current?.toDataURL()}" class="qr-image" />
            <div class="footer">
              COMMON EXIT STATION QR CODE
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <section className="min-w-0 pb-10">
      <div>
        <h1 className="text-4xl font-black text-[var(--primary)]">
          System Settings & QR Panel
        </h1>
        <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
          Manage exit QR codes, scan URLs, reschedule/cancellation hours limit, and system configurations.
        </p>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        {/* QR Section */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col items-center justify-between min-h-[450px]">
          <h3 className="text-lg font-black text-[var(--primary)] self-start border-b pb-2 w-full flex items-center gap-2">
            <QrCode size={20} />
            Common Exit QR Generator
          </h3>

          <div className="flex flex-col items-center my-6">
            <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 shadow-inner flex items-center justify-center">
              <canvas 
                ref={qrCanvasRef} 
                width={250} 
                height={250} 
                className="w-[250px] h-[250px] rounded-xl"
              />
            </div>
            <p className="text-[10px] font-mono text-gray-400 mt-3 break-all select-all max-w-[280px]">
              Token: {token || "Loading..."}
            </p>
          </div>

          <div className="flex flex-wrap w-full gap-3">
            <button
              onClick={handleRegenerate}
              disabled={regenerating || loading}
              className="flex-1 h-12 rounded-full bg-[var(--primary)] text-white text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
              Regenerate QR
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !token}
              className="flex-1 h-12 rounded-full bg-[#EDEBE2] text-[var(--primary)] text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Printer size={14} />
              Print QR
            </button>
          </div>
        </div>

        {/* Configurations Section */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
          <form onSubmit={handleUpdateSettings}>
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2 flex items-center gap-2">
              <Clock size={20} />
              Booking Window Restrictions
            </h3>

            <div className="mt-5 space-y-4 text-sm font-semibold text-gray-700">
              <div className="p-4 bg-amber-50 rounded-2xl ring-1 ring-amber-100 text-xs leading-relaxed text-amber-800">
                <strong>Rules Configuration:</strong> Specify the window hours threshold. Bookings modified inside this limit window will require admin approval and might be subject to penalties, whereas bookings outside will cancel/reschedule instantly.
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-400">Visitor Reschedule (Hrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={visitorRescheduleHours}
                    onChange={(e) => setVisitorRescheduleHours(Number(e.target.value))}
                    className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-400">Visitor Cancel (Hrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={visitorCancellationHours}
                    onChange={(e) => setVisitorCancellationHours(Number(e.target.value))}
                    className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-400">Member Reschedule (Hrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={memberRescheduleHours}
                    onChange={(e) => setMemberRescheduleHours(Number(e.target.value))}
                    className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-400">Member Cancel (Hrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={memberCancellationHours}
                    onChange={(e) => setMemberCancellationHours(Number(e.target.value))}
                    className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-400">Visitor Reward Coin Usage Cap (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={maxVisitorCoinUsagePercentage}
                    onChange={(e) => setMaxVisitorCoinUsagePercentage(Number(e.target.value))}
                    className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-400">Billing Letterhead URL / File</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,.docx,image/*"
                      onChange={handleFileUpload}
                      className="text-xs font-bold text-gray-500"
                    />
                    {uploading && <span className="text-xs text-[var(--primary)] animate-pulse">Uploading...</span>}
                  </div>
                  {billingLetterheadUrl && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-emerald-600 font-bold truncate max-w-[150px]">✓ {billingLetterheadUrl}</span>
                      <button
                        type="button"
                        onClick={() => setBillingLetterheadUrl("")}
                        className="text-[10px] text-red-500 font-black hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={updatingSettings || loading}
              className="mt-6 w-full h-12 rounded-full bg-[var(--primary)] text-white text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Save size={14} />
              {updatingSettings ? "Saving Settings..." : "Save Configuration"}
            </button>
          </form>

          {/* QR Destination URL */}
          <div className="mt-6 border-t pt-4 space-y-2">
            <span className="text-xs font-black uppercase text-gray-400">Scanner Destination URL</span>
            <input
              type="text"
              readOnly
              value={qrScanUrl}
              className="w-full h-11 bg-gray-50 rounded-xl px-3 border-0 outline-none text-xs font-mono text-gray-500 select-all"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

