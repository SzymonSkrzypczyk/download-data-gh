import { TreeNode } from "@/types/github";

export function getSubtreeFiles(node: TreeNode): TreeNode[] {
    if (node.type === "blob") return [node];
    return (node.children ?? []).flatMap(getSubtreeFiles);
}

export function calcSubtreeSize(node: TreeNode): number {
    return getSubtreeFiles(node).reduce((acc, f) => acc + (f.size ?? 0), 0);
}

export function findNodeByPath(tree: TreeNode[], path: string): TreeNode | null {
    for (const node of tree) {
        if (node.path === path) return node;
        if (node.children) {
            const found = findNodeByPath(node.children, path);
            if (found) return found;
        }
    }
    return null;
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
