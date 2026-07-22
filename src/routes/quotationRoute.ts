// src/routes/userRoutes.ts
import express from "express";
import User from "../models/User";
import { authenticateToken } from "../middleware/authMiddleware";
import Quotation from "../models/Quotation";
import mongoose from "mongoose";

const router = express.Router();

router.post("/add", authenticateToken, async (req, res) => {
    try {
        const {
            id,
            customerName,
            mobileNumber,
            quotationDate,
            address,
            // invoiceType,
            orgId,
            services,
            createdBy,
            updatedBy,
        } = req.body;

        if (id) {
            // Update existing Quotation
            const updatedQuotation = await Quotation.findByIdAndUpdate(
                id,
                {
                    customerName,
                    mobileNumber,
                    quotationDate,
                    address,
                    // invoiceType,
                    services,
                    updatedBy,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!updatedQuotation) {
                return res.status(404).json({ error: "Quotation not found" });
            }
            return res.status(200).json(updatedQuotation);
        } else {
            // Add new Quotation
            const quotations = await Quotation.find({ orgId: orgId });

            const maxQuotationID = quotations.reduce((max, quotation) => {
                return quotation.quotationID > max
                    ? quotation.quotationID
                    : max;
            }, 0);

            const newQuotationData = req.body;

            const newQuotation = new Quotation({
                quotationID: maxQuotationID + 1, // Generate a new Quotation ID
                customerName: newQuotationData.customerName || "",
                mobileNumber: newQuotationData.mobileNumber || "",
                quotationDate: newQuotationData.quotationDate || null,
                address: newQuotationData.address || {},
                // invoiceType: newInvoiceData.invoiceType || "",
                orgId: newQuotationData.orgId,
                services: newQuotationData.services || [],
                createdBy: newQuotationData.createdBy,
                updatedBy: newQuotationData.updatedBy,
            });

            await newQuotation.save();
            return res.status(201).json(newQuotation);
        }
    } catch (error) {
        console.error("Error in add/update Quotation:", error);
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

        const items = await Quotation.aggregate([
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

        const count = await Quotation.aggregate([
            {
                $match: match,
            },
        ]);

        return res.status(200).json({
            items,
            count: count.length,
        });
    } catch (error) {
        console.error("Error getting Quotations:", error);
        res.status(500).send(error);
    }
});

router.post("/getQuotation/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const quotation = await Quotation.findById(id);

        if (!quotation) {
            return res.status(404).send({ message: "Quotation not found" });
        }

        res.status(200).json(quotation);
    } catch (error) {
        console.error("Error fetching quotation by ID:", error);
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
        const count = await Quotation.countDocuments(match);

        res.status(200).json(count);
    } catch (error) {
        console.error("Error getting quotations:", error);
        res.status(500).send(error);
    }
});

router.put("/deletequotation/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const quotation = await Quotation.findByIdAndUpdate(
            id,
            { status: "delete" },
            { new: true }
        );

        if (!quotation) {
            return res.status(404).send({ error: "User not found" });
        }

        res.status(200).send(quotation);
    } catch (error) {
        console.error("Error in deleting user:", error);
        res.status(400).send(error);
    }
});

export default router;
