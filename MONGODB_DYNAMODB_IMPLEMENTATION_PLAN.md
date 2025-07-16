# MongoDB and DynamoDB Implementation Plan for Wayfarer/Tome

## Overview

This document outlines the comprehensive plan for adding MongoDB and DynamoDB support to the Wayfarer/Tome database management application. Unlike the MySQL/SQLite extension, this requires significant architectural changes due to the fundamental differences between SQL and NoSQL databases.

## Current State Analysis

### What's Already in Place ✅
- **Extensible type system** with `DatabaseEngineObject` enum pattern
- **Provider-agnostic architecture** in core connection functions
- **IPC handlers** that can be extended for new engines
- **Frontend form system** designed for multiple engines
- **Database schema** supports engine enum extension
- **Well-structured codebase** with clear separation of concerns

### What Needs Complete Implementation ❌
- **NoSQL-specific connection configurations** (MongoDB URI, AWS credentials)
- **Query execution paradigm** (MongoDB aggregation pipelines, DynamoDB key-value operations)
- **Schema discovery** adapted for collections/tables instead of SQL schemas
- **Result formatting** for NoSQL query responses
- **New dependencies** (mongodb, aws-sdk)
- **Logo components** for MongoDB and DynamoDB
- **Frontend forms** for NoSQL-specific connection parameters
- **Query language support** in Monaco editor

---

## Architectural Challenges

### 1. **Query Paradigm Shift**
- **SQL**: `SELECT * FROM users WHERE age > 18`
- **MongoDB**: `db.users.find({ age: { $gt: 18 } })`
- **DynamoDB**: `scan/query` operations with FilterExpressions

### 2. **Schema Concepts**
- **SQL**: Database → Schema → Table → Column
- **MongoDB**: Database → Collection → Document → Field
- **DynamoDB**: Region → Table → Item → Attribute

### 3. **Connection Patterns**
- **SQL**: Host/Port/Database/User/Password
- **MongoDB**: Connection URI (mongodb://...)
- **DynamoDB**: AWS Region/Credentials/Endpoint

---

## Implementation Plan

### 1. Type System Extensions

**File: `src/types.ts`**

Extend the database engine enum and connection configs:

```typescript
// Update the engine enum
export const DatabaseEngineObject = z.enum([
  "Postgres", 
  "MySQL", 
  "SQLite", 
  "MongoDB", 
  "DynamoDB"
]);

// Add NoSQL-specific connection configs
type MongoDBConnectionConfig = {
  uri: string; // Full MongoDB connection URI
  database?: string; // Optional default database
  options?: {
    authSource?: string;
    ssl?: boolean;
    replicaSet?: string;
    readPreference?: string;
  };
};

type DynamoDBConnectionConfig = {
  region: string;
  accessKeyId?: string; // Optional - can use IAM roles
  secretAccessKey?: string;
  endpoint?: string; // For local DynamoDB
  profile?: string; // AWS profile name
};

// Update the union type
export type ConnectionConfig = 
  | PGConnection 
  | MYSQLConnection 
  | SQLiteConnectionConfig
  | MongoDBConnectionConfig
  | DynamoDBConnectionConfig;

// Add NoSQL-specific result types
export interface MongoQueryResult {
  documents: any[];
  totalCount: number;
  collection: string;
  operation: string;
}

export interface DynamoQueryResult {
  items: any[];
  count: number;
  scannedCount?: number;
  lastEvaluatedKey?: any;
  tableName: string;
  operation: 'scan' | 'query' | 'getItem' | 'putItem' | 'updateItem' | 'deleteItem';
}

// Extend JsonQueryResult to handle NoSQL
export type UnifiedQueryResult = JsonQueryResult | MongoQueryResult | DynamoQueryResult;
```

### 2. Database Dependencies

**File: `package.json`**

Add required dependencies:

```json
{
  "dependencies": {
    // ... existing dependencies
    "mongodb": "^6.3.0",
    "aws-sdk": "^2.1691.0",
    // Alternative: "@aws-sdk/client-dynamodb": "^3.485.0",
    // Alternative: "@aws-sdk/lib-dynamodb": "^3.485.0"
  },
  "devDependencies": {
    // ... existing devDependencies
    "@types/mongodb": "^4.0.7"
  }
}
```

### 3. Core Connection Functions

**File: `core/connections/index.ts`**

#### A. Add Import Statements

```typescript
import { MongoClient, Db as MongoDatabase } from 'mongodb';
import { DynamoDB, DocumentClient } from 'aws-sdk';
// Alternative: import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
```

#### B. Update Driver Type

```typescript
type Driver = PgPool | mysql.Connection | any | MongoClient | DynamoDB;
```

#### C. Extend Test Connection

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
    case "MongoDB":
      return await testMongoDBConnection(db.connection);
    case "DynamoDB":
      return await testDynamoDBConnection(db.connection);
    default:
      throw new Error("Unsupported engine");
  }
}

