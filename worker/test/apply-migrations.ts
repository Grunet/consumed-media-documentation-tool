import { applyD1Migrations, env } from 'cloudflare:test';

// Setup files run outside isolated storage, and may be run multiple times.
// `applyD1Migrations()` only applies migrations that haven't already been
// applied, therefore it is safe to call this function here.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
await applyD1Migrations((env as any)[(env as any).DB_BINDING_NAME], (env as any).TEST_MIGRATIONS);
