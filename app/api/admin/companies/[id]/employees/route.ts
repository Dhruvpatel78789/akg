import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import { Company } from "@/models/Company";
import bcrypt from "bcryptjs";

// Helper CSV parser
function parseCSV(text: string) {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }
  return lines.filter(r => r.length > 0 && r.some(c => c !== ""));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id } = await params;
    const employees = await CompanyEmployee.find({ companyId: id, softDeleted: false })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ success: true, employees });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to load employees" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id: companyId } = await params;
    const company = await Company.findById(companyId);
    if (!company || company.softDeleted) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action } = body;

    // Single Manual Employee Creation
    if (action === "MANUAL") {
      const { employeeId, name, mobile, email, address, dateOfBirth, department, designation, gender, joiningDate, emergencyContact, notes } = body;

      if (!employeeId || !name || !mobile || !email) {
        return NextResponse.json({ success: false, message: "Missing required employee details" }, { status: 400 });
      }

      const cleanMobile = mobile.replace(/\D/g, "");
      if (cleanMobile.length !== 10) {
        return NextResponse.json({ success: false, message: "Mobile must be exactly 10 digits" }, { status: 400 });
      }

      // Check unique constraints inside this company
      const existing = await CompanyEmployee.findOne({
        companyId,
        softDeleted: false,
        $or: [
          { employeeId: { $regex: new RegExp(`^${employeeId}$`, "i") } },
          { mobile: cleanMobile },
          { email: email.toLowerCase() }
        ]
      });

      if (existing) {
        return NextResponse.json({ success: false, message: "Employee with duplicate ID, mobile, or email already exists in company" }, { status: 409 });
      }

      const defaultPasswordHash = await bcrypt.hash("NEW1234", 10);
      const employee = await CompanyEmployee.create({
        companyId,
        employeeId,
        name,
        mobile: cleanMobile,
        email: email.toLowerCase(),
        address: address || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        department: department || undefined,
        designation: designation || undefined,
        gender: gender || undefined,
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
        emergencyContact: emergencyContact || undefined,
        notes: notes || undefined,
        passwordHash: defaultPasswordHash,
        mustChangePassword: true,
        status: "ACTIVE"
      });

      return NextResponse.json({ success: true, employee });
    }

    const { csvText } = body;
    if (!csvText) {
      return NextResponse.json({ success: false, message: "Missing CSV data" }, { status: 400 });
    }

    const parsed = parseCSV(csvText);
    if (parsed.length < 2) {
      return NextResponse.json({ success: false, message: "CSV is empty or missing header" }, { status: 400 });
    }

    const headers = parsed[0].map(h => h.toLowerCase());
    
    // Validate required columns
    const reqCols = ["employeeid", "name", "mobile", "email"];
    for (const col of reqCols) {
      if (!headers.includes(col)) {
        return NextResponse.json({ success: false, message: `Missing mandatory column: ${col}` }, { status: 400 });
      }
    }

    const getColIndex = (colName: string) => headers.indexOf(colName);
    const empIdIdx = getColIndex("employeeid");
    const nameIdx = getColIndex("name");
    const mobileIdx = getColIndex("mobile");
    const emailIdx = getColIndex("email");

    // Optional columns indices
    const addrIdx = getColIndex("address");
    const dobIdx = getColIndex("dateofbirth");
    const deptIdx = getColIndex("department");
    const desigIdx = getColIndex("designation");

    // Find all headers not in standard list as metadata
    const standardCols = ["employeeid", "name", "mobile", "email", "address", "dateofbirth", "department", "designation"];
    const metadataIndices: Array<{ name: string; index: number }> = [];
    headers.forEach((h, idx) => {
      if (!standardCols.includes(h) && h !== "") {
        metadataIndices.push({ name: h, index: idx });
      }
    });

    const successRows: any[] = [];
    const rejectedRows: any[] = [];

    // Track unique constraints inside this upload block
    const csvEmpIds = new Set<string>();
    const csvPhones = new Set<string>();
    const csvEmails = new Set<string>();

    const defaultPasswordHash = await bcrypt.hash("NEW1234", 10);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Load existing active employees to check duplicates quickly
    const existingEmployees = await CompanyEmployee.find({ companyId, softDeleted: false }).lean();
    const existingEmpIds = new Set(existingEmployees.map(e => String(e.employeeId).toLowerCase()));
    const existingMobiles = new Set(existingEmployees.map(e => String(e.mobile)));
    const existingEmails = new Set(existingEmployees.map(e => String(e.email).toLowerCase()));

    for (let r = 1; r < parsed.length; r++) {
      const row = parsed[r];
      if (row.length < reqCols.length) continue; // skip incomplete rows

      const employeeId = row[empIdIdx]?.trim();
      const name = row[nameIdx]?.trim();
      const mobile = row[mobileIdx]?.trim()?.replace(/\D/g, "");
      const email = row[emailIdx]?.trim()?.toLowerCase();

      // Row Validation
      if (!employeeId || !name || !mobile || !email) {
        rejectedRows.push({ rowIndex: r + 1, error: "Missing required values (employeeId, name, mobile, email)" });
        continue;
      }

      if (mobile.length !== 10) {
        rejectedRows.push({ rowIndex: r + 1, error: `Invalid phone number: ${row[mobileIdx]} (must be exactly 10 digits)` });
        continue;
      }

      if (!emailRegex.test(email)) {
        rejectedRows.push({ rowIndex: r + 1, error: `Invalid email address format: ${row[emailIdx]}` });
        continue;
      }

      // Unique Checks inside the CSV
      if (csvEmpIds.has(employeeId.toLowerCase())) {
        rejectedRows.push({ rowIndex: r + 1, error: `Duplicate employeeId within CSV: ${employeeId}` });
        continue;
      }
      if (csvPhones.has(mobile)) {
        rejectedRows.push({ rowIndex: r + 1, error: `Duplicate mobile within CSV: ${mobile}` });
        continue;
      }
      if (csvEmails.has(email)) {
        rejectedRows.push({ rowIndex: r + 1, error: `Duplicate email within CSV: ${email}` });
        continue;
      }

      // Unique Checks inside the Database
      if (existingEmpIds.has(employeeId.toLowerCase())) {
        rejectedRows.push({ rowIndex: r + 1, error: `Duplicate employeeId inside company: ${employeeId}` });
        continue;
      }
      if (existingMobiles.has(mobile)) {
        rejectedRows.push({ rowIndex: r + 1, error: `Duplicate mobile inside company: ${mobile}` });
        continue;
      }
      if (existingEmails.has(email)) {
        rejectedRows.push({ rowIndex: r + 1, error: `Duplicate email inside company: ${email}` });
        continue;
      }

      // Add to CSV sets
      csvEmpIds.add(employeeId.toLowerCase());
      csvPhones.add(mobile);
      csvEmails.add(email);

      // Extract optional fields
      const address = addrIdx !== -1 ? row[addrIdx]?.trim() : undefined;
      const dobStr = dobIdx !== -1 ? row[dobIdx]?.trim() : undefined;
      const department = deptIdx !== -1 ? row[deptIdx]?.trim() : undefined;
      const designation = desigIdx !== -1 ? row[desigIdx]?.trim() : undefined;

      let dateOfBirth: Date | undefined;
      if (dobStr) {
        const parsedDate = new Date(dobStr);
        if (!isNaN(parsedDate.getTime())) {
          dateOfBirth = parsedDate;
        }
      }

      // Extra metadata parsing
      const metadata: Record<string, string> = {};
      metadataIndices.forEach(item => {
        metadata[item.name] = row[item.index] || "";
      });

      successRows.push({
        companyId,
        employeeId,
        name,
        mobile,
        email,
        address,
        dateOfBirth,
        department,
        designation,
        passwordHash: defaultPasswordHash,
        mustChangePassword: true,
        status: "ACTIVE",
        metadata,
      });
    }

    if (successRows.length > 0) {
      await CompanyEmployee.insertMany(successRows);
    }

    return NextResponse.json({
      success: true,
      successCount: successRows.length,
      rejectedCount: rejectedRows.length,
      rejectedRows,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Upload operation failed" }, { status: 500 });
  }
}
