import { IDatabaseAdapter } from '../../dependencies/database/database';

interface IAnimeIdentityService {
	getAnimeInternalIdFromAnilistId({ anilistId }: { anilistId: number }): Promise<{ animeInternalId: number }>;
}

function createAnimeIdentityService({ dbAdapter }: { dbAdapter: IDatabaseAdapter }): IAnimeIdentityService {
	return {
		async getAnimeInternalIdFromAnilistId({ anilistId }) {
			const res = await dbAdapter.run('SELECT InternalId FROM AnimeIdentity_Anime WHERE AnilistId = ?', anilistId);
			if (res.length > 0 && typeof res[0]['InternalId'] === 'number') {
				return {
					animeInternalId: res[0]['InternalId'],
				};
			}

			const anilistIdIsValid = await checkIfAnilistIdIsValid({ anilistId });
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

async function checkIfAnilistIdIsValid({ anilistId }: { anilistId: number }) {
	// TODO - actually implement this
	return Promise.resolve(true);
}

export { createAnimeIdentityService };
export type { IAnimeIdentityService };
