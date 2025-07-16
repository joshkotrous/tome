# MySQL and SQLite Implementation Plan for Wayfarer/Tome

## Overview

This document outlines the comprehensive plan for adding MySQL and SQLite support to the Wayfarer/Tome database management application. The codebase already has a well-structured architecture that supports multiple database engines, with MySQL and SQLite code partially implemented but currently disabled.

## Current State Analysis

### What's Already in Place ✅
- **Type definitions** for all three engines (`DatabaseEngineObject`)
- **Database schema** supports all engines via enum constraint
- **Required dependencies** installed (`mysql`, `better-sqlite3`)
- **Logo components** for all engines (PostgresLogo, MySQLLogo, SQLiteLogo)
- **IPC handlers** are engine-agnostic and will work with new engines
- **Core architecture** designed with provider-agnostic patterns

### What Needs Implementation ❌
- **Core connection functions** have MySQL/SQLite code commented out
- **Frontend UI** filters out MySQL/SQLite in engine selection
- **Engine-specific forms** for connection configuration
- **File browser integration** for SQLite database files
- **Comprehensive testing** for new engines

---

## Implementation Plan

### 1. Type System Updates

**File: `src/types.ts`**

Extend ConnectionConfig to properly support SQLite:

```typescript
// Add SQLite-specific connection config
type SQLiteConnectionConfig = {
  database: string; // file path for SQLite
};

// Update the union type
export type ConnectionConfig = PGConnection | MYSQLConnection | SQLiteConnectionConfig;
```

### 2. Core Connection Functions

**File: `core/connections/index.ts`**

#### A. Enable Test Connection Support

Update `testConnection()` function:

```typescript
export async function testConnection(
  db: Omit<Connection, "id">
): Promise<{ success: boolean; error: string }> {
  switch (db.engine) {
    case "Postgres":
      return await testPostgresConnection(db.connection);
    case "MySQL":
      return await testMySQLConnection(db.connection);
    case "SQLite":
      return await testSQLiteConnection(db.connection);
    default:
      throw new Error("Unsupported engine");
  }
}

// Add new test functions
async function testMySQLConnection(connection: ConnectionConfig): Promise<{success: boolean, error: string}> {
  const conn = mysql.createConnection(connection as MYSQLConnection);
  
  try {
    await new Promise((resolve, reject) => {
      conn.connect(err => err ? reject(err) : resolve(void 0));
    });
    await new Promise((resolve, reject) => {
      conn.query('SELECT 1', (err, results) => err ? reject(err) : resolve(results));
    });
    return { success: true, error: '' };
  } catch (err) {
    console.error('MySQL connection test failed:', err);
    return { success: false, error: String(err) };
  } finally {
    conn.end().catch(() => undefined);
  }
}

async function testSQLiteConnection(connection: ConnectionConfig): Promise<{success: boolean, error: string}> {
  try {
    const Database = require('better-sqlite3');
    const db = new Database((connection as any).database);
    db.prepare('SELECT 1').get();
    db.close();
    return { success: true, error: '' };
  } catch (err) {
    console.error('SQLite connection test failed:', err);
    return { success: false, error: String(err) };
  }
}
```

#### B. Uncomment and Fix Connection Management

**In `connect()` function - Add SQLite case:**

```typescript
case "SQLite": {
  const Database = require('better-sqlite3');
  const sqliteDb = new Database((db.connection as any).database);
  entry = { db, driver: sqliteDb };
  break;
}
```

**In `disconnect()` function - Add SQLite handling:**

```typescript
export async function disconnect(db: Connection): Promise<void> {
  const entry = connections.get(db.id);
  if (!entry) return;

  const { driver } = entry;

  if (driver instanceof PgPool) await driver.end();
  else if ("end" in driver && typeof driver.end === 'function') {
    // MySQL connection
    await (driver as mysql.Connection).end();
  } else if ("close" in driver && typeof driver.close === 'function') {
    // SQLite connection
    (driver as any).close();
  }

  connections.delete(db.id);
}
```

#### C. Uncomment Query Execution

**Update `toJsonResult()` function - ensure all cases work:**

```typescript
function toJsonResult(engine: Connection["engine"], result: any): JsonQueryResult {
  switch (engine) {
    case "Postgres": {
      const pgRes = result as QueryResult<any>;
      return {
        columns: pgRes.fields.map((f) => f.name),
        rows: pgRes.rows,
        rowCount: pgRes.rowCount ?? 0,
      };
    }
    case "MySQL": {
      const [rows, fields] = result as [any[], mysql.FieldInfo[]];
      return {
        columns: fields.map((f) => f.name),
        rows,
        rowCount: rows.length,
      };
    }
    case "SQLite": {
      const rows = result as any[];
      return {
        columns: rows.length ? Object.keys(rows[0]) : [],
        rows,
        rowCount: rows.length,
      };
    }
    default:
      throw new Error(`Unsupported engine ${engine as string}`);
  }
}
```

#### D. Uncomment Schema Discovery Functions

