"use client";

import { useState, useEffect, useRef } from "react";
import { QrCode, Upload, Trash2, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Image as ImageIcon } from "lucide-react";

export function OwnerQrManager({ initialUpiId, restaurantName }: { initialUpiId: string | null; restaurantName?: string }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hasCustomQr, setHasCustomQr] = useState(false);
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/owner/upload-qr", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setHasCustomQr(json.data.hasCustomQr);
        setActiveQrUrl(json.data.activeQrUrl ? `${json.data.activeQrUrl}?t=${Date.now()}` : null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", text: "Please select a valid image file (PNG, JPG, WEBP)." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", text: "File is too large. Maximum size is 5MB." });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFeedback(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setFeedback(null);

      const formData = new FormData();
      formData.append("qrFile", selectedFile);

      const res = await fetch("/api/owner/upload-qr", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to upload QR code.");
      }

      setFeedback({ type: "success", text: "Payment QR code uploaded and activated successfully!" });
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to upload QR code." });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCustom = async () => {
    if (!confirm("Are you sure you want to remove your custom QR code? Dynamic UPI QR will be used instead.")) return;

    try {
      setUploading(true);
      const res = await fetch("/api/owner/upload-qr", { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setFeedback({ type: "success", text: "Custom QR code removed. Auto-generating dynamic UPI QR now." });
        setHasCustomQr(false);
        setActiveQrUrl(null);
        setPreviewUrl(null);
        setSelectedFile(null);
        await fetchStatus();
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to remove custom QR code." });
    } finally {
      setUploading(false);
    }
  };

  const dynamicQrPreviewUrl = initialUpiId
    ? `/api/manager/qr?text=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(initialUpiId)}&pn=${encodeURIComponent(restaurantName || "Restaurant")}&cu=INR`)}`
    : null;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <QrCode size={18} />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Payment QR Code Setup</h2>
            <p className="text-xs text-slate-400">Upload your own restaurant QR code standee or auto-generate via UPI.</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
            hasCustomQr
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              : "bg-teal-500/15 text-teal-300 border-teal-500/30"
          }`}
        >
          {hasCustomQr ? "Custom Standee Active" : "Dynamic UPI QR Active"}
        </span>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 backdrop-blur-md animate-toast ${
            feedback.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* QR Code Preview & Details */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center gap-5">
        <div className="bg-white qr-box bg-white-solid p-3 rounded-xl border border-white/20 shadow-md shrink-0">
          <img
            src={previewUrl || activeQrUrl || dynamicQrPreviewUrl || "/api/manager/qr?text=upi://pay"}
            alt="Payment QR Code Preview"
            className="w-32 h-40 object-contain mx-auto"
          />
        </div>

        <div className="space-y-2 text-xs text-center sm:text-left flex-1 min-w-0">
          <p className="font-bold text-white flex items-center justify-center sm:justify-start gap-1.5 text-sm">
            <span>{previewUrl ? "Preview (Unsaved)" : hasCustomQr ? "Your Custom Restaurant Standee" : "Auto-Generated UPI Standee"}</span>
          </p>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {hasCustomQr
              ? "Your uploaded custom QR code is currently displayed on all diner checkouts, digital terminals, and customer bills."
              : "No custom QR code uploaded. The system auto-generates dynamic scan & pay QR codes using your restaurant's registered UPI ID."}
          </p>
          {initialUpiId && (
            <p className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded inline-block border border-emerald-500/20">
              UPI VPA: <strong>{initialUpiId}</strong>
            </p>
          )}

          {hasCustomQr && !previewUrl && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleDeleteCustom}
                disabled={uploading}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium inline-flex items-center gap-1 transition-colors"
              >
                <Trash2 size={13} />
                <span>Remove Custom QR &amp; Use Dynamic</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Input Area */}
      <div className="p-4 rounded-xl border-2 border-dashed border-white/20 hover:border-emerald-500/50 transition-colors text-center space-y-3 bg-black/20">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/jpg"
          onChange={handleFileChange}
          className="hidden"
          id="qrUploadInput"
        />

        <div className="flex flex-col items-center justify-center gap-1.5">
          <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400">
            <Upload size={18} />
          </div>
          <p className="text-xs font-semibold text-white">
            {selectedFile ? selectedFile.name : "Upload your restaurant's payment QR code"}
          </p>
          <p className="text-[11px] text-slate-400">
            Supports PhonePe, Google Pay, Paytm, BHIM, or bank standee image (PNG, JPG up to 5MB)
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <label
            htmlFor="qrUploadInput"
            className="btn-secondary !py-2 !px-3 text-xs cursor-pointer flex items-center gap-1.5"
          >
            <ImageIcon size={13} />
            <span>{selectedFile ? "Choose Different Image" : "Browse Image"}</span>
          </label>

          {selectedFile && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              {uploading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Save &amp; Activate QR</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
