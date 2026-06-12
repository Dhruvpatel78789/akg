import mongoose, { Schema, models } from "mongoose";

const SubSectionPermissionSchema = new Schema(
  {
    view: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
  },
  { _id: false }
);

const SectionPermissionSchema = new Schema(
  {
    section: { type: String, required: true },
    view: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    subSections: {
      type: Map,
      of: SubSectionPermissionSchema,
      default: {},
    },
  },
  { _id: false }
);

const UserRoleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    permissions: [SectionPermissionSchema],
    allowedCompanyIds: [{ type: Schema.Types.ObjectId, ref: "Company" }],
    allowedGameIds: [{ type: Schema.Types.ObjectId, ref: "Game" }],
    allowedColumns: [{ type: String }],
  },
  { timestamps: true }
);

if (models.UserRole) {
  delete (models as any).UserRole;
}

export const UserRole = mongoose.model("UserRole", UserRoleSchema);
