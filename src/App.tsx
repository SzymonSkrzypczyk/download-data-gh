"use client";
import { RepoInput } from "@/components/RepoInput";
import { TokenInput } from "@/components/TokenInput";
import { RepoTree } from "@/components/RepoTree";
import { DownloadPanel } from "@/components/DownloadPanel";
import { Toaster } from "@/components/ui/sonner";
import { isTauri } from "@/lib/tauri";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function App() {
  const tauriActive = isTauri();

  if (!tauriActive) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-background text-foreground space-y-6 text-center">
        <div className="p-6 rounded-full bg-destructive/10 text-destructive animate-pulse">
          <AlertCircle size={48} />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-2xl font-bold tracking-tight">Desktop Environment Required</h1>
          <p className="text-muted-foreground">
            This application uses a Rust backend to perform high-performance file operations and GitHub API calls.
            It cannot function inside a standard web browser.
          </p>
        </div>

        <Card className="max-w-sm w-full bg-muted/30">
          <CardContent className="p-4 space-y-4 text-left text-sm">
            <h3 className="font-semibold flex items-center gap-2">
              How to fix this:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground italic">
              <li>Look for the <b>standalone desktop window</b> that opened.</li>
              <li>If no window appeared, check your terminal for <b>Rust build errors</b>.</li>
              <li>Ensure you have <b>Rust</b> installed and restarted your terminal.</li>
            </ol>
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
          Detection: Browser (Web) / Bridge: Missing
        </p>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-card">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <span className="bg-primary text-primary-foreground p-1 rounded">GH</span>
          GitHub Directory Downloader
        </h1>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2">
            Desktop (Tauri)
          </Badge>
        </div>
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
