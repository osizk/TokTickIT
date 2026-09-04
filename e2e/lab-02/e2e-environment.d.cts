export const E2E_SCHEMA_ALLOWLIST: readonly string[];

export function readEnvFile(filePath: string): Record<string, string>;

export function assertAllowedE2ESchema(schemaValue: unknown): string;

export function assertDisposableDatabaseUrl(baseDatabaseUrl?: string | null): {
  baseDatabaseUrl: string;
  databaseName: string;
};

export function assertSafeE2EEnvironment(args: {
  baseDatabaseUrl?: string | null;
  schemaName?: unknown;
}): {
  baseDatabaseUrl: string;
  databaseName: string;
  schemaName: string;
};
