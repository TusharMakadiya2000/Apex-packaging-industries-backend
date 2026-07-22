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
    quantity: { type: Number, required: true },
    amount: { type: Number, required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service" },
});

// Quotation Schema
const quotationSchema = new Schema(
    {
        quotationID: { type: Number, required: true },
        customerName: { type: String, required: false },
        mobileNumber: { type: String, required: false },
        quotationDate: { type: Date, default: null },
        address: { type: addressSchema, required: true },
        // quotationType: { type: String, required: true },
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

// Create the Quotation Model
const Quotation = model("Quotation", quotationSchema);

export default Quotation;