// Add new test functions
async function testMongoDBConnection(connection: ConnectionConfig): Promise<{success: boolean, error: string}> {
  try {
    const mongoConfig = connection as MongoDBConnectionConfig;
    const client = new MongoClient(mongoConfig.uri);
    await client.connect();
    await client.db('admin').admin().ping();
    await client.close();
    return { success: true, error: '' };
  } catch (err) {
    console.error('MongoDB connection test failed:', err);
    return { success: false, error: String(err) };
  }
}

async function testDynamoDBConnection(connection: ConnectionConfig): Promise<{success: boolean, error: string}> {
  try {
    const dynamoConfig = connection as DynamoDBConnectionConfig;
    const dynamoClient = new DynamoDB({
      region: dynamoConfig.region,
      accessKeyId: dynamoConfig.accessKeyId,
      secretAccessKey: dynamoConfig.secretAccessKey,
      endpoint: dynamoConfig.endpoint,
    });
    
    // Test with listTables operation
    await dynamoClient.listTables({ Limit: 1 }).promise();
    return { success: true, error: '' };
  } catch (err) {
    console.error('DynamoDB connection test failed:', err);
    return { success: false, error: String(err) };
  }
}
```

#### D. Extend Connect Function

```typescript
export async function connect(db: Connection): Promise<ConnectionEntry> {
  const existing = connections.get(db.id);
  if (existing) return existing;

  let entry: ConnectionEntry;

  switch (db.engine) {
    case "Postgres": {
      const pool = new PgPool(db.connection as PGConnection);
      await pool.query("SELECT 1");
      entry = { db, driver: pool };
      break;
    }

    case "MySQL": {
      const conn = mysql.createConnection(db.connection as MYSQLConnection);
      conn.ping();
      entry = { db, driver: conn };
      break;
    }

    case "SQLite": {
      const Database = require('better-sqlite3');
      const sqliteDb = new Database((db.connection as any).database);
      entry = { db, driver: sqliteDb };
      break;
    }

    case "MongoDB": {
      const mongoConfig = db.connection as MongoDBConnectionConfig;
      const client = new MongoClient(mongoConfig.uri);
      await client.connect();
      entry = { db, driver: client };
      break;
    }

    case "DynamoDB": {
      const dynamoConfig = db.connection as DynamoDBConnectionConfig;
      const dynamoClient = new DynamoDB({
        region: dynamoConfig.region,
        accessKeyId: dynamoConfig.accessKeyId,
        secretAccessKey: dynamoConfig.secretAccessKey,
        endpoint: dynamoConfig.endpoint,
      });
      entry = { db, driver: dynamoClient };
      break;
    }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }

  connections.set(db.id, entry);
  return entry;
}
```

#### E. Extend Disconnect Function

```typescript
export async function disconnect(db: Connection): Promise<void> {
  const entry = connections.get(db.id);
  if (!entry) return;

  const { driver } = entry;

  if (driver instanceof PgPool) {
    await driver.end();
  } else if ("end" in driver && typeof driver.end === 'function') {
    // MySQL connection
    await (driver as mysql.Connection).end();
  } else if ("close" in driver && typeof driver.close === 'function') {
    // SQLite or MongoDB connection
    if (driver instanceof MongoClient) {
      await driver.close();
    } else {
      (driver as any).close();
    }
  }
  // DynamoDB doesn't need explicit disconnection

  connections.delete(db.id);
}
```

#### F. Rework Query Function for NoSQL

```typescript
export async function query(
  db: Connection,
  queryString: string,
  params: any[] = []
): Promise<UnifiedQueryResult> {
  const entry = connections.get(db.id) ?? (await connect(db));
  const { driver } = entry;

  switch (db.engine) {
    /* --------------------------- SQL DATABASES -------------------------- */
    case "Postgres": {
      const native = await (driver as PgPool).query(queryString, params);
      return toJsonResult("Postgres", native);
    }

    case "MySQL": {
      const native = await new Promise<any>((resolve, reject) =>
        (driver as mysql.Connection).query(queryString, params, (err, rows, fields) =>
          err ? reject(err) : resolve([rows, fields])
        )
      );
      return toJsonResult("MySQL", native);
    }

    case "SQLite": {
      const stmt = (driver as any).prepare(queryString);
      const native = Array.isArray(params) && params.length
        ? stmt.all(...params)
        : stmt.all();
      return toJsonResult("SQLite", native);
    }

    /* --------------------------- MONGODB -------------------------- */
    case "MongoDB": {
      return await executeMongoQuery(driver as MongoClient, queryString, params, db);
    }

    /* --------------------------- DYNAMODB -------------------------- */
    case "DynamoDB": {
      return await executeDynamoQuery(driver as DynamoDB, queryString, params, db);
    }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }
}

