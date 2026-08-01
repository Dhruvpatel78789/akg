import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// Load .env.local manually for standalone script execution
if (!process.env.MONGODB_URI) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const envText = fs.readFileSync(envPath, "utf-8");
      const lines = envText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const eqIdx = trimmed.indexOf("=");
          const key = trimmed.substring(0, eqIdx).trim();
          const value = trimmed.substring(eqIdx + 1).trim();
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    console.warn("Could not read .env.local file:", err);
  }
}

// Static imports removed to prevent hoisting before process.env is configured.

// Helper CSV parser from the API routes
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

async function migrate() {
  const { connectDB } = await import("../lib/mongodb");
  const { Company } = await import("../models/Company");
  const { CompanyEmployee } = await import("../models/CompanyEmployee");

  await connectDB();
  console.log("Connected to MongoDB for CSV migration...");

  // 1. Find or create the company "Apar ind ltd"
  let company = await Company.findOne({ name: { $regex: /^Apar ind ltd$/i } });
  if (!company) {
    console.log("Company 'Apar ind ltd' not found. Creating it...");
    company = await Company.create({
      name: "Apar ind ltd",
      contactPerson: "Admin",
      contactNumber: "0000000000",
      email: "contact@apar.com",
      billingAddress: "Address",
      status: "ACTIVE",
      discountPercentage: 0
    });
    console.log(`Created company 'Apar ind ltd' with ID: ${company._id}`);
  } else {
    console.log(`Found existing company 'Apar ind ltd' with ID: ${company._id}`);
  }

  // 2. Read the CSV file
  const csvPath = path.join(process.cwd(), "pass latest.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, "utf8");
  const parsed = parseCSV(csvText);

  if (parsed.length < 2) {
    console.error("Error: CSV is empty or missing header row.");
    process.exit(1);
  }

  const headers = parsed[0].map(h => h.trim().toLowerCase());
  console.log("CSV Headers:", headers);

  const getColIndex = (name: string) => headers.indexOf(name);
  const userIdIdx = getColIndex("user_id");
  const emailIdx = getColIndex("email");
  const encPasswordIdx = getColIndex("encrypted_password");
  const fullNameIdx = getColIndex("full_name");
  const phoneIdx = getColIndex("phone");
  const passwordSetIdx = getColIndex("password_set");
  const mustChangePasswordIdx = getColIndex("must_change_password");
  const companyKeyIdx = getColIndex("company_key");

  if (userIdIdx === -1 || emailIdx === -1 || encPasswordIdx === -1 || fullNameIdx === -1 || phoneIdx === -1 || passwordSetIdx === -1) {
    console.error("Error: CSV is missing required columns. Required: user_id, email, encrypted_password, full_name, phone, password_set");
    process.exit(1);
  }

  // Hash the default password for users who have not set/changed their passwords
  const defaultPasswordHash = await bcrypt.hash("NEW1234", 10);
  
  let successCount = 0;
  let skipCount = 0;
  let aksharCount = 0;

  const idsToDelete: string[] = [];
  const emailsToDelete: string[] = [];

  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < headers.length) {
      console.log(`Skipping row ${i + 1} due to insufficient columns.`);
      skipCount++;
      continue;
    }

    const userId = row[userIdIdx];
    const email = row[emailIdx].toLowerCase().trim();
    const encryptedPassword = row[encPasswordIdx];
    const fullName = row[fullNameIdx];
    const phone = row[phoneIdx];
    const passwordSet = row[passwordSetIdx].toLowerCase().trim() === "true";
    const mustChangePassword = mustChangePasswordIdx !== -1 
      ? row[mustChangePasswordIdx].toLowerCase().trim() === "true"
      : !passwordSet; // If not set, default to true for non-password-set users
    
    // Check if the player belongs to the 'akshar' company key
    const companyKey = companyKeyIdx !== -1 ? row[companyKeyIdx].toLowerCase().trim() : "";
    if (companyKey === "akshar") {
      idsToDelete.push(userId);
      emailsToDelete.push(email);
      aksharCount++;
      continue; // Skip adding them
    }

    // Clean phone number (strip non-digits)
    const cleanPhone = phone.replace(/\D/g, "");

    // Determine password hash
    let finalPasswordHash = defaultPasswordHash;
    let finalMustChangePassword = true;

    if (passwordSet) {
      // If the player set/changed their password, retain the encrypted_password hash
      finalPasswordHash = encryptedPassword;
      finalMustChangePassword = mustChangePassword;
    } else {
      // If the player has NOT set/changed their password, use the default hash
      finalPasswordHash = defaultPasswordHash;
      finalMustChangePassword = true;
    }

    try {
      await CompanyEmployee.updateOne(
        {
          companyId: company._id,
          $or: [
            { email },
            { mobile: cleanPhone },
            { employeeId: userId }
          ]
        },
        {
          $set: {
            companyId: company._id,
            employeeId: userId,
            name: fullName,
            mobile: cleanPhone,
            email,
            passwordHash: finalPasswordHash,
            mustChangePassword: finalMustChangePassword,
            status: "ACTIVE",
            softDeleted: false
          }
        },
        { upsert: true }
      );
      successCount++;
    } catch (err: any) {
      console.error(`Error updating employee ${email}:`, err.message);
      skipCount++;
    }
  }

  // Perform deletion cleanup for any 'akshar' players that were previously imported
  if (idsToDelete.length > 0 || emailsToDelete.length > 0) {
    console.log(`Cleaning up previously imported 'akshar' players (${aksharCount} found in CSV)...`);
    const result = await CompanyEmployee.deleteMany({
      companyId: company._id,
      $or: [
        { employeeId: { $in: idsToDelete } },
        { email: { $in: emailsToDelete } }
      ]
    });
    console.log(`Deleted ${result.deletedCount} 'akshar' players from the database.`);
  }

  console.log(`\nMigration Summary:`);
  console.log(`- Successfully Migrated/Updated: ${successCount}`);
  console.log(`- Skipped 'akshar' Players: ${aksharCount}`);
  console.log(`- Skipped/Failed Rows: ${skipCount}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
