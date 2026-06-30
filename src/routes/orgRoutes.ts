// src/routes/bankDetailRoutes.ts
import express from "express";
import orgDetails from "../models/Org";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    const userId = (req as any).user.userId;
    try {
        const orgs = await orgDetails.find({status:"active"});
        res.status(200).send(orgs);
    } catch (error) {
        console.error("Error geting org Details:", error);
        res.status(500).send(error);
    }
});

export default router;
