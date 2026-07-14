import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import { Company } from "@/models/Company";
import { UserRole } from "@/models/UserRole";

export async function GET() {
  await connectDB();

  const authUser = await getAuthUser();

  if (!authUser) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (authUser.role === "COMPANY_EMPLOYEE") {
    const employee = await CompanyEmployee.findById(authUser.userId);
    if (!employee || employee.softDeleted || employee.status === "INACTIVE") {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    const company = await Company.findById(employee.companyId);
    return NextResponse.json({
      user: {
        id: employee._id.toString(),
        name: employee.name,
        email: employee.email,
        phone: employee.mobile,
        role: "COMPANY_EMPLOYEE",
        accountType: "COMPANY_PLAYER",
        companyId: employee.companyId.toString(),
        companyName: company ? company.name : "Company",
        mustChangePassword: employee.mustChangePassword,
      },
    });
  }

  const user = await User.findById(authUser.userId).select(
    "name email phone role coins coinsAvailable coinsFrozen coinsFrozenReason coinsFrozenAt dob mustChangePassword activePlanId coinPlanExpiryDate"
  );

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const { Membership } = await import("@/models/Membership");
  const activeFixed = await Membership.findOne({ userId: user._id, status: "ACTIVE", membershipType: "FIXED" }).lean();
  const activeCoins = await Membership.findOne({ userId: user._id, status: "ACTIVE", membershipType: "COINS" }).lean();
  const accountType = activeFixed ? "MEMBER" : activeCoins ? "COIN_MEMBER" : "PLAYER";

  const userRole = await UserRole.findOne({ userId: user._id }).lean();

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      accountType,
      coins: user.coins,
      coinsAvailable: user.coinsAvailable,
      coinsFrozen: user.coinsFrozen,
      coinsFrozenReason: user.coinsFrozenReason,
      coinsFrozenAt: user.coinsFrozenAt,
      dob: user.dob,
      mustChangePassword: user.mustChangePassword,
      activePlanId: user.activePlanId,
      coinPlanExpiryDate: user.coinPlanExpiryDate,
      roleProfile: userRole || null,
    },
  });
}