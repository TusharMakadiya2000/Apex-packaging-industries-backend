// src/routes/userRoutes.ts
import express from "express";
import User from "../models/User";
import { authenticateToken } from "../middleware/authMiddleware";
import Invoice from "../models/Invoice";
import mongoose from "mongoose";
import {
    deductInvoiceStock,
    reconcileInvoiceStock,
    reverseInvoiceStock,
} from "../services/inventoryService";

const router = express.Router();

router.post("/add", async (req, res) => {
    try {
        const {
            id,
            customerId,
            customerName,
            mobileNumber,
            gstIn,
            invoiceDate,
            address,
            // invoiceType,
            orgId,
            services,
            createdBy,
            updatedBy,
        } = req.body;

        if (id) {
            // Fetch the pre-update state first, so we can diff old vs new
            // line-item quantities for stock reconciliation.
            const existingInvoice = await Invoice.findById(id);

            if (!existingInvoice) {
                return res.status(404).json({ error: "Invoice not found" });
            }

            // Update existing invoice
            const updatedInvoice = await Invoice.findByIdAndUpdate(
                id,
                {
                    customerId,
                    customerName,
                    mobileNumber,
                    gstIn,
                    invoiceDate,
                    address,
                    // invoiceType,
                    services,
                    updatedBy,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!updatedInvoice) {
                return res.status(404).json({ error: "Invoice not found" });
            }

            try {
                await reconcileInvoiceStock(
                    existingInvoice.services,
                    updatedInvoice.services,
                    updatedInvoice._id,
                    updatedInvoice.orgId,
                    updatedBy
                );
            } catch (stockErr) {
                console.error(
                    "Error reconciling stock on invoice update:",
                    stockErr
                );
                // Invoice update itself already succeeded; surface the
                // stock issue but don't roll back the invoice save.
            }

            return res.status(200).json(updatedInvoice);
        } else {
            // Add new invoice
            const invoices = await Invoice.find({ orgId: orgId });

            const maxInvoiceID = invoices.reduce((max, invoice) => {
                return invoice.invoiceID > max ? invoice.invoiceID : max;
            }, 0);

            const newInvoiceData = req.body;

            const newInvoice = new Invoice({
                invoiceID: maxInvoiceID + 1, // Generate a new invoice ID
                customerId: newInvoiceData.customerId || undefined,
                customerName: newInvoiceData.customerName || "",
                mobileNumber: newInvoiceData.mobileNumber || "",
                gstIn: newInvoiceData.gstIn || "",
                invoiceDate: newInvoiceData.invoiceDate || null,
                address: newInvoiceData.address || {},
                // invoiceType: newInvoiceData.invoiceType || "",
                orgId: newInvoiceData.orgId,
                services: newInvoiceData.services || [],
                createdBy: newInvoiceData.createdBy,
                updatedBy: newInvoiceData.updatedBy,
            });

            await newInvoice.save();

            try {
                await deductInvoiceStock(
                    newInvoice.services,
                    newInvoice._id,
                    newInvoice.orgId,
                    newInvoice.createdBy
                );
            } catch (stockErr) {
                console.error(
                    "Error deducting stock on invoice create:",
                    stockErr
                );
                // Invoice itself already saved; surface the stock issue
                // but don't roll back the invoice save.
            }

            return res.status(201).json(newInvoice);
        }
    } catch (error) {
        console.error("Error in add/update invoice:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/", authenticateToken, async (req, res) => {
    try {
        const userEmail = (req as any).user.email;
        const user = await User.findOne({ email: userEmail });
        const { sort, sortDirection, searchText, recordPerPage, page, orgId } =
            req.body;
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

        if (searchText) {
            match = {
                ...match,
                $or: [
                    {
                        customerName: {
                            $regex: searchText,
                            $options: "i",
                        },
                    },
                    {
                        mobileNumber: {
                            $regex: searchText,
                            $options: "i",
                        },
                    },
                ],
            };
        }

        const sortField = sort || "createdAt";
        const sortOrder = sortDirection || -1;

        const items = await Invoice.aggregate([
            {
                $match: match,
            },
            {
                $sort: { [sortField]: sortOrder },
            },
            {
                $skip: (page - 1) * recordPerPage,
            },

            {
                $limit: recordPerPage,
            },
        ]);

        const count = await Invoice.aggregate([
            {
                $match: match,
            },
        ]);

        return res.status(200).json({
            items,
            count: count.length,
        });
    } catch (error) {
        console.error("Error getting invoices:", error);
        res.status(500).send(error);
    }
});

router.post("/getInvoice/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const invoice = await Invoice.findById(id);

        if (!invoice) {
            return res.status(404).send({ message: "Invoice not found" });
        }

        res.status(200).json(invoice);
    } catch (error) {
        console.error("Error fetching invoice by ID:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

router.post("/get-count", authenticateToken, async (req, res) => {
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
        const count = await Invoice.countDocuments(match);

        res.status(200).json(count);
    } catch (error) {
        console.error("Error getting invoices:", error);
        res.status(500).send(error);
    }
});

router.put("/deleteinvoice/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const existingInvoice = await Invoice.findById(id);

        if (!existingInvoice) {
            return res.status(404).send({ error: "Invoice not found" });
        }

        if (existingInvoice.status === "delete") {
            // Already deleted - stock was already reversed, don't do it twice
            return res.status(200).send(existingInvoice);
        }

        const invoice = await Invoice.findByIdAndUpdate(
            id,
            { status: "delete" },
            { new: true }
        );

        if (!invoice) {
            return res.status(404).send({ error: "Invoice not found" });
        }

        try {
            const actingUserEmail = (req as any).user?.email;
            const actingUser = actingUserEmail
                ? await User.findOne({ email: actingUserEmail })
                : null;

            await reverseInvoiceStock(
                existingInvoice.services,
                existingInvoice._id,
                existingInvoice.orgId,
                actingUser?._id
            );
        } catch (stockErr) {
            console.error(
                "Error reversing stock on invoice delete:",
                stockErr
            );
        }

        res.status(200).send(invoice);
    } catch (error) {
        console.error("Error in deleting user:", error);
        res.status(400).send(error);
    }
});

export default router;
