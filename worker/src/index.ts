import { Hono } from 'hono';
const app = new Hono();

app.get('/', (c) => c.text('Hello Cloudflare Workers!'));

app.get('/anime/random', (c) => {
	c.status(501);
	return c.text('Not Implemented');
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
