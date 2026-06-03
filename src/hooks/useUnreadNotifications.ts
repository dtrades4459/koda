import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useUnreadNotifications(): { count: number; refresh: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const { count: c } = await supabase
      .from("notification_feed")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    setCount(c ?? 0);
  }, []);

  useEffect(() => {
    let alive = true;
    const safeFetch = async () => {
      const { count: c } = await supabase
        .from("notification_feed")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (alive) setCount(c ?? 0);
    };
    void safeFetch();
    // 30s backstop in case a notification arrives without realtime subscription
    const id = setInterval(() => void safeFetch(), 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return { count, refresh: fetchCount };
}
