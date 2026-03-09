"use client";
import { useState, useEffect } from "react";
import { invoke } from "@/lib/tauri";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EyeIcon, EyeOffIcon } from "lucide-react";

export function TokenInput() {
    const [token, setToken] = useState("");
    const [saved, setSaved] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        invoke<string | null>("get_github_token").then((t) => {
            if (t) {
                setToken(t);
                setSaved(true);
            }
        });
    }, []);

    const handleSave = async () => {
        await invoke("set_github_token", { token });
        setSaved(true);
    };

    const handleClear = async () => {
        await invoke("set_github_token", { token: "" });
        setToken("");
        setSaved(false);
    };

    return (
        <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card text-card-foreground">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">GitHub Token (optional)</label>
                {saved && <Badge variant="outline" className="text-green-600 border-green-600/20 bg-green-500/10">Saved</Badge>}
            </div>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input
                        type={visible ? "text" : "password"}
                        placeholder="ghp_xxxxxxxxxxxx"
                        value={token}
                        onChange={(e) => {
                            setToken(e.target.value);
                            setSaved(false);
                        }}
                    />
                    <button
                        onClick={() => setVisible(!visible)}
                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                        {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                </div>
                <Button onClick={handleSave} size="sm" disabled={!token}>
                    Save
                </Button>
                {saved && (
                    <Button onClick={handleClear} variant="ghost" size="sm">
                        Clear
                    </Button>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                Token increases API rate limit from 60 to 5,000 req/hr.
                Requires <code>repo</code> scope for private repos.
            </p>
        </div>
    );
}
