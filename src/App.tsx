import BottomBar from "./components/bottomBar";
import SqlEditor from "./components/editor";
import Sidebar from "./components/sidebar";
import Toolbar from "./components/toolbar";

function App() {
  return (
    <div className="w-full h-full bg-zinc-950 dark flex flex-col">
      <Toolbar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SqlEditor />
          <BottomBar />
        </div>
      </div>
    </div>
  );
}

export default App;
