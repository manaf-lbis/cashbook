import { Resend } from 'resend';
import { ENV } from '../config/env';

export class EmailService {
  private static resendClient: Resend | null = null;

  private static getClient(): Resend {
    if (!this.resendClient) {
      this.resendClient = new Resend(ENV.RESEND_API_KEY);
    }
    return this.resendClient;
  }

  /**
   * Sends a 6-digit Login OTP to the user's email via Resend
   * and always logs the OTP to the console for testing and auditing.
   */
  static async sendLoginOtp(email: string, otp: string): Promise<{ success: boolean; id?: string; error?: string }> {
    const formattedEmail = email.toLowerCase().trim();

    // 1. Prominently log to console for development, testing, and debugging
    console.log('\n======================================================');
    console.log(`🔐 [AUTH OTP VERIFICATION]`);
    console.log(`📧 Target Email : ${formattedEmail}`);
    console.log(`🔑 Secure OTP   : [ ${otp} ]`);
    console.log(`⏳ Valid For   : 10 Minutes`);
    console.log(`🕒 Timestamp    : ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    console.log('======================================================\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Cashbook Login Verification Code</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 30px 15px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 35px 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">
                  Cashbook <span style="background-color: #2563eb; font-size: 11px; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">PRO</span>
                </h1>
                <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 13px;">Shop Ledger & Terminal Authentication</p>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding: 35px 30px;">
                <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">Sign in to your Cashbook account</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0;">
                  Use the one-time verification code below to sign in securely to your cash book terminal. This code is valid for <strong>10 minutes</strong>.
                </p>
                
                <!-- OTP Box -->
                <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 25px;">
                  <div style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #1e40af; font-family: monospace;">
                    ${otp}
                  </div>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Do not share this one-time code with anyone</p>
                </div>

                <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 10px 0;">
                  If you didn't request this verification code, you can safely ignore this email. Someone may have entered your email address by mistake.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center;">
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                  Cashbook PRO &copy; ${new Date().getFullYear()} • Secure Shop Financial Ledgers
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    try {
      const resend = this.getClient();
      const response = await resend.emails.send({
        from: ENV.EMAIL_FROM || 'Cashbook Pro <onboarding@resend.dev>',
        to: [formattedEmail],
        subject: `Your Cashbook Verification Code: ${otp}`,
        html: htmlContent,
      });

      if (response.error) {
        console.warn(`[Resend Notice] Resend API returned error:`, response.error);
        return { success: false, error: response.error.message };
      }

      console.log(`[Resend Success] Email sent successfully to ${formattedEmail}. Resend Email ID:`, response.data?.id);
      return { success: true, id: response.data?.id };
    } catch (err: any) {
      console.warn(`[Resend Error] Could not deliver email via Resend API:`, err?.message || err);
      // Return gracefully with error message so login flow doesn't crash
      return { success: false, error: err?.message || 'Email delivery failed' };
    }
  }
}
