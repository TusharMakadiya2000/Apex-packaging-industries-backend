import express from "express";
import User from "../models/User";
import SupplierOrder from "../models/SupplierOrder";
import mongoose from "mongoose";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Add / Update Supplier Order
|--------------------------------------------------------------------------
*/
router.post("/add", authenticateToken, async (req, res) => {
    try {
        const {
            id,
            supplierId,
            supplierName,
            gstIn,
            orderDate,
            items,
            paymentAmount,
            paymentStatus,
            orgId,
            createdBy,
            updatedBy,
        } = req.body;

        if (id) {
            const updatedOrder = await SupplierOrder.findByIdAndUpdate(
                id,
                {
                    supplierId,
                    supplierName,
                    gstIn,
                    orderDate,
                    items,
                    paymentAmount,
                    paymentStatus,
                    updatedBy,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!updatedOrder) {
                return res.status(404).json({ error: "Order not found" });
            }

            return res.status(200).json(updatedOrder);
        }

        // Add new order
        const orders = await SupplierOrder.find({ orgId });

        const maxOrderID = orders.reduce((max, order) => {
            return order.orderID > max ? order.orderID : max;
        }, 0);

        const newOrder = new SupplierOrder({
            orderID: maxOrderID + 1,
            supplierId: supplierId || undefined,
            supplierName: supplierName || "",
            gstIn: gstIn || "",
            orderDate: orderDate || null,
            items: items || [],
            paymentAmount: paymentAmount || 0,
            paymentStatus: paymentStatus || "pending",
            orgId,
            createdBy,
            updatedBy,
        });

        await newOrder.save();

        return res.status(201).json(newOrder);
    } catch (error) {
        console.error("Error in add/update supplier order:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/*
|--------------------------------------------------------------------------
| Supplier Order List (Management page - paginated)
|--------------------------------------------------------------------------
*/
router.post("/", authenticateToken, async (req, res) => {
    try {
        const userEmail = (req as any).user.email;
        const user = await User.findOne({ email: userEmail });
        const {
            sort,
            sortDirection,
            searchText,
            recordPerPage,
            page,
            orgId,
            paymentStatus,
        } = req.body;

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let match: any = { $and: [{ status: { $ne: "delete" } }] };

        if (orgId) {
            match["$and"].push({ orgId: new mongoose.Types.ObjectId(orgId) });
        }

        if (user.role === "org") {
            match["$and"].push({ orgId: user.orgId });
        }

        if (user.role !== "SA") {
            match["$and"].push({ createdBy: user._id });
        }

        if (paymentStatus) {
            match["$and"].push({ paymentStatus });
        }

        if (searchText) {
            match = {
                ...match,
                $or: [
                    {
                        supplierName: {
                            $regex: searchText,
                            $options: "i",
                        },
                    },
                    {
                        gstIn: {
                            $regex: searchText,
                            $options: "i",
                        },
                    },
                ],
            };
        }

        const sortField = sort || "createdAt";
        const sortOrder = sortDirection || -1;

        const items = await SupplierOrder.aggregate([
            { $match: match },
            { $sort: { [sortField]: sortOrder } },
            { $skip: (page - 1) * recordPerPage },
            { $limit: recordPerPage },
        ]);

        const count = await SupplierOrder.aggregate([{ $match: match }]);

        return res.status(200).json({
            items,
            count: count.length,
        });
    } catch (error) {
        console.error("Error getting supplier orders:", error);
        res.status(500).send(error);
    }
});

/*
|--------------------------------------------------------------------------
| Get Supplier Order
|--------------------------------------------------------------------------
*/
router.post("/getOrder/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const order = await SupplierOrder.findById(id);

        if (!order) {
            return res.status(404).send({ message: "Order not found" });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error("Error fetching supplier order by ID:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

/*
|--------------------------------------------------------------------------
| Payment Summary (Dashboard) - total pending vs paid across all orders
|--------------------------------------------------------------------------
*/
router.post("/payment-summary", authenticateToken, async (req, res) => {
    try {
        const userEmail = (req as any).user.email;
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let match: any = { $and: [{ status: { $ne: "delete" } }] };

        if (user.role === "org") {
            match["$and"].push({ orgId: user.orgId });
        } else if (user.role !== "SA") {
            match["$and"].push({ createdBy: user._id });
        }

        const results = await SupplierOrder.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { $ifNull: ["$paymentStatus", "pending"] },
                    totalAmount: { $sum: "$paymentAmount" },
                    count: { $sum: 1 },
                },
            },
        ]);

        const summary: any = {
            pending: { totalAmount: 0, count: 0 },
            partial: { totalAmount: 0, count: 0 },
            paid: { totalAmount: 0, count: 0 },
        };

        for (const row of results) {
            if (row._id === "paid" || row._id === "partial") {
                summary[row._id] = {
                    totalAmount: row.totalAmount,
                    count: row.count,
                };
            } else {
                summary.pending = {
                    totalAmount: row.totalAmount,
                    count: row.count,
                };
            }
        }

        res.status(200).json(summary);
    } catch (error) {
        console.error("Error getting supplier payment summary:", error);
        res.status(500).send(error);
    }
});

/*
|--------------------------------------------------------------------------
| Delete Supplier Order
|--------------------------------------------------------------------------
*/
router.put("/deleteorder/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const order = await SupplierOrder.findByIdAndUpdate(
            id,
            { status: "delete" },
            { new: true }
        );

        if (!order) {
            return res.status(404).send({ error: "Order not found" });
        }

        res.status(200).send(order);
    } catch (error) {
        console.error("Error in deleting supplier order:", error);
        res.status(400).send(error);
    }
});

export default router;
