import { LegalPage, LegalSection } from "@/components/legal-page";
import { LAST_UPDATED, CONTACT_EMAIL, LEGAL_ENTITY, JURISDICTION, bullet } from "@/lib/legalConstants";

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          This Privacy Policy explains how {LEGAL_ENTITY} (“we”, “us”) collects, uses, and protects your information
          when you use TimeTrakr (the “Service”), an earnings and tax tracker for freelancers. By using the Service you
          agree to the practices described here.
        </p>
      }
    >
      <LegalSection heading="1. Information we collect">
        <p>We collect only what we need to run the Service:</p>
        <ul className={bullet}>
          <li><strong>Account information</strong> — username, password (stored only as a salted hash, never in plain text), and optionally your email address, full name, date of birth, and profile picture.</li>
          <li><strong>Sign-in identifiers</strong> — if you log in with Google or GitHub, we receive your basic profile and email from that provider to create and link your account.</li>
          <li><strong>Financial data you enter</strong> — time entries, hourly rates, projects, earnings, withdrawals, currency settings, and tax configuration (Advance Tax, GST, TDS). This data is yours; we process it solely to provide the Service.</li>
          <li><strong>Technical data</strong> — a session cookie to keep you logged in, plus standard server logs and aggregate, privacy-friendly usage analytics.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. How we use your information">
        <ul className={bullet}>
          <li>To provide, maintain, and secure the Service and your account.</li>
          <li>To perform the earnings, currency, and tax calculations you request.</li>
          <li>To send you tax-deadline reminder emails, if you enable them.</li>
          <li>To detect, prevent, and respond to abuse, fraud, and security incidents.</li>
        </ul>
        <p>We do <strong>not</strong> sell your personal information or your financial data.</p>
      </LegalSection>

      <LegalSection heading="3. Service providers we share with">
        <p>We use a small set of trusted processors to operate the Service. They access data only to perform services for us:</p>
        <ul className={bullet}>
          <li><strong>Google &amp; GitHub</strong> — optional OAuth sign-in.</li>
          <li><strong>Neon</strong> — managed PostgreSQL database hosting.</li>
          <li><strong>Vercel</strong> — application hosting and aggregate analytics.</li>
          <li><strong>SendGrid</strong> — delivery of reminder emails (only if you enable them).</li>
          <li><strong>Razorpay</strong> — payment processing, only if and when paid plans are enabled.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Cookies">
        <p>
          We use a single essential, http-only session cookie to keep you signed in. It is required for the Service to
          function and is not used for advertising or cross-site tracking.
        </p>
      </LegalSection>

      <LegalSection heading="5. Data retention">
        <p>
          We keep your account and the data you enter for as long as your account is active. When you delete your
          account, we delete or irreversibly anonymize your personal data within a reasonable period, except where we
          must retain certain records to comply with legal obligations.
        </p>
      </LegalSection>

      <LegalSection heading="6. Security">
        <p>
          We protect your data with industry-standard measures: passwords are salted and hashed, traffic is encrypted
          in transit (HTTPS), database connections use verified TLS, and the application uses security headers and
          rate limiting. No method of transmission or storage is ever 100% secure, but we work to protect your
          information.
        </p>
      </LegalSection>

      <LegalSection heading="7. Your rights">
        <p>
          Subject to applicable law (including India’s Digital Personal Data Protection Act, 2023 and, where relevant,
          the GDPR), you may request to access, correct, export, or delete your personal data. You can update most
          details in your profile, or contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection heading="8. Children">
        <p>The Service is intended for users aged 18 and over and is not directed at children.</p>
      </LegalSection>

      <LegalSection heading="9. Changes to this policy">
        <p>
          We may update this policy from time to time. We will revise the “Last updated” date above and, for material
          changes, take reasonable steps to notify you.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact us">
        <p>
          Questions about this policy or your data? Contact {LEGAL_ENTITY} at{" "}
          <a className="text-amber-600 underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          Registered in {JURISDICTION}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
