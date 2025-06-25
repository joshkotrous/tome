# Contributing to Tome

Welcome to Tome! This guide will help you understand our codebase structure, conventions, and development practices for this AI-native database client built with Electron and Vite.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Code Style & Conventions](#code-style--conventions)
- [Component Patterns](#component-patterns)
- [State Management](#state-management)
- [TypeScript Guidelines](#typescript-guidelines)
- [UI Components](#ui-components)
- [Testing](#testing)
- [Pull Request Guidelines](#pull-request-guidelines)

## Development Setup

### Prerequisites

- Node.js (version specified in `.nvmrc` if present)
- npm or yarn
- Git

### Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Rebuild native dependencies: `npm run rebuild` (for better-sqlite3 and other native modules)
4. Start development server: `npm run start` (runs both Vite dev server and TypeScript watcher)
5. The Electron app will launch automatically with hot-reload enabled

### Available Scripts

- `npm run dev` - Start Vite development server only
- `npm run start` - Start both Vite dev server and TypeScript watcher (recommended for development)
- `npm run build:renderer` - Build the React renderer process
- `npm run build:main` - Build the Electron main process
- `npm run prebuild` - Clean and build both renderer and main processes
- `npm run dist:mac` / `npm run dist:win` / `npm run dist:linux` - Build distributables for respective platforms

## Project Architecture

### Directory Structure

```
tome/
├── src/                    # React renderer process (Vite + React)
│   ├── components/         # Reusable UI components
│   │   └── ui/            # shadcn/ui components
│   ├── agent/             # AI agent functionality
│   ├── utils/             # Shared utilities
│   └── types.ts           # Global TypeScript types
├── electron/              # Electron main process
│   ├── bridge/           # IPC bridge interfaces
│   ├── handlers/         # IPC event handlers
│   ├── main.ts           # Electron main process entry
│   └── preload.ts        # Preload script for secure IPC
├── core/                  # Shared business logic modules
│   ├── ai/               # AI/LLM integration (OpenAI, Anthropic)
│   ├── connections/      # Database connection management
│   ├── queries/          # SQL query execution and management
│   └── */               # Other domain modules (messages, jobs, etc.)
├── db/                   # SQLite database (Drizzle ORM)
│   ├── schema.ts         # Database schema definitions
│   └── migrations/       # Database migrations
├── public/              # Static assets (icons, images)
└── dist-electron/       # Built Electron main process (generated)
```

### Architecture Principles

1. **Electron + Vite**: Modern development setup with Vite for fast HMR and optimized builds
2. **Separation of Concerns**: Core business logic is separated from UI components
3. **Secure IPC**: All Electron IPC communication goes through typed bridge interfaces
4. **Type Safety**: Full TypeScript coverage with strict configuration across all processes
5. **Reactive Patterns**: Extensive use of React hooks for state management
6. **AI-First**: Built around natural language query processing with multiple LLM providers
7. **Database Agnostic**: Support for multiple database engines (PostgreSQL, MySQL, SQLite, etc.)

## Code Style & Conventions

### General Guidelines

- **Functional Components**: We use function components with hooks
- **TypeScript**: Write new code in TypeScript when possible
- **Type Safety**: Try to avoid `any` types, but don't stress over perfect typing
- **Readability**: Code should be easy to read and understand

### Naming Conventions

```typescript
// Components - PascalCase
function QueryDisplay() { }

// Variables and functions - camelCase
const handleRecordClick = useCallback(...)
const selectedRecords = useState(...)

// Constants - UPPER_SNAKE_CASE
const MAX_QUERY_RESULTS = 1000;

// Files - camelCase or PascalCase, be consistent within folders
// queryDisplay.tsx, utils.ts, ConnectionModal.tsx
```

## Component Patterns

### Component Structure

A suggested component organization pattern:

```typescript
interface ComponentProps {
  // Props interface
}

export default function ComponentName({ prop1, prop2 }: ComponentProps) {
  // State and hooks
  const [state, setState] = useState();
  const computedValue = useMemo(() => {}, []);

  // Event handlers
  const handleEvent = useCallback(() => {}, []);

  // Effects
  useEffect(() => {}, []);

  // Early returns for loading/error states
  if (!data) return null;

  return <div>{/* JSX */}</div>;
}
```

_Note: This is a guideline, not a strict requirement. Organize your components in whatever way makes them most readable and maintainable._

### Performance Optimization

Consider these patterns when performance matters:

- **useCallback**: For functions passed as props or used in dependency arrays
- **useMemo**: For expensive computations that don't need to run on every render
- **Virtualization**: Use `@tanstack/react-virtual` for large data sets
- **Early Returns**: Handle loading/error states early in components

```typescript
// When you need memoization
const handleClick = useCallback(
  (id: number) => {
    // handler logic
  },
  [dependency]
);

const expensiveValue = useMemo(() => {
  return heavyComputation(data);
}, [data]);
```

_Don't over-optimize - profile first, optimize second._

## State Management

### Context Providers

We use React Context for application-wide state:

```typescript
// Pattern for context providers
interface ContextValue {
  data: SomeType[];
  loading: boolean;
  refresh: () => void;
}

const Context = createContext<ContextValue | undefined>(undefined);

export function Provider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SomeType[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    // refresh logic
  }, []);

  return (
    <Context.Provider value={{ data, loading, refresh }}>
      {children}
    </Context.Provider>
  );
}

export function useContextData() {
  const context = useContext(Context);
  if (!context) {
    throw new Error("useContextData must be used within Provider");
  }
  return context;
}
```

## TypeScript Guidelines

### Type Definitions

- Define interfaces for component props
- Use discriminated unions for variants
- Leverage `Omit`, `Pick`, `Partial` for type composition

```typescript
// Component props interface
interface QueryDisplayProps {
  result: JsonQueryResult | null;
  selectedRecords: Set<number>;
  onRecordClick: (index: number, shiftKey: boolean, ctrlKey: boolean) => void;
  className?: string;
}

// Discriminated union
type DatabaseEngine = "Postgres" | "MySQL" | "SQLite";

// Type composition
type CreateConnection = Omit<Connection, "id">;
type UpdateConnection = Partial<Pick<Connection, "name" | "host" | "port">>;
```

### Generic Types

Use generics for reusable components and utilities:

```typescript
interface DropdownProps<T> {
  items: T[];
  onSelect: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
}

function Dropdown<T>({ items, onSelect, renderItem }: DropdownProps<T>) {
  // Component implementation
}
```

## UI Components

### shadcn/ui Integration

- Use shadcn/ui components as the foundation
- Extend components using the `cn()` utility for class merging
- Follow the variant pattern for component customization

```typescript
// ✅ Good - using cn() for class merging
<Button className={cn("bg-zinc-950/50", isActive && "bg-blue-500", className)}>
  Export
</Button>;

// ✅ Good - using variants
const buttonVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "default-classes",
      ghost: "ghost-classes",
    },
    size: {
      sm: "small-classes",
      lg: "large-classes",
    },
  },
});
```

### Styling Guidelines

- **Tailwind CSS**: Our primary styling approach
- **Class combinations**: Group related classes together for readability
- **Dark mode**: The app defaults to dark mode, but light mode support is welcome
- **Responsive**: Consider desktop-first since this is primarily a desktop app

```typescript
// Group related classes
<div className="flex items-center gap-2 p-4 bg-zinc-950 rounded-lg">

// Desktop-first responsive design
<div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
```

## Pull Request Guidelines

### Before Submitting

1. **Code Quality**

   - [ ] No major TypeScript errors
   - [ ] Code is readable and follows general patterns
   - [ ] App builds and runs without errors

2. **Testing**

   - [ ] Manual testing completed
   - [ ] Consider adding tests for complex logic

3. **Documentation**
   - [ ] Update README if adding major features
   - [ ] Add comments for non-obvious code

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases tested

## Screenshots (if applicable)

Add screenshots for UI changes

## Checklist

- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] No console errors
- [ ] Performance impact considered
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one approving review required
3. **Testing**: Manual testing in development environment
4. **Documentation**: Ensure code is self-documenting or well-commented

## Development Best Practices

### Electron-Specific Considerations

- **Security**: Always use context isolation and disable node integration in renderer
- **IPC Communication**: Use the typed bridge interfaces, never expose Node.js APIs directly
- **Native Dependencies**: Use `npm run rebuild` after installing packages with native modules
- **Process Separation**: Keep main process lightweight, do heavy work in renderer or workers
- **Updates**: Consider how changes affect both development and packaged app

### Performance Considerations

- **Bundle Size**: Be mindful of import patterns and dependencies (affects app startup time)
- **Memory Usage**: Clean up event listeners and subscriptions (important in desktop apps)
- **Render Optimization**: Use React.memo judiciously for complex components
- **Database Queries**: Optimize query patterns and result handling (can be large datasets)
- **IPC Overhead**: Minimize data passed between main and renderer processes

## Common Problems

### Node Version Mismatch with better-sqlite3

If you encounter errors related to `better-sqlite3` or node version mismatches:

1. Run `npm rebuild`
2. Push any pending database migrations: `npx drizzle-kit push`
3. Run `npm run rebuild` (specifically this command to rebuild electron)
4. Start development: `npm run dev`

This typically happens when switching Node.js versions or after fresh installs.

## Getting Help

- **Issues**: Check existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: Don't hesitate to ask for clarification
- **Documentation**: Refer to this guide and inline comments

## Final Notes

This is a living document that evolves with the project. When you notice patterns that aren't covered here, or when practices change, please update this guide accordingly.

## Additional Resources

- **Tome Website**: [tomedb.dev](https://tomedb.dev)
- **Electron Documentation**: [electronjs.org](https://electronjs.org)
- **Vite Documentation**: [vitejs.dev](https://vitejs.dev)
- **Drizzle ORM**: [orm.drizzle.team](https://orm.drizzle.team)
- **shadcn/ui**: [ui.shadcn.com](https://ui.shadcn.com)

Thank you for contributing to Tome! 🚀
