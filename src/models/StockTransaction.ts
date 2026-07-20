// src/models/StockTransaction.ts

import { Schema, model } from "mongoose";

const stockTransactionSchema = new Schema(
    {
        orgId: {
            type: Schema.Types.ObjectId,
            ref: "Org",
        },

        itemId: {
            type: Schema.Types.ObjectId,
            ref: "InventoryItem",
            required: true,
        },

        type: {
            type: String,
            enum: ["in", "out"],
            required: true,
        },

        // Roll count (raw material) or unit count (finished good) moved.
        quantity: {
            type: Number,
            required: true,
        },

        // Weight (kg) moved alongside quantity, for raw materials only.
        // Optional - manual invoice-driven movements don't set this.
        weight: {
            type: Number,
        },

        reason: {
            type: String,
            enum: [
                "purchase",
                "production",
                "invoice-sale",
                "adjustment",
                "return",
            ],
            required: true,
        },

        // e.g. the Invoice _id, when this movement came from a sale
        referenceId: {
            type: Schema.Types.ObjectId,
        },

        notes: {
            type: String,
        },

        // Snapshot of currentStock (roll count) immediately after this
        // transaction, for auditability.
        balanceAfter: {
            type: Number,
            required: true,
        },

        // Snapshot of totalWeight immediately after this transaction.
        weightBalanceAfter: {
            type: Number,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

stockTransactionSchema.index({ itemId: 1, createdAt: -1 });

export default model("StockTransaction", stockTransactionSchema);