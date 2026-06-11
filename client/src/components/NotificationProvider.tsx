import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type NotificationKind = "success" | "error";

interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
}

interface NotificationApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const NotificationContext = createContext<NotificationApi | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);

  const api = useMemo<NotificationApi>(() => ({
    success: (message) => setNotification({ id: Date.now(), kind: "success", message }),
    error: (message) => setNotification({ id: Date.now(), kind: "error", message })
  }), []);

  useEffect(() => {
    if (notification?.kind !== "success") return;
    const timeout = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  return (
    <NotificationContext.Provider value={api}>
      {children}
      {notification && (
        <div
          key={notification.id}
          className={`app-toast ${notification.kind}`}
          role={notification.kind === "success" ? "status" : "alert"}
          aria-live={notification.kind === "success" ? "polite" : "assertive"}
        >
          {notification.kind === "success" ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
          <span>{notification.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotification(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationApi {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used inside NotificationProvider");
  return context;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
