// Builds the standard UPI "intent" URI that any UPI app (GPay, PhonePe,
// Paytm, BHIM...) recognises when scanned from a QR code. This is the same
// string format banks/UPI apps use themselves — no payment gateway or
// external API involved, so it works with just a VPA (UPI ID), no merchant
// account setup.
export function buildUpiUri(params: {
  vpa: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const q = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    am: params.amount.toFixed(2),
    cu: "INR",
    tn: params.note,
  });
  return `upi://pay?${q.toString()}`;
}
