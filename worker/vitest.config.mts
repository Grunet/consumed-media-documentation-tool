import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';
import { readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
	// These need to run in a Node.js context, which is why they're here and not in the apply-migrations.ts file (which runs in a workerd context)
	// See https://github.com/cloudflare/workers-sdk/issues/5590 for more context
	const migrationsPath = path.join(__dirname, './src/dependencies/database/migrations');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		test: {
			setupFiles: ['./test/apply-migrations.ts'],
			poolOptions: {
				workers: {
					wrangler: { configPath: './wrangler.toml' },
					miniflare: {
						// Add a test-only binding for migrations, so we can apply them in a
						// setup file
						bindings: { TEST_MIGRATIONS: migrations },
					},
				},
			},
		},
	};
});
