export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type ServiceLike = { amount: number; quantity: number; gst: number };
type PaymentLike = { amount: number };

// Same formula as your dashboard: amount * qty + GST
export const calcInvoiceTotal = (services: ServiceLike[] = []) =>
    round2(
        services.reduce((sum, s) => {
            const base = s.amount * s.quantity;
            return sum + base + base * (s.gst / 100);
        }, 0)
    );

export const calcPaidAmount = (payments: PaymentLike[] = []) =>
    round2(payments.reduce((sum, p) => sum + p.amount, 0));

export const derivePaymentStatus = (
    total: number,
    paid: number
): "pending" | "partial" | "paid" => {
    if (paid <= 0) return "pending";
    if (paid >= total - 0.005) return "paid";
    return "partial";
};