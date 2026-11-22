// src/models/User.ts
import { Schema, model } from "mongoose";

const orgSchema = new Schema(
    {
        orgName: { type: String, required: true },
        status: {
            type: String,
            enum: ["active", "inactive", "banned", "deleted"],
            default: "active",
        },
        invoiceType: {
            type: [String],
            enum: ["Apex Packaging Industries"],
            required: true,
          },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

const Org = model("org", orgSchema);

export default Org;