// Helper function for MongoDB queries
async function executeMongoQuery(
  client: MongoClient, 
  queryString: string, 
  params: any[], 
  connection: Connection
): Promise<MongoQueryResult> {
  try {
    // Parse the query string to extract database, collection, and operation
    // This is a simplified parser - in reality, you'd want a more robust solution
    const query = JSON.parse(queryString);
    const { database, collection, operation, filter = {}, options = {} } = query;
    
    const db = client.db(database);
    const coll = db.collection(collection);
    
    let documents: any[] = [];
    let totalCount = 0;
    
    switch (operation) {
      case 'find':
        documents = await coll.find(filter, options).toArray();
        totalCount = documents.length;
        break;
      case 'aggregate':
        documents = await coll.aggregate(filter).toArray();
        totalCount = documents.length;
        break;
      case 'findOne':
        const doc = await coll.findOne(filter, options);
        documents = doc ? [doc] : [];
        totalCount = documents.length;
        break;
      default:
        throw new Error(`Unsupported MongoDB operation: ${operation}`);
    }
    
    return {
      documents,
      totalCount,
      collection,
      operation
    };
  } catch (error) {
    throw new Error(`MongoDB query failed: ${error}`);
  }
}

// Helper function for DynamoDB queries
async function executeDynamoQuery(
  dynamoClient: DynamoDB,
  queryString: string,
  params: any[],
  connection: Connection
): Promise<DynamoQueryResult> {
  try {
    const query = JSON.parse(queryString);
    const { tableName, operation, key, item, updateExpression, filterExpression } = query;
    
    let result: any;
    let items: any[] = [];
    
    switch (operation) {
      case 'scan':
        result = await dynamoClient.scan({
          TableName: tableName,
          FilterExpression: filterExpression,
          ...query.options
        }).promise();
        items = result.Items || [];
        break;
        
      case 'query':
        result = await dynamoClient.query({
          TableName: tableName,
          KeyConditionExpression: query.keyConditionExpression,
          FilterExpression: filterExpression,
          ...query.options
        }).promise();
        items = result.Items || [];
        break;
        
      case 'getItem':
        result = await dynamoClient.getItem({
          TableName: tableName,
          Key: key
        }).promise();
        items = result.Item ? [result.Item] : [];
        break;
        
      default:
        throw new Error(`Unsupported DynamoDB operation: ${operation}`);
    }
    
    return {
      items,
      count: items.length,
      scannedCount: result.ScannedCount,
      lastEvaluatedKey: result.LastEvaluatedKey,
      tableName,
      operation: operation as any
    };
  } catch (error) {
    throw new Error(`DynamoDB query failed: ${error}`);
  }
}
```

#### G. Extend Schema Discovery Functions

```typescript
export async function listRemoteDatabases(db: Connection): Promise<string[]> {
  const { driver } = await connect(db);

  switch (db.engine) {
    case "Postgres": {
      const res = await (driver as PgPool).query<{ datname: string }>(`
        SELECT datname FROM pg_database 
        WHERE datistemplate = FALSE AND datallowconn = TRUE 
        ORDER BY datname;
      `);
      return res.rows.map((r) => r.datname);
    }

    case "MySQL": {
      const rows = await new Promise<{ Database: string }[]>(
        (resolve, reject) =>
          (driver as mysql.Connection).query("SHOW DATABASES", (err, rows) =>
            err ? reject(err) : resolve(rows as any)
          )
      );
      return rows.map((r) => r.Database);
    }

    case "SQLite": {
      return [db.connection.database ?? ""];
    }

    case "MongoDB": {
      const client = driver as MongoClient;
      const adminDb = client.db('admin');
      const result = await adminDb.admin().listDatabases();
      return result.databases.map(db => db.name);
    }

    case "DynamoDB": {
      // DynamoDB doesn't have databases - return the region
      const dynamoConfig = db.connection as DynamoDBConnectionConfig;
      return [dynamoConfig.region];
    }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }
}

