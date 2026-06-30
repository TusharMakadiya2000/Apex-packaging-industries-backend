// src/routes/userRoutes.ts
import express from "express";
import User from "../models/User";
import { decryptData } from "../utils/encryption";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/auth";
import { authenticateToken } from "../middleware/authMiddleware";
import crypto from "crypto";
import nodemailer from "nodemailer";
import Org from "../models/Org";
import mongoose from "mongoose";

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            username,
            email,
            password,
            isCompanyUser,
            businessName,
        } = req.body;

        // Decrypt and hash the password
        const decryptedPassword = decryptData(password);
        const hashedPassword = await bcrypt.hash(decryptedPassword, 10);

        let userPayload = {
            firstName,
            lastName,
            username,
            email,
            password: hashedPassword,
            role: "employee",
            status: "active",
        };

        let savedOrg = null;

        if (isCompanyUser) {
            if (!businessName || businessName.trim().length === 0) {
                return res.status(400).json({
                    error: "Business name is required when registering as a Company user.",
                });
            }

            const user = new User(userPayload);
            const savedUser = await user.save();

            savedOrg = new Org({
                orgName: businessName,
                createdBy: savedUser._id,
            });

            const savedOrgInstance = await savedOrg.save();

            savedUser.orgId = savedOrgInstance._id;
            savedUser.role = "org";

            const updatedUser = await savedUser.save();
            res.status(201).json(updatedUser);
        } else {
            // Save the user without Org creation if not a Company user
            const user = new User(userPayload);
            const savedUser = await user.save();
            res.status(201).json(savedUser);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const isEmail = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
        const user = await User.findOne(
            isEmail ? { email: email } : { username: email }
        );
        if (!user) {
            return res.status(401).send({ error: "Invalid email." });
        }
        const decryptedPassword = decryptData(password);
        const isMatch = await bcrypt.compare(decryptedPassword, user.password);
        if (!isMatch) {
            return res.status(401).send({ error: "Invalid password." });
        }
        const token = generateToken(
            user._id,
            user.email,
            user.firstName + " " + user.lastName,
            user.role,
            user.orgId
        );
        res.send({ user, token });
    } catch (error) {
        res.status(500).send(error);
    }
});

router.post("/add", authenticateToken, async (req, res) => {
    try {
        const loginUserId = (req as any).user.userId;
        const {
            id,
            firstName,
            lastName,
            username,
            email,
            password,
            isCompanyUser,
            businessName,
        } = req.body;

        if (id) {
            // Update existing user
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Update user details
            user.firstName = firstName ?? user.firstName;
            user.lastName = lastName ?? user.lastName;
            user.username = username ?? user.username;
            user.email = email ?? user.email;

            if (isCompanyUser && user.role !== "employee") {
                // Handle Apex Packaging user updates
                if (!businessName || businessName.trim().length === 0) {
                    return res.status(400).json({
                        error: "Business name is required for as a Company.",
                    });
                }

                if (!user.orgId) {
                    // Create a new organization if none exists
                    const newOrg = new Org({
                        orgName: businessName,
                        createdBy: user._id,
                    });
                    const savedOrg = await newOrg.save();
                    user.orgId = savedOrg._id;
                } else {
                    // Update existing organization
                    await Org.findByIdAndUpdate(
                        user.orgId,
                        { orgName: businessName },
                        { new: true }
                    );
                }
                user.role = "org";
            }
            user.updatedBy = loginUserId;
            // Save updated user
            const updatedUser = await user.save();
            return res.status(200).json(updatedUser);
        } else {
            // Add new user
            const decryptedPassword = decryptData(password);
            const hashedPassword = await bcrypt.hash(decryptedPassword, 10);
            const newUser = new User({
                firstName,
                lastName,
                username,
                email,
                password: hashedPassword,
                role: isCompanyUser ? "org" : "employee",
                status: "active",
                createdBy: loginUserId,
            });

            if (isCompanyUser) {
                // Handle Apex Packaging user creation
                if (!businessName || businessName.trim().length === 0) {
                    return res.status(400).json({
                        error: "Business name is required for as a Company.",
                    });
                }

                const org = new Org({
                    orgName: businessName,
                    createdBy: newUser._id,
                });
                const savedOrg = await org.save();
                newUser.orgId = savedOrg._id;
            }

            const savedUser = await newUser.save();
            return res.status(201).json(savedUser);
        }
    } catch (error) {
        console.error("Error in add/update user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }

        const otp = crypto.randomInt(100000, 999999).toString();

        user.otp = otp;
        await user.save();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Send OTP via email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset OTP",
            html: `<p>Hello,${user.firstName + user.lastName}</p>
           <p>We received a request to reset your password. Your OTP code is <strong>${otp}</strong>.</p>
           <p>Please use this code to proceed with the password reset. If you did not request a password reset, please ignore this email.</p>
           <p>Thank you,<br>DbCodder</p>`,
        });

        res.status(200).send({ message: "OTP sent to your email." });
    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).send({
            error: "Failed to send OTP. Please try again.",
        });
    }
});

