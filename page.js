export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-gray-200">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: July 29, 2026</p>

      <p className="mb-6">
        Welcome to Encompass Rideshare ("Encompass," "we," "us," or "our"). These Terms of
        Service ("Terms") govern your access to and use of the Encompass mobile and web
        applications, including our rider, driver, and Family Hub services (collectively, the
        "Platform"). By creating an account or using the Platform, you agree to these Terms.
        If you do not agree, do not use the Platform.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. What Encompass Is</h2>
      <p className="mb-4">
        Encompass is a technology platform that connects independent Riders seeking
        transportation with independent Drivers who provide rides using their own vehicles.
        Encompass does not itself provide transportation services, employ Drivers, or own any
        vehicles. Drivers are independent contractors, not employees or agents of Encompass.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">2. Eligibility &amp; Accounts</h2>
      <p className="mb-4">
        You must be at least 18 years old to create a Rider, Driver, or Family Hub account.
        You are responsible for maintaining the confidentiality of your account credentials
        and for all activity that occurs under your account. You agree to provide accurate,
        current information when creating and maintaining your account.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">3. Rider Terms</h2>
      <p className="mb-4">
        By requesting a ride, you authorize Encompass to charge your selected payment method
        for the fare, applicable fees, and any tolls or surcharges. Fares are calculated based
        on distance, time, vehicle type, and demand at the time of your request. Cancellation
        fees may apply if you cancel a ride after a Driver has been assigned.
      </p>
      <p className="mb-4">
        Riders may select round-trip options (same-driver-waits or two separate scheduled
        rides) and, where eligible, a weekly flat-rate plan. Flat-rate plans are subject to
        admin approval and apply only to standard vehicle rides within the scope described at
        signup — they are not unlimited and do not apply to other vehicle types or job board
        transactions.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">4. Driver Terms</h2>
      <p className="mb-4">
        Drivers are independent contractors solely responsible for their own vehicle,
        insurance, licensing, and compliance with all applicable state and local
        transportation laws. Encompass requires Drivers to complete a documentation and
        verification process, including background check status, before activating an
        account. Encompass reserves the right to suspend or deactivate any Driver account for
        failure to meet safety, documentation, or conduct standards.
      </p>
      <p className="mb-4">
        Driver payouts are processed through our third-party payment partner, Stripe, via
        Stripe Connect. Drivers are responsible for their own tax obligations as independent
        contractors, including any applicable 1099 reporting.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">5. Job Board</h2>
      <p className="mb-4">
        The Job Board allows Drivers to post and claim cargo/delivery opportunities on a
        first-come, first-served basis. Encompass is not a party to any agreement formed
        between Drivers through the Job Board and is not responsible for the performance,
        payment, or safety of any job posted or claimed there.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">6. Family Hub</h2>
      <p className="mb-4">
        Family Hub allows a Guardian to create a family group and invite Members via a private
        invite code. Guardians can view ride activity and live location for Members during
        active rides, and may remove Members from the family group at any time. By joining a
        family group as a Member, you consent to this visibility for as long as you remain a
        Member.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">7. Payments</h2>
      <p className="mb-4">
        All payments on the Platform are processed through Stripe. By using the Platform, you
        also agree to Stripe's terms of service applicable to payment processing. Encompass
        does not store your full payment card details.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">8. Prohibited Conduct</h2>
      <p className="mb-4">
        You agree not to use the Platform for any unlawful purpose, to harass or endanger
        another user, to provide false information, or to attempt to circumvent Encompass's
        payment systems (e.g., arranging off-platform payment to avoid fees).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">9. Disclaimers &amp; Limitation of Liability</h2>
      <p className="mb-4">
        THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. ENCOMPASS DOES NOT
        GUARANTEE THE AVAILABILITY, SAFETY, OR CONDUCT OF ANY RIDER OR DRIVER. TO THE MAXIMUM
        EXTENT PERMITTED BY LAW, ENCOMPASS'S TOTAL LIABILITY FOR ANY CLAIM ARISING FROM YOUR
        USE OF THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU PAID TO ENCOMPASS IN THE THREE
        MONTHS PRECEDING THE CLAIM.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">10. Termination</h2>
      <p className="mb-4">
        Encompass may suspend or terminate your account at any time for violation of these
        Terms, safety concerns, or fraudulent activity. You may stop using the Platform and
        request account deletion at any time by contacting us.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">11. Changes to These Terms</h2>
      <p className="mb-4">
        We may update these Terms from time to time. Continued use of the Platform after
        changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">12. Contact</h2>
      <p className="mb-4">
        Questions about these Terms can be directed to{" "}
        <a href="mailto:support@encompassrs.com" className="text-blue-400 underline">
          support@encompassrs.com
        </a>.
      </p>
    </div>
  );
          }
