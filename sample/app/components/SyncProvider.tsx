"use client";
import { useEffect } from "react";
import { syncPull, syncPush } from "@/lib/sync";
import { toast } from "sonner"; // Assuming sonner is used, or console logs

export function SyncProvider() {
  useEffect(() => {
    // Initial Hydration
    const init = async () => {
        if (navigator.onLine) {
            console.log("Online: Pulling latest data...");
            await syncPull();
            await syncPush(); // Also push any leftovers
        }
    };
    init();

    // Listeners
    const onOnline = () => {
        console.log("Back Online: Syncing...");
        toast.success("Back Online: Syncing data...");
        syncPush();
        syncPull();
    };

    const onOffline = () => {
        console.log("Offline Mode Active");
        toast.info("Offline Mode: Changes saved locally");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
    };
  }, []);

  return null; // Renderless component
}
