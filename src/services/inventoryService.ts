// src/services/inventoryService.ts

import InventoryItem from "../models/InventoryItem";
import StockTransaction from "../models/StockTransaction";
import mongoose from "mongoose";

type StockReason =
    | "purchase"
    | "production"
    | "invoice-sale"
    | "adjustment"
    | "return";

/*
|--------------------------------------------------------------------------
| applyStockChange
|--------------------------------------------------------------------------
| The one place that ever touches InventoryItem.currentStock/totalWeight.
| direction: "in" increases stock, "out" decreases it.
| `weight` is optional - pass it for raw-material movements where you
| also want to move totalWeight (kg) alongside the roll count. Omit it
| for movements that only ever dealt in roll/unit counts (e.g. invoice
| line deductions), so totalWeight is left untouched.
| Always writes a matching StockTransaction ledger row in the same call,
| so currentStock/totalWeight and the ledger can never drift apart.
*/
export const applyStockChange = async ({
    itemId,
    direction,
    quantity,
    weight,
    reason,
    referenceId,
    notes,
    orgId,
    createdBy,
}: {
    itemId: string | mongoose.Types.ObjectId;
    direction: "in" | "out";
    quantity: number;
    weight?: number;
    reason: StockReason;
    referenceId?: string | mongoose.Types.ObjectId;
    notes?: string;
    orgId?: string | mongoose.Types.ObjectId;
    createdBy?: string | mongoose.Types.ObjectId;
}) => {
    if (!quantity || quantity <= 0) {
        // zero/negative-quantity changes are no-ops, not errors -
        // callers looping over invoice lines may pass 0 for untouched lines
        return null;
    }

    const item = await InventoryItem.findById(itemId);
    if (!item) {
        throw new Error(`InventoryItem not found: ${itemId}`);
    }

    const delta = direction === "in" ? quantity : -quantity;
    const newBalance = (item.currentStock || 0) + delta;

    item.currentStock = newBalance;

    let newWeightBalance: number | undefined = undefined;
    if (weight !== undefined && weight !== null && !Number.isNaN(weight)) {
        const weightDelta = direction === "in" ? weight : -weight;
        newWeightBalance = (item.totalWeight || 0) + weightDelta;
        item.totalWeight = newWeightBalance;
    }

    await item.save();

    const transaction = await StockTransaction.create({
        orgId: orgId || item.orgId,
        itemId: item._id,
        type: direction,
        quantity,
        weight: weight !== undefined ? weight : undefined,
        reason,
        referenceId,
        notes,
        balanceAfter: newBalance,
        weightBalanceAfter: newWeightBalance,
        createdBy,
    });

    return { item, transaction };
};

/*
|--------------------------------------------------------------------------
| deductInvoiceStock
|--------------------------------------------------------------------------
| Called once when a NEW invoice is created. Walks every line item that
| has an inventoryItemId and writes an "out" / "invoice-sale" entry.
| Only moves roll/unit count (quantity) - totalWeight is intentionally
| left untouched here since invoice lines don't track weight.
*/
export const deductInvoiceStock = async (
    services: any[],
    invoiceId: string | mongoose.Types.ObjectId,
    orgId: any,
    createdBy: any
) => {
    for (const line of services || []) {
        if (!line.inventoryItemId) continue;

        await applyStockChange({
            itemId: line.inventoryItemId,
            direction: "out",
            quantity: line.quantity,
            reason: "invoice-sale",
            referenceId: invoiceId,
            notes: `Invoice sale (${line.title})`,
            orgId,
            createdBy,
        });
    }
};

/*
|--------------------------------------------------------------------------
| reverseInvoiceStock
|--------------------------------------------------------------------------
| Called when an invoice is deleted. Adds every previously-deducted
| quantity back as an "in" / "return" entry.
*/
export const reverseInvoiceStock = async (
    services: any[],
    invoiceId: string | mongoose.Types.ObjectId,
    orgId: any,
    updatedBy: any
) => {
    for (const line of services || []) {
        if (!line.inventoryItemId) continue;

        await applyStockChange({
            itemId: line.inventoryItemId,
            direction: "in",
            quantity: line.quantity,
            reason: "return",
            referenceId: invoiceId,
            notes: `Invoice deleted - stock returned (${line.title})`,
            orgId,
            createdBy: updatedBy,
        });
    }
};

/*
|--------------------------------------------------------------------------
| reconcileInvoiceStock
|--------------------------------------------------------------------------
| Called when an EXISTING invoice is updated. Compares old vs new line
| items per inventoryItemId and only moves the difference - so editing
| an invoice never double-deducts or silently loses track of stock.
*/
export const reconcileInvoiceStock = async (
    oldServices: any[],
    newServices: any[],
    invoiceId: string | mongoose.Types.ObjectId,
    orgId: any,
    updatedBy: any
) => {
    // Sum quantities per inventoryItemId on each side
    const oldTotals = new Map<string, number>();
    for (const line of oldServices || []) {
        if (!line.inventoryItemId) continue;
        const key = String(line.inventoryItemId);
        oldTotals.set(key, (oldTotals.get(key) || 0) + Number(line.quantity));
    }

    const newTotals = new Map<string, number>();
    for (const line of newServices || []) {
        if (!line.inventoryItemId) continue;
        const key = String(line.inventoryItemId);
        newTotals.set(key, (newTotals.get(key) || 0) + Number(line.quantity));
    }

    // Union of all itemIds touched on either side
    const allItemIds = new Set([...oldTotals.keys(), ...newTotals.keys()]);

    for (const itemId of allItemIds) {
        const oldQty = oldTotals.get(itemId) || 0;
        const newQty = newTotals.get(itemId) || 0;
        const diff = newQty - oldQty; // positive = need to deduct more, negative = return some

        if (diff === 0) continue;

        if (diff > 0) {
            await applyStockChange({
                itemId,
                direction: "out",
                quantity: diff,
                reason: "invoice-sale",
                referenceId: invoiceId,
                notes: "Invoice updated - additional stock deducted",
                orgId,
                createdBy: updatedBy,
            });
        } else {
            await applyStockChange({
                itemId,
                direction: "in",
                quantity: Math.abs(diff),
                reason: "return",
                referenceId: invoiceId,
                notes: "Invoice updated - excess stock returned",
                orgId,
                createdBy: updatedBy,
            });
        }
    }
};