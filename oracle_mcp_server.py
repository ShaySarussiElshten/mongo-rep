"""Oracle Database MCP Server for Bridgewise."""

import os
import oracledb
from mcp.server.fastmcp import FastMCP

# Config
ORACLE_USER = os.getenv("ORACLE_USER", "bridgewise")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD", "bridgewise123")
ORACLE_DSN = os.getenv("ORACLE_DSN", "localhost:1521/XEPDB1")

mcp = FastMCP("oracle-db")


def get_connection():
    return oracledb.connect(user=ORACLE_USER, password=ORACLE_PASSWORD, dsn=ORACLE_DSN)


@mcp.tool()
def list_tables() -> str:
    """List all tables in the current schema."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
        tables = [row[0] for row in cur]
        return "\n".join(tables) if tables else "No tables found."
    finally:
        conn.close()


@mcp.tool()
def describe_table(table_name: str) -> str:
    """Describe a table's columns with data types and constraints.

    Args:
        table_name: Name of the table to describe (case-insensitive).
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT column_name, data_type, data_length, nullable, data_default
            FROM user_tab_columns
            WHERE table_name = UPPER(:1)
            ORDER BY column_id
            """,
            [table_name],
        )
        rows = cur.fetchall()
        if not rows:
            return f"Table '{table_name}' not found."

        lines = [f"Table: {table_name.upper()}", "-" * 60]
        for col_name, dtype, length, nullable, default in rows:
            null_str = "NULL" if nullable == "Y" else "NOT NULL"
            default_str = f" DEFAULT {default.strip()}" if default else ""
            lines.append(f"  {col_name:<25} {dtype}({length}) {null_str}{default_str}")

        # Primary keys
        cur.execute(
            """
            SELECT cols.column_name
            FROM user_constraints cons
            JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
            WHERE cons.table_name = UPPER(:1) AND cons.constraint_type = 'P'
            ORDER BY cols.position
            """,
            [table_name],
        )
        pk_cols = [row[0] for row in cur]
        if pk_cols:
            lines.append(f"\n  PK: ({', '.join(pk_cols)})")

        # Foreign keys
        cur.execute(
            """
            SELECT cols.column_name, r_cons.table_name AS ref_table, r_cols.column_name AS ref_column
            FROM user_constraints cons
            JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
            JOIN user_constraints r_cons ON cons.r_constraint_name = r_cons.constraint_name
            JOIN user_cons_columns r_cols ON r_cons.constraint_name = r_cols.constraint_name
            WHERE cons.table_name = UPPER(:1) AND cons.constraint_type = 'R'
            """,
            [table_name],
        )
        fks = cur.fetchall()
        if fks:
            for col, ref_table, ref_col in fks:
                lines.append(f"  FK: {col} -> {ref_table}({ref_col})")

        return "\n".join(lines)
    finally:
        conn.close()


@mcp.tool()
def run_query(sql: str, max_rows: int = 100) -> str:
    """Execute a read-only SQL query and return results.

    Only SELECT statements are allowed. DML/DDL is blocked.

    Args:
        sql: The SQL SELECT query to execute.
        max_rows: Maximum number of rows to return (default 100).
    """
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT") and not stripped.startswith("WITH"):
        return "Error: Only SELECT/WITH queries are allowed."

    blocked = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "MERGE", "GRANT", "REVOKE"]
    for keyword in blocked:
        if keyword in stripped:
            return f"Error: '{keyword}' statements are not allowed."

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchmany(max_rows)

        if not rows:
            return "Query returned no results."

        # Format as table
        col_widths = [len(c) for c in columns]
        for row in rows:
            for i, val in enumerate(row):
                col_widths[i] = max(col_widths[i], len(str(val) if val is not None else "NULL"))

        header = " | ".join(c.ljust(col_widths[i]) for i, c in enumerate(columns))
        separator = "-+-".join("-" * w for w in col_widths)
        lines = [header, separator]
        for row in rows:
            line = " | ".join(
                str(val if val is not None else "NULL").ljust(col_widths[i])
                for i, val in enumerate(row)
            )
            lines.append(line)

        lines.append(f"\n({len(rows)} row{'s' if len(rows) != 1 else ''})")
        return "\n".join(lines)
    except oracledb.Error as e:
        return f"Oracle error: {e}"
    finally:
        conn.close()


@mcp.tool()
def get_schema_overview() -> str:
    """Get an overview of the database schema: tables, row counts, and relationships."""
    conn = get_connection()
    try:
        cur = conn.cursor()

        # Tables with row counts
        cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
        tables = [row[0] for row in cur]
        if not tables:
            return "No tables found in schema."

        lines = ["Schema Overview", "=" * 50]
        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            lines.append(f"  {table}: {count} rows")

        # Foreign keys
        cur.execute(
            """
            SELECT cons.table_name, cols.column_name,
                   r_cons.table_name AS ref_table, r_cols.column_name AS ref_col
            FROM user_constraints cons
            JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
            JOIN user_constraints r_cons ON cons.r_constraint_name = r_cons.constraint_name
            JOIN user_cons_columns r_cols ON r_cons.constraint_name = r_cols.constraint_name
            WHERE cons.constraint_type = 'R'
            ORDER BY cons.table_name
            """
        )
        fks = cur.fetchall()
        if fks:
            lines.append("\nRelationships:")
            for table, col, ref_table, ref_col in fks:
                lines.append(f"  {table}.{col} -> {ref_table}.{ref_col}")

        return "\n".join(lines)
    finally:
        conn.close()


if __name__ == "__main__":
    mcp.run()