export async function listSchemas(
  db: Connection,
  targetDb?: string
): Promise<string[]> {
  switch (db.engine) {
    case "Postgres": {
      // ... existing Postgres implementation
    }

    case "MongoDB": {
      // In MongoDB, "schemas" are collections
      const client = (await connect(db)).driver as MongoClient;
      const database = client.db(targetDb);
      const collections = await database.listCollections().toArray();
      return collections.map(c => c.name);
    }

    case "DynamoDB": {
      // In DynamoDB, list all tables in the region
      const dynamoClient = (await connect(db)).driver as DynamoDB;
      const result = await dynamoClient.listTables().promise();
      return result.TableNames || [];
    }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }
}

export async function listSchemaTables(
  db: Connection,
  targetSchema: string,
  targetDb?: string
): Promise<TableDef[]> {
  switch (db.engine) {
    case "Postgres": {
      // ... existing Postgres implementation
    }

    case "MongoDB": {
      // For MongoDB, targetSchema is a collection name
      // We'll sample documents to infer the "schema"
      const client = (await connect(db)).driver as MongoClient;
      const database = client.db(targetDb);
      const collection = database.collection(targetSchema);
      
      // Sample a few documents to infer field structure
      const samples = await collection.find({}).limit(10).toArray();
      const fieldSet = new Set<string>();
      
      samples.forEach(doc => {
        Object.keys(doc).forEach(key => fieldSet.add(key));
      });
      
      const columns = Array.from(fieldSet).map(field => ({
        name: field,
        type: inferMongoFieldType(samples, field),
        nullable: true, // MongoDB fields are typically nullable
        default: null
      }));
      
      return [{
        table: targetSchema,
        columns
      }];
    }

    case "DynamoDB": {
      // For DynamoDB, describe the table to get key schema
      const dynamoClient = (await connect(db)).driver as DynamoDB;
      const result = await dynamoClient.describeTable({
        TableName: targetSchema
      }).promise();
      
      const table = result.Table;
      if (!table) return [];
      
      const columns = [
        ...(table.KeySchema || []).map(key => ({
          name: key.AttributeName,
          type: getAttributeType(table.AttributeDefinitions, key.AttributeName),
          nullable: false,
          default: null
        })),
        // Add other known attributes from AttributeDefinitions
        ...(table.AttributeDefinitions || [])
          .filter(attr => !table.KeySchema?.some(key => key.AttributeName === attr.AttributeName))
          .map(attr => ({
            name: attr.AttributeName,
            type: attr.AttributeType,
            nullable: true,
            default: null
          }))
      ];
      
      return [{
        table: targetSchema,
        columns
      }];
    }

    default:
      throw new Error(`Unsupported engine ${db.engine as string}`);
  }
}

