// src/models/Service.ts

import { Schema, model } from "mongoose";

const serviceSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Org",
    },

    title: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default model("Service", serviceSchema);
