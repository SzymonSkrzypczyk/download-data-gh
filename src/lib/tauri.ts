import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Checks if the application is running inside a Tauri environment.
 */
export const isTauri = () => {
    return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
};

/**
 * A safe wrapper around Tauri's invoke function that prevents crashing in a browser environment.
 */
export async function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
    if (!isTauri()) {
        const error = "Tauri bridge not found. Are you running in a regular browser? Please use the standalone Tauri desktop app.";
        console.warn(`[Tauri Mock] invoke("${cmd}"): ${error}`);
        throw new Error(error);
    }

    try {
        return await tauriInvoke<T>(cmd, args);
    } catch (e) {
        if (e instanceof TypeError && e.message.includes("reading 'invoke'")) {
            throw new Error("Tauri API bridge is present but partially initialized. Please restart the application.");
        }
        throw e;
    }
}
