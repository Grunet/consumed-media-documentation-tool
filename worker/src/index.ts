import { Bindings } from './types/bindings';
import { Hono } from 'hono';
import { createServiceRegistry as createServiceRegistryInternal } from './services/serviceRegistry';
import { createAnimeIdentityService } from './services/animeIdentity';
import { createDatabaseAdapter } from './dependencies/database/database';

const app = new Hono<{ Bindings: Bindings }>();

function createServiceRegistry({ env }: { env: Bindings }) {
	const dbAdapter = createDatabaseAdapter({ env });

	return createServiceRegistryInternal({
		services: {
			animeIdentityService: createAnimeIdentityService({ dbAdapter, anilistApiUrl: env.ANILIST_API_URL }),
		},
	});
}

app.get('/', (c) => c.text('Hello Cloudflare Workers!'));

app.get('/anime/random', async (c) => {
	//TODO - actually implement this
	const randomAnilistId = 170942;

	const { animeInternalId } = await createServiceRegistry({ env: c.env })
		.getAnimeIdentityService()
		.getAnimeInternalIdFromAnilistId({ anilistId: randomAnilistId });
	return c.redirect(`/anime/${animeInternalId}`);
});

app.get('/anime/:animeId', (c) => {
	c.status(501);
	return c.text('Not Implemented');
});

app.post('/user/anime/:animeId', (c) => {
	c.status(501);
	return c.text('Not Implemented');
});

app.get('/auth/anilist/redirect', (c) => {
	c.status(501);
	return c.text('Not Implemented');
});

export default app;
