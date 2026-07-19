import express from "express";
import User from "../models/User";
import Customer from "../models/Customer";
import Invoice from "../models/Invoice";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Add / Update Customer
|--------------------------------------------------------------------------
*/
router.post("/add", authenticateToken, async (req, res) => {
    try {
        const {
            id,
            customerName,
            mobileNumber,
            gstIn,
            address,
            status,
            orgId,
            createdBy,
            updatedBy,
        } = req.body;

        if (id) {
            const customer = await Customer.findByIdAndUpdate(
                id,
                {
                    customerName,
                    mobileNumber,
                    gstIn,
                    address,
                    status,
                    updatedBy,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!customer) {
                return res.status(404).json({
                    error: "Customer not found",
                });
            }

            // ---- Cascade the edit onto every invoice linked to this customer ----
            // Only sync fields that were actually provided, so a partial
            // request can never accidentally wipe data on those invoices.
            const syncFields: any = {};
            if (customerName !== undefined)
                syncFields.customerName = customerName;
            if (mobileNumber !== undefined)
                syncFields.mobileNumber = mobileNumber;
            if (gstIn !== undefined) syncFields.gstIn = gstIn;
            if (address !== undefined) syncFields.address = address;

            if (Object.keys(syncFields).length > 0) {
                try {
                    await Invoice.updateMany(
                        { customerId: id, status: { $ne: "delete" } },
                        { $set: syncFields }
                    );
                } catch (syncErr) {
                    console.error(
                        "Error syncing customer info to invoices:",
                        syncErr
                    );
                    // Customer update itself already succeeded; surface the
                    // sync issue but don't fail the customer save.
                }
            }

            return res.status(200).json(customer);
        }

        const customer = new Customer({
            customerName,
            mobileNumber,
            gstIn,
            address,
            status,
            orgId,
            createdBy,
            updatedBy,
        });

        await customer.save();

        res.status(201).json(customer);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Internal Server Error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| Customer List (Management page - paginated)
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
            ];
        }

        const items = await Customer.find(match)
            .sort({
                [sort]: sortDirection,
            })
            .skip((page - 1) * recordPerPage)
            .limit(recordPerPage);

        const count = await Customer.countDocuments(match);

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
| Get Customer
|--------------------------------------------------------------------------
*/
router.post("/get/:id", authenticateToken, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({
                error: "Customer not found",
            });
        }

        res.json(customer);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Autocomplete Search (Invoice Page) - typeahead by customerName
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
            match.customerName = {
                $regex: searchText,
                $options: "i",
            };
        }

        const customers = await Customer.find(match)
            .select("customerName mobileNumber gstIn address")
            .sort({ customerName: 1 })
            .limit(10);

        res.json(customers);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Delete Customer
|--------------------------------------------------------------------------
*/
router.put("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            {
                status: "delete",
            },
            {
                new: true,
            }
        );

        if (!customer) {
            return res.status(404).json({
                error: "Customer not found",
            });
        }

        res.json(customer);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

export default router;
