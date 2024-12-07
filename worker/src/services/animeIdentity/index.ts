import { IDatabaseAdapter } from '../../dependencies/database/database';

interface IAnimeIdentityService {
	getAnimeInternalIdFromAnilistId({ anilistId }: { anilistId: number }): Promise<{ animeInternalId: number }>;
}

function createAnimeIdentityService({
	dbAdapter,
	anilistApiUrl,
}: {
	dbAdapter: IDatabaseAdapter;
	anilistApiUrl: string;
}): IAnimeIdentityService {
	return {
		async getAnimeInternalIdFromAnilistId({ anilistId }) {
			const res = await dbAdapter.run('SELECT InternalId FROM AnimeIdentity_Anime WHERE AnilistId = ?', anilistId);
			if (res.length > 0 && typeof res[0]['InternalId'] === 'number') {
				return {
					animeInternalId: res[0]['InternalId'],
				};
			}

			const anilistIdIsValid = await checkIfAnilistIdIsValid({ anilistApiUrl, anilistId });
			if (!anilistIdIsValid) {
				throw new Error(`Invalid Anilist id: ${anilistId}`);
			}

			// If this method is hit twice in quick succession, this line might run twice
			// The DB should be enforcing a unique constraint on AnilistId that will cause one of the inserts to error
			await dbAdapter.run(`INSERT INTO AnimeIdentity_Anime (AnilistId) VALUES ( ? )`, anilistId);

			const res2 = await dbAdapter.run('SELECT InternalId FROM AnimeIdentity_Anime WHERE AnilistId = ?', anilistId);
			if (res2.length > 0 && typeof res2[0]['InternalId'] === 'number') {
				return {
					animeInternalId: res2[0]['InternalId'],
				};
			}

			throw new Error(`Unable to retrieve internal id for anilist id of ${anilistId}`);
		},
	};
}

async function checkIfAnilistIdIsValid({ anilistApiUrl, anilistId }: { anilistApiUrl: string; anilistId: number }): Promise<boolean> {
	const controller = new AbortController();
	const signal = controller.signal;
	const timeoutId = setTimeout(() => controller.abort(), 10 * 1000);

	try {
		const response = await fetch(anilistApiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({
				query: `
					query ($id: Int) { 
						Media (id: $id, type: ANIME) {
							id
						}
					}
					`,
				variables: {
					id: anilistId,
				},
			}),
			signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
		}

		const responseBody = await response.json<{ data: { Media: { id: number }}; errors: [{ status: number }] }>();

		if (!responseBody || (!responseBody.data && !responseBody.errors)) {
			throw new Error('Invalid GraphQL response structure.');
		}

		if (responseBody.errors) {
			if (responseBody.errors.find(({ status }) => status >= 400 && status < 500)) {
				throw new Error(`Anilist id of ${anilistId} not found`);
			} else {
				throw new Error(`GraphQL errors occurred.: ${responseBody.errors}`);
			}
		}

		const data = responseBody.data;
		if (data?.Media?.id !== anilistId) {
			throw new Error(`Sent Anilist id of ${anilistId} but received id of ${data.Media.id}`);
		}

		return true;
	} catch (error) {
		if (signal.aborted) {
			throw new Error('Request timed out');
		} else {
			throw error;
		}
	}
}

export { createAnimeIdentityService };
export type { IAnimeIdentityService };
