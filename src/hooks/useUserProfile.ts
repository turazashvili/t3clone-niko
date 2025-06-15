
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  full_name?: string | null;
}

export function useUserProfile(user: { id?: string } | null) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    const fetchProfile = async () => {
      if (user?.id) {
        setProfileLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          setUserProfile({ full_name: data.full_name });
        } else {
          setUserProfile(null);
        }
        setProfileLoading(false);
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }
    };
    if (user?.id) {
      timeout = setTimeout(fetchProfile, 300);
    } else {
      fetchProfile();
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line
  }, [user]);

  return { userProfile, profileLoading };
}