// Helper functions
function inferMongoFieldType(samples: any[], field: string): string {
  const types = samples
    .filter(doc => doc[field] !== undefined)
    .map(doc => typeof doc[field]);
  
  const uniqueTypes = [...new Set(types)];
  return uniqueTypes.length === 1 ? uniqueTypes[0] : 'mixed';
}

function getAttributeType(definitions: any[], attributeName: string): string {
  const def = definitions?.find(d => d.AttributeName === attributeName);
  return def?.AttributeType || 'string';
}
```

### 4. Frontend Form Updates

**File: `src/components/addDatabaseButton.tsx`**

#### A. Update Engine Selection Grid

```typescript
// Update grid to accommodate 5 engines
<div className="w-full grid grid-cols-5 text-center gap-4 items-center justify-center">
  {DatabaseEngineObject.options
    .map((i) => (
      <Button
        key={i}
        onClick={() => setEngine(i)}
        className={cn(
          `size-48 border rounded-md flex flex-col text-lg`,
          i === engine && "bg-accent"
        )}
      >
        <div className="size-20 flex items-center justify-center">
          {getEngineLogo(i)}
        </div>
        {i}
      </Button>
    ))}
</div>
```

#### B. Add Logo Components

**File: `src/components/logos/mongodb.tsx`**

```typescript
import { cn } from "@/lib/utils";

export default function MongoDBLogo({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("text-green-500", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    </svg>
  );
}
```

**File: `src/components/logos/dynamodb.tsx`**

```typescript
import { cn } from "@/lib/utils";

export default function DynamoDBLogo({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn("text-orange-500", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      {/* AWS DynamoDB logo SVG path */}
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </svg>
  );
}
```

#### C. Update Engine Logo Function

```typescript
export function getEngineLogo(engine: DatabaseEngine) {
  switch (engine) {
    case "Postgres":
      return <PostgresLogo className="size-20" />;
    case "MySQL":
      return <MySQLLogo className="size-30" />;
    case "SQLite":
      return <SQLiteLogo className="size-20" />;
    case "MongoDB":
      return <MongoDBLogo className="size-20" />;
    case "DynamoDB":
      return <DynamoDBLogo className="size-20" />;
  }
}
```

#### D. Add NoSQL Connection Forms

```typescript
export function ConnectionDetailsForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange: React.Dispatch<SetStateAction<any>>;
}) {
  function getForm() {
    switch (values.engine) {
      case "Postgres":
        return <GeneralConnectionForm values={values} onChange={onChange} />;
      case "MySQL":
        return <MySQLConnectionForm values={values} onChange={onChange} />;
      case "SQLite":
        return <SQLiteConnectionForm values={values} onChange={onChange} />;
      case "MongoDB":
        return <MongoDBConnectionForm values={values} onChange={onChange} />;
      case "DynamoDB":
        return <DynamoDBConnectionForm values={values} onChange={onChange} />;
    }
  }

  return (
    <div className="w-full space-y-4">
      {getForm()}
      {/* Semantic index toggle - may not apply to all NoSQL databases */}
    </div>
  );
}

