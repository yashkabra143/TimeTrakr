import { LegalPage, LegalSection } from "@/components/legal-page";

// ── Edit these in one place ──────────────────────────────────────────────
const LAST_UPDATED = "June 22, 2026";
const CONTACT_EMAIL = "yashkabra143@gmail.com";
const LEGAL_ENTITY = "NirbhayLabs";
const JURISDICTION = "Indore, Madhya Pradesh, India";

const bullet = "list-disc pl-5 space-y-1.5 marker:text-amber-500";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          These Terms of Service (“Terms”) govern your use of TimeTrakr (the “Service”), provided by {LEGAL_ENTITY}.
          By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the
          Service.
        </p>
      }
    >
      <LegalSection heading="1. The Service">
        <p>
          TimeTrakr helps freelancers track time, earnings (including USD-to-INR conversions), withdrawals, and
          estimated Indian tax obligations (Advance Tax, GST, TDS), and sends optional tax-deadline reminders.
        </p>
      </LegalSection>

      <LegalSection heading="2. Not financial, tax, or legal advice">
        <p>
          The Service provides <strong>estimates and tools for your convenience only</strong>. All calculations —
          including tax figures, currency conversions, and earnings — are informational and may not reflect your actual
          obligations. TimeTrakr is not a substitute for a qualified chartered accountant, tax professional, or
          financial advisor. <strong>You are solely responsible for verifying figures and for your own tax filings and
          financial decisions.</strong>
        </p>
      </LegalSection>

      <LegalSection heading="3. Eligibility &amp; accounts">
        <ul className={bullet}>
          <li>You must be at least 18 years old and able to form a binding contract.</li>
          <li>You are responsible for the accuracy of the information you provide and for keeping your login credentials secure.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className={bullet}>
          <li>Use the Service unlawfully or to infringe the rights of others.</li>
          <li>Attempt to access accounts or data that are not yours, or probe, scan, or breach security measures.</li>
          <li>Interfere with or disrupt the Service, or attempt to overload, reverse-engineer, or abuse it.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Subscriptions &amp; payments">
        <p>
          Some features may require a paid subscription. If paid plans are offered, pricing, billing cycle, and refund
          terms will be presented at checkout and processed by our payment provider <strong>[Razorpay]</strong>. Taxes
          may apply. You can cancel as described in your account settings; cancellation stops future renewals.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your data">
        <p>
          The financial and personal data you enter remains yours. Our handling of it is described in our{" "}
          <a className="text-amber-600 underline underline-offset-2" href="/privacy">Privacy Policy</a>, which is
          incorporated into these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="7. Service availability">
        <p>
          We aim to keep the Service available but provide it on an “as is” and “as available” basis. We may modify,
          suspend, or discontinue features at any time. We are not liable for any unavailability or data loss, though
          we encourage you to keep your own backups (you can export your data to CSV).
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers &amp; limitation of liability">
        <p>
          To the maximum extent permitted by law, the Service is provided without warranties of any kind, and {LEGAL_ENTITY}
          shall not be liable for any indirect, incidental, or consequential damages, or for any tax penalties,
          financial losses, or decisions arising from your use of the Service or reliance on its calculations.
        </p>
      </LegalSection>

      <LegalSection heading="9. Termination">
        <p>
          You may stop using the Service and delete your account at any time. We may suspend or terminate access if you
          violate these Terms or to protect the Service and its users.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing law">
        <p>
          These Terms are governed by the laws of India, and any disputes are subject to the exclusive jurisdiction of
          the courts of {JURISDICTION}.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these Terms">
        <p>
          We may update these Terms from time to time. We will revise the “Last updated” date above, and continued use
          of the Service after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact us">
        <p>
          Questions about these Terms? Contact {LEGAL_ENTITY} at{" "}
          <a className="text-amber-600 underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
