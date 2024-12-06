import { Hono } from 'hono';
import { createServiceRegistry } from './services/serviceRegistry';
import { createAnimeIdentityService } from './services/animeIdentity';
const app = new Hono();

const serviceRegistry = createServiceRegistry({
	services: {
		animeIdentityService: createAnimeIdentityService(),
	},
});

app.get('/', (c) => c.text('Hello Cloudflare Workers!'));

app.get('/anime/random', (c) => {
	//TODO - actually implement this
	const randomAnilistId = 170942;

	const { animeInternalId } = serviceRegistry.getAnimeIdentityService().getAnimeInternalIdFromAnilistId({ anilistId: randomAnilistId });
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
