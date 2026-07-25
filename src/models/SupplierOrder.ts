// src/models/SupplierOrder.ts

import { Schema, model } from "mongoose";

// Each line item is one paper-roll spec ordered from the supplier -
// same GSM/color(paperType)/size vocabulary as InventoryItem, plus how
// many rolls were ordered.
const orderItemSchema = new Schema(
    {
        gsm: {
            type: Number,
            required: true,
        },

        paperType: {
            type: String, // color, e.g. "Gold", "Natural"
            required: true,
        },

        size: {
            type: Number,
            required: true,
        },

        quantity: {
            type: Number, // rolls ordered
            required: true,
        },

        // Optional link back to the matching InventoryItem, so a
        // received order can later be turned into a stock-in transaction
        // without re-typing the spec.
        inventoryItemId: {
            type: Schema.Types.ObjectId,
            ref: "InventoryItem",
        },
    },
    { _id: false }
);

const supplierOrderSchema = new Schema(
    {
        orgId: {
            type: Schema.Types.ObjectId,
            ref: "Org",
        },

        orderID: {
            type: Number,
            required: true,
        },

        // Reference to the Supplier master, plus a name/GST snapshot at
        // the time of order (mirrors how Invoice snapshots Customer info)
        // so this record stays accurate even if the supplier is edited
        // or removed later.
        supplierId: {
            type: Schema.Types.ObjectId,
            ref: "Supplier",
        },

        supplierName: {
            type: String,
            required: true,
        },

        gstIn: {
            type: String,
        },

        orderDate: {
            type: Date,
            default: null,
        },

        items: {
            type: [orderItemSchema],
            required: true,
        },

        paymentAmount: {
            type: Number,
            default: 0,
        },

        paymentStatus: {
            type: String,
            enum: ["pending", "partial", "paid"],
            default: "pending",
        },

        status: {
            type: String,
            enum: ["active", "delete"],
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

export default model("SupplierOrder", supplierOrderSchema);