**Uncomment and fix `listSchemas()`, `listSchemaTables()`, `listRemoteDatabases()`:**

- Remove comment blocks around MySQL and SQLite implementations
- Fix any syntax errors or missing imports
- Test each function individually

### 3. Frontend Form Updates

**File: `src/components/addDatabaseButton.tsx`**

#### A. Enable All Engine Selection

**Line 334 - Remove Postgres-only filter:**

```typescript
// BEFORE:
DatabaseEngineObject.options
  .filter((i) => i === "Postgres") // REMOVE THIS LINE
  .map((i) => (

// AFTER:
DatabaseEngineObject.options
  .map((i) => (
```

#### B. Add Engine-Specific Forms

**Update `ConnectionDetailsForm` component:**

```typescript
export function ConnectionDetailsForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange:
    | React.Dispatch<SetStateAction<Omit<Connection, "id">>>
    | React.Dispatch<SetStateAction<Connection>>;
}) {
  function getForm() {
    switch (values.engine) {
      case "Postgres":
        return <GeneralConnectionForm values={values} onChange={onChange} />;
      case "MySQL":
        return <MySQLConnectionForm values={values} onChange={onChange} />;
      case "SQLite":
        return <SQLiteConnectionForm values={values} onChange={onChange} />;
    }
  }

  return (
    <div className="w-full space-y-4">
      {getForm()}
      {/* Keep existing semantic index toggle */}
    </div>
  );
}
```

#### C. Create New Form Components

**Add MySQLConnectionForm:**

```typescript
export function MySQLConnectionForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange: React.Dispatch<SetStateAction<any>>;
}) {
  const handleConnectionChange = (
    field: keyof ConnectionConfig,
    value: string | number | boolean
  ) => {
    onChange((prev: any) => ({
      ...prev,
      connection: {
        ...prev.connection,
        [field]: value,
      },
    }));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold">MySQL Connection Details</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Similar to GeneralConnectionForm but MySQL-specific */}
        <div className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            value={values.connection.host}
            id="host"
            placeholder="localhost"
            onChange={(e) => handleConnectionChange("host", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            value={values.connection.port || 3306}
            id="port"
            type="number"
            placeholder="3306"
            onChange={(e) => handleConnectionChange("port", parseInt(e.target.value))}
          />
        </div>
        {/* Add remaining MySQL-specific fields */}
      </div>
    </div>
  );
}
```

**Add SQLiteConnectionForm:**

```typescript
export function SQLiteConnectionForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange: React.Dispatch<SetStateAction<any>>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConnectionChange = (field: string, value: string) => {
    onChange((prev: any) => ({
      ...prev,
      connection: {
        ...prev.connection,
        [field]: value,
      },
    }));
  };

  const selectDatabaseFile = async () => {
    setLoading(true);
    try {
      const filePath = await window.files.selectDatabase();
      if (filePath) {
        handleConnectionChange("database", filePath);
      }
    } catch (error) {
      console.error("Failed to select database file:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold">SQLite Database File</h2>
      </div>
      <div className="space-y-2">
        <Label htmlFor="database">Database File Path</Label>
        <div className="flex gap-2">
          <Input
            value={values.connection.database || ""}
            id="database"
            placeholder="/path/to/database.db"
            onChange={(e) => handleConnectionChange("database", e.target.value)}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            onClick={selectDatabaseFile}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Browse"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### D. Update Validation Logic

**Update form validation to handle different engine requirements:**

```typescript
function isConnectionValid(database: Omit<Connection, "id">): boolean {
  if (!database.engine || !database.name) return false;
  
  switch (database.engine) {
    case "Postgres":
    case "MySQL":
      return !!(
        database.connection.host &&
        database.connection.user &&
        database.connection.password &&
        database.connection.port &&
        database.connection.database
      );
    case "SQLite":
      return !!(database.connection.database);
    default:
      return false;
  }
}
```

### 4. File Browser Integration (SQLite)

**File: `electron/handlers/` (create new handler or add to existing)**

```typescript
// Add to electron main process
import { dialog } from 'electron';

ipcMain.handle('files:selectDatabase', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result.canceled ? null : result.filePaths[0];
});
```

**File: `electron/bridge/` (create files bridge)**

```typescript
// electron/bridge/files.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("files", {
  selectDatabase: () => ipcRenderer.invoke("files:selectDatabase"),
});
```

**File: `src/global.d.ts` (add to Window interface)**

```typescript
interface FilesApi {
  selectDatabase: () => Promise<string | null>;
}

declare global {
  interface Window {
    // ... existing APIs
    files: FilesApi;
  }
}
```

### 5. Engine-Specific Defaults and Helpers

**File: `src/components/addDatabaseButton.tsx`**

```typescript
const getDefaultConnection = (engine: DatabaseEngine): ConnectionConfig => {
  switch (engine) {
    case "Postgres":
      return {
        database: "",
        host: "",
        user: "",
        password: "",
        port: 5432,
        ssl: false,
      };
    case "MySQL":
      return {
        database: "",
        host: "",
        user: "",
        password: "",
        port: 3306,
      };
    case "SQLite":
      return {
        database: "",
      };
  }
};

