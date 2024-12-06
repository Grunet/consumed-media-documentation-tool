interface IAnimeIdentityService {
	getAnimeInternalIdFromAnilistId({ anilistId }: { anilistId: number }): { animeInternalId: number };
}

function createAnimeIdentityService(): IAnimeIdentityService {
	return {
		getAnimeInternalIdFromAnilistId({ anilistId }) {
			// TODO - actually do the lookup or creation

			const animeInternalId = anilistId;

			return {
				animeInternalId,
			};
		},
	};
}

export { createAnimeIdentityService };
export type { IAnimeIdentityService };
