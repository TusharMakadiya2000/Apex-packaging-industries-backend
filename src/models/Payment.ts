import { Schema, model } from "mongoose";

const paymentSchema = new Schema(
    {
        orgId: { type: Schema.Types.ObjectId, ref: "Org" },
        partyKey: { type: String, required: true, index: true },
        customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
        customerName: { type: String, required: true },
        mobileNumber: { type: String, default: "" },
        amount: { type: Number, required: true, min: 0.01 },
        paidOn: { type: Date, default: Date.now },
        method: {
            type: String,
            enum: ["cash", "upi", "bank_transfer", "cheque", "card", "other"],
            default: "cash",
        },
        reference: { type: String, default: "" },
        note: { type: String, default: "" },
        status: { type: String, enum: ["active", "delete"], default: "active" },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

const Payment = model("Payment", paymentSchema);
export default Payment;