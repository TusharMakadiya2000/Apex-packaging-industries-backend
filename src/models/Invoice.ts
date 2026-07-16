import { Schema, model } from "mongoose";

// Address Schema
const addressSchema = new Schema({
    country: { type: String, required: false },
    state: { type: String, required: false },
    city: { type: String, required: false },
    zipcode: { type: Number, required: false },
    address1: { type: String, required: false },
});

// Service Schema
const serviceSchema = new Schema({
    title: { type: String, required: true },
    hsnSac: { type: Number, required: true },
    quantity: { type: Number, required: true },
    amount: { type: Number, required: true },
    gst: { type: Number, required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service" },
});

// Invoice Schema
const invoiceSchema = new Schema(
    {
        invoiceID: { type: Number, required: true },
        customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
        customerName: { type: String, required: true },
        mobileNumber: { type: String, required: true },
        gstIn: { type: String },
        invoiceDate: { type: Date, default: null },
        address: { type: addressSchema, required: true },
        // invoiceType: { type: String, required: true },
        orgId: { type: Schema.Types.ObjectId, ref: "Org" },
        services: { type: [serviceSchema], required: true },
        status: {
            type: String,
            enum: ["active", "delete"],
            default: "active",
        },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

// Create the Invoice Model
const Invoice = model("Invoice", invoiceSchema);

export default Invoice;
