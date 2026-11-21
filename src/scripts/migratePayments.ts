// src/scripts/migratePayments.ts
import mongoose from "mongoose";
import connectDB from "../config/mongoose";
import Invoice from "../models/Invoice";
import { calcInvoiceTotal } from "../utils/invoicePayment";

async function migratePayments() {
    await connectDB(); // same connection your server uses

    const paidInvoices = await Invoice.find({
        paymentStatus: "paid",
        "payments.0": { $exists: false }, // skip ones already migrated
    });

    for (const inv of paidInvoices) {
        await Invoice.updateOne(
            { _id: inv._id },
            {
                $push: {
                    payments: {
                        amount: calcInvoiceTotal(inv.services as any),
                        paidOn:
                            (inv as any).updatedAt ||
                            (inv as any).createdAt ||
                            new Date(),
                        method: "other",
                        note: "Migrated from old paid status",
                    },
                },
            }
        );
    }

    console.log(`Migrated ${paidInvoices.length} invoices`);
    await mongoose.disconnect();
}

migratePayments().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});