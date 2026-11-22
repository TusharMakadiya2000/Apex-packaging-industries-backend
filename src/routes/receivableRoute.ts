import express from "express";
import User from "../models/User";
import Invoice from "../models/Invoice";
import Payment from "../models/Payment";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Customers linked to a saved customer use their id; others use name|mobile
const makePartyKey = (customerId?: any, name = "", mobile = "") =>
    customerId
        ? String(customerId)
        : `${String(name).trim().toLowerCase()}|${String(mobile).trim()}`;

const getUser = (req: any) => User.findOne({ email: req.user.email });

// Same visibility rules as your invoices
const getScope = (user: any): any => {
    if (user.role === "org") return { orgId: user.orgId };
    if (user.role !== "SA") return { createdBy: user._id };
    return {};
};

/* ---------------- List: every customer with total / received / pending ---------------- */
router.post("/", authenticateToken, async (req, res) => {
    try {
        const user: any = await getUser(req);
        if (!user) return res.status(404).json({ error: "User not found" });

        const scope = getScope(user);
        const { searchText } = req.body;

        const billed = await Invoice.aggregate([
            { $match: { status: { $ne: "delete" }, ...scope } },
            {
                $addFields: {
                    invoiceTotal: {
                        $sum: {
                            $map: {
                                input: "$services",
                                as: "s",
                                in: {
                                    $multiply: [
                                        { $multiply: ["$$s.amount", "$$s.quantity"] },
                                        { $add: [1, { $divide: ["$$s.gst", 100] }] },
                                    ],
                                },
                            },
                        },
                    },
                    partyKey: {
                        $cond: [
                            { $eq: [{ $type: "$customerId" }, "objectId"] },
                            { $toString: "$customerId" },
                            {
                                $concat: [
                                    {
                                        $toLower: {
                                            $trim: { input: { $ifNull: ["$customerName", ""] } },
                                        },
                                    },
                                    "|",
                                    { $trim: { input: { $ifNull: ["$mobileNumber", ""] } } },
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: "$partyKey",
                    customerId: { $first: "$customerId" },
                    customerName: { $first: "$customerName" },
                    mobileNumber: { $first: "$mobileNumber" },
                    totalAmount: { $sum: "$invoiceTotal" },
                    invoiceCount: { $sum: 1 },
                },
            },
        ]);

        const received = await Payment.aggregate([
            { $match: { status: { $ne: "delete" }, ...scope } },
            {
                $group: {
                    _id: "$partyKey",
                    customerId: { $first: "$customerId" },
                    customerName: { $first: "$customerName" },
                    mobileNumber: { $first: "$mobileNumber" },
                    receivedAmount: { $sum: "$amount" },
                    paymentCount: { $sum: 1 },
                    lastPaymentOn: { $max: "$paidOn" },
                },
            },
        ]);

        const map = new Map<string, any>();

        for (const b of billed) {
            map.set(b._id, {
                partyKey: b._id,
                customerId: b.customerId || null,
                customerName: b.customerName,
                mobileNumber: b.mobileNumber || "",
                totalAmount: round2(b.totalAmount),
                invoiceCount: b.invoiceCount,
                receivedAmount: 0,
                paymentCount: 0,
                lastPaymentOn: null,
            });
        }

        for (const r of received) {
            const row = map.get(r._id) || {
                partyKey: r._id,
                customerId: r.customerId || null,
                customerName: r.customerName,
                mobileNumber: r.mobileNumber || "",
                totalAmount: 0,
                invoiceCount: 0,
            };
            row.receivedAmount = round2(r.receivedAmount);
            row.paymentCount = r.paymentCount;
            row.lastPaymentOn = r.lastPaymentOn;
            map.set(r._id, row);
        }

        let items = Array.from(map.values()).map((i) => ({
            ...i,
            pendingAmount: round2(i.totalAmount - i.receivedAmount),
        }));

        if (searchText) {
            const q = String(searchText).toLowerCase();
            items = items.filter(
                (i) =>
                    String(i.customerName || "").toLowerCase().includes(q) ||
                    String(i.mobileNumber || "").includes(q)
            );
        }

        items.sort((a, b) => b.pendingAmount - a.pendingAmount);

        const totals = {
            billed: round2(items.reduce((s, i) => s + i.totalAmount, 0)),
            received: round2(items.reduce((s, i) => s + i.receivedAmount, 0)),
            pending: round2(items.reduce((s, i) => s + i.pendingAmount, 0)),
        };

        res.status(200).json({ items, totals });
    } catch (error) {
        console.error("Error getting receivables:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ---------------- Payment history of one customer ---------------- */
router.post("/party-payments", authenticateToken, async (req, res) => {
    try {
        const user: any = await getUser(req);
        if (!user) return res.status(404).json({ error: "User not found" });

        const { partyKey } = req.body;
        const payments = await Payment.find({
            partyKey,
            status: { $ne: "delete" },
            ...getScope(user),
        }).sort({ paidOn: -1, createdAt: -1 });

        res.status(200).json(payments);
    } catch (error) {
        console.error("Error getting payments:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ---------------- Add payment ---------------- */
router.post("/payment/add", authenticateToken, async (req, res) => {
    try {
        const user: any = await getUser(req);
        if (!user) return res.status(404).json({ error: "User not found" });

        const { customerId, customerName, mobileNumber, amount, paidOn, method, reference, note } =
            req.body;

        const amt = round2(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ error: "Enter a valid amount" });
        }
        if (!customerName) {
            return res.status(400).json({ error: "Customer is required" });
        }

        const payment = await Payment.create({
            orgId: user.orgId,
            partyKey: makePartyKey(customerId, customerName, mobileNumber),
            customerId: customerId || undefined,
            customerName,
            mobileNumber: mobileNumber || "",
            amount: amt,
            paidOn: paidOn ? new Date(paidOn) : new Date(),
            method: method || "cash",
            reference: reference || "",
            note: note || "",
            createdBy: user._id,
            updatedBy: user._id,
        });

        res.status(201).json(payment);
    } catch (error) {
        console.error("Error adding payment:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ---------------- Edit payment ---------------- */
router.put("/payment/:id", authenticateToken, async (req, res) => {
    try {
        const user: any = await getUser(req);
        if (!user) return res.status(404).json({ error: "User not found" });

        const { amount, paidOn, method, reference, note } = req.body;

        const amt = round2(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ error: "Enter a valid amount" });
        }

        const payment = await Payment.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: "delete" }, ...getScope(user) },
            {
                amount: amt,
                paidOn: paidOn ? new Date(paidOn) : new Date(),
                method: method || "cash",
                reference: reference || "",
                note: note || "",
                updatedBy: user._id,
            },
            { new: true }
        );

        if (!payment) return res.status(404).json({ error: "Payment not found" });
        res.status(200).json(payment);
    } catch (error) {
        console.error("Error updating payment:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ---------------- Delete payment (soft delete) ---------------- */
router.put("/payment/delete/:id", authenticateToken, async (req, res) => {
    try {
        const user: any = await getUser(req);
        if (!user) return res.status(404).json({ error: "User not found" });

        const payment = await Payment.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: "delete" }, ...getScope(user) },
            { status: "delete", updatedBy: user._id },
            { new: true }
        );

        if (!payment) return res.status(404).json({ error: "Payment not found" });
        res.status(200).json(payment);
    } catch (error) {
        console.error("Error deleting payment:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/* ---------------- Dashboard summary: pending vs received ---------------- */
router.post("/summary", authenticateToken, async (req, res) => {
    try {
        const user: any = await getUser(req);
        if (!user) return res.status(404).json({ error: "User not found" });

        const scope = getScope(user);

        // Total billed per customer
        const billed = await Invoice.aggregate([
            { $match: { status: { $ne: "delete" }, ...scope } },
            {
                $addFields: {
                    invoiceTotal: {
                        $sum: {
                            $map: {
                                input: "$services",
                                as: "s",
                                in: {
                                    $multiply: [
                                        { $multiply: ["$$s.amount", "$$s.quantity"] },
                                        { $add: [1, { $divide: ["$$s.gst", 100] }] },
                                    ],
                                },
                            },
                        },
                    },
                    partyKey: {
                        $cond: [
                            { $eq: [{ $type: "$customerId" }, "objectId"] },
                            { $toString: "$customerId" },
                            {
                                $concat: [
                                    {
                                        $toLower: {
                                            $trim: { input: { $ifNull: ["$customerName", ""] } },
                                        },
                                    },
                                    "|",
                                    { $trim: { input: { $ifNull: ["$mobileNumber", ""] } } },
                                ],
                            },
                        ],
                    },
                },
            },
            { $group: { _id: "$partyKey", totalAmount: { $sum: "$invoiceTotal" } } },
        ]);

        // Total received per customer
        const received = await Payment.aggregate([
            { $match: { status: { $ne: "delete" }, ...scope } },
            {
                $group: {
                    _id: "$partyKey",
                    receivedAmount: { $sum: "$amount" },
                    paymentCount: { $sum: 1 },
                },
            },
        ]);

        const map = new Map<string, { billed: number; received: number }>();
        for (const b of billed) {
            map.set(b._id, { billed: b.totalAmount, received: 0 });
        }

        let paymentEntries = 0;
        for (const r of received) {
            const row = map.get(r._id) || { billed: 0, received: 0 };
            row.received = r.receivedAmount;
            map.set(r._id, row);
            paymentEntries += r.paymentCount;
        }

        let totalBilled = 0;
        let totalReceived = 0;
        let pendingCustomers = 0;

        for (const row of map.values()) {
            totalBilled += row.billed;
            totalReceived += row.received;
            if (round2(row.billed - row.received) > 0.005) pendingCustomers++;
        }

        // Same totals as the Receivable page
        res.status(200).json({
            pending: {
                totalAmount: round2(totalBilled - totalReceived),
                count: pendingCustomers, // customers who still owe money
            },
            paid: {
                totalAmount: round2(totalReceived),
                count: paymentEntries, // number of payment entries received
            },
            billed: { totalAmount: round2(totalBilled) },
        });
    } catch (error) {
        console.error("Error getting receivable summary:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;