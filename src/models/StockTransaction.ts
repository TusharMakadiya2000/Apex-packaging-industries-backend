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

        quantity: {
            type: Number,
            required: true,
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

        // Snapshot of currentStock immediately after this transaction,
        // for auditability - lets you reconstruct history without
        // replaying every transaction from zero.
        balanceAfter: {
            type: Number,
            required: true,
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
