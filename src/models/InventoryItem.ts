// src/models/InventoryItem.ts

import { Schema, model } from "mongoose";

const inventoryItemSchema = new Schema(
    {
        orgId: {
            type: Schema.Types.ObjectId,
            ref: "Org",
        },

        type: {
            type: String,
            enum: ["raw_material", "finished_good"],
            required: true,
        },

        name: {
            type: String,
            required: true,
        },

        gsm: {
            type: Number,
        },

        paperType: {
            type: String,
        },

        size: {
            type: Number,
        },

        hsnSac: {
            type: Number,
        },

        unit: {
            type: String,
            required: true,
            default: "kg",
        },

        currentStock: {
            type: Number,
            default: 0,
        },

        totalWeight: {
            type: Number,
            default: 0,
        },

        reorderLevel: {
            type: Number,
            default: 0,
        },

        costPrice: {
            type: Number,
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

export default model("InventoryItem", inventoryItemSchema);