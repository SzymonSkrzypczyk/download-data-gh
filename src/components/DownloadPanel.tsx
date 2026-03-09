import { useState, useEffect } from "react";
import { invoke } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRepoStore } from "@/store/repoStore";
import { DownloadProgress } from "@/types/github";
import { findNodeByPath, getSubtreeFiles, calcSubtreeSize, formatBytes } from "@/lib/treeUtils";
import { toast } from "sonner";
import { Download, FolderIcon, Files, Info, Copy, Check } from "lucide-react";

export function DownloadPanel() {
    const { selectedPath, treeRoot, repoMeta, clearSelection } = useRepoStore();
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Global shortcuts
    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "d") {
                e.preventDefault();
                if (selectedPath && !downloading) handleDownload();
            }
            if (e.key === "Escape") {
                clearSelection();
            }
        };
        window.addEventListener("keydown", handleDown);
        return () => window.removeEventListener("keydown", handleDown);
    }, [selectedPath, downloading]);

    const handleCopy = () => {
        if (selectedPath) {
            navigator.clipboard.writeText(selectedPath);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("Path copied to clipboard");
        }
    };

    const selectedNode = selectedPath ? findNodeByPath(treeRoot ?? [], selectedPath) : null;
    const fileCount = selectedNode ? getSubtreeFiles(selectedNode).length : 0;
    const totalBytes = selectedNode ? calcSubtreeSize(selectedNode) : 0;

    const handleDownload = async () => {
        if (!selectedPath || !repoMeta) return;

        // Open folder picker
        const destPath = await open({
            directory: true,
            title: "Choose download destination",
        });
        if (!destPath) return;

        setDownloading(true);
        setProgress({ stage: "downloading", progress: 0, message: "Starting download..." });

        // Listen for progress events
        const unlisten = await listen<DownloadProgress>("download-progress", (e) => {
            setProgress(e.payload);
        });

        try {
            await invoke("download_directory", {
                owner: repoMeta.owner,
                repo: repoMeta.repo,
                branch: repoMeta.defaultBranch,
                dirPath: selectedPath,
                outputPath: destPath as string,
            });
            toast.success("Download complete!", { description: `Successfully exported to ${destPath}` });
        } catch (e) {
            toast.error("Download failed", { description: String(e) });
            setProgress((prev) => prev ? { ...prev, stage: "error", message: String(e) } : null);
        } finally {
            unlisten();
            setDownloading(false);
            setTimeout(() => setProgress(null), 5000);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 h-full">
            <Card className="h-full flex flex-col">
                <CardHeader className="p-4 border-b">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Info size={16} className="text-primary" />
                        Download Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col gap-4">
                    {selectedNode ? (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Path</label>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="h-6 w-6"
                                        onClick={handleCopy}
                                    >
                                        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                    </Button>
                                </div>
                                <p className="font-mono text-[10px] bg-muted p-2 rounded border break-all leading-tight">
                                    {selectedPath}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg border bg-muted/30">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                        <Files size={14} />
                                        Files
                                    </div>
                                    <div className="text-lg font-bold">{fileCount}</div>
                                </div>
                                <div className="p-3 rounded-lg border bg-muted/30">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                        <FolderIcon size={14} />
                                        Total Size
                                    </div>
                                    <div className="text-lg font-bold">{formatBytes(totalBytes)}</div>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t space-y-4">
                                <Button
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className="w-full flex items-center gap-2"
                                >
                                    {downloading ? (
                                        "Downloading..."
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            Download Selected Directory
                                        </>
                                    )}
                                </Button>

                                {progress && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                            <span>{progress.stage}</span>
                                            <span>{Math.round(progress.progress * 100)}%</span>
                                        </div>
                                        <Progress value={progress.progress * 100} className="h-1.5" />
                                        <p className="text-xs text-muted-foreground italic truncate">
                                            {progress.message}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-50">
                            <div className="p-4 rounded-full bg-muted">
                                <Download size={32} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Select a directory from the tree to preview and download its contents.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
