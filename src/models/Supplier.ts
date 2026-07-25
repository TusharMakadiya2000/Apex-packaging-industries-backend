// src/models/Supplier.ts

import { Schema, model } from "mongoose";

const supplierSchema = new Schema(
    {
        orgId: {
            type: Schema.Types.ObjectId,
            ref: "Org",
        },

        name: {
            type: String,
            required: true,
        },

        gstIn: {
            type: String,
        },

        mobileNumber: {
            type: String,
        },

        status: {
            type: String,
            enum: ["active", "inactive", "delete"],
            default: "active",
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

export default model("Supplier", supplierSchema);
