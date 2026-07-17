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
            name,
            type,
            hsnSac,
            unit,
            reorderLevel,
            costPrice,
            sellingPrice,
            status,
            orgId,
            createdBy,
            updatedBy,
        } = req.body;

        if (id) {
            const item = await InventoryItem.findByIdAndUpdate(
                id,
                {
                    name,
                    type,
                    hsnSac,
                    unit,
                    reorderLevel,
                    costPrice,
                    sellingPrice,
                    status,
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
            name,
            type,
            hsnSac,
            unit,
            reorderLevel,
            costPrice,
            sellingPrice,
            status,
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
            .select("name type unit hsnSac currentStock sellingPrice")
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
        const { itemId, quantity, reason, notes, orgId, createdBy } =
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
        const { itemId, quantity, reason, notes, orgId, createdBy } =
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

export default router;
