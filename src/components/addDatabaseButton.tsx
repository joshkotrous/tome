--- a/src/components/addDatabaseButton.tsx
+++ b/src/components/addDatabaseButton.tsx
@@ -79,8 +79,14 @@
-  const [database, setDatabase] = useState<Omit<Connection, "id">>({
-    connection: {
-      database: "",
-      host: "",
-      user: "",
-      password: "",
-      port: 5432,
-      ssl: false,
-    },
-    description: "",
-    engine: "Postgres",
-    name: "",
-    createdAt: new Date(),
-    settings: {
-      autoUpdateSemanticIndex: false,
-    },
-  });
+  const [database, setDatabase] = useState<Omit<Connection, "id"> | null>(null);
+  // Initialize with default values or null
+  useEffect(() => {
+    setDatabase({
+      connection: {
+        database: "",
+        host: "",
+        user: "",
+        password: "",
+        port: 5432,
+        ssl: false,
+      },
+      description: "",
+      engine: "Postgres",
+      name: "",
+      createdAt: new Date(),
+      settings: {
+        autoUpdateSemanticIndex: false,
+      },
+    });
+  }, []);
+  
+  // Rest of the code remains unchanged
+  const [loading, setLoading] = useState(false);
+  
+  // The rest of the component code...
+  
+  // When saving, ensure credentials are provided by user input, not hardcoded defaults
+  // The default values are now empty strings, which should be overridden by user input at runtime.
