import BottomBar from "./components/bottomBar";
import Editor from "./components/editor";
import Sidebar from "./components/sidebar";
import Toolbar from "./components/toolbar";

function App() {
  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 dark">
      <Toolbar />
      <div className="size-full flex">
        <Sidebar />
        <div className="size-full flex flex-col">
          <Editor />
          <BottomBar />
        </div>
      </div>
    </div>
  );
}

export default App;
