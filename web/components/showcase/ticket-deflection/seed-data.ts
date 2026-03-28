import type { KnowledgeArticle, Ticket } from "./store";

// ── Knowledge base articles ────────────────────────────────────────────────

export const SEED_ARTICLES: KnowledgeArticle[] = [
  {
    id: "kb-1",
    title: "How to Reset Your Password",
    content:
      "To reset your password, go to the login page and click 'Forgot Password'. Enter your email address and we will send you a reset link. The link expires in 24 hours. If you do not receive the email, check your spam folder or contact support.",
    tags: ["password", "reset", "login", "account", "authentication"],
    category: "AccountIssue",
  },
  {
    id: "kb-2",
    title: "Account Locked After Too Many Failed Logins",
    content:
      "Your account is automatically locked after 5 consecutive failed login attempts to protect against unauthorized access. The lockout lasts 15 minutes. After 15 minutes, try logging in again with your correct credentials. If you have forgotten your password, use the password reset flow instead.",
    tags: ["account", "locked", "lockout", "login", "failed", "security"],
    category: "AccountIssue",
  },
  {
    id: "kb-3",
    title: "Understanding Your Monthly Invoice",
    content:
      "Your invoice is generated on the first of each month and covers usage from the previous billing period. It includes a line-item breakdown of API calls, storage, and any add-on subscriptions. You can download past invoices from the Billing section in your account settings. Payment is due within 30 days of the invoice date.",
    tags: ["billing", "invoice", "payment", "subscription", "charge"],
    category: "Bug",
  },
  {
    id: "kb-4",
    title: "Updating or Canceling Your Subscription",
    content:
      "To update your subscription plan, navigate to Settings > Billing > Change Plan. Upgrades take effect immediately and you are charged a prorated amount. Downgrades take effect at the end of the current billing cycle. To cancel, click 'Cancel Subscription' and follow the confirmation steps. You retain access until the end of the period you have paid for.",
    tags: ["billing", "subscription", "cancel", "upgrade", "downgrade", "plan"],
    category: "Bug",
  },
  {
    id: "kb-5",
    title: "API Authentication and API Keys",
    content:
      "All API requests must include your API key in the Authorization header as a Bearer token. You can generate and revoke API keys from Settings > API Keys. Each key can be scoped to specific permissions. Never share your API key publicly or commit it to source control. If a key is compromised, revoke it immediately and generate a new one.",
    tags: ["api", "key", "authentication", "bearer", "token", "authorization"],
    category: "HowTo",
  },
  {
    id: "kb-6",
    title: "Common API Error Codes Explained",
    content:
      "400 Bad Request: your request payload is malformed — check the JSON structure and required fields. 401 Unauthorized: your API key is missing or invalid. 403 Forbidden: your API key does not have permission for this operation. 404 Not Found: the resource ID does not exist. 429 Too Many Requests: you have exceeded the rate limit — see the Retry-After header. 500 Internal Server Error: a server-side issue — retry after a brief delay.",
    tags: ["api", "error", "400", "401", "403", "404", "429", "500", "status", "code"],
    category: "Bug",
  },
  {
    id: "kb-7",
    title: "API Rate Limits and How to Handle Them",
    content:
      "The API enforces rate limits on a per-key basis: 1000 requests per minute on the standard plan and 5000 on the enterprise plan. When you exceed the limit, the API responds with HTTP 429 and includes a Retry-After header indicating how many seconds to wait. Implement exponential backoff in your client code to handle bursts gracefully. Contact support to discuss higher limits if your use case requires them.",
    tags: ["rate", "limit", "throttle", "429", "api", "retry", "backoff"],
    category: "HowTo",
  },
  {
    id: "kb-8",
    title: "Getting Started with Webhooks",
    content:
      "Webhooks allow you to receive real-time notifications when events occur in your account. To configure a webhook, go to Settings > Webhooks > Add Endpoint and enter a publicly accessible HTTPS URL. Select the event types you want to receive. Each request includes a signature header so you can verify the payload. Respond with HTTP 200 within 5 seconds to acknowledge receipt; failed deliveries are retried up to 3 times.",
    tags: ["webhook", "integration", "notification", "event", "setup", "endpoint"],
    category: "HowTo",
  },
  {
    id: "kb-9",
    title: "Connecting Third-Party Integrations",
    content:
      "To connect an integration (Slack, GitHub, Jira, etc.), navigate to Settings > Integrations and click the integration name. You will be redirected to the third-party OAuth flow. Grant the requested permissions and you will be redirected back. The integration will appear as 'Connected'. You can disconnect at any time by clicking 'Revoke Access'. Some integrations require admin permissions on the third-party platform.",
    tags: ["integration", "slack", "github", "jira", "oauth", "connect", "setup"],
    category: "HowTo",
  },
  {
    id: "kb-10",
    title: "Deployment Failures and Rollback",
    content:
      "If a deployment fails, the system automatically rolls back to the last successful deployment. You will receive an email and an in-app notification with the error logs. Common causes include: failed health checks, out-of-memory errors, or configuration validation failures. Review the deployment log in the dashboard to diagnose the issue. If the rollback itself fails, contact support immediately with the deployment ID.",
    tags: ["deploy", "deployment", "failure", "rollback", "error", "health", "check"],
    category: "Bug",
  },
  {
    id: "kb-11",
    title: "How to Submit a Feature Request",
    content:
      "We welcome feature requests from our users. To submit one, click 'Feedback' in the main navigation or email feedback@example.com with the subject 'Feature Request'. Describe the problem you are trying to solve, not just the solution. Include your use case and how many users it affects. Feature requests are reviewed by the product team and added to the roadmap based on demand and alignment with product strategy.",
    tags: ["feature", "request", "feedback", "roadmap", "suggestion", "idea"],
    category: "FeatureRequest",
  },
  {
    id: "kb-12",
    title: "Exporting Your Data",
    content:
      "You can export all of your account data at any time from Settings > Data Export. Exports are available in JSON and CSV formats. Depending on the volume of data, export files may take a few minutes to generate; you will receive an email with a download link when the export is ready. Download links expire after 48 hours. If you need data exported in a specific format for compliance reasons, contact support.",
    tags: ["export", "data", "download", "csv", "json", "backup", "compliance"],
    category: "HowTo",
  },
  {
    id: "kb-13",
    title: "Two-Factor Authentication Setup",
    content:
      "Two-factor authentication (2FA) adds an extra layer of security to your account. To enable it, go to Settings > Security > Enable 2FA. You can use an authenticator app (Google Authenticator, Authy) or receive codes via SMS. Save your backup codes in a secure location — you will need them if you lose access to your authentication device. 2FA is required for accounts with admin or billing permissions.",
    tags: ["2fa", "two-factor", "authentication", "security", "authenticator", "sms", "otp"],
    category: "AccountIssue",
  },
];

