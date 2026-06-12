import { connectDB } from "@/lib/mongodb";
import { UserRole } from "@/models/UserRole";
import { User } from "@/models/User";

export async function hasPermission(
  userId: string,
  section: string,
  subSection?: string,
  needEdit: boolean = false,
  companyId?: string
): Promise<boolean> {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) return false;

  // Admin has all permissions
  if (user.role === "ADMIN") return true;

  const roleProfile = await UserRole.findOne({ userId });
  if (!roleProfile) return false;

  // Check section permission
  const perm = roleProfile.permissions?.find((p: any) => p.section === section);
  if (!perm) return false;

  if (subSection) {
    const subSectionsObj = perm.subSections instanceof Map 
      ? Object.fromEntries(perm.subSections) 
      : perm.subSections || {};
    
    const subPerm = subSectionsObj[subSection];
    if (!subPerm || (needEdit ? !subPerm.edit : !subPerm.view)) {
      return false;
    }
  } else {
    if (needEdit ? !perm.edit : !perm.view) {
      return false;
    }
  }

  // If specific company restriction applies
  if (companyId && roleProfile.allowedCompanyIds && roleProfile.allowedCompanyIds.length > 0) {
    const isCompanyAllowed = roleProfile.allowedCompanyIds.some(
      (id: any) => id.toString() === companyId
    );
    if (!isCompanyAllowed) return false;
  }

  return true;
}
