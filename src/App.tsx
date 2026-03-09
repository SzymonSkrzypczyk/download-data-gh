"use client";
import { RepoInput } from "@/components/RepoInput";
import { TokenInput } from "@/components/TokenInput";
import { RepoTree } from "@/components/RepoTree";
import { DownloadPanel } from "@/components/DownloadPanel";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <span className="bg-primary text-primary-foreground p-1 rounded">GH</span>
          GitHub Directory Downloader
        </h1>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Inputs */}
        <div className="w-[350px] border-right flex flex-col shrink-0 overflow-y-auto bg-muted/10">
          <RepoInput />
          <div className="px-4 pb-4">
            <TokenInput />
          </div>
        </div>

        {/* Center: Tree View */}
        <div className="flex-1 border-r flex flex-col p-4 bg-background">
          <RepoTree />
        </div>

        {/* Right Side: Download Panel */}
        <div className="w-[350px] shrink-0 bg-muted/5 shadow-sm">
          <DownloadPanel />
        </div>
      </div>

      <Toaster position="top-center" richColors />
    </main>
  );
}

export default App;