// Update the default database state initialization
const [database, setDatabase] = useState<Omit<Connection, "id">>({
  connection: getDefaultConnection("Postgres"),
  description: "",
  engine: "Postgres",
  name: "",
  createdAt: new Date(),
  settings: {
    autoUpdateSemanticIndex: false,
  },
});

// Update engine change handler
function handleEngineChange(engine: DatabaseEngine) {
  setDatabase((prev) => ({
    ...prev,
    engine,
    connection: getDefaultConnection(engine),
  }));
}
```

### 6. Update Preload and Main Process

**File: `electron/preload.ts`**

Ensure all bridge files are imported:

```typescript
import "./bridge/connections";
import "./bridge/files"; // Add this line
// ... other imports
```

---

## Implementation Phases

### Phase 1: Core Functionality (Priority 1)
1. **Uncomment and fix core connection functions** in `core/connections/index.ts`
2. **Add missing test connection functions** for MySQL and SQLite
3. **Update type definitions** for SQLite connection config
4. **Basic connection management** (connect/disconnect)

### Phase 2: Frontend Integration (Priority 2)  
1. **Remove engine filter** in frontend form
2. **Create engine-specific form components**
3. **Update form validation logic**
4. **Test basic connection flow**

### Phase 3: File System Integration (Priority 3)
1. **Implement file browser** for SQLite
2. **Add file selection IPC handlers**
3. **Update global type definitions**
4. **Test SQLite file selection**

### Phase 4: Schema Discovery (Priority 4)
1. **Implement database listing** for MySQL/SQLite
2. **Schema introspection** functions
3. **Table and column discovery**
4. **Full schema generation**

### Phase 5: Testing and Polish (Priority 5)
1. **Comprehensive testing** of all engines
2. **Error handling improvements**
3. **User experience enhancements**
4. **Documentation updates**

---

## Key Files to Modify

### Core Logic
- ```5:71:core/connections/index.ts``` - Uncomment MySQL/SQLite test functions
- ```105:133:core/connections/index.ts``` - Add SQLite to connect() function
- ```135:144:core/connections/index.ts``` - Update disconnect() for SQLite
- ```195:234:core/connections/index.ts``` - Uncomment query execution
- ```284:318:core/connections/index.ts``` - Uncomment listSchemas()
- ```320:475:core/connections/index.ts``` - Uncomment listSchemaTables()

### Frontend  
- ```334:334:src/components/addDatabaseButton.tsx``` - Remove Postgres filter
- ```364:380:src/components/addDatabaseButton.tsx``` - Add engine-specific forms
- ```src/types.ts``` - Extend ConnectionConfig for SQLite

### Electron Integration
- ```electron/handlers/``` - Add file picker handlers
- ```electron/bridge/``` - Add file picker bridge
- ```electron/preload.ts``` - Import new bridge
- ```src/global.d.ts``` - Add FilesApi interface

---

## Testing Strategy

### Connection Testing
1. **Postgres** - Existing functionality (ensure no regression)
2. **MySQL** - Test with local MySQL instance
3. **SQLite** - Test with local .db files

### Schema Discovery Testing  
1. **Database listing** for each engine
2. **Schema enumeration** 
3. **Table and column introspection**
4. **Query execution** with different parameter types

### UI/UX Testing
1. **Engine selection** works correctly
2. **Form validation** for each engine type
3. **File browser** integration for SQLite
4. **Error messages** are helpful and specific

---

## Risk Mitigation

### Potential Issues
1. **Commented code may be outdated** - Review and update before uncommenting
2. **Type mismatches** between engines - Ensure proper type guards
3. **File permissions** for SQLite databases - Handle gracefully
4. **Connection timeouts** - Implement proper timeout handling

### Testing Approach
1. **Incremental implementation** - Test each phase thoroughly
2. **Fallback mechanisms** - Graceful degradation if features fail
3. **Comprehensive error handling** - User-friendly error messages
4. **Cross-platform testing** - Ensure SQLite file paths work on all OS

---

## Success Criteria

### Functional Requirements ✅
- [ ] Users can create MySQL connections
- [ ] Users can create SQLite connections  
- [ ] All connection types can be tested
- [ ] Schema discovery works for all engines
- [ ] Queries execute correctly for all engines
- [ ] File browser works for SQLite databases

### Technical Requirements ✅
- [ ] No regression in existing Postgres functionality
- [ ] Type safety maintained across all engines
- [ ] Error handling is comprehensive
- [ ] Code follows existing patterns and conventions
- [ ] Performance is acceptable for all engines

### User Experience Requirements ✅
- [ ] Forms are intuitive for each engine type
- [ ] Validation messages are clear and helpful
- [ ] File selection is smooth and reliable
- [ ] Connection testing provides clear feedback
- [ ] Engine switching preserves appropriate form state

This plan provides a systematic approach to implementing MySQL and SQLite support while leveraging the existing well-architected foundation of the Wayfarer/Tome application. 