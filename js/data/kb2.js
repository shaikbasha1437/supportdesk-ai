/* Sample knowledge base for Orbitask (fictional). Part 2 of 2: integrations, troubleshooting, policies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.SD = root.SD || {}; root.SD.kb2 = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  return [
{ id: 'slack-integration', category: 'Integrations', title: 'Connect Slack', updated: '2026-09-17', keywords: ['slack', 'slack notifications', 'slash command'], body: `# Connect Slack

1. Go to **Settings > Integrations > Slack** and click **Connect**.
2. Pick your Slack workspace and approve the permissions. A Slack admin may need to approve the Orbitask app first.
3. Choose which Orbitask projects post updates to which Slack channels.

You can then create tasks with the \`/orbitask new\` slash command and get a direct message when you're assigned or mentioned.

## Slack messages stopped arriving

- Reconnect from **Settings > Integrations > Slack > Reconnect**. Tokens expire if the person who connected Slack leaves the workspace.
- Private channels need the Orbitask app to be invited: type \`/invite @Orbitask\` in the channel.
- Check the project's notification rules; muted projects don't post.` },
{ id: 'google-drive', category: 'Integrations', title: 'Google Drive and file previews', updated: '2026-06-12', keywords: ['google drive', 'google docs', 'attachments', 'file preview'], body: `# Google Drive and file previews

Attach Google Docs, Sheets and Slides to any task. Go to **Settings > Integrations > Google Drive** and sign in with Google. Each person connects their own Google account.

## Permissions

Orbitask doesn't change sharing on your Drive files. If a teammate sees **"Request access"** on an attached file, share the file with them in Google Drive.

## Previews don't load

Previews need third-party cookies for docs.google.com. If your browser blocks them, open the file in a new tab instead. Shared drives are supported, but files in a shared drive your teammate can't access won't preview.` },
{ id: 'github-integration', category: 'Integrations', title: 'Connect GitHub', updated: '2026-08-08', keywords: ['github', 'pull requests', 'commits', 'link pr'], body: `# Connect GitHub

Link pull requests and commits to tasks so status updates automatically.

1. Go to **Settings > Integrations > GitHub** and click **Install GitHub app**.
2. Choose the GitHub organisation and the repositories Orbitask may read.
3. Mention a task ID such as \`ORB-123\` in a branch name, commit message or pull request title.

When the pull request is merged, the task moves to **Done** automatically (you can turn this off per project).

## Pull requests aren't linking

- Check the repository is included in the GitHub app's repository access.
- Task IDs are case sensitive: \`ORB-123\`, not \`orb-123\`.
- GitHub Enterprise Server is supported only on the Enterprise plan.` },
{ id: 'zapier-webhooks', category: 'Integrations', title: 'Zapier and webhooks', updated: '2026-07-30', keywords: ['zapier', 'webhook', 'automation', 'make', 'n8n'], body: `# Zapier and webhooks

## Zapier

Search for **Orbitask** in Zapier to connect thousands of apps. Triggers include *New task*, *Task completed* and *New comment*. Actions include *Create task* and *Update status*. Zapier is available on Team plans and above.

## Webhooks

Business and Enterprise workspaces can add webhooks in **Settings > Developers > Webhooks**. Each webhook sends a signed JSON POST. Verify the \`X-Orbitask-Signature\` header with your signing secret. Failed deliveries are retried 5 times over 24 hours, then the webhook is paused and the Owner gets an email.

## Webhook paused

Fix the receiving endpoint so it returns a 2xx status within 10 seconds, then click **Resume** on the webhook.` },
{ id: 'api-rate-limits', category: 'Integrations', title: 'API keys and rate limits', updated: '2026-10-01', keywords: ['api', 'rate limit', '429', 'api token', 'too many requests'], body: `# API keys and rate limits

Create a personal API token from **Profile > Developer > API tokens**. Tokens have the same permissions as you. Treat them like passwords and never paste them into tickets or chat.

## Rate limits

| Plan | Requests per minute |
| --- | --- |
| Team | 120 |
| Business | 600 |
| Enterprise | 1,200 (can be raised) |

Free plans don't include API access.

When you go over the limit the API returns **HTTP 429 Too Many Requests** with a \`Retry-After\` header in seconds. Wait that long, then retry with exponential backoff. Bulk endpoints such as \`POST /v2/tasks/batch\` accept up to 100 tasks per call and count as one request.` },
{ id: 'import-tools', category: 'Integrations', title: 'Import from Jira, Trello, Asana or CSV', updated: '2026-09-03', keywords: ['import', 'migrate', 'jira', 'trello', 'asana', 'csv import'], body: `# Import from Jira, Trello, Asana or CSV

Go to **Settings > Import** and choose a source.

- **Jira Cloud** and **Trello**: sign in and pick boards or projects. Comments, attachments, assignees and due dates are imported.
- **Asana**: export a project to CSV in Asana, then upload it here.
- **CSV**: upload any CSV and map columns to Orbitask fields.

Imports run in the background and you get an email when they finish. Large imports (over 10,000 tasks) can take up to an hour.

## Import limits

Files up to 50 MB. Attachments larger than your plan's upload limit are skipped and listed in the import report. Members are matched by email address; unmatched people become guests.` },
{ id: 'sync-issues', category: 'Troubleshooting', title: 'Tasks not syncing or the app shows old data', updated: '2026-10-08', keywords: ['not syncing', 'sync', 'offline', 'mobile app', 'stale data', 'refresh'], body: `# Tasks not syncing or the app shows old data

1. Check status.orbitask.example for any ongoing incident.
2. Refresh the page or pull down to refresh in the mobile app.
3. Make sure you're on the latest app version. Versions older than 6 months stop syncing.
4. On the web, try a private window. Browser extensions such as ad blockers can block our real-time connection.
5. Sign out and sign back in.

## Offline mode

The mobile apps keep the last 30 days of your tasks offline. Changes made offline sync automatically when you're back online. If two people edit the same field while one is offline, the latest change wins and the other appears in the task history.

## Still stuck

Send us your app version (in **Profile > About**), device model and the time it happened.` },
{ id: 'notifications', category: 'Troubleshooting', title: 'Not getting email or push notifications', updated: '2026-07-14', keywords: ['notifications', 'emails not arriving', 'push', 'digest', 'unsubscribe'], body: `# Not getting email or push notifications

## Check your settings

Go to **Profile > Notifications**. You can choose instant emails, a daily digest or none, for each kind of event. Projects you muted don't send anything.

## Emails not arriving

- Check spam and add notifications@orbitask.example to your contacts.
- Company mail filters sometimes quarantine automated mail. Ask IT to allow our sending domain.
- If you clicked **Unsubscribe** in an email, turn emails back on in your notification settings.

## Push notifications on mobile

Allow notifications for Orbitask in your phone's settings and make sure **Do Not Disturb** or Focus mode isn't on. Push notifications pause while you're active on the web app, to avoid duplicates.` },
{ id: 'upload-errors', category: 'Troubleshooting', title: 'File upload errors', updated: '2026-08-25', keywords: ['upload failed', 'file too large', 'E413', 'E415', 'attachment error'], body: `# File upload errors

## Upload size limits

| Plan | Max file size |
| --- | --- |
| Free | 25 MB |
| Team | 250 MB |
| Business and Enterprise | 2 GB |

## Error codes

- **E413 File too large**: the file is over your plan's limit. Compress it or share a link from cloud storage instead.
- **E415 Unsupported file type**: executable files (.exe, .bat, .sh, .msi) are blocked for security.
- **E507 Storage full**: your workspace has used all its storage. Delete old attachments or upgrade.
- **E408 Upload timed out**: usually a slow or unstable connection. Try again on a stronger connection; uploads resume from where they stopped.` },
{ id: 'login-problems', category: 'Troubleshooting', title: 'Can\u2019t sign in', updated: '2026-09-29', keywords: ['cant log in', 'login error', 'session expired', 'locked out', 'AUTH-401', 'account locked'], body: `# Can't sign in

## Wrong password or locked account

After 10 failed attempts your account is locked for **30 minutes** to protect it. Wait, then use **Forgot password?** if needed.

## "Session expired" or a sign-in loop

Clear cookies for orbitask.example, or try a private window. Make sure your computer's date and time are set automatically.

## Error AUTH-401

Your workspace requires SSO. Use **Sign in with SSO** instead of your password.

## Error AUTH-403

Your Owner has restricted sign-ins to certain IP addresses or email domains. Ask your workspace Admin.

## You think someone else signed in

If you see sessions or activity you don't recognise, change your password, sign out other sessions from **Profile > Security** and contact us right away so the security team can review it.` },
{ id: 'security-practices', category: 'Policy', title: 'Security, suspicious activity and reporting a vulnerability', updated: '2026-10-15', keywords: ['security', 'breach', 'hacked', 'vulnerability', 'phishing', 'unauthorized access', 'data leak'], body: `# Security, suspicious activity and reporting a vulnerability

Orbitask encrypts data in transit (TLS 1.2+) and at rest (AES-256). We're SOC 2 Type II and ISO 27001 certified. Reports are available to customers under NDA from the Trust Center.

## Suspected account compromise or data exposure

Contact us right away. Our **security team** handles every report of unauthorised access, leaked data or suspicious activity, usually within 4 hours. Support agents will not discuss other customers' data or make security changes on your behalf.

## Phishing

We never ask for your password, 2FA codes or card number by email, chat or phone. Forward suspicious emails to security@orbitask.example.

## Reporting a vulnerability

Send details to security@orbitask.example. We run a bug bounty for responsibly disclosed issues. Please don't test against other customers' data.` },
{ id: 'plan-limits', category: 'Policy', title: 'Plan limits', updated: '2026-09-14', keywords: ['limits', 'storage', 'how many projects', 'guests limit', 'automations'], body: `# Plan limits

| Limit | Free | Team | Business | Enterprise |
| --- | --- | --- | --- | --- |
| Members | 5 | Unlimited | Unlimited | Unlimited |
| Projects | 3 | Unlimited | Unlimited | Unlimited |
| Storage | 2 GB | 100 GB | 1 TB | Custom |
| Guests | None | 10 per paid member | 10 per paid member | Unlimited |
| Automations per month | 100 | 5,000 | 50,000 | Unlimited |
| Version history | 7 days | 90 days | 1 year | Unlimited |

## When you hit a limit

You'll see a banner in the app. Nothing is deleted. For storage, uploads are paused until you free up space or upgrade. For automations, rules pause until the next calendar month.` },
{ id: 'data-retention-privacy', category: 'Policy', title: 'Data retention, privacy and data residency', updated: '2026-10-12', keywords: ['privacy', 'data retention', 'where is data stored', 'eu data', 'dpa', 'subprocessors'], body: `# Data retention, privacy and data residency

## Where your data lives

By default data is stored in the United States. **Enterprise** customers can choose EU (Frankfurt) or Australia (Sydney) data residency when the workspace is created. Existing workspaces can be migrated by our team.

## Retention

- Deleted tasks go to Trash for 30 days.
- Deleted workspaces can be restored for 14 days.
- Audit logs are kept for 1 year on Business and 7 years on Enterprise.

## Legal documents

Our Data Processing Agreement (DPA) and subprocessor list are in the Trust Center. To sign a custom DPA or for any legal question about contracts, contact legal@orbitask.example. Support can't give legal advice or change contract terms.` },
{ id: 'support-hours-sla', category: 'Policy', title: 'Support hours, response times and what support covers', updated: '2026-08-01', keywords: ['contact support', 'response time', 'sla', 'phone support', 'escalate'], body: `# Support hours, response times and what support covers

## Response times (first reply)

- **Free**: community forum only.
- **Team**: within 1 business day by email.
- **Business**: within 4 business hours, Monday to Friday, 6 AM to 8 PM US Central time.
- **Enterprise**: 24/7, within 1 hour for urgent issues, with phone support.

## What support can help with

How-to questions, billing, account access, integrations and bugs in Orbitask.

## What support can't help with

Custom software development, help with third-party products beyond our integrations, legal advice, and requests unrelated to Orbitask. We're also unable to share information about other customers.

## Talking to a person

Every conversation can be passed to a human. Just ask, and include your workspace name.` }
  ];
});
