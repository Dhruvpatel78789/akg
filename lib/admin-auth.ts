import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { connectDB } from "@/lib/mongodb";
import { UserRole } from "@/models/UserRole";

export async function requireAdmin(section?: string, subSection?: string, needEdit: boolean = false) {
  const authUser = await getAuthUser();

  if (!authUser) {
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
      user: null,
      roleProfile: null,
    };
  }

  await connectDB();
  const user = await User.findById(authUser.userId).lean();

  if (!user) {
    return {
      error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
      user: null,
      roleProfile: null,
    };
  }

  // If global admin, allow everything
  if (user.role === "ADMIN") {
    return {
      error: null,
      user,
      roleProfile: null,
    };
  }

  // Look up user permissions
  const roleProfile = await UserRole.findOne({ userId: user._id }).lean();
  if (!roleProfile) {
    return {
      error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
      user: null,
      roleProfile: null,
    };
  }

  // If section checks are requested
  if (section) {
    const perm = roleProfile.permissions?.find((p: any) => p.section === section);
    if (!perm) {
      return {
        error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
        user: null,
        roleProfile: null,
      };
    }

    if (subSection) {
      // Since map is stored as Map/Object, support both lookup syntaxes
      const subSectionsObj = perm.subSections instanceof Map 
        ? Object.fromEntries(perm.subSections) 
        : perm.subSections || {};
      
      const subPerm = subSectionsObj[subSection];
      if (!subPerm || (needEdit ? !subPerm.edit : !subPerm.view)) {
        return {
          error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
          user: null,
          roleProfile: null,
        };
      }
    } else {
      if (needEdit ? !perm.edit : !perm.view) {
        return {
          error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
          user: null,
          roleProfile: null,
        };
      }
    }
  }

  return {
    error: null,
    user,
    roleProfile,
  };
}