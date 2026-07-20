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

        // Auto-generated for raw materials (e.g. "100 GSM Gold 25"),
        // user-entered for finished goods (e.g. "Corrugated Box - Small").
        // Always populated - this is what shows in lists/dropdowns.
        name: {
            type: String,
            required: true,
        },

        // ---- Raw material (paper roll) specific fields ----
        gsm: {
            type: Number, // e.g. 100, 120, 150
        },

        paperType: {
            type: String, // e.g. "Gold", "Natural"
        },

        size: {
            type: Number, // roll size, e.g. 25, 30, 35, 40, 45, 50
        },

        hsnSac: {
            type: Number,
        },

        // Always "kg" for raw materials. Free text for finished goods
        // (pcs, box, etc.) since those aren't sold by weight.
        unit: {
            type: String,
            required: true,
            default: "kg",
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

        // For raw materials this is "Purchase Rate (per KG)".
        // For finished goods it's a generic cost price.
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
