import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("notification_feed")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (alive) setCount(c ?? 0);
    };
    void fetchCount();
    // 30s backstop in case a notification arrives without realtime subscription
    const id = setInterval(() => void fetchCount(), 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return count;
}
