import express from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Service from "../models/Service";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Add / Update Service
|--------------------------------------------------------------------------
*/
router.post("/add", authenticateToken, async (req, res) => {
    try {
        const {
            id,
            title,
            status,
            orgId,
            createdBy,
            updatedBy,
        } = req.body;

        if (id) {
            const service = await Service.findByIdAndUpdate(
                id,
                {
                    title,
                    status,
                    updatedBy,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!service) {
                return res.status(404).json({
                    error: "Service not found",
                });
            }

            return res.status(200).json(service);
        }

        const service = new Service({
            title,
            status,
            orgId,
            createdBy,
            updatedBy,
        });

        await service.save();

        res.status(201).json(service);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Internal Server Error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| Service List
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
            match.title = {
                $regex: searchText,
                $options: "i",
            };
        }

        const items = await Service.find(match)
            .sort({
                [sort]: sortDirection,
            })
            .skip((page - 1) * recordPerPage)
            .limit(recordPerPage);

        const count = await Service.countDocuments(match);

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
| Get Service
|--------------------------------------------------------------------------
*/
router.post("/get/:id", authenticateToken, async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({
                error: "Service not found",
            });
        }

        res.json(service);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Dropdown List (Invoice Page) - only id + title needed
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

        const services = await Service.find(match)
            .select("title")
            .sort({
                title: 1,
            });

        res.json(services);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

/*
|--------------------------------------------------------------------------
| Delete Service
|--------------------------------------------------------------------------
*/
router.put("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            {
                status: "delete",
            },
            {
                new: true,
            }
        );

        if (!service) {
            return res.status(404).json({
                error: "Service not found",
            });
        }

        res.json(service);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

export default router;
