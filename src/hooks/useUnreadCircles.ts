import { useEffect, useState } from "react";
import { getUnreadCounts } from "../data/chatReads";

export function useUnreadCircles(circleCodes: string[]): {
  perCircle: Record<string, number>;
  total: number;
  refresh: () => Promise<void>;
} {
  const [perCircle, setPerCircle] = useState<Record<string, number>>({});

  const refresh = async () => {
    if (circleCodes.length === 0) {
      setPerCircle({});
      return;
    }
    const counts = await getUnreadCounts(circleCodes);
    setPerCircle(counts);
  };

  useEffect(() => {
    void refresh();
    // 30s backstop in case a realtime event was missed
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleCodes.join(",")]);

  const total = Object.values(perCircle).reduce((a, b) => a + b, 0);
  return { perCircle, total, refresh };
}
