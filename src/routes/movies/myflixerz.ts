import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { MOVIES } from '@consumet/extensions';
import { StreamingServers } from '@consumet/extensions/dist/models';

import cache from '../../utils/cache';
import { redis } from '../../main';
import { Redis } from 'ioredis';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  const myflixerz = new MOVIES.MyFlixerz();

  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro:
        "Welcome to the myflixerz provider: check out the provider's website @ https://myflixerz.to/",
      routes: ['/:query', '/info', '/watch','/recent-shows','/recent-movies','/trending','/servers','/country','/genre'],
      documentation: 'https://docs.consumet.org/#tag/flixhq',
    });
  });

  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = decodeURIComponent((request.params as { query: string }).query);

    const page = (request.query as { page: number }).page;

    let res = redis
      ? await cache.fetch(
        redis as Redis,
        `myflixerz:${query}:${page}`,
        async () => await myflixerz.search(query, page ? page : 1),
        60 * 60 * 6,
      )
      : await myflixerz.search(query, page ? page : 1);

    reply.status(200).send(res);
  });

  fastify.get('/recent-shows', async (request: FastifyRequest, reply: FastifyReply) => {
    let res = redis
      ? await cache.fetch(
        redis as Redis,
        `myflixerz:recent-shows`,
        async () => await myflixerz.fetchRecentTvShows(),
        60 * 60 * 3,
      )
      : await myflixerz.fetchRecentTvShows();

    reply.status(200).send(res);
  });

  fastify.get('/recent-movies', async (request: FastifyRequest, reply: FastifyReply) => {
    let res = redis
      ? await cache.fetch(
        redis as Redis,
        `myflixerz:recent-movies`,
        async () => await myflixerz.fetchRecentMovies(),
        60 * 60 * 3,
      )
      : await myflixerz.fetchRecentMovies();

    reply.status(200).send(res);
  });

  fastify.get('/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    const type = (request.query as { type: string }).type;
    try {
      if (!type) {
        const res = {
          results: [
            ...(await myflixerz.fetchTrendingMovies()),
            ...(await myflixerz.fetchTrendingTvShows()),
          ],
        };
        return reply.status(200).send(res);
      }

      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `myflixerz:trending:${type}`,
          async () =>
            type === 'tv'
              ? await myflixerz.fetchTrendingTvShows()
              : await myflixerz.fetchTrendingMovies(),
          60 * 60 * 3,
        )
        : type === 'tv'
          ? await myflixerz.fetchTrendingTvShows()
          : await myflixerz.fetchTrendingMovies();

      reply.status(200).send(res);
    } catch (error) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });

  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.query as { id: string }).id;

    if (typeof id === 'undefined')
      return reply.status(400).send({
        message: 'id is required',
      });

    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `myflixerz:info:${id}`,
          async () => await myflixerz.fetchMediaInfo(id),
          60 * 60 * 3,
        )
        : await myflixerz.fetchMediaInfo(id);

      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });

  fastify.get('/watch', async (request: FastifyRequest, reply: FastifyReply) => {
    const episodeId = (request.query as { episodeId: string }).episodeId;
    const mediaId = (request.query as { mediaId: string }).mediaId;
    const server = (request.query as { server: StreamingServers }).server;

    if (typeof episodeId === 'undefined')
      return reply.status(400).send({ message: 'episodeId is required' });
    if (typeof mediaId === 'undefined')
      return reply.status(400).send({ message: 'mediaId is required' });

    if (server && !Object.values(StreamingServers).includes(server))
      return reply.status(400).send({ message: 'Invalid server query' });

    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `myflixerz:watch:${episodeId}:${mediaId}:${server}`,
          async () => await myflixerz.fetchEpisodeSources(episodeId, mediaId, server),
          60 * 30,
        )
        : await myflixerz.fetchEpisodeSources(episodeId, mediaId, server);

      reply.status(200).send(res);
    } catch (err) {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Please try again later.' });
    }
  });

  fastify.get('/servers', async (request: FastifyRequest, reply: FastifyReply) => {
    const episodeId = (request.query as { episodeId: string }).episodeId;
    const mediaId = (request.query as { mediaId: string }).mediaId;
    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `myflixerz:servers:${episodeId}:${mediaId}`,
          async () => await myflixerz.fetchEpisodeServers(episodeId, mediaId),
          60 * 30,
        )
        : await myflixerz.fetchEpisodeServers(episodeId, mediaId);

      reply.status(200).send(res);
    } catch (error) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });

  fastify.get('/country/:country', async (request: FastifyRequest, reply: FastifyReply) => {
    const country = (request.params as { country: string }).country;
    const page = (request.query as { page: number }).page ?? 1;
    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `myflixerz:country:${country}:${page}`,
          async () => await myflixerz.fetchByCountry(country, page),
          60 * 60 * 3,
        )
        : await myflixerz.fetchByCountry(country, page);

      reply.status(200).send(res);
    } catch (error) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });


  fastify.get('/genre/:genre', async (request: FastifyRequest, reply: FastifyReply) => {
    const genre = (request.params as { genre: string }).genre;
    const page = (request.query as { page: number }).page ?? 1;
    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `myflixerz:genre:${genre}:${page}`,
          async () => await myflixerz.fetchByGenre(genre, page),
          60 * 60 * 3,
        )
        : await myflixerz.fetchByGenre(genre, page);

      reply.status(200).send(res);
    } catch (error) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });
};
export default routes;
