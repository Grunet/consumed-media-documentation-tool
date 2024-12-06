import { IDatabaseAdapter } from '../../dependencies/database/database';

interface IAnimeIdentityService {
	getAnimeInternalIdFromAnilistId({ anilistId }: { anilistId: number }): Promise<{ animeInternalId: number }>;
}

function createAnimeIdentityService({ dbAdapter }: { dbAdapter: IDatabaseAdapter }): IAnimeIdentityService {
	return {
		async getAnimeInternalIdFromAnilistId({ anilistId }) {
			// TODO - actually do the lookup or creation

			const res = await dbAdapter.run('SELECT InternalId FROM AnimeIdentity_Anime WHERE AnilistId = ?', anilistId);
			if (res.length > 0 && typeof res[0]['InternalId'] === 'number') {
				return {
					animeInternalId: res[0]['InternalId'],
				};
			}

			// Hit the anilist API to see if the id is valid there
			//   If it's not, return an error or throw an exception (maybe functional try catch) of some sort
			//   If it is, create a new record in D1, and return the internal id you get

			// Add overall exception handling

			const animeInternalId = anilistId;

			return {
				animeInternalId,
			};
		},
	};
}

export { createAnimeIdentityService };
export type { IAnimeIdentityService };
