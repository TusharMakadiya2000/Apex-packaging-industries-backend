// src/models/Customer.ts

import { Schema, model } from "mongoose";

const addressSchema = new Schema(
    {
        country: { type: String, required: false },
        state: { type: String, required: false },
        city: { type: String, required: false },
        zipcode: { type: Number, required: false },
        address1: { type: String, required: false },
    },
    { _id: false }
);

const customerSchema = new Schema(
    {
        orgId: {
            type: Schema.Types.ObjectId,
            ref: "Org",
        },

        customerName: {
            type: String,
            required: true,
        },

        mobileNumber: {
            type: String,
            required: true,
        },

        gstIn: {
            type: String,
        },

        address: {
            type: addressSchema,
            required: false,
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

export default model("Customer", customerSchema);
