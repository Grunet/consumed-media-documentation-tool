import { IDatabaseAdapter } from '../../dependencies/database/database';

interface IAnimeIdentityService {
	getAnimeInternalIdFromAnilistId({ anilistId }: { anilistId: number }): Promise<Response>;
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
			try {
				if (!Number.isInteger(anilistId) || anilistId <= 0) {
					return createResponse(400, { errorMessage: `Anilist id of ${anilistId} is either not an integer or is not positive` });
				}

				const { animeInternalId } = await getInternalIdFromAnilistId({ dbAdapter, anilistId });
				if (animeInternalId) {
					return createResponse(200, {
						data: {
							animeInternalId,
						},
					});
				}

				const { status } = await checkIfAnilistIdIsValid({ anilistApiUrl, anilistId });
				// TODO - emit the status and errorMessage property in the return value into telemetry
				if (status != 200) {
					if (status === 404) {
						return createResponse(404, { errorMessage: `Not Found` });
					} else if (status === 408) {
						return createResponse(408, { errorMessage: `Request Timeout` });
					} else {
						return createResponse(500, { errorMessage: `Internal Server Error` });
					}
				}

				// If this method is hit twice in quick succession, this line might run twice
				// The DB should be enforcing a unique constraint on AnilistId that will cause one of the inserts to error
				await dbAdapter.run(`INSERT INTO AnimeIdentity_Anime (AnilistId) VALUES ( ? )`, anilistId);

				const { animeInternalId: animeInternalId2 } = await getInternalIdFromAnilistId({ dbAdapter, anilistId });
				if (animeInternalId2) {
					return createResponse(200, {
						data: {
							animeInternalId: animeInternalId2,
						},
					});
				}

				return createResponse(500, { errorMessage: `Unable to retrieve internal id for anilist id of ${anilistId}` });
			} catch {
				//TODO - emit the error into telemetry
				return createResponse(500, { errorMessage: `Internal Server Error` });
			}
		},
	};
}

function createResponse(status: number, body: { errorMessage: string } | { data: { animeInternalId: number } }) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function getInternalIdFromAnilistId({ dbAdapter, anilistId }: { dbAdapter: IDatabaseAdapter; anilistId: number }) {
	const res = await dbAdapter.run('SELECT InternalId FROM AnimeIdentity_Anime WHERE AnilistId = ?', anilistId);
	if (res.length > 0 && typeof res[0]['InternalId'] === 'number') {
		return {
			animeInternalId: res[0]['InternalId'],
		};
	} else {
		return {
			animeInternalId: undefined,
		};
	}
}

async function checkIfAnilistIdIsValid({
	anilistApiUrl,
	anilistId,
}: {
	anilistApiUrl: string;
	anilistId: number;
}): Promise<{ status: number; errorMessage?: string }> {
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
			return {
				status: response.status,
				errorMessage: response.statusText,
			};
		}

		const responseBody = await response.json<{ data: { Media: { id: number } }; errors: [{ status: number }] }>();

		if (!responseBody || (!responseBody.data && !responseBody.errors)) {
			return {
				status: 500,
				errorMessage: 'Invalid Anilist API GraphQL response structure.',
			};
		}

		if (responseBody.errors) {
			if (responseBody.errors.find(({ status }) => status >= 400 && status < 500)) {
				return {
					status: 404,
					errorMessage: `Anilist id of ${anilistId} not found`,
				};
			} else {
				return {
					status: 500,
					errorMessage: `Anilist API GraphQL errors occurred.: ${JSON.stringify(responseBody.errors)}`,
				};
			}
		}

		const data = responseBody.data;
		if (data?.Media?.id !== anilistId) {
			return {
				status: 500,
				errorMessage: `Sent Anilist id of ${anilistId} but received id of ${JSON.stringify(data.Media.id)}`,
			};
		}

		return {
			status: 200,
		};
	} catch (error) {
		if (signal.aborted) {
			return {
				status: 408,
				errorMessage: `Anilist API GraphQL request timed out`,
			};
		} else {
			let errorMessage: string;
			if (error instanceof Error) {
				errorMessage = JSON.stringify({
					name: error.name,
					message: error.message,
					stack: error.stack,
				});
			} else {
				errorMessage = JSON.stringify(error);
			}

			return {
				status: 500,
				errorMessage,
			};
		}
	}
}

export { createAnimeIdentityService };
export type { IAnimeIdentityService };
