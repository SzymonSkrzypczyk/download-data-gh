export interface RepoMeta {
    owner: string;
    repo: string;
    description: string | null;
    stars: number;
    forks: number;
    private: boolean;
    defaultBranch: string;
    sizeKb: number;
}

export interface TreeNode {
    path: string;
    name: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
    children?: TreeNode[];
}

export interface DownloadProgress {
    stage: "downloading" | "extracting" | "done" | "error";
    progress: number;
    message: string;
}