// ── Pre-existing tickets at various statuses ───────────────────────────────

export const SEED_TICKETS: Ticket[] = [
  {
    id: "ticket-seed-1",
    title: "Cannot log in — keeps saying password is wrong",
    description:
      "I am certain my password is correct but the login page keeps rejecting it. I have tried copy-pasting it to make sure there are no typos.",
    category: "AccountIssue",
    severity: "High",
    status: "AutoResolved",
    resolution:
      "This is likely due to account lockout after multiple failed login attempts. Your account locks for 15 minutes after 5 consecutive failures. Please wait and try again, or use the password reset flow.",
    createdAt: "2026-03-15T09:12:00Z",
  },
  {
    id: "ticket-seed-2",
    title: "API returning 429 errors intermittently",
    description:
      "Our integration is hitting 429 Too Many Requests errors during peak hours. We are on the standard plan and sending about 800 requests per minute.",
    category: "Bug",
    severity: "High",
    status: "AutoResolved",
    resolution:
      "You are approaching the 1000 req/min rate limit on the standard plan. Implement exponential backoff and consider upgrading to the enterprise plan for 5000 req/min. The Retry-After header in the 429 response tells you exactly how long to wait.",
    createdAt: "2026-03-15T10:30:00Z",
  },
  {
    id: "ticket-seed-3",
    title: "Where can I find my invoices?",
    description:
      "I need to download my invoice for February for accounting purposes but I cannot find where to access past invoices in the dashboard.",
    category: "HowTo",
    severity: "Low",
    status: "AutoResolved",
    resolution:
      "Past invoices are available in Settings > Billing. Each invoice shows a full line-item breakdown and can be downloaded as a PDF. Invoices are generated on the first of each month.",
    createdAt: "2026-03-15T11:05:00Z",
  },
  {
    id: "ticket-seed-4",
    title: "Feature request: bulk export via API",
    description:
      "We have thousands of records and the UI export is too slow. It would be great to have a bulk export endpoint in the API so we can automate this.",
    category: "FeatureRequest",
    severity: "Medium",
    status: "Escalated",
    resolution: null,
    createdAt: "2026-03-15T13:22:00Z",
  },
  {
    id: "ticket-seed-5",
    title: "Deployment failed with health check error",
    description:
      "Our deployment pipeline failed during the health check phase. The error log says 'upstream connect error or disconnect/reset before headers'. This is blocking our release.",
    category: "Bug",
    severity: "Critical",
    status: "Escalated",
    resolution: null,
    createdAt: "2026-03-16T08:15:00Z",
  },
  {
    id: "ticket-seed-6",
    title: "How do I set up webhook notifications?",
    description:
      "I want to receive a notification in our Slack channel whenever a certain event fires. I see there is a webhooks section but I am not sure how to configure it.",
    category: "HowTo",
    severity: "Low",
    status: "AutoResolved",
    resolution:
      "Go to Settings > Webhooks > Add Endpoint and enter your Slack incoming webhook URL. Select the event types you need. Each payload is signed with a secret so you can verify authenticity. Slack incoming webhooks accept the standard JSON payload format.",
    createdAt: "2026-03-16T09:45:00Z",
  },
  {
    id: "ticket-seed-7",
    title: "Account locked out after password reset",
    description:
      "I just reset my password but now the account is locked and I cannot log in with the new password either. I have tried multiple times.",
    category: "AccountIssue",
    severity: "High",
    status: "AutoResolved",
    resolution:
      "Account lockout can occur even after a password reset if multiple failed attempts have been made. Wait 15 minutes for the lockout to expire, then log in with your new password. Do not retry — additional failures restart the lockout timer.",
    createdAt: "2026-03-16T11:00:00Z",
  },
  {
    id: "ticket-seed-8",
    title: "Request: dark mode for the dashboard",
    description:
      "The dashboard is very bright and our team works in a low-light environment. A dark mode option would significantly improve our experience.",
    category: "FeatureRequest",
    severity: "Low",
    status: "Escalated",
    resolution: null,
    createdAt: "2026-03-17T10:00:00Z",
  },
  {
    id: "ticket-seed-9",
    title: "Getting 401 error on all API requests",
    description:
      "All our API requests suddenly started returning 401 Unauthorized. The API key has not changed and was working fine yesterday.",
    category: "Bug",
    severity: "Critical",
    status: "AutoResolved",
    resolution:
      "A 401 error means the API key is missing, expired, or revoked. Check that you are sending it as a Bearer token in the Authorization header. If the key was recently regenerated, update all services using the old key. Verify the key is active in Settings > API Keys.",
    createdAt: "2026-03-17T14:30:00Z",
  },
  {
    id: "ticket-seed-10",
    title: "How to enable two-factor authentication?",
    description:
      "Our security team requires 2FA for all accounts. I have looked through the settings but cannot find where to enable it.",
    category: "HowTo",
    severity: "Medium",
    status: "AutoResolved",
    resolution:
      "2FA is available under Settings > Security > Enable 2FA. You can use any TOTP-compatible authenticator app or receive codes via SMS. Make sure to save your backup codes securely. 2FA is mandatory for all admin and billing accounts.",
    createdAt: "2026-03-18T08:00:00Z",
  },
];
