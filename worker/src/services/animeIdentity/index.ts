interface IAnimeIdentityService {
	getAnimeInternalIdFromAnilistId({ anilistId }: { anilistId: number }): { animeInternalId: number };
}

function createAnimeIdentityService(): IAnimeIdentityService {
	return {
		getAnimeInternalIdFromAnilistId({ anilistId }) {
			// TODO - actually do the lookup or creation

			// Check D1 to see if it's already there, return the internal id if so

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
