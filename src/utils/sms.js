/**
 * Sends login OTPs by SMS. Pick a provider with SMS_PROVIDER and fill in its keys:
 *
 *   msg91    MSG91_AUTH_KEY, MSG91_TEMPLATE_ID (a DLT-approved OTP template with ##OTP##)
 *   fast2sms FAST2SMS_API_KEY (uses the "otp" route)
 *   twilio   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (a number or messaging service SID)
 *
 * Without SMS settings, codes are only logged to the console (fine for development, not for real users).
 * `phone` is always the 10 local digits; the +91 country code is added here.
 */

const provider = () => String(process.env.SMS_PROVIDER || '').trim().toLowerCase();

const REQUIRED_KEYS = {
  msg91: ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'],
  fast2sms: ['FAST2SMS_API_KEY'],
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']
};

const isSmsConfigured = () => {
  const keys = REQUIRED_KEYS[provider()];
  return !!keys && keys.every((k) => !!process.env[k]);
};

/** Reads a provider response and throws with its message when the SMS was not accepted. */
const readResponse = async (response, accepted) => {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { message: text };
  }
  if (!response.ok || !accepted(body)) {
    const detail = body.message || body.error || body.type || text || response.statusText;
    throw new Error(`${provider()} rejected the SMS (${response.status}): ${Array.isArray(detail) ? detail.join(', ') : detail}`);
  }
  return body;
};

const senders = {
  msg91: async (phone, otp, minutes) => {
    const params = new URLSearchParams({
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${phone}`,
      otp,
      otp_expiry: String(minutes)
    });
    const response = await fetch(`https://control.msg91.com/api/v5/otp?${params}`, {
      method: 'POST',
      headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ OTP: otp })
    });
    await readResponse(response, (b) => b.type === 'success');
  },

  fast2sms: async (phone, otp) => {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'otp', variables_values: otp, numbers: phone })
    });
    await readResponse(response, (b) => b.return === true);
  },

  twilio: async (phone, otp, minutes) => {
    const appName = process.env.APP_NAME || 'Rotaract Clubs';
    const from = process.env.TWILIO_FROM;
    const form = new URLSearchParams({
      To: `+91${phone}`,
      Body: `${otp} is your ${appName} login code. It expires in ${minutes} minutes. Do not share it with anyone.`
    });
    form.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    await readResponse(response, (b) => !!b.sid);
  }
};

const sendOtpSms = async (phone, otp, minutes) => {
  const send = senders[provider()];
  if (!send) throw new Error(`Unknown SMS_PROVIDER "${provider()}"`);
  await send(phone, otp, minutes);
};

module.exports = {
  isSmsConfigured,
  sendOtpSms
};
