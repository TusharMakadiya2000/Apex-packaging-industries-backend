import { Schema, model } from "mongoose";

const addressSchema = new Schema({
    country: { type: String, required: false },
    state: { type: String, required: false },
    city: { type: String, required: false },
    zipcode: { type: Number, required: false },
    address1: { type: String, required: false },
});

const serviceSchema = new Schema({
    title: { type: String, required: true },
    hsnSac: { type: Number, required: true },
    quantity: { type: Number, required: true },
    amount: { type: Number, required: true },
    gst: { type: Number, required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service" },
    inventoryItemId: { type: Schema.Types.ObjectId, ref: "InventoryItem" },
});

// NEW: one entry per installment received
const paymentSchema = new Schema({
    amount: { type: Number, required: true, min: 0.01 },
    paidOn: { type: Date, default: Date.now },
    method: {
        type: String,
        enum: ["cash", "upi", "bank_transfer", "cheque", "card", "other"],
        default: "cash",
    },
    reference: { type: String, default: "" }, // UPI ref / cheque no.
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
});

const invoiceSchema = new Schema(
    {
        invoiceID: { type: Number, required: true },
        customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
        customerName: { type: String, required: true },
        mobileNumber: { type: String, required: false, default: "" },
        gstIn: { type: String },
        invoiceDate: { type: Date, default: null },
        address: { type: addressSchema, required: true },
        orgId: { type: Schema.Types.ObjectId, ref: "Org" },
        services: { type: [serviceSchema], required: true },
        status: {
            type: String,
            enum: ["active", "delete"],
            default: "active",
        },
        // CHANGED: added "partial"
        paymentStatus: {
            type: String,
            enum: ["pending", "partial", "paid"],
            default: "pending",
        },
        // NEW
        payments: { type: [paymentSchema], default: [] },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

const Invoice = model("Invoice", invoiceSchema);
export default Invoice;