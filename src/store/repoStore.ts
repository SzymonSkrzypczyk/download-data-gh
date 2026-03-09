import { create } from "zustand";
import { RepoMeta, TreeNode } from "@/types/github";

interface RepoStore {
    repoMeta: RepoMeta | null;
    treeRoot: TreeNode[] | null;
    branches: string[];
    recentRepos: string[];
    selectedPath: string | null;
    isLoading: boolean;
    setRepoMeta: (meta: RepoMeta) => void;
    setTreeRoot: (tree: TreeNode[]) => void;
    setBranches: (branches: string[]) => void;
    setSelectedPath: (path: string | null) => void;
    setIsLoading: (loading: boolean) => void;
    addToRecent: (url: string) => void;
    clearSelection: () => void;
}

export const useRepoStore = create<RepoStore>((set) => ({
    repoMeta: null,
    treeRoot: null,
    branches: [],
    recentRepos: [],
    selectedPath: null,
    isLoading: false,
    setRepoMeta: (repoMeta) => set({ repoMeta }),
    setTreeRoot: (treeRoot) => set({ treeRoot }),
    setBranches: (branches) => set({ branches }),
    setSelectedPath: (selectedPath) => set({ selectedPath }),
    setIsLoading: (isLoading) => set({ isLoading }),
    addToRecent: (url) => set((s) => ({
        recentRepos: [url, ...s.recentRepos.filter(r => r !== url)].slice(0, 5)
    })),
    clearSelection: () => set({ selectedPath: null, treeRoot: null, repoMeta: null, branches: [] }),
}));
