import { env } from '../config/env.js';

// Twilio client - initialized lazily
let twilioClient = null;

async function getTwilioClient() {
  if (!twilioClient && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    const twilio = await import('twilio');
    twilioClient = twilio.default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Send an SMS via Twilio
 */
export async function sendSMS(to, body) {
  const client = await getTwilioClient();

  if (!client) {
    console.log(`[SMS-DEV] To: ${to} | Message: ${body}`);
    return { success: true, dev: true, sid: 'dev-' + Date.now() };
  }

  try {
    const message = await client.messages.create({
      body,
      from: env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`[SMS] Sent to ${to}: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('[SMS] Send failed:', error.message);
    throw error;
  }
}

/**
 * Send OTP verification code
 */
export async function sendVerificationCode(phone) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await sendSMS(phone, `Your OpenRide verification code is: ${code}. Valid for 10 minutes.`);

  return code;
}

/**
 * Send ride status SMS to passenger (fallback when push fails)
 */
export async function sendRideStatusSMS(phone, status, details = {}) {
  const messages = {
    matched: `OpenRide: Your driver ${details.driverName} is on the way! ${details.vehicleInfo}. ETA: ${details.eta} min.`,
    arriving: `OpenRide: Your driver has arrived at the pickup location.`,
    completed: `OpenRide: Ride complete! Fare: $${details.fare}. Thank you for riding with OpenRide!`,
    cancelled: `OpenRide: Your ride has been cancelled. ${details.reason || ''}`,
  };

  const body = messages[status] || `OpenRide: Ride status update - ${status}`;
  return sendSMS(phone, body);
}

/**
 * Send emergency alert SMS
 */
export async function sendEmergencyAlert(contacts, rideDetails) {
  const message = `EMERGENCY ALERT from OpenRide: ${rideDetails.userName} has triggered an SOS during a ride. ` +
    `Current location: ${rideDetails.location}. Ride ID: ${rideDetails.rideId}. ` +
    `Please check on them or call emergency services.`;

  const results = await Promise.allSettled(
    contacts.map(contact => sendSMS(contact.phone, message))
  );

  return results.map((r, i) => ({
    contact: contacts[i].name,
    sent: r.status === 'fulfilled',
  }));
}
