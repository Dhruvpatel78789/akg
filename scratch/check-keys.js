const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

console.log("RAZORPAY_KEY_ID prefix:", process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 8) : "NOT_FOUND");
process.exit(0);
