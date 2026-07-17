// src/models/InventoryItem.ts

import { Schema, model } from "mongoose";

const inventoryItemSchema = new Schema(
    {
        orgId: {
            type: Schema.Types.ObjectId,
            ref: "Org",
        },

        name: {
            type: String,
            required: true,
        },

        type: {
            type: String,
            enum: ["raw_material", "finished_good"],
            required: true,
        },

        hsnSac: {
            type: Number,
        },

        unit: {
            type: String,
            required: true, // e.g. "pcs", "kg", "box", "sheet"
        },

        // Cached running total - always updated via a StockTransaction,
        // never edited directly from the item edit form.
        currentStock: {
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

        sellingPrice: {
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
