"use client";
import { AlertCircle, X } from "lucide-react";

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-tight">{message}</span>
            <button
                onClick={onDismiss}
                className="shrink-0 p-1 hover:bg-destructive/20 rounded transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
}