router.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user || user.otp !== otp) {
            return res.status(400).send({ error: "Invalid OTP." });
        }
        if (user.otp !== otp) {
            return res.status(400).send({ error: "Incorrect OTP." });
        }
        user.otp = undefined;
        await user.save();
        res.status(200).send({ message: "OTP verified successfully." });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).send({
            error: "Failed to verify OTP. Please try again.",
        });
    }
});

router.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).send({ error: "User not found." });
        }

        const encryptedPassword = decryptData(newPassword);
        const hashedPassword = await bcrypt.hash(encryptedPassword, 10);

        user.password = hashedPassword;

        await user.save();

        res.status(200).send({
            message: "Password has been reset successfully.",
        });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).send({
            error: "Failed to reset password. Please try again.",
        });
    }
});

router.post("/changepassword", authenticateToken, async (req, res) => {
    try {
        const { userId, currentPassword, password } = req.body;
        if (!userId || !currentPassword || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const decryptedCurrentPassword = decryptData(currentPassword);

        const passwordsMatched = await bcrypt.compare(
            decryptedCurrentPassword,
            user.password
        );
        if (!passwordsMatched) {
            return res
                .status(400)
                .json({ error: "Current password is incorrect" });
        }
        // Hash the new password
        const decryptedPassword = decryptData(password);
        const hashedPassword = await bcrypt.hash(decryptedPassword, 10);
        // Update the user password
        user.password = hashedPassword;
        await user.save();

        return res
            .status(200)
            .json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Error in changing password:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/me", authenticateToken, async (req, res) => {
    const loginUserId = (req as any).user.userId;
    try {
        const users = await User.findById(loginUserId).select("-password");
        if (!users) {
            return res.status(404).json({ error: "User not found" });
        }
        const org = await Org.findById(users.orgId).select("orgName");

        if (org) {
            const userData = {
                ...users.toObject(),
                orgName: org?.orgName,
            };
            res.status(200).send(userData);
        } else {
            res.status(200).send(users);
        }
    } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send(error);
    }
});

router.post("/", authenticateToken, async (req, res) => {
    try {
        const { sort, sortDirection, searchText, recordPerPage, page } =
            req.body.filter;
        const userEmail = (req as any).user.email;
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let match: any = { $and: [{ status: { $ne: "delete" } }] };

        if (user.role === "org") {
            match["$and"].push({ role: "employee", orgId: user.orgId });
        }

        if (user.role === "SA") {
            match["$and"].push({ role: { $ne: "SA" } });
        }

        if (searchText) {
            match = {
                ...match,
                $or: [
                    { firstName: { $regex: searchText, $options: "i" } },
                    { lastName: { $regex: searchText, $options: "i" } },
                    { email: { $regex: searchText, $options: "i" } },
                ],
            };
        }

        const items = await User.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: "orgs",
                    localField: "orgId",
                    foreignField: "_id",
                    as: "organization",
                },
            },
            {
                $unwind: {
                    path: "$organization",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    firstName: 1,
                    lastName: 1,
                    username: 1,
                    email: 1,
                    role: 1,
                    status: 1,
                    orgName: "$organization.orgName",
                },
            },
            { $sort: { [sort]: sortDirection } },
            { $skip: (page - 1) * recordPerPage },
            { $limit: recordPerPage },
        ]);

        // Get total count
        const count = await User.countDocuments(match);

        return res.status(200).json({
            items,
            count,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send(error);
    }
});

router.post("/:id", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const userWithOrg = await User.aggregate([
            { $match: { _id: user._id } },
            {
                $lookup: {
                    from: "orgs",
                    localField: "orgId",
                    foreignField: "_id",
                    as: "organization",
                },
            },
            {
                $unwind: {
                    path: "$organization",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    id: "$_id",
                    firstName: 1,
                    lastName: 1,
                    username: 1,
                    email: 1,
                    status: 1,
                    orgName: "$organization.orgName",
                },
            },
        ]);

        if (!userWithOrg.length) {
            return res.status(404).send({ message: "User not found" });
        }

        res.status(200).json(userWithOrg[0]);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ message: "Internal server error" });
    }
});

router.put("/deleteuser/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByIdAndUpdate(
            id,
            { status: "deleted" },
            { new: true }
        );

        if (!user) {
            return res.status(404).send({ error: "User not found" });
        }

        if (user.orgId) {
            await Org.findByIdAndUpdate(user.orgId, { status: "deleted" });
        }

        res.status(200).send({
            message: "User and associated organization deleted successfully.",
            user,
        });
    } catch (error) {
        console.error("Error in soft-deleting user:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

export default router;
