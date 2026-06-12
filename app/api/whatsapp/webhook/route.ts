import { NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// WhatsApp webhook verification (GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "akshar_verify_token_123";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp Webhook verified successfully.");
      return new Response(challenge, { status: 200 });
    }
  }

  return new Response("Forbidden", { status: 403 });
}

// Inbound message handler (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Inbound WhatsApp payload:", JSON.stringify(body));

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (message) {
      const from = message.from; // Sender's phone number
      const text = message.text?.body?.trim()?.toLowerCase() || "";

      if (text) {
        let reply = "Hello! Welcome to *Akshar Game Zone*. 🎾\n\nTo book a court, please share the game name, date, start time, and number of players.\n\nType *help* to see all commands.";

        if (text === "book" || text === "booking") {
          reply = "Let's get you booked! Please share the following details:\n1️⃣ Game Name (e.g. Pickleball, Box Cricket)\n2️⃣ Date (YYYY-MM-DD)\n3️⃣ Start Time (e.g. 18:00)\n4️⃣ Number of players";
        } else if (text === "my booking" || text === "my bookings") {
          const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
          reply = `You can view all your active sessions and bookings by logging into your Player Dashboard at: ${appUrl}/player/dashboard`;
        } else if (text === "help") {
          reply = "List of available commands:\n👉 *book* / *booking* - Start booking a slot\n👉 *my booking* - Check status of your bookings\n👉 *help* - Display this help menu";
        }

        await sendWhatsAppMessage(from, reply);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("WhatsApp Webhook POST failed:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
