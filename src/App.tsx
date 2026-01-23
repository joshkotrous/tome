import { useCallback, useEffect, useState } from "react";
import { AppDataProvider, useAppData } from "./applicationDataProvider";
import BottomBar from "./components/bottomBar";
import QueryInterface from "./components/editor";
import Sidebar from "./components/sidebar";
import Toolbar, { AIFeaturesSettingsPage } from "./components/toolbar";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryDataProvider } from "./queryDataProvider";
import { Dialog, DialogDescription, DialogTitle } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { ArrowRight } from "lucide-react";
import { AddConnectionForm } from "./components/addDatabaseButton";
import TomeLogo from "./components/logos/tome";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./themeProvider";
import { toast } from "sonner";

function App() {
  useEffect(() => {
    console.log(String.raw`
 _________  ________  _____ ______   _______      
|\___   ___\\   __  \|\   _ \  _   \|\  ___ \     
\|___ \  \_\ \  \|\  \ \  \\\__\ \  \ \   __/|    
     \ \  \ \ \  \\\  \ \  \\|__| \  \ \  \_|/__  
      \ \  \ \ \  \\\  \ \  \    \ \  \ \  \_|\ \ 
       \ \__\ \ \_______\ \__\    \ \__\ \_______\
        \|__|  \|_______|\|__|     \|__|\|_______|
        
        
Contribute at https://github.com/joshkotrous/tome`);
  }, []);

  return (
    <ThemeProvider>
      <AppDataProvider>
        <QueryDataProvider>
          <TooltipProvider>
            <Toaster />
            <UpdateChecker />
            <SetupWindow />
            <div className="w-full h-full bg-zinc-950 flex flex-col dark overflow-hidden">
              <Toolbar />
              <div className=" flex-1 flex min-h-0">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                  <QueryInterface />
                </div>
              </div>
              <BottomBar />
            </div>
          </TooltipProvider>
        </QueryDataProvider>
      </AppDataProvider>
    </ThemeProvider>
  );
}

function UpdateChecker() {
  const { settings } = useAppData();
  const [hasChecked, setHasChecked] = useState(false);
  const [downloadToastId, setDownloadToastId] = useState<string | number | null>(null);

  // Listen for download progress updates
  useEffect(() => {
    const unsubscribeProgress = window.updates.onDownloadProgress((progress) => {
      if (downloadToastId) {
        toast.loading(
          `Downloading update... ${progress.percent.toFixed(0)}%`,
          {
            id: downloadToastId,
            description: `${(progress.transferred / 1024 / 1024).toFixed(1)} MB / ${(progress.total / 1024 / 1024).toFixed(1)} MB`,
          }
        );
      }
    });

    const unsubscribeStatus = window.updates.onUpdateStatus((data) => {
      if (data.status === "downloaded") {
        if (downloadToastId) {
          toast.dismiss(downloadToastId);
        }
        toast.success(`Update v${data.latestVersion} ready to install!`, {
          description: "The update will be installed when you restart the app.",
          duration: 0, // Persist until dismissed
          action: {
            label: "Restart Now",
            onClick: async () => {
              await window.updates.installUpdate();
            },
          },
        });
      } else if (data.status === "error") {
        if (downloadToastId) {
          toast.dismiss(downloadToastId);
        }
        toast.error("Update failed", {
          description: data.error || "An error occurred while updating",
          duration: 5000,
        });
      }
    });

    return () => {
      unsubscribeProgress();
      unsubscribeStatus();
    };
  }, [downloadToastId]);

  const checkForUpdates = useCallback(async () => {
    if (hasChecked || !settings) return;
    setHasChecked(true);

    try {
      const updateInfo = await window.updates.checkForUpdates();

      if (updateInfo.status !== "available") return;

      const autoUpdatesEnabled = settings.autoUpdates ?? true;

      if (autoUpdatesEnabled) {
        // Auto-update enabled: automatically start download
        const toastId = toast.loading(
          `Downloading update v${updateInfo.latestVersion}...`,
          {
            description: "Starting download...",
          }
        );
        setDownloadToastId(toastId);
        await window.updates.downloadUpdate();
      } else {
        // Auto-update disabled: show toast with option to download
        toast.info(`Update v${updateInfo.latestVersion} available!`, {
          description: `You're currently on v${updateInfo.currentVersion}`,
          duration: 10000,
          action: {
            label: "Download Update",
            onClick: async () => {
              const toastId = toast.loading(
                `Downloading update v${updateInfo.latestVersion}...`,
                {
                  description: "Starting download...",
                }
              );
              setDownloadToastId(toastId);
              await window.updates.downloadUpdate();
            },
          },
        });
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
    }
  }, [settings, hasChecked]);

  useEffect(() => {
    // Only check for updates after settings are loaded and setup is complete
    if (settings?.setupComplete) {
      checkForUpdates();
    }
  }, [settings, checkForUpdates]);

  return null;
}

function SetupWindow() {
  const [step, setStep] = useState<
    "get started" | "add connection" | "settings"
  >("get started");
  const [open, setOpen] = useState(false);
  const { settings, refreshSettings } = useAppData();

  useEffect(() => {
    if (!settings?.setupComplete) {
      setOpen(true);
    }
  }, [settings]);

  async function handleComplete() {
    setOpen(false);
    await window.settings.updateSettings({ setupComplete: true });
    refreshSettings();
  }

  if (settings?.setupComplete) return null;

  function displayStep(step: "get started" | "add connection" | "settings") {
    switch (step) {
      case "get started":
        return (
          <>
            <DialogTitle></DialogTitle>
            <div className="size-full flex flex-col gap-8 justify-center items-center">
              <TomeLogo className="" />
              <div className="text-zinc-400 text-center text-xl">
                The AI-native database client that translates natural language
                into perfect queries. Ask questions in plain English and get
                instant results.
              </div>
              <Button
                onClick={() => setStep("settings")}
                size="lg"
                variant="secondary"
                className="text-xl w-full"
              >
                Get Started <ArrowRight className="size-5" />
              </Button>
            </div>
          </>
        );
      case "add connection":
        return (
          <>
            <DialogTitle>Add your first connection</DialogTitle>
            <DialogDescription>
              Add your first connection to get started
            </DialogDescription>

            <AddConnectionForm onComplete={() => handleComplete()} />
          </>
        );
      case "settings":
        return (
          <>
            <DialogTitle>Enable AI Features</DialogTitle>
            <DialogDescription>
              Configure AI features to experience the true magic of Tome
            </DialogDescription>
            <AIFeaturesSettingsPage
              onComplete={() => setStep("add connection")}
            />
            <Button
              className="w-full"
              onClick={() => setStep("add connection")}
            >
              Skip
            </Button>
          </>
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* <DialogContent className="dark size-full max-w-full flex justify-center items-center outline-none">
        <div className="space-y-2 w-full max-w-3xl">{displayStep(step)}</div>
      </DialogContent> */}
      <div className="space-y-2 size-full absolute top-0 left-0 z-50 bg-zinc-950 flex justify-center items-center">
        <div className="size-full flex flex-col justify-center w-full max-w-3xl px-8 space-y-2 dark">
          {displayStep(step)}
        </div>
      </div>
    </Dialog>
  );
}

export default App;
