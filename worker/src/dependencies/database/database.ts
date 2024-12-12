import { Bindings } from '../../types/bindings';

interface IDatabaseAdapter {
	run(query: string, ...values: unknown[]): Promise<Record<string, unknown>[]>;
}

function createDatabaseAdapter({ env }: { env: Bindings }): IDatabaseAdapter {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const db = (env as any)[env.DB_BINDING_NAME] as D1Database;

	return {
		async run(query: string, ...values: unknown[]) {
			const { results } = await db
				.prepare(query)
				.bind(...values)
				.all();

			return results;
		},
	};
}

export { createDatabaseAdapter };
export type { IDatabaseAdapter };
