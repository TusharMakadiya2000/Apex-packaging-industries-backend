// src/models/User.ts
import { Schema, model } from "mongoose";

const userSchema = new Schema(
    {
        orgId: { type: Schema.Types.ObjectId, required: false, ref: "Org" },
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: {
            type: String,
            enum: ["SA", "org", "manager", "employee", "customer"],
            default: "customer",
        },
        status: {
            type: String,
            enum: ["active", "inactive", "banned", "deleted"],
            default: "active",
        },
        otp: { type: String, required: false, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

const User = model("User", userSchema);

export default User;
