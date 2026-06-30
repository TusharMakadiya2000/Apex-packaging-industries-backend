// src/routes/bankDetailRoutes.ts
import express from "express";
import BankDetails from "../models/BankDetails";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    console.log('userId', userId)
    try {
        const bankDetails = await BankDetails.find({status:"active", userId: userId});
        res.status(200).send(bankDetails);
    } catch (error) {
        console.error("Error saving Bank Details:", error);
        res.status(500).send(error);
    }
});

export default router;
