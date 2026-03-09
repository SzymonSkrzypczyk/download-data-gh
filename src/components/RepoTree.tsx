"use client";
import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/store/repoStore";
import { TreeNode } from "@/types/github";
import { formatBytes } from "@/lib/treeUtils";

interface TreeNodeProps {
    node: TreeNode;
    depth: number;
}

function TreeNodeItem({ node, depth }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(depth < 1); // auto-expand top level
    const { selectedPath, setSelectedPath } = useRepoStore();
    const isDir = node.type === "tree";
    const isSelected = selectedPath === node.path;

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors text-sm group",
                    isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50 text-foreground/80",
                    !isDir && "text-muted-foreground cursor-default"
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => {
                    if (isDir) {
                        setExpanded(!expanded);
                        setSelectedPath(node.path);
                    }
                }}
            >
                <div className="w-4 h-4 flex items-center justify-center">
                    {isDir && (
                        <span className="text-muted-foreground group-hover:text-foreground">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                    {isDir ? (
                        expanded ? (
                            <FolderOpen size={16} className="text-yellow-500 fill-yellow-500/20" />
                        ) : (
                            <Folder size={16} className="text-yellow-500 fill-yellow-500/20" />
                        )
                    ) : (
                        <File size={16} className="text-muted-foreground" />
                    )}
                    <span className="truncate">{node.name}</span>
                </div>

                {node.size != null && (
                    <span className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatBytes(node.size)}
                    </span>
                )}
            </div>

            {isDir && expanded && node.children && node.children.length > 0 && (
                <div className="border-l border-muted/50 ml-6">
                    {node.children.map((child) => (
                        <TreeNodeItem key={child.path} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}

            {isDir && expanded && (!node.children || node.children.length === 0) && (
                <div
                    className="text-[10px] text-muted-foreground italic py-1"
                    style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
                >
                    (Empty folder)
                </div>
            )}
        </div>
    );
}

export function RepoTree() {
    const { treeRoot, isLoading } = useRepoStore();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="animate-spin" size={24} />
                <p className="text-sm">Loading repository tree...</p>
            </div>
        );
    }

    if (!treeRoot) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-2 border-2 border-dashed rounded-lg bg-muted/20">
                <Folder size={32} className="text-muted-foreground/50" />
                <div className="space-y-1">
                    <p className="font-medium text-muted-foreground">No repository loaded</p>
                    <p className="text-xs text-muted-foreground/70">
                        Enter a GitHub URL above and click Load to browse the file tree.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full border rounded-lg bg-card text-card-foreground">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File Explorer</h3>
                <span className="text-[10px] font-mono text-muted-foreground">
                    {treeRoot.length} items
                </span>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {treeRoot.map((node) => (
                        <TreeNodeItem key={node.path} node={node} depth={0} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
