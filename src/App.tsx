import { useEffect, useState } from "react";
import { AppDataProvider, useAppData } from "./applicationDataProvider";
import BottomBar from "./components/bottomBar";
import QueryInterface from "./components/editor";
import Sidebar from "./components/sidebar";
import Toolbar, { AIFeaturesSettingsPage } from "./components/toolbar";
import { TooltipProvider } from "./components/ui/tooltip";
import { DBConnectionProvider } from "./databaseConnectionProvider";
import { QueryDataProvider } from "./queryDataProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { ArrowRight } from "lucide-react";
import { AddConnectionForm } from "./components/addDatabaseButton";
import TomeLogo from "./components/logos/tome";

function App() {
  return (
    <AppDataProvider>
      <DBConnectionProvider>
        <QueryDataProvider>
          <TooltipProvider>
            <SetupWindow />
            <div className="w-full h-full bg-zinc-950 flex flex-col dark overflow-hidden">
              <Toolbar />
              <div className="flex-1 flex min-h-0">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                  <QueryInterface />
                  <BottomBar />
                </div>
              </div>
            </div>
          </TooltipProvider>
        </QueryDataProvider>
      </DBConnectionProvider>
    </AppDataProvider>
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
              <div className="text-zinc-400 w-xl text-center text-xl">
                The AI-native database client that translates natural language
                into perfect queries. Ask questions in plain English and get
                instant results.
              </div>
              <Button
                onClick={() => setStep("add connection")}
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

            <AddConnectionForm onComplete={() => setStep("settings")} />
          </>
        );
      case "settings":
        return (
          <>
            <DialogTitle>Enable AI Features</DialogTitle>
            <DialogDescription>
              Configure AI features to experience the true magic of Tome
            </DialogDescription>
            <AIFeaturesSettingsPage onComplete={() => handleComplete()} />
            <Button onClick={() => handleComplete()}>Skip</Button>
          </>
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dark max-w-5xl">
        {displayStep(step)}
      </DialogContent>
    </Dialog>
  );
}

export default App;
