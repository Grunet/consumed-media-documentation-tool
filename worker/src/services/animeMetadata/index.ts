import { trace, Span, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions';

interface ICacheAdapter {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

interface IAnimeIdentityService {
	getAnilistIdFromAnimeInternalId({ animeInternalId }: { animeInternalId: number }): Promise<Response>;
}

interface IAnimeMetadataService {
	getAnimeMetadata({ animeInternalId }: { animeInternalId: number }): Promise<Response>;
}

function createAnimeMetadataService({
	cacheAdapter,
	animeIdentityService,
	anilistApiUrl,
}: {
	cacheAdapter: ICacheAdapter;
	animeIdentityService: IAnimeIdentityService;
	anilistApiUrl: string;
}): IAnimeMetadataService {
	const tracer = trace.getTracer('anime-metadata', '0.0.1');

	return {
		async getAnimeMetadata({ animeInternalId }) {
			return tracer.startActiveSpan('getAnimeMetadata', async (span: Span) => {
				try {
					span.setAttribute('custom.anime.animeInternalId', animeInternalId);

					if (!Number.isInteger(animeInternalId) || animeInternalId <= 0) {
						return createResponse(
							400,
							{ errorMessage: `Anime internal id of ${animeInternalId} is either not an integer or is not positive` },
							span,
						);
					}

					const cachedMetadata = await cacheAdapter.get(`anime-metadata:${animeInternalId}`);
					if (cachedMetadata) {
						return createResponse(200, { data: JSON.parse(cachedMetadata) }, span);
					}

					const anilistIdResponse = await animeIdentityService.getAnilistIdFromAnimeInternalId({ animeInternalId });
					if (anilistIdResponse.status !== 200) {
						return createResponse(
							anilistIdResponse.status,
							{ errorMessage: `Unable to retrieve anilist id for anime internal id of ${animeInternalId}` },
							span,
						);
					}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const anilistId = ((await anilistIdResponse.json()) as any)?.data?.anilistId;
					if (!anilistId || !Number.isInteger(anilistId) || anilistId <= 0) {
						return createResponse(500, { errorMessage: `Invalid anilist id retrieved for anime internal id of ${animeInternalId}` }, span);
					}

					//TODO - implement actual fetching of metadata from Anilist API using the anilistId and anilistApiUrl, then cache the result and return it
				} catch (error) {
					span.recordException(error as Error);
					span.setStatus({ code: SpanStatusCode.ERROR });

					return createResponse(500, { errorMessage: `Internal Server Error` }, span);
				}
			});
		},
	};
}

type JSONValue = string | number | boolean | null | { [x: string]: JSONValue } | JSONValue[];

function createResponse(status: number, body: { errorMessage: string } | { data: JSONValue }, span: Span) {
	const stringifiedBody = JSON.stringify(body);

	span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
	span.setAttribute('custom.http.response.body', stringifiedBody);
	span.end();

	return new Response(stringifiedBody, {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export { createAnimeMetadataService };
export type { IAnimeMetadataService };
