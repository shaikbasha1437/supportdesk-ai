/* Sample knowledge base for Orbitask, a fictional project-management SaaS. All names, prices and
   policies are invented for the demo. Part 1 of 2: billing, refunds, account. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.SD = root.SD || {}; root.SD.kb1 = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  return [
{ id: 'plans-and-pricing', category: 'Billing', title: 'Plans and pricing', updated: '2026-09-14', keywords: ['price', 'cost', 'plan comparison'], body: `# Plans and pricing

Orbitask has four plans. Prices are per user, per month.

- **Free**: up to 5 members, 3 projects and 2 GB of storage. Community support only.
- **Team**: $12 per user per month billed monthly, or $10 per user per month billed annually. Unlimited projects, 100 GB storage, guest access and email support.
- **Business**: $24 per user per month billed monthly, or $20 billed annually. Adds SSO (SAML), advanced permissions, audit log, 1 TB storage and priority support.
- **Enterprise**: custom pricing with a dedicated success manager, data residency options, a 99.9% uptime SLA and 24/7 phone support. Contact sales from **Settings > Billing > Talk to sales**.

## Discounts

Annual billing saves about 17%. Verified non-profits and schools get 50% off Team or Business; apply from **Settings > Billing > Discounts** with proof of status. Discounts can't be combined.

## Taxes

Prices exclude sales tax and VAT, which are added at checkout based on your billing address.` },
{ id: 'update-payment-method', category: 'Billing', title: 'Update your payment method', updated: '2026-08-02', keywords: ['credit card', 'card declined', 'expired card', 'paypal'], body: `# Update your payment method

Only workspace **Owners** and **Billing admins** can change payment details.

1. Go to **Settings > Billing > Payment method**.
2. Click **Replace card** and enter the new card. We accept Visa, Mastercard, American Express and Discover. Annual Business and Enterprise plans can also pay by bank transfer (ACH or SEPA) or PayPal.
3. Click **Save**. Any unpaid invoice is retried on the new card within one hour.

## My card was declined

Declines usually come from the bank, not Orbitask. Check the card's expiry date, the billing postcode and that international online payments are allowed. Some banks block recurring charges until you approve them in their app. If it still fails, try another card or contact your bank and mention a recurring charge from "ORBITASK INC".

We never ask for card numbers by email or chat. Never send card details in a support ticket.` },
{ id: 'invoices-and-receipts', category: 'Billing', title: 'Invoices, receipts and tax IDs', updated: '2026-07-21', keywords: ['invoice', 'receipt', 'vat number', 'billing email', 'pdf invoice'], body: `# Invoices, receipts and tax IDs

Every payment creates an invoice. Owners and Billing admins can download them as PDF from **Settings > Billing > Invoices**.

## Send invoices to accounting

Add up to three billing email addresses under **Settings > Billing > Billing contacts**. Each one gets a copy of every invoice and receipt.

## Add a VAT or tax ID

Enter your VAT, GST or tax ID under **Settings > Billing > Company details** before the next invoice is created. When a valid EU VAT ID is added, reverse charge applies and VAT is removed from future invoices. We can't change the tax on invoices that were already issued, but we can reissue an invoice with a corrected company name or address within 90 days.

## Purchase orders

Enterprise customers can add a PO number, which appears on each invoice.` },
{ id: 'change-plan', category: 'Billing', title: 'Upgrade, downgrade or switch billing period', updated: '2026-09-01', keywords: ['upgrade', 'downgrade', 'proration', 'annual', 'monthly'], body: `# Upgrade, downgrade or switch billing period

Change your plan any time from **Settings > Billing > Change plan**.

## Upgrades

Upgrades take effect immediately. You pay a prorated amount for the rest of the current billing period, and new features unlock right away.

## Downgrades

Downgrades take effect at the end of the current billing period. No partial refunds are given for the remaining time. Before you downgrade, check **Plan limits**: if you have more projects or storage than the lower plan allows, extra projects become read-only until you archive some.

## Monthly to annual

Switching to annual billing starts a new 12-month period today. The unused part of your monthly payment is credited against the annual invoice.

## Annual to monthly

You can switch to monthly at your next renewal date. Annual plans can't be converted to monthly mid-term.` },
{ id: 'seats-billing', category: 'Billing', title: 'How seats are billed', updated: '2026-06-30', keywords: ['seats', 'add users', 'remove users', 'guests', 'licenses'], body: `# How seats are billed

You pay for every **member** of the workspace. Guests are free on Team and Business plans (up to 10 guests per paid member).

## Adding members

When you invite a new member, a prorated charge for the rest of the billing period is added to your next invoice.

## Removing members

When you remove a member, their seat is freed but not refunded for the current period. Your next invoice will be lower. On annual plans, removed seats stay paid until the renewal date, and you can reuse them for new people at no extra cost.

## Deactivated members

Deactivated members don't count as seats. Their tasks and comments stay in the workspace.` },
{ id: 'failed-payments', category: 'Billing', title: 'Failed payments and account suspension', updated: '2026-08-19', keywords: ['payment failed', 'past due', 'suspended', 'read-only', 'grace period'], body: `# Failed payments and account suspension

If a payment fails we retry it 3 times over 7 days and email the Owner and billing contacts each time.

## Grace period

You have a **14-day grace period** after the first failed payment. Everything keeps working during this time.

## After the grace period

If the invoice is still unpaid after 14 days, the workspace becomes **read-only**. Members can view and export data but can't create or edit tasks. Paying the open invoice from **Settings > Billing > Invoices** restores full access within a few minutes.

## Deletion

Workspaces that stay unpaid for 90 days are scheduled for deletion. We send three warnings first. Support can't extend the grace period, but the billing team can set up a payment plan for Business and Enterprise customers.` },
{ id: 'refund-policy', category: 'Refunds', title: 'Refund policy', updated: '2026-10-05', keywords: ['refund', 'money back', 'reimburse', 'chargeback'], body: `# Refund policy

## Annual plans

New **annual** subscriptions can get a full refund if you cancel within **14 days** of the first payment. Renewals are refundable within 7 days of the renewal date if the workspace hasn't been used since renewal.

## Monthly plans

Monthly payments are not refundable, except for duplicate charges or billing errors on our side. When you cancel a monthly plan, you keep access until the end of the period you paid for.

## How refunds are handled

- Refunds of **$500 or less** that meet this policy are processed by support.
- Refunds **over $500**, exceptions to this policy and any refund for Enterprise contracts must be approved by the billing team.
- Approved refunds go back to the original payment method and take **5 to 10 business days** to appear.

## Chargebacks

Please contact us before filing a chargeback. A chargeback suspends the workspace until it is resolved.` },
{ id: 'duplicate-charge', category: 'Refunds', title: 'I was charged twice', updated: '2026-09-22', keywords: ['double charge', 'charged twice', 'duplicate payment', 'two charges'], body: `# I was charged twice

## Pending authorisations

When you update your card or upgrade, your bank may show a temporary **authorisation hold** next to the real charge. Holds disappear on their own within 3 to 5 business days and are never collected.

## Real duplicate charges

Check **Settings > Billing > Invoices**. If you see two paid invoices for the same period, it's a duplicate. Reply to support with both invoice numbers (they start with INV-) and we'll refund the duplicate in full. Duplicate charges are always refundable, including on monthly plans.

## Two workspaces

A common cause of "double" charges is two separate workspaces, for example one created by a colleague. Each workspace is billed separately. You can merge workspaces by moving projects; see **Change account email and workspace ownership**.` },
{ id: 'cancel-subscription', category: 'Refunds', title: 'Cancel your subscription', updated: '2026-08-11', keywords: ['cancel', 'cancellation', 'stop subscription', 'close account', 'unsubscribe'], body: `# Cancel your subscription

Only the workspace **Owner** can cancel.

1. Go to **Settings > Billing > Change plan**.
2. Choose **Cancel subscription** and tell us why (optional).
3. Confirm. You'll get an email receipt of the cancellation.

## What happens next

Your paid plan stays active until the end of the current billing period. After that the workspace moves to the **Free** plan. If it has more than 5 members or 3 projects, the extra projects become read-only. Nothing is deleted.

Cancelling doesn't refund the current period unless you qualify under the **Refund policy**.

## Deleting everything instead

To remove the workspace and all its data, see **Delete your workspace and export data**.` },
{ id: 'reset-password', category: 'Account', title: 'Reset your password', updated: '2026-05-18', keywords: ['forgot password', 'password reset', 'reset link', 'change password'], body: `# Reset your password

1. On the sign-in page, click **Forgot password?**
2. Enter the email you use for Orbitask. We send a reset link that works for **30 minutes**.
3. Choose a new password with at least 10 characters.

## I didn't get the reset email

Check spam and any filters. The email comes from no-reply@orbitask.example. Corporate email systems sometimes hold it for a few minutes. You can request a new link after 60 seconds; only the newest link works.

## My workspace uses SSO

If your company signs in with SSO (Okta, Microsoft Entra ID or Google), your password is managed by your company. Use **Sign in with SSO** and ask your IT team to reset it. Orbitask support can't reset SSO passwords.

## Change your password while signed in

Go to **Profile > Security > Change password**. Other sessions are signed out automatically.` },
{ id: 'two-factor-auth', category: 'Account', title: 'Two-factor authentication (2FA)', updated: '2026-09-09', keywords: ['2fa', 'authenticator', 'recovery codes', 'lost phone', 'mfa'], body: `# Two-factor authentication (2FA)

Turn on 2FA from **Profile > Security > Two-factor authentication**. Scan the QR code with an authenticator app (such as Google Authenticator, 1Password or Authy) and enter the 6-digit code. Save your **10 recovery codes** somewhere safe.

Owners on Business and Enterprise can require 2FA for every member under **Settings > Security**.

## Lost your phone

Sign in with one of your recovery codes instead of the 6-digit code. Each code works once. Then set up 2FA again on your new device.

## Lost your phone and your recovery codes

For your security, support agents can't turn off 2FA. Your workspace Owner can reset 2FA for members. If you are the Owner, our **security team** must verify your identity first, which takes 1 to 3 business days. Open a ticket and we'll route it to them.` },
{ id: 'change-email-owner', category: 'Account', title: 'Change account email and workspace ownership', updated: '2026-07-07', keywords: ['change email', 'transfer ownership', 'new owner', 'merge workspaces', 'left company'], body: `# Change account email and workspace ownership

## Change your email

Go to **Profile > Account > Email**, enter the new address and confirm it from the verification email. Your tasks, comments and history move with you.

## Transfer workspace ownership

The current Owner can make another member the Owner from **Settings > Members**: open the member's menu and choose **Transfer ownership**. The old Owner becomes an Admin.

## The Owner has left the company

If the Owner can't be reached, an Admin can request a transfer. We need a request from a company email on the same domain and confirmation from a second Admin. This goes to our account team and takes up to 5 business days.

## Merge two workspaces

Workspaces can't be merged automatically, but you can move projects between workspaces you belong to from **Project settings > Move project**.` },
{ id: 'delete-account-data', category: 'Account', title: 'Delete your workspace and export data', updated: '2026-10-12', keywords: ['delete account', 'export data', 'gdpr', 'erase', 'right to be forgotten', 'download my data'], body: `# Delete your workspace and export data

## Export first

Owners and Admins can export everything from **Settings > Data > Export**. You get a ZIP with JSON and CSV files for projects, tasks, comments and members, plus attachments. Large exports are emailed as a link that lasts 7 days.

## Delete the workspace

1. Cancel any paid subscription.
2. Go to **Settings > Data > Delete workspace** and type the workspace name to confirm.

Deleted workspaces can be restored by support for **14 days**. After that, data is permanently erased from live systems within 30 days and from backups within 90 days.

## Personal data requests

To exercise rights under GDPR or CCPA (access, correction, deletion), email privacy@orbitask.example or use **Profile > Privacy**. We answer within 30 days. Support agents can't process data deletion for other people's accounts.` },
{ id: 'sso-saml', category: 'Account', title: 'Set up single sign-on (SAML SSO)', updated: '2026-08-28', keywords: ['sso', 'saml', 'okta', 'entra', 'azure ad', 'scim', 'provisioning'], body: `# Set up single sign-on (SAML SSO)

SSO is available on **Business** and **Enterprise** plans.

1. In **Settings > Security > SSO**, copy the ACS URL and Entity ID.
2. Create a SAML app in your identity provider (Okta, Microsoft Entra ID, Google Workspace, OneLogin or JumpCloud) using those values.
3. Paste your provider's metadata URL back into Orbitask and click **Test connection**.
4. When the test works, choose whether SSO is optional or required.

## SCIM provisioning

Enterprise plans can automatically add and remove members with SCIM. Generate a SCIM token in the same settings page.

## Common SSO errors

- **SAML-INVALID-AUDIENCE**: the Entity ID in your provider doesn't match. Copy it again.
- **SAML-CLOCK-SKEW**: your provider's clock is off by more than 3 minutes.
- **User not provisioned**: the person isn't assigned to the Orbitask app in your provider.` }
  ];
});
