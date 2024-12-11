import { env, fetchMock } from 'cloudflare:test';
import { describe, expect, it, beforeAll } from 'vitest';
import { _createAnimeIdentityService } from '../src';
import { Bindings } from '../src/types/bindings';

describe('Getting Anime internal id from Anilist id', () => {
	beforeAll(() => {
		// Enable outbound request mocking...
		fetchMock.activate();
		// ...and throw errors if an outbound request isn't mocked
		fetchMock.disableNetConnect();
	});

	it('Generates a new internal id and returns it on the second asking', async () => {
		const service = _createAnimeIdentityService({ env: env as Bindings });

		const anilistId = 12345;

		fetchMock
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.get((env as any).ANILIST_API_URL)
			.intercept({ path: '/', method: 'POST' }) // Could also add a "body" matcher delegate here, but seems overhardened for now
			.reply(200, {
				data: {
					Media: {
						id: anilistId,
					},
				},
			});

		const firstRes = await service.getAnimeInternalIdFromAnilistId({ anilistId });
		expect(firstRes.status).to.equal(200);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const internalId = ((await firstRes.json()) as any).data.animeInternalId;
		expect(internalId).toBeDefined();

		// Simulate Anilist being down, in which case we should return from our stored data and not actually hit Anilist
		// So this mock should never be invoked (if it is there's a bug)
		fetchMock
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.get((env as any).ANILIST_API_URL)
			.intercept({ path: '/', method: 'POST' })
			.reply(503, 'Anilist is unavailable');

		const secondRes = await service.getAnimeInternalIdFromAnilistId({ anilistId });
		expect(secondRes.status).to.equal(200);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const sameInternalId = ((await secondRes.json()) as any).data.animeInternalId;

		expect(internalId).toEqual(sameInternalId);
	});
});
