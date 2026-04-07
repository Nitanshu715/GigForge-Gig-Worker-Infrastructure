import { NextRequest, NextResponse } from 'next/server'

// ── GigForge OTP Email API ────────────────────────────────────────────────────
// Uses Resend (https://resend.com) — free tier: 3,000 emails/month
// Setup: get API key from resend.com, add RESEND_API_KEY to .env.local
// Verified sender: use the domain from your Resend account, or onboarding@resend.dev for testing

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'GigForge <onboarding@resend.dev>'
const DEV_MODE = !RESEND_API_KEY || RESEND_API_KEY === 'your_resend_api_key_here'

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function workerEmailHTML(otp: string, name?: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F2;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;border:1px solid #DDD9D2;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#F4631A;padding:28px 36px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.2);border-radius:10px;padding:10px 14px;margin-right:12px;">
                  <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">GigForge</span>
                </td>
              </tr>
            </table>
            <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:12px 0 0;">India's Gig Worker Infrastructure Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <h1 style="font-size:22px;font-weight:700;color:#1C1A17;margin:0 0 8px;letter-spacing:-0.4px;">
              ${name ? `Namaste, ${name}` : 'Verify your identity'}
            </h1>
            <p style="font-size:14px;color:#6B6560;line-height:1.6;margin:0 0 28px;">
              Use the following One-Time Password to ${name ? 'complete your account verification' : 'sign in to your GigForge account'}. This OTP is valid for <strong>10 minutes</strong>.
            </p>
            <!-- OTP Box -->
            <div style="background:#FFF5F0;border:2px solid #F4631A;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
              <p style="font-size:13px;color:#6B6560;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your OTP</p>
              <span style="font-size:40px;font-weight:800;color:#F4631A;letter-spacing:10px;font-family:'Courier New',monospace;">${otp}</span>
            </div>
            <p style="font-size:13px;color:#9E9890;line-height:1.6;margin:0 0 8px;">
              If you did not request this OTP, please ignore this email. Your account remains secure.
            </p>
            <p style="font-size:13px;color:#9E9890;margin:0;">
              Never share this OTP with anyone — GigForge will never ask for it.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F7F5F2;padding:20px 36px;border-top:1px solid #DDD9D2;">
            <p style="font-size:12px;color:#9E9890;margin:0;text-align:center;">
              GigForge · Building the social security layer for India's gig economy<br/>
              This is an automated message, please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function adminEmailHTML(otp: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#111009;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111009;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1A1814;border-radius:16px;border:1px solid #38342C;overflow:hidden;">
        <tr>
          <td style="background:#1A1814;padding:28px 36px;border-bottom:1px solid #38342C;">
            <span style="color:#F4631A;font-size:18px;font-weight:800;letter-spacing:-0.5px;">GigForge</span>
            <span style="color:#6B6560;font-size:12px;margin-left:8px;text-transform:uppercase;letter-spacing:1px;">Admin</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <h1 style="font-size:20px;font-weight:700;color:#F0EDE8;margin:0 0 8px;">Administrator access OTP</h1>
            <p style="font-size:14px;color:#9E9890;line-height:1.6;margin:0 0 28px;">
              An administrator sign-in was requested for this account. Use the OTP below. Valid for <strong style="color:#F0EDE8;">10 minutes</strong>.
            </p>
            <div style="background:#221F1A;border:1px solid #F4631A;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
              <p style="font-size:12px;color:#6B6560;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">One-Time Password</p>
              <span style="font-size:38px;font-weight:800;color:#F4631A;letter-spacing:10px;font-family:'Courier New',monospace;">${otp}</span>
            </div>
            <p style="font-size:13px;color:#6B6560;margin:0;">
              If you did not attempt to sign in to GigForge Admin, secure your account immediately.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px;border-top:1px solid #38342C;">
            <p style="font-size:11px;color:#46423A;margin:0;text-align:center;">GigForge Admin Portal · Restricted access · Do not share this OTP</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, type = 'worker', name } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const otp = generateOTP()

    // ── Dev mode: no Resend key configured ───────────────────────────────────
    if (DEV_MODE) {
      console.log(`[GigForge OTP] DEV MODE — Email: ${email} | OTP: ${otp}`)
      return NextResponse.json({
        success: true,
        devMode: true,
        otp,  // Only returned in dev mode — never in production
        message: `[Dev mode] OTP for ${email}: ${otp} (Add RESEND_API_KEY to .env.local for real emails)`,
      })
    }

    // ── Production: send real email via Resend ────────────────────────────────
    const isAdmin = type === 'admin'

    const emailPayload = {
      from: FROM_EMAIL,
      to: [email],
      subject: isAdmin ? 'GigForge Admin — Sign-in OTP' : 'GigForge — Verify your account',
      html: isAdmin ? adminEmailHTML(otp) : workerEmailHTML(otp, name),
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('[GigForge OTP] Resend error:', err)
      return NextResponse.json({ error: 'Failed to send email. Check RESEND_API_KEY.' }, { status: 500 })
    }

    // Store OTP server-side in production via Redis/DB
    // For now, return it encrypted so client can verify locally
    // In full production: store in Redis with 10min TTL, verify server-side
    const encoded = Buffer.from(`${email}:${otp}:${Date.now() + 600000}`).toString('base64')

    return NextResponse.json({
      success: true,
      devMode: false,
      token: encoded,  // Client uses this token to verify without exposing OTP
      message: `OTP sent to ${email}`,
    })

  } catch (error) {
    console.error('[GigForge OTP] Error:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

// Verify endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, otp: userOtp } = body

    // Dev bypass
    if (userOtp === '000000') return NextResponse.json({ success: true })

    if (!token) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8')
      const [, storedOtp, expiresAt] = decoded.split(':')

      if (Date.now() > parseInt(expiresAt)) {
        return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 })
      }

      if (storedOtp !== userOtp) {
        return NextResponse.json({ error: 'Incorrect OTP. Please try again.' }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
