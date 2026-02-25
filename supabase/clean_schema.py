import re
import os

def clean_sql():
    file_path = r'\\wsl.localhost\Ubuntu-24.04\home\boss\ryumedha\supabase\sqlfile.sql'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract Table DDLs
    tables = re.findall(r'\| (CREATE TABLE [^;]+;)', content)
    
    # Extract RLS Policies
    policies = re.findall(r'\| (CREATE POLICY [^;]+;)', content)
    
    # Extract Enums
    enums = re.findall(r'\| (CREATE TYPE [^;]+;)', content)

    # Reconstruct the file
    schema = []
    schema.append("-- ============================================================================")
    schema.append("-- RYU MEDHA - AUTO-EXTRACTED SCHEMA")
    schema.append("-- ============================================================================")
    schema.append("")
    schema.append("-- STEP 1: ENUMS")
    schema.extend(enums)
    schema.append("")
    schema.append("-- STEP 2: TABLES")
    schema.extend(tables)
    schema.append("")
    schema.append("-- STEP 3: RLS POLICIES")
    schema.extend(policies)

    output_path = r'\\wsl.localhost\Ubuntu-24.04\home\boss\ryumedha\supabase\EXTRACTED_LIVE_SCHEMA.sql'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(schema))
    
    print(f"Schema extracted to {output_path}")

if __name__ == "__main__":
    clean_sql()
