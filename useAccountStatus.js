import { useState, useEffect } from "react";

export function useAccountStatus(driverProfile) {
  const [needsPayoutSetup, setNeedsPayoutSetup] = useState(false);

  useEffect(() => {
    if (!driverProfile) return;
    // No Stripe account at all, or one exists but hasn't finished onboarding
    setNeedsPayoutSetup(
      !driverProfile.stripe_account_id || !driverProfile.payout_setup_complete
    );
  }, [driverProfile]);

  return { needsPayoutSetup };
}
