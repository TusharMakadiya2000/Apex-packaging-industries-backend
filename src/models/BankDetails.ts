// src/models/User.ts
import { Schema, model } from "mongoose";

const bankSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        bankName: { type: String, required: true },
        branchName: { type: String, required: true },
        bankerName: { type: String, required: true },
        accountNo: { type: Number, required: true, unique: true },
        IFSCCode: { type: String, required: true, unique: true },
        status: {
            type: String,
            enum: ["active", "deleted"],
            default: "active",
        },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

const BankDetails = model("BankDetails", bankSchema);

export default BankDetails;
