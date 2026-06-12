export function normalizePhoneNumber(phone: string): string {
  // Remove all spaces, +, dashes
  let cleaned = phone.replace(/[\s\+\-]/g, "");
  
  // If it's a 10-digit number, prepend 91 for India
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    cleaned = "91" + cleaned;
  }
  
  return cleaned;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.error("WhatsApp credentials not fully configured in env.");
    return false;
  }

  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "text",
      text: {
        preview_url: true,
        body: message,
      },
    };

    console.log(`Sending WhatsApp message to ${normalizedPhone}: "${message}"`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Meta WhatsApp Cloud API error response:", data);
      return false;
    }

    console.log("WhatsApp message sent successfully:", data);
    return true;
  } catch (error) {
    console.error("Exception caught in sendWhatsAppMessage:", error);
    return false;
  }
}

interface PaymentLinkDetails {
  gameName: string;
  date: string;
  startTime: string;
  price: number;
  link: string;
}

export async function sendBookingPaymentLink(phone: string, details: PaymentLinkDetails): Promise<boolean> {
  const message = `🎾 *Akshar Game Zone* 🎾\n\nYour booking request for *${details.gameName}* is received!\n📅 Date: ${details.date}\n⏰ Time: ${details.startTime}\n💰 Price: ₹${details.price}\n\nComplete your payment here to confirm: ${details.link}\n\n_Note: This link will expire in 10-15 minutes and the slot will be released._`;
  return sendWhatsAppMessage(phone, message);
}

interface BookingDetails {
  gameName: string;
  court: string;
  date: string;
  startTime: string;
  endTime: string;
  playersCount: number;
}

export async function sendBookingConfirmation(phone: string, booking: BookingDetails): Promise<boolean> {
  const message = `🎉 *Booking Confirmed!* 🎉\n\nAkshar Game Zone booking successful:\n🎾 Game: *${booking.gameName}*\n🏟️ Court: *${booking.court}*\n📅 Date: ${booking.date}\n⏰ Time: ${booking.startTime} - ${booking.endTime}\n👥 Players: ${booking.playersCount}\n\nSee you at the turf! Please reach 10 mins before your slot.`;
  return sendWhatsAppMessage(phone, message);
}

export async function sendBookingFailed(phone: string, reason: string): Promise<boolean> {
  const message = `⚠️ *Booking Error* ⚠️\n\nWe encountered an issue confirming your booking: ${reason}.\n\nOur team is reviewing this and will contact you shortly to resolve it or process a refund.`;
  return sendWhatsAppMessage(phone, message);
}
