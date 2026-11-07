import { useEffect, useState } from 'react';
import { showPublicLanding } from '@/lib/publicPaths';
import { flagEnabled, loadFeatureFlags } from '@/lib/featureFlags';
import PublicLanding from './PublicLanding';

// In front of the age door, and only for a device that has not answered it.
// A stored "off" for the public_landing flag (read on a previous visit, or
// fetched while this page is up) steps straight through to the door.
const FrontOfHouse = ({ children }) => {
  const [entered, setEntered] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (!showPublicLanding({ href: window.location.href })) return true;
    if (!flagEnabled('public_landing', true)) return true;
    return false;
  });

  useEffect(() => {
    if (entered) return undefined;
    let live = true;
    loadFeatureFlags().then(() => {
      if (live && !flagEnabled('public_landing', true)) setEntered(true);
    });
    return () => { live = false; };
  }, [entered]);

  if (entered) return children;
  return <PublicLanding onEnter={() => setEntered(true)} />;
};

export default FrontOfHouse;
