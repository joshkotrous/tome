import { AppDataProvider } from "./applicationDataProvider";
import BottomBar from "./components/bottomBar";
import QueryInterface from "./components/editor";
import Sidebar from "./components/sidebar";
import Toolbar from "./components/toolbar";
import { TooltipProvider } from "./components/ui/tooltip";
import { DBConnectionProvider } from "./databaseConnectionProvider";
import { QueryDataProvider } from "./queryDataProvider";

function App() {
  return (
    <AppDataProvider>
      <DBConnectionProvider>
        <QueryDataProvider>
          <TooltipProvider>
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

export default App;
