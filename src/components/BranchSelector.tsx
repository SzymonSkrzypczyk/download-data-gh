"use client";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, ChevronsUpDown, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRepoStore } from "@/store/repoStore";
import { TreeNode } from "@/types/github";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function BranchSelector() {
    const { repoMeta, branches, setTreeRoot, setIsLoading, setRepoMeta } = useRepoStore();
    const [open, setOpen] = useState(false);

    if (!repoMeta || branches.length === 0) return null;

    const handleBranchSelect = async (branch: string) => {
        if (branch === repoMeta.defaultBranch) {
            setOpen(false);
            return;
        }

        setIsLoading(true);
        setOpen(false);

        try {
            const tree = await invoke<TreeNode[]>("fetch_repo_tree", {
                owner: repoMeta.owner,
                repo: repoMeta.repo,
                branch,
            });
            setTreeRoot(tree);
            setRepoMeta({ ...repoMeta, defaultBranch: branch });
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] flex items-center gap-1 bg-background"
                    >
                        <GitBranch size={12} className="text-muted-foreground" />
                        <span className="truncate max-w-[80px]">{repoMeta.defaultBranch}</span>
                        <ChevronsUpDown size={10} className="text-muted-foreground opacity-50" />
                    </Button>
                }
            />
            <DialogContent className="sm:max-w-[300px] p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b bg-muted/30">
                    <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                        <GitBranch size={16} />
                        Switch Branch
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[300px]">
                    <div className="p-1">
                        {branches.map((branch) => (
                            <button
                                key={branch}
                                onClick={() => handleBranchSelect(branch)}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-sm transition-colors flex items-center justify-between group",
                                    branch === repoMeta.defaultBranch
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-muted"
                                )}
                            >
                                <span className="truncate">{branch}</span>
                                {branch === repoMeta.defaultBranch && (
                                    <Check size={14} className="text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
