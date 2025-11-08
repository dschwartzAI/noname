/**
 * Email Service - Resend Integration
 *
 * Handles all email sending via Resend API (using HTTP fetch for Cloudflare Workers compatibility)
 */

export interface SendInviteEmailParams {
  to: string;
  inviterName: string;
  inviteToken: string;
  appUrl: string;
}

export async function sendOwnerInviteEmail(
  params: SendInviteEmailParams,
  resendApiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const inviteUrl = `${params.appUrl}/signup/${params.inviteToken}`;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #ffffff;
                border-radius: 8px;
                padding: 40px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 {
                color: #1a1a1a;
                font-size: 24px;
                margin-bottom: 20px;
              }
              .button {
                display: inline-block;
                background: #000000;
                color: #ffffff;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
                font-weight: 600;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eeeeee;
                font-size: 14px;
                color: #666;
              }
              .link {
                color: #666;
                font-size: 14px;
                word-break: break-all;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>You're invited to create your coaching app! 🎉</h1>

              <p>Hi there,</p>

              <p><strong>${params.inviterName}</strong> has invited you to set up your own white-label coaching platform powered by SoloOS.</p>

              <p>With your new app, you'll be able to:</p>
              <ul>
                <li>Create AI-powered coaching experiences for your clients</li>
                <li>Manage your community and client relationships</li>
                <li>Deliver courses and content through your Academy</li>
                <li>Customize your branding and domain</li>
              </ul>

              <p>Click the button below to get started:</p>

              <a href="${inviteUrl}" class="button">Accept Invite & Create Your App</a>

              <div class="footer">
                <p>Or copy and paste this link into your browser:</p>
                <p class="link">${inviteUrl}</p>
                <p>This invitation will expire in 7 days.</p>
              </div>
            </div>
          </body>
        </html>
      `;

    // Use Resend HTTP API directly (compatible with Cloudflare Workers)
    // Using verified custom domain: toolchat.ai
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SoloOS <noreply@toolchat.ai>',
        to: [params.to],
        subject: `${params.inviterName} has invited you to create your coaching app`,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('❌ Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return {
        success: false,
        error: errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log('✅ Invite email sent:', data.id);
    return { success: true };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
