const labels: Record<string, string> = { awaiting_payment: "Payment under review", awaiting_delivery: "Choose delivery timing", queued: "Waiting to start", processing: "In progress", completed: "Completed", payment_rejected: "Payment rejected", pending: "Under review", approved: "Approved", rejected: "Rejected" };
export default function StatusBadge({ status }: { status: string }) {
  const color = ["approved", "completed"].includes(status) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ["rejected", "payment_rejected"].includes(status) ? "border-red-200 bg-red-50 text-red-700" : ["queued", "processing"].includes(status) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={"inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold " + color}>{labels[status] || status}</span>;
}
