import nodemailer from 'nodemailer'

const SMTP_USER = process.env.SMTP_USER || 'ryumedha@gmail.com'
const SMTP_PASS = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS

function getTransporter() {
  if (!SMTP_PASS) {
    console.warn('Email warning: Neither GMAIL_APP_PASSWORD nor SMTP_PASS is configured in .env. Emails will log in console.')
    return null
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  })
}

export interface PaymentEmailOptions {
  to: string
  displayName?: string
  planType: 'monthly' | 'yearly'
  razorpaySubId?: string
  amountFormatted?: string
  periodEnd?: string
}

export async function sendPaymentConfirmationEmail(options: PaymentEmailOptions): Promise<boolean> {
  const { to, displayName, planType, razorpaySubId, amountFormatted, periodEnd } = options
  const name = displayName || 'Valued User'
  const planName = planType === 'yearly' ? 'Yearly Plan (₹399/yr)' : 'Monthly Plan (₹39/mo)'
  const price = amountFormatted || (planType === 'yearly' ? '₹399' : '₹39')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 580px; background: #ffffff; margin: 0 auto; padding: 32px; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { font-size: 24px; font-weight: 800; color: #4f46e5; text-decoration: none; }
          .badge { display: inline-block; background-color: #e0e7ff; color: #4338ca; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 12px; margin-top: 8px; }
          .content { font-size: 15px; line-height: 1.6; }
          .receipt-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .receipt-row { flex: 1; display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 14px; }
          .receipt-row:last-child { border-bottom: none; font-weight: 700; }
          .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          .button { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 700; padding: 12px 28px; border-radius: 9999px; text-decoration: none; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Ryu Medha</div>
            <div class="badge">Auto-Pay Mandate Confirmed</div>
          </div>
          <div class="content">
            <p>Dear <strong>${name}</strong>,</p>
            <p>Thank you for setting up your Auto-Pay subscription with <strong>Ryu Medha</strong>! Your payment mandate has been successfully authorized and your workspace is fully unlocked.</p>
            
            <div class="receipt-box">
              <div class="receipt-row">
                <span>Selected Plan:</span>
                <span><strong>${planName}</strong></span>
              </div>
              <div class="receipt-row">
                <span>Charged Today:</span>
                <span><strong>₹0 (Mandate Authorization)</strong></span>
              </div>
              <div class="receipt-row">
                <span>Recurring Billing Rate:</span>
                <span><strong>${price}</strong></span>
              </div>
              ${razorpaySubId ? `
              <div class="receipt-row">
                <span>Razorpay Subscription ID:</span>
                <span style="font-family: monospace;">${razorpaySubId}</span>
              </div>
              ` : ''}
              ${periodEnd ? `
              <div class="receipt-row">
                <span>Next Renewal Date:</span>
                <span>${periodEnd}</span>
              </div>
              ` : ''}
            </div>

            <p>You can manage your subscription, view billing history, or cancel anytime with 1-click from your account settings.</p>
            
            <div style="text-align: center;">
              <a href="https://ryumedha.in/dashboard/whatsapp-bot" class="button">Go to Dashboard</a>
            </div>
          </div>

          <div class="footer">
            <p>This payment email was sent from official account <strong>ryumedha@gmail.com</strong>.</p>
            <p>Need help? Contact support at <a href="mailto:ryumedha@gmail.com">ryumedha@gmail.com</a></p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    const transporter = getTransporter()
    if (!transporter) {
      console.log(`[Email Log] Payment confirmation email to ${to}: ${planName}`)
      return true
    }

    await transporter.sendMail({
      from: `"Ryu Medha" <${SMTP_USER}>`,
      to,
      subject: `Payment Mandate Confirmed — Ryu Medha ${planType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
      html
    })

    console.log(`Payment confirmation email sent successfully to ${to}`)
    return true
  } catch (err) {
    console.error('Failed to send payment confirmation email:', err)
    return false
  }
}

export interface InviteEmailOptions {
  to: string
  displayName?: string
  code: string
  durationType: '1_year' | 'lifetime'
}

export async function sendInviteAccessEmail(options: InviteEmailOptions): Promise<boolean> {
  const { to, displayName, code, durationType } = options
  const name = displayName || 'Valued User'
  const durationLabel = durationType === 'lifetime' ? 'Free Lifetime Access' : 'Free 1-Year Access'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 580px; background: #ffffff; margin: 0 auto; padding: 32px; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 2px solid #a855f7; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { font-size: 24px; font-weight: 800; color: #7e22ce; text-decoration: none; }
          .badge { display: inline-block; background-color: #f3e8ff; color: #7e22ce; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 12px; margin-top: 8px; }
          .content { font-size: 15px; line-height: 1.6; }
          .receipt-box { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #d8b4fe; font-size: 14px; }
          .receipt-row:last-child { border-bottom: none; font-weight: 700; }
          .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          .button { display: inline-block; background-color: #7e22ce; color: #ffffff !important; font-weight: 700; padding: 12px 28px; border-radius: 9999px; text-decoration: none; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Ryu Medha</div>
            <div class="badge">Invite Code Redeemed Successfully</div>
          </div>
          <div class="content">
            <p>Dear <strong>${name}</strong>,</p>
            <p>Congratulations! Your invite code <strong>${code}</strong> has been successfully redeemed on <strong>Ryu Medha</strong>.</p>
            
            <div class="receipt-box">
              <div class="receipt-row">
                <span>Access Plan Granted:</span>
                <span><strong>${durationLabel}</strong></span>
              </div>
              <div class="receipt-row">
                <span>Redeemed Code:</span>
                <span style="font-family: monospace;"><strong>${code}</strong></span>
              </div>
              <div class="receipt-row">
                <span>Total Amount Charged:</span>
                <span><strong>₹0 Free Benefit</strong></span>
              </div>
            </div>

            <p>Enjoy full access to your Ryu Medha dashboard, study timers, attendance tracking, and WhatsApp bot commands!</p>
            
            <div style="text-align: center;">
              <a href="https://ryumedha.in/dashboard/whatsapp-bot" class="button">Access Your Workspace</a>
            </div>
          </div>

          <div class="footer">
            <p>This official access confirmation email was sent from <strong>ryumedha@gmail.com</strong>.</p>
            <p>Need support? Contact us at <a href="mailto:ryumedha@gmail.com">ryumedha@gmail.com</a></p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    const transporter = getTransporter()
    if (!transporter) {
      console.log(`[Email Log] Invite access email to ${to}: ${code} (${durationLabel})`)
      return true
    }

    await transporter.sendMail({
      from: `"Ryu Medha" <${SMTP_USER}>`,
      to,
      subject: `Invite Code Redeemed (${durationLabel}) — Ryu Medha`,
      html
    })

    console.log(`Invite access email sent successfully to ${to}`)
    return true
  } catch (err) {
    console.error('Failed to send invite access email:', err)
    return false
  }
}
