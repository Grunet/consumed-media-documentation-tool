import { IDatabaseAdapter } from '../../dependencies/database/database';
import { trace, Span, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions';

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
	const tracer = trace.getTracer('anime-identity', '0.0.1');

	return {
		async getAnimeInternalIdFromAnilistId({ anilistId }) {
			return tracer.startActiveSpan('getAnimeInternalIdFromAnilistId', async (span: Span) => {
				try {
					span.setAttribute('custom.anime.anilistId', anilistId);

					if (!Number.isInteger(anilistId) || anilistId <= 0) {
						return createResponse(400, { errorMessage: `Anilist id of ${anilistId} is either not an integer or is not positive` }, span);
					}

					const { animeInternalId } = await getInternalIdFromAnilistId({ dbAdapter, anilistId });
					if (animeInternalId) {
						return createResponse(
							200,
							{
								data: {
									animeInternalId,
								},
							},
							span,
						);
					}

					const { status } = await checkIfAnilistIdIsValid({ anilistApiUrl, anilistId }, tracer);
					if (status != 200) {
						if (status === 404) {
							return createResponse(404, { errorMessage: `Not Found` }, span);
						} else if (status === 408) {
							return createResponse(408, { errorMessage: `Request Timeout` }, span);
						} else {
							return createResponse(500, { errorMessage: `Internal Server Error` }, span);
						}
					}

					// If this method is hit twice in quick succession, this line might run twice
					// The DB should be enforcing a unique constraint on AnilistId that will cause one of the inserts to error
					// A single retry from the caller should always end up returning the correct value, so this seems OK until proven otherwise
					await dbAdapter.run(`INSERT INTO AnimeIdentity_Anime (AnilistId) VALUES ( ? )`, anilistId);

					const { animeInternalId: animeInternalId2 } = await getInternalIdFromAnilistId({ dbAdapter, anilistId });
					if (animeInternalId2) {
						return createResponse(
							200,
							{
								data: {
									animeInternalId: animeInternalId2,
								},
							},
							span,
						);
					}

					return createResponse(500, { errorMessage: `Unable to retrieve internal id for anilist id of ${anilistId}` }, span);
				} catch (error) {
					span.recordException(error as Error);
					span.setStatus({ code: SpanStatusCode.ERROR });

					return createResponse(500, { errorMessage: `Internal Server Error` }, span);
				}
			});
		},
	};
}

function createResponse(status: number, body: { errorMessage: string } | { data: { animeInternalId: number } }, span: Span) {
	const stringifiedBody = JSON.stringify(body);

	span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
	span.setAttribute('custom.http.response.body', stringifiedBody);
	span.end();

	return new Response(stringifiedBody, {
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

async function checkIfAnilistIdIsValid(
	{
		anilistApiUrl,
		anilistId,
	}: {
		anilistApiUrl: string;
		anilistId: number;
	},
	tracer: Tracer,
): Promise<{ status: number; errorMessage?: string }> {
	return tracer.startActiveSpan('checkIfAnilistIdIsValid', async (span: Span) => {
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
				return createInternalResponse(response.status, response.statusText, span);
			}

			const responseBody = await response.json<{ data: { Media: { id: number } }; errors: [{ status: number }] }>();

			if (!responseBody || (!responseBody.data && !responseBody.errors)) {
				return createInternalResponse(500, 'Invalid Anilist API GraphQL response structure.', span);
			}

			if (responseBody.errors) {
				if (responseBody.errors.find(({ status }) => status >= 400 && status < 500)) {
					return createInternalResponse(404, `Anilist id of ${anilistId} not found`, span);
				} else {
					return createInternalResponse(500, `Anilist API GraphQL errors occurred.: ${JSON.stringify(responseBody.errors)}`, span);
				}
			}

			const data = responseBody.data;
			if (data?.Media?.id !== anilistId) {
				return createInternalResponse(500, `Sent Anilist id of ${anilistId} but received id of ${JSON.stringify(data.Media.id)}`, span);
			}

			return createInternalResponse(200, undefined, span);
		} catch (error) {
			if (signal.aborted) {
				return createInternalResponse(408, `Anilist API GraphQL request timed out`, span);
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

				return createInternalResponse(500, errorMessage, span);
			}
		}
	});
}

function createInternalResponse(status: number, errorMessage: string | undefined, span: Span) {
	span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
	if (errorMessage) {
		span.recordException(new Error(errorMessage));
		span.setStatus({ code: SpanStatusCode.ERROR });
	}

	return {
		status,
		errorMessage,
	};
}

export { createAnimeIdentityService };
export type { IAnimeIdentityService };
