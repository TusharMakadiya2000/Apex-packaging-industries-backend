import express from "express";
import User from "../models/User";
import Supplier from "../models/Supplier";
import SupplierOrder from "../models/SupplierOrder";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Add / Update Supplier
|--------------------------------------------------------------------------
*/
router.post("/add", authenticateToken, async (req, res) => {
    try {
        const {
            id,
            name,
            gstIn,
            mobileNumber,
            status,
            orgId,
            createdBy,
            updatedBy,
        } = req.body;

        if (id) {
            const supplier = await Supplier.findByIdAndUpdate(
                id,
                {
                    name,
                    gstIn,
                    mobileNumber,
                    status,
                    updatedBy,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!supplier) {
                return res.status(404).json({
                    error: "Supplier not found",
                });
            }

            // Cascade the edit onto every order linked to this supplier,
            // same approach used for Customer -> Invoice syncing.
            const syncFields: any = {};
            if (name !== undefined) syncFields.supplierName = name;
            if (gstIn !== undefined) syncFields.gstIn = gstIn;

            if (Object.keys(syncFields).length > 0) {
                try {
                    await SupplierOrder.updateMany(
                        { supplierId: id, status: { $ne: "delete" } },
                        { $set: syncFields }
                    );
                } catch (syncErr) {
                    console.error(
                        "Error syncing supplier info to orders:",
                        syncErr
                    );
                }
            }

            return res.status(200).json(supplier);
        }

        const supplier = new Supplier({
            name,
            gstIn,
            mobileNumber,
            status,
            orgId,
            createdBy,
            updatedBy,
        });

        await supplier.save();

        res.status(201).json(supplier);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Internal Server Error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| Supplier List (Management page - paginated)
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

        if (searchText) {
            match.$or = [
                {
                    name: {
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
            ];
        }

        const items = await Supplier.find(match)
            .sort({
                [sort]: sortDirection,
            })
            .skip((page - 1) * recordPerPage)
            .limit(recordPerPage);

        const count = await Supplier.countDocuments(match);

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
| Get Supplier
|--------------------------------------------------------------------------
*/
router.post("/get/:id", authenticateToken, async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                error: "Supplier not found",
            });
        }

        res.json(supplier);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Autocomplete Search (Supplier Order Page) - typeahead by name
|--------------------------------------------------------------------------
*/
router.post("/list", authenticateToken, async (req, res) => {
    try {
        const userEmail = (req as any).user.email;

        const user = await User.findOne({
            email: userEmail,
        });

        const { searchText } = req.body;

        let match: any = {
            status: { $ne: "delete" },
        };

        if (user?.role === "org") {
            match.orgId = user.orgId;
        }

        if (user?.role !== "SA" && user?.role !== "org") {
            match.createdBy = user?._id;
        }

        if (searchText) {
            match.name = {
                $regex: searchText,
                $options: "i",
            };
        }

        const suppliers = await Supplier.find(match)
            .select("name gstIn mobileNumber")
            .sort({ name: 1 })
            .limit(10);

        res.json(suppliers);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Delete Supplier
|--------------------------------------------------------------------------
*/
router.put("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const supplier = await Supplier.findByIdAndUpdate(
            req.params.id,
            {
                status: "delete",
            },
            {
                new: true,
            }
        );

        if (!supplier) {
            return res.status(404).json({
                error: "Supplier not found",
            });
        }

        res.json(supplier);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

export default router;
