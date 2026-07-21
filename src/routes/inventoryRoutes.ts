import express from "express";
import User from "../models/User";
import InventoryItem from "../models/InventoryItem";
import StockTransaction from "../models/StockTransaction";
import { authenticateToken } from "../middleware/authMiddleware";
import { applyStockChange } from "../services/inventoryService";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Add / Update Inventory Item
| NOTE: this only touches the item's static info. currentStock is never
| set here directly - use /stock-in or /stock-out for that.
|--------------------------------------------------------------------------
*/
router.post("/add", authenticateToken, async (req, res) => {
    try {
        const {
            id,
            type,
            name,
            gsm,
            paperType,
            size,
            rollWeight,
            hsnSac,
            unit,
            reorderLevel,
            costPrice,
            status,
            orgId,
            createdBy,
            updatedBy,
        } = req.body;

        // For raw materials the display name is always derived from
        // gsm/paperType/size - never trust a client-supplied name here,
        // so it can never drift out of sync with the actual spec.
        const resolvedName =
            type === "raw_material"
                ? `${gsm} GSM ${paperType} ${size}"`
                : name;

        const resolvedUnit = type === "raw_material" ? "roll" : unit || "pcs";

        const payload: any = {
            type,
            name: resolvedName,
            hsnSac,
            unit: resolvedUnit,
            reorderLevel,
            costPrice,
            status,
        };

        if (type === "raw_material") {
            payload.gsm = gsm;
            payload.paperType = paperType;
            payload.size = size;
            payload.rollWeight = rollWeight;
        }

        if (id) {
            const item = await InventoryItem.findByIdAndUpdate(
                id,
                {
                    ...payload,
                    updatedBy,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!item) {
                return res.status(404).json({
                    error: "Inventory item not found",
                });
            }

            return res.status(200).json(item);
        }

        const item = new InventoryItem({
            ...payload,
            orgId,
            createdBy,
            updatedBy,
            currentStock: 0,
        });

        await item.save();

        res.status(201).json(item);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Internal Server Error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| Inventory List (Management page - paginated)
|--------------------------------------------------------------------------
*/
router.post("/", authenticateToken, async (req, res) => {
    try {
        const userEmail = (req as any).user.email;

        const user = await User.findOne({
            email: userEmail,
        });

        if (!user) {
            return res.status(404).json({
                error: "User not found",
            });
        }

        const {
            searchText,
            type,
            page = 1,
            recordPerPage = 10,
            sort = "createdAt",
            sortDirection = -1,
        } = req.body;

        let match: any = {
            status: {
                $ne: "delete",
            },
        };

        if (user.role === "org") {
            match.orgId = user.orgId;
        }

        if (user.role !== "SA" && user.role !== "org") {
            match.createdBy = user._id;
        }

        if (type) {
            match.type = type;
        }

        if (searchText) {
            match.name = {
                $regex: searchText,
                $options: "i",
            };
        }

        const items = await InventoryItem.find(match)
            .sort({
                [sort]: sortDirection,
            })
            .skip((page - 1) * recordPerPage)
            .limit(recordPerPage);

        const count = await InventoryItem.countDocuments(match);

        res.status(200).json({
            items,
            count,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Get Inventory Item + recent ledger entries
|--------------------------------------------------------------------------
*/
router.post("/get/:id", authenticateToken, async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                error: "Inventory item not found",
            });
        }

        const transactions = await StockTransaction.find({
            itemId: item._id,
        })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({ item, transactions });
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Dropdown List (Invoice Page) - active items only
|--------------------------------------------------------------------------
*/
router.post("/list", authenticateToken, async (req, res) => {
    try {
        const userEmail = (req as any).user.email;

        const user = await User.findOne({
            email: userEmail,
        });

        let match: any = {
            status: "active",
        };

        if (user?.role === "org") {
            match.orgId = user.orgId;
        }

        const items = await InventoryItem.find(match)
            .select(
                "name type unit hsnSac currentStock gsm paperType size rollWeight"
            )
            .sort({ name: 1 });

        res.json(items);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Stock IN (purchase / production)
|--------------------------------------------------------------------------
*/
router.post("/stock-in", authenticateToken, async (req, res) => {
    try {
        const { itemId, quantity, weight, reason, notes, orgId, createdBy } =
            req.body;

        if (!itemId || !quantity) {
            return res.status(400).json({
                error: "itemId and quantity are required",
            });
        }

        const result = await applyStockChange({
            itemId,
            direction: "in",
            quantity: Number(quantity),
            reason: reason || "purchase",
            notes,
            orgId,
            createdBy,
        });

        if (!result) {
            return res.status(400).json({ error: "Invalid quantity" });
        }

        res.status(200).json(result.item);
    } catch (err: any) {
        console.log(err);
        res.status(500).json({
            error: err.message || "Internal Server Error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| Stock OUT (manual adjustment / wastage / correction)
|--------------------------------------------------------------------------
*/
router.post("/stock-out", authenticateToken, async (req, res) => {
    try {
        const { itemId, quantity, weight, reason, notes, orgId, createdBy } =
            req.body;

        if (!itemId || !quantity) {
            return res.status(400).json({
                error: "itemId and quantity are required",
            });
        }

        const result = await applyStockChange({
            itemId,
            direction: "out",
            quantity: Number(quantity),
            reason: reason || "adjustment",
            notes,
            orgId,
            createdBy,
        });

        if (!result) {
            return res.status(400).json({ error: "Invalid quantity" });
        }

        res.status(200).json(result.item);
    } catch (err: any) {
        console.log(err);
        res.status(500).json({
            error: err.message || "Internal Server Error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| Delete Inventory Item
|--------------------------------------------------------------------------
*/
router.put("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const item = await InventoryItem.findByIdAndUpdate(
            req.params.id,
            {
                status: "delete",
            },
            {
                new: true,
            }
        );

        if (!item) {
            return res.status(404).json({
                error: "Inventory item not found",
            });
        }

        res.json(item);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Inventory Summary (Dashboard) - per-record stock value + grand total,
| plus total weight of raw materials (already tracked in kg)
|--------------------------------------------------------------------------
*/
router.post("/summary", authenticateToken, async (req, res) => {
    try {
        const userEmail = (req as any).user.email;

        const user = await User.findOne({
            email: userEmail,
        });

        if (!user) {
            return res.status(404).json({
                error: "User not found",
            });
        }

        let match: any = {
            status: { $ne: "delete" },
        };

        if (user.role === "org") {
            match.orgId = user.orgId;
        }

        if (user.role !== "SA" && user.role !== "org") {
            match.createdBy = user._id;
        }

        const items = await InventoryItem.find(match).select(
            "name type unit currentStock rollWeight costPrice"
        );

        const records = items.map((item: any) => {
            // Raw materials: currentStock counts ROLLS, not weight. Actual
            // weight is always derived here (never stored), and value is
            // that derived weight x the per-kg purchase rate.
            const rollTotalWeight =
                item.type === "raw_material"
                    ? (item.currentStock || 0) * (item.rollWeight || 0)
                    : undefined;

            const total =
                item.type === "raw_material"
                    ? rollTotalWeight! * (item.costPrice || 0)
                    : (item.currentStock || 0) * (item.costPrice || 0);

            return {
                id: item._id,
                name: item.name,
                type: item.type,
                unit: item.unit,
                currentStock: item.currentStock || 0,
                rollWeight: item.rollWeight || 0,
                rollTotalWeight: rollTotalWeight || 0,
                costPrice: item.costPrice || 0,
                total,
            };
        });

        const grandTotal = records.reduce((sum, r) => sum + r.total, 0);

        const totalWeight = records
            .filter((r) => r.type === "raw_material")
            .reduce((sum, r) => sum + r.rollTotalWeight, 0);

        res.status(200).json({
            records,
            grandTotal,
            totalWeight,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

export default router;
