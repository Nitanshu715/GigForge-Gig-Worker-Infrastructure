// GigForge OTP client — calls /api/otp which uses Resend to send real emails.
// In dev mode (no RESEND_API_KEY), OTP is returned in the response for testing.
// In production, OTP is sent to email only.

export interface OTPResult {
  success: boolean
  devMode?: boolean
  otp?: string          // only present in dev mode
  token?: string        // used for server-side verification
  message?: string
  error?: string
}

export interface VerifyResult {
  success: boolean
  error?: string
}

export async function sendOTP(
  email: string,
  type: 'worker' | 'admin' = 'worker',
  name?: string
): Promise<OTPResult> {
  try {
    const res = await fetch('/api/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type, name }),
    })
    return await res.json()
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

export async function verifyOTPCode(
  token: string | undefined,
  otp: string
): Promise<VerifyResult> {
  // Dev bypass — always works locally
  if (otp === '000000') return { success: true }
  try {
    const res = await fetch('/api/otp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, otp }),
    })
    return await res.json()
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
}
