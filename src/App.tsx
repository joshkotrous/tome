import { useEffect, useState } from "react";
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
