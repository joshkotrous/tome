export const COLUMN_DESCRIPTION_PROMPT = `You are a database documentation expert. Generate a concise, informative description for this database column.

Context:
- Connection Description: {connectionDescription}
- Database Schema: {schemaName}
- Table: {tableName}
- Column: {columnName}
- Data Type: {columnType}

Full Schema Context:
{fullSchema}

Table Definition:
{tableDefinition}

Column Definition:
{columnDefinition}

Instructions:
1. Provide a clear, concise description (1-2 sentences) of what this column represents
2. Include the business purpose or meaning of the data stored
3. Note any constraints, relationships, or special characteristics if evident
4. Use professional, technical language appropriate for developers and analysts
5. Do not include the column name or data type in the description (already known)
6. Focus on WHAT the column stores and WHY it's important

Examples of good descriptions:
- "Unique identifier assigned to each customer account upon registration"
- "Timestamp indicating when the record was last modified by any system process"
- "Customer's preferred communication language as a two-letter ISO code"

Generate only the description text, no additional formatting or explanation.`;

export const TABLE_DESCRIPTION_PROMPT = `You are a database documentation expert. Generate a comprehensive description for this database table.

Context:
- Connection Description: {connectionDescription}
- Database Schema: {schemaName}
- Table: {tableName}
- Number of Columns: {columnCount}

Full Schema Context:
{fullSchema}

Table Definition:
{tableDefinition}

Column Definitions:
{columnDefinitions}

Instructions:
1. Provide a clear description (2-3 sentences) of what this table represents in the business domain
2. Explain the primary purpose and key relationships of this table
3. Mention the main entity or concept this table models
4. If relationships are evident from foreign keys, briefly mention key connections
5. Use business-friendly language that both developers and stakeholders can understand
6. Focus on the table's role in the overall data model

Examples of good descriptions:
- "Stores comprehensive customer information including contact details, preferences, and account status. Serves as the central customer registry with relationships to orders, support tickets, and billing information."
- "Tracks individual line items for each customer order, linking products to orders with quantities and pricing. Essential for order fulfillment, inventory management, and revenue reporting."

Generate only the description text, no additional formatting or explanation.`;

export const SCHEMA_DESCRIPTION_PROMPT = `You are a database documentation expert. Generate a comprehensive description for this database schema.

Context:
- Connection Description: {connectionDescription}
- Schema Name: {schemaName}
- Number of Tables: {tableCount}
- Database Context: {databaseName}

Full Schema Definition:
{fullSchema}

Table Definitions:
{tableDefinitions}

Instructions:
1. Provide a comprehensive description (3-4 sentences) of what this schema represents
2. Explain the business domain or functional area this schema covers
3. Describe the main entities and their relationships within this schema
4. Highlight the schema's role in the broader database architecture
5. Use business-oriented language that explains the functional purpose
6. Mention key workflows or processes this schema supports

Examples of good descriptions:
- "Customer Relationship Management schema containing all customer-related entities and interactions. Manages customer profiles, contact information, communication history, and relationship tracking. Central to sales processes, customer service operations, and marketing campaigns."
- "Financial transaction processing schema handling all monetary operations and accounting records. Tracks payments, invoices, refunds, and financial reconciliation. Critical for revenue recognition, financial reporting, and audit compliance."

Generate only the description text, no additional formatting or explanation.`;

export const DATABASE_DESCRIPTION_PROMPT = `You are a database documentation expert. Generate a comprehensive description for this database.

Context:
- Connection Description: {connectionDescription}
- Database Name: {databaseName}
- Number of Schemas: {schemaCount}
- Connection Type: {connectionType}

Full Schema Definitions:
{fullSchemas}

Schema Definitions with Tables:
{schemaDefinitions}

Instructions:
1. Provide a comprehensive description (4-5 sentences) of what this database represents
2. Explain the overall business purpose and domain this database serves
3. Describe the main functional areas covered by the schemas
4. Highlight the database's role in the organization's data architecture
5. Mention key business processes or applications this database supports
6. Use executive-level language that explains the strategic value

Examples of good descriptions:
- "Primary operational database for the e-commerce platform managing all customer-facing and internal business operations. Contains customer management, product catalog, order processing, inventory tracking, and financial transaction schemas. Serves as the single source of truth for customer data, sales analytics, and operational reporting across web, mobile, and administrative applications."
- "Human Resources Information System database managing all employee-related data and HR processes. Encompasses employee profiles, organizational structure, payroll processing, benefits administration, and performance management. Critical for HR operations, compliance reporting, workforce analytics, and integration with third-party HR tools."

Generate only the description text, no additional formatting or explanation.`;

export const CONNECTION_DESCRIPTION_PROMPT = `You are a database documentation expert. Generate a comprehensive description for this database connection.

Context:
- Connection Name: {connectionName}
- User provided description: {connectionDescription}
- Database Engine: {connectionEngine}
- Number of Databases: {databaseCount}
- Connection Host: {connectionHost}

Database Definitions:
{databaseDefinitions}

Full Connection Schema:
{fullConnectionSchema}

Instructions:
1. Provide a comprehensive description (5-6 sentences) of what this database connection represents
2. Explain the overall system or platform this connection provides access to
3. Describe the main business domains and functional areas across all databases
4. Highlight the connection's role in the organization's data ecosystem
5. Mention key business applications, systems, or processes this connection serves
6. Use strategic-level language that explains the organizational and technical value
7. Consider the database engine type and infrastructure context

Examples of good descriptions:
- "Production PostgreSQL cluster serving the core e-commerce platform with comprehensive customer, inventory, and transaction management capabilities. Hosts multiple specialized databases covering customer relationship management, product catalog, order processing, financial transactions, and analytics. Critical infrastructure supporting web applications, mobile apps, administrative tools, and business intelligence systems. Processes millions of transactions daily and serves as the primary data source for real-time operations, reporting, and decision-making across the organization."
- "Microsoft SQL Server instance managing enterprise resource planning and business operations data. Contains databases for human resources, financial management, supply chain operations, and customer service. Integrates with multiple business applications including CRM, ERP, and reporting systems. Essential for daily business operations, regulatory compliance, financial reporting, and strategic planning initiatives."

Generate only the description text, no additional formatting or explanation.`;
