import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, GitFork, Lock, Globe, ExternalLink, History, XCircle } from "lucide-react";
import { useRepoStore } from "@/store/repoStore";
import { RepoMeta, TreeNode } from "@/types/github";
import { BranchSelector } from "@/components/BranchSelector";
import { ErrorBanner } from "@/components/ErrorBanner";

function parseRepoUrl(input: string): { owner: string; repo: string } | null {
    const clean = input.trim().replace(/\.git$/, "");
    const match = clean.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
}

export function RepoInput() {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {
        setRepoMeta,
        setTreeRoot,
        setBranches,
        clearSelection,
        setIsLoading,
        repoMeta,
        recentRepos,
        addToRecent
    } = useRepoStore();
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus shortcut
    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "l") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleDown);
        return () => window.removeEventListener("keydown", handleDown);
    }, []);

    const handleLoad = async (urlOverride?: string) => {
        const targetUrl = typeof urlOverride === "string" ? urlOverride : input;
        const parsed = parseRepoUrl(targetUrl);
        if (!parsed) {
            setError("Invalid repo URL or format");
            return;
        }

        setLoading(true);
        setIsLoading(true);
        setError(null);
        clearSelection();

        try {
            const meta = await invoke<RepoMeta>("fetch_repo_meta", parsed);
            setRepoMeta(meta);
            addToRecent(targetUrl);
            if (typeof urlOverride === "string") setInput(urlOverride);

            // Fetch branches in parallel
            const [tree, branches] = await Promise.all([
                invoke<TreeNode[]>("fetch_repo_tree", {
                    owner: parsed.owner,
                    repo: parsed.repo,
                    branch: meta.defaultBranch,
                }),
                invoke<string[]>("fetch_branches", parsed),
            ]);

            setTreeRoot(tree);
            setBranches(branches);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 p-4">
            <div className="flex gap-2">
                <Input
                    ref={inputRef}
                    placeholder="https://github.com/owner/repo or owner/repo"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoad()}
                    disabled={loading}
                />
                <Button onClick={() => handleLoad()} disabled={loading || !input}>
                    {loading ? <Loader2 className="animate-spin" size={16} /> : "Load"}
                </Button>
            </div>

            {!repoMeta && recentRepos.length > 0 && (
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <History size={10} />
                        Recent Repositories
                    </label>
                    <div className="flex flex-col gap-1">
                        {recentRepos.map((url) => (
                            <button
                                key={url}
                                onClick={() => handleLoad(url)}
                                className="text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors truncate text-muted-foreground hover:text-foreground border border-transparent hover:border-muted-foreground/10"
                            >
                                {url.replace(/https:\/\/github\.com\//, "")}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {repoMeta && (
                <Card className="bg-muted/50 overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold truncate max-w-[180px]">
                                        {repoMeta.repo}
                                    </h2>
                                    <Badge variant="outline" className="text-[10px] h-5">
                                        {repoMeta.private ? <Lock size={10} className="mr-1" /> : <Globe size={10} className="mr-1" />}
                                        {repoMeta.private ? "Private" : "Public"}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                    {repoMeta.owner}
                                </p>
                            </div>
                            <a
                                href={`https://github.com/${repoMeta.owner}/${repoMeta.repo}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                                <ExternalLink size={16} />
                            </a>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex gap-3 text-[10px]">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <Star size={12} className="text-yellow-500" />
                                    <span className="font-medium text-foreground">{repoMeta.stars}</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <GitFork size={12} className="text-blue-500" />
                                    <span className="font-medium text-foreground">{repoMeta.forks}</span>
                                </div>
                            </div>

                            <BranchSelector />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
