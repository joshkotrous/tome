import BottomBar from "./components/bottomBar";
import SqlEditor from "./components/editor";
import Sidebar from "./components/sidebar";
import Toolbar from "./components/toolbar";
import { TooltipProvider } from "./components/ui/tooltip";
import { DBConnectionProvider } from "./databaseConnectionProvider";

function App() {
  return (
    <DBConnectionProvider>
      <TooltipProvider>
        <div className="w-full h-full bg-zinc-950 flex flex-col dark">
          <Toolbar />
          <div className="flex-1 flex min-h-0">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <SqlEditor />
              <BottomBar />
            </div>
          </div>
        </div>
      </TooltipProvider>
    </DBConnectionProvider>
  );
}

export default App;