export function MongoDBConnectionForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange: React.Dispatch<SetStateAction<any>>;
}) {
  const handleConnectionChange = (field: string, value: any) => {
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
        <h2 className="font-semibold">MongoDB Connection Details</h2>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="uri">Connection URI</Label>
          <Input
            value={values.connection.uri || ""}
            id="uri"
            placeholder="mongodb://username:password@host:port/database"
            onChange={(e) => handleConnectionChange("uri", e.target.value)}
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">
            Full MongoDB connection string including authentication
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="database">Default Database (Optional)</Label>
          <Input
            value={values.connection.database || ""}
            id="database"
            placeholder="myapp"
            onChange={(e) => handleConnectionChange("database", e.target.value)}
          />
        </div>

        {/* Advanced options */}
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-medium">
            Advanced Options
          </summary>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="authSource">Auth Source</Label>
              <Input
                value={values.connection.options?.authSource || ""}
                id="authSource"
                placeholder="admin"
                onChange={(e) => handleConnectionChange("options", {
                  ...values.connection.options,
                  authSource: e.target.value
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replicaSet">Replica Set</Label>
              <Input
                value={values.connection.options?.replicaSet || ""}
                id="replicaSet"
                placeholder="rs0"
                onChange={(e) => handleConnectionChange("options", {
                  ...values.connection.options,
                  replicaSet: e.target.value
                })}
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export function DynamoDBConnectionForm({
  values,
  onChange,
}: {
  values: Omit<Connection, "id"> | Connection;
  onChange: React.Dispatch<SetStateAction<any>>;
}) {
  const handleConnectionChange = (field: string, value: any) => {
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
        <h2 className="font-semibold">DynamoDB Connection Details</h2>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="region">AWS Region</Label>
          <Select
            value={values.connection.region || ""}
            onValueChange={(value) => handleConnectionChange("region", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select AWS region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
              <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
              <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
              <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
              {/* Add more regions as needed */}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="accessKeyId">Access Key ID</Label>
            <Input
              value={values.connection.accessKeyId || ""}
              id="accessKeyId"
              placeholder="AKIA..."
              onChange={(e) => handleConnectionChange("accessKeyId", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secretAccessKey">Secret Access Key</Label>
            <Input
              value={values.connection.secretAccessKey || ""}
              id="secretAccessKey"
              type="password"
              placeholder="••••••••"
              onChange={(e) => handleConnectionChange("secretAccessKey", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile">AWS Profile (Optional)</Label>
          <Input
            value={values.connection.profile || ""}
            id="profile"
            placeholder="default"
            onChange={(e) => handleConnectionChange("profile", e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            Use AWS profile instead of explicit credentials
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="endpoint">Custom Endpoint (Optional)</Label>
          <Input
            value={values.connection.endpoint || ""}
            id="endpoint"
            placeholder="http://localhost:8000"
            onChange={(e) => handleConnectionChange("endpoint", e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            For local DynamoDB or custom endpoints
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 5. Update Database Schema

**File: `db/schema.ts`**

```typescript
// Update the engine enum to include NoSQL databases
engine: text("engine", { enum: ["Postgres", "MySQL", "SQLite", "MongoDB", "DynamoDB"] })
  .$type<DatabaseEngine>()
  .notNull(),
```

**Migration Required:**
```sql
-- This will require a new migration to update the enum constraint
-- Create migration: drizzle-kit generate:sqlite
```

### 6. Query Interface Enhancements

**File: `src/components/editor.tsx` (or similar)**

Add query templates for NoSQL databases:

```typescript
const getQueryTemplate = (engine: DatabaseEngine): string => {
  switch (engine) {
    case "Postgres":
    case "MySQL":
    case "SQLite":
      return "SELECT * FROM table_name LIMIT 10;";
    case "MongoDB":
      return JSON.stringify({
        database: "mydb",
        collection: "mycollection", 
        operation: "find",
        filter: {},
        options: { limit: 10 }
      }, null, 2);
    case "DynamoDB":
      return JSON.stringify({
        tableName: "MyTable",
        operation: "scan",
        options: { Limit: 10 }
      }, null, 2);
    default:
      return "";
  }
};
```

### 7. Result Display Component

**File: `src/components/queryDisplay.tsx`**

Update to handle NoSQL results:

```typescript
export function QueryResultDisplay({ result, engine }: { 
  result: UnifiedQueryResult, 
  engine: DatabaseEngine 
}) {
  if (engine === "MongoDB" && "documents" in result) {
    return <MongoResultDisplay result={result} />;
  }
  
  if (engine === "DynamoDB" && "items" in result) {
    return <DynamoResultDisplay result={result} />;
  }
  
  // Default SQL result display
  return <SQLResultDisplay result={result as JsonQueryResult} />;
}

function MongoResultDisplay({ result }: { result: MongoQueryResult }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">
          {result.collection} ({result.operation})
        </h3>
        <span className="text-sm text-muted-foreground">
          {result.totalCount} documents
        </span>
      </div>
      <div className="font-mono text-sm bg-muted p-4 rounded-md overflow-auto">
        <pre>{JSON.stringify(result.documents, null, 2)}</pre>
      </div>
    </div>
  );
}

function DynamoResultDisplay({ result }: { result: DynamoQueryResult }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">
          {result.tableName} ({result.operation})
        </h3>
        <span className="text-sm text-muted-foreground">
          {result.count} items
          {result.scannedCount && ` (${result.scannedCount} scanned)`}
        </span>
      </div>
      <div className="font-mono text-sm bg-muted p-4 rounded-md overflow-auto">
        <pre>{JSON.stringify(result.items, null, 2)}</pre>
      </div>
    </div>
  );
}
```

### 8. Monaco Editor Configuration

**File: `src/components/monacoConfig.tsx`**

Add language support for MongoDB and DynamoDB queries:

```typescript
export const configureMonacoForNoSQL = (monaco: any, engine: DatabaseEngine) => {
  switch (engine) {
    case "MongoDB":
      // Register MongoDB query language
      monaco.languages.register({ id: 'mongodb' });
      monaco.languages.setMonarchTokensProvider('mongodb', {
        tokenizer: {
          root: [
            [/\b(find|aggregate|insertOne|updateOne|deleteOne)\b/, 'keyword'],
            [/\b(\$gt|\$lt|\$eq|\$ne|\$in|\$nin|\$exists)\b/, 'operator'],
            // Add more MongoDB-specific tokens
          ]
        }
      });
      break;
      
    case "DynamoDB":
      // Register DynamoDB query language (JSON-based)
      monaco.languages.register({ id: 'dynamodb' });
      monaco.languages.setMonarchTokensProvider('dynamodb', {
        tokenizer: {
          root: [
            [/\b(scan|query|getItem|putItem|updateItem|deleteItem)\b/, 'keyword'],
            [/\b(TableName|KeyConditionExpression|FilterExpression)\b/, 'attribute'],
            // Add more DynamoDB-specific tokens
          ]
        }
      });
      break;
  }
};
```

---

## Implementation Phases

### Phase 1: Foundation (Priority 1)
1. **Add dependencies** (mongodb, aws-sdk)
2. **Update type definitions** for NoSQL engines
3. **Extend database schema** enum
4. **Create logo components** for MongoDB and DynamoDB
5. **Basic connection testing** functions

### Phase 2: Core Functionality (Priority 2)
1. **Implement connect/disconnect** for NoSQL engines
2. **Create basic query execution** framework
3. **Add NoSQL connection forms** to frontend
4. **Update engine selection** UI
5. **Test basic connection flow**

### Phase 3: Query System (Priority 3)
1. **Implement MongoDB query execution**
2. **Implement DynamoDB query execution**
3. **Create query templates** for each engine
4. **Update result display** components
5. **Add Monaco editor** language support

### Phase 4: Schema Discovery (Priority 4)
1. **Implement database/collection listing**
2. **Schema inference** for MongoDB
3. **Table description** for DynamoDB
4. **Update schema browsing** UI
5. **Full schema generation**

### Phase 5: Advanced Features (Priority 5)
1. **Query optimization** and caching
2. **Advanced connection options**
3. **Bulk operations** support
4. **Performance monitoring**
5. **Comprehensive error handling**

---

## Key Files to Modify

### Core Logic
- ```5:71:core/connections/index.ts``` - Add NoSQL test functions
- ```105:133:core/connections/index.ts``` - Add MongoDB/DynamoDB connect()
- ```135:144:core/connections/index.ts``` - Update disconnect() for NoSQL
- ```195:272:core/connections/index.ts``` - Complete query system overhaul
- ```284:475:core/connections/index.ts``` - Add NoSQL schema discovery

### Type System
- ```5:5:src/types.ts``` - Extend DatabaseEngineObject enum
- ```10:24:src/types.ts``` - Add NoSQL connection configs
- ```src/types.ts``` - Add NoSQL result types

### Frontend
- ```5:5:db/schema.ts``` - Update engine enum in schema
- ```300:402:src/components/addDatabaseButton.tsx``` - Add NoSQL forms
- ```src/components/logos/``` - Create MongoDB/DynamoDB logos
- ```src/components/queryDisplay.tsx``` - Add NoSQL result displays

### Dependencies
- ```package.json``` - Add mongodb and aws-sdk packages

---

## Architectural Considerations

### 1. **Query Language Abstraction**
The current `query()` function assumes SQL. For NoSQL:
- **MongoDB**: JSON-based query objects
- **DynamoDB**: Parameter-based operations
- **Solution**: Create query builders or use JSON format for all NoSQL queries

### 2. **Schema Concept Mapping**
```
SQL:      Database → Schema → Table → Column
MongoDB:  Database → Collection → Document → Field  
DynamoDB: Region → Table → Item → Attribute
```

### 3. **Result Format Standardization**
- **SQL**: Tabular data (rows/columns)
- **MongoDB**: Document arrays
- **DynamoDB**: Item arrays with attributes
- **Solution**: Engine-specific result components

### 4. **Connection Management**
- **SQL**: Connection pools
- **MongoDB**: Client connections with database switching
- **DynamoDB**: Service clients (stateless)

---

## Testing Strategy

### Connection Testing
1. **MongoDB** - Test with local MongoDB instance and MongoDB Atlas
2. **DynamoDB** - Test with local DynamoDB and AWS DynamoDB
3. **Authentication** - Test various auth methods for each engine

### Query Testing
1. **MongoDB** - Test find, aggregate, insert, update, delete operations
2. **DynamoDB** - Test scan, query, getItem, putItem, updateItem operations
3. **Error handling** - Test malformed queries and connection failures

### Schema Discovery Testing
1. **MongoDB** - Test collection listing and field inference
2. **DynamoDB** - Test table listing and key schema discovery
3. **Performance** - Test with large datasets

---

## Risk Mitigation

### Potential Issues
1. **Authentication complexity** - AWS credentials, MongoDB auth methods
2. **Query format** - JSON vs SQL paradigm shift
3. **Schema inference** - NoSQL flexible schemas
4. **Connection management** - Different connection patterns
5. **Result formatting** - Nested/complex data structures

### Mitigation Strategies
1. **Comprehensive documentation** for connection setup
2. **Query templates** and examples for each engine
3. **Graceful fallbacks** for schema discovery failures
4. **Robust error handling** with user-friendly messages
5. **Progressive enhancement** - start with basic features

---

## Success Criteria

### Functional Requirements ✅
- [ ] Users can create MongoDB connections
- [ ] Users can create DynamoDB connections
- [ ] All NoSQL connection types can be tested
- [ ] Basic queries work for both engines
- [ ] Schema discovery works for collections/tables
- [ ] Results display properly for each engine type

### Technical Requirements ✅
- [ ] No regression in existing SQL functionality
- [ ] Type safety maintained across all engines
- [ ] Clean separation of SQL vs NoSQL logic
- [ ] Performance is acceptable for NoSQL operations
- [ ] Error handling covers NoSQL-specific scenarios

### User Experience Requirements ✅
- [ ] Forms are intuitive for NoSQL connection parameters
- [ ] Query templates help users get started
- [ ] Results are displayed in a readable format
- [ ] Schema browsing works intuitively for NoSQL
- [ ] Connection switching preserves context appropriately

This plan provides a systematic approach to adding NoSQL database support while maintaining the existing SQL functionality and architectural patterns of the Wayfarer/Tome application. 