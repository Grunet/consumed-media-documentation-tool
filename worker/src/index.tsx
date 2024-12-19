import { Bindings } from './types/bindings';
import { Hono } from 'hono';
import { jsx } from 'hono/jsx'; // Seems to be required even though it's unused

import { instrument, ResolveConfigFn } from '@microlabs/otel-cf-workers';
import { createServiceRegistry as createServiceRegistryInternal } from './services/serviceRegistry';
import { createAnimeIdentityService } from './services/animeIdentity';
import { createDatabaseAdapter } from './dependencies/database/database';

type Env = { Bindings: Bindings };
const app = new Hono<Env>();

function createServiceRegistry({ env }: { env: Bindings }) {
	return createServiceRegistryInternal({
		services: {
			animeIdentityService: _createAnimeIdentityService({ env }),
		},
	});
}

// Exposed for tests
export function _createAnimeIdentityService({ env }: { env: Bindings }) {
	const dbAdapter = createDatabaseAdapter({ env });

	return createAnimeIdentityService({ dbAdapter, anilistApiUrl: env.ANILIST_API_URL });
}

app.get('/', (c) => c.text('Hello Cloudflare Workers!'));

app.get('/anime/random', async (c) => {
	//TODO - actually implement this
	const randomAnilistId = 170942;

	const res = await createServiceRegistry({ env: c.env })
		.getAnimeIdentityService()
		.getAnimeInternalIdFromAnilistId({ anilistId: randomAnilistId });

	//TODO - implement handling for when res has a status of 4xx or 5xx

	const json = await res.json();

	//TODO - implement handling for when the json data comes back in an unexpected form

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const animeInternalId = (json as any).data.animeInternalId;

	return c.redirect(`/anime/${animeInternalId}`);
});

app.get('/anime/:animeInternalId', async (c) => {
	const animeInternalIdAsString = c.req.param('animeInternalId');
	const animeInternalId = Number(animeInternalIdAsString);
	if (!Number.isFinite(animeInternalId)) {
		c.status(400);
		return c.text('Invalid anime id');
	}

	const res = await createServiceRegistry({ env: c.env }).getAnimeIdentityService().getAnimeCoreDetails({ animeInternalId });

	const json = await res.json();
	// TODO - implement handling for when the json data comes back in an unexpected form
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { name, imageUrl } = (json as any).data as { name: string, imageUrl: string };

	return c.html(
		<html lang="en">
			<head>
				<title>Some title</title>
				<meta name="description" content="Some description" />
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			</head>
      		<body>
				{name}
				{imageUrl}
			</body>
		</html>
	  );
});

app.post('/user/anime/:animeId', (c) => {
	c.status(501);
	return c.text('Not Implemented');
});

app.get('/auth/anilist/redirect', (c) => {
	c.status(501);
	return c.text('Not Implemented');
});

const handler = {
	fetch(req: Request, env: Env, ctx: ExecutionContext) {
		return app.fetch(req, env, ctx);
	},
};

const config: ResolveConfigFn = () => {
	return {
		exporter: {
			url: 'http://0.0.0.0:4318/v1/traces',
		},
		service: { name: 'consumed-media' },
	};
};

// NOTE: Test code is rewriting this line of code during tests
export default instrument(handler, config);