import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import {
  createMediaSchema,
  updateTrackingSchema,
  mediaWithTrackingSchema,
  statsSchema,
  healthSchema
} from '../../shared/schemas/index.js';

export const generateOpenApiSpec = () => {
  const registry = new OpenAPIRegistry();

  registry.register('CreateMedia', createMediaSchema);
  registry.register('UpdateTracking', updateTrackingSchema);
  registry.register('MediaWithTracking', mediaWithTrackingSchema);
  registry.register('Stats', statsSchema);
  registry.register('Health', healthSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/v1/media',
    summary: 'Get all media items',
    tags: ['Media'],
    responses: {
      200: {
        description: 'List of media items with tracking',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/MediaWithTracking'
              }
            }
          }
        }
      }
    }
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/media',
    summary: 'Create new media item',
    tags: ['Media'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createMediaSchema
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Media item created',
        content: {
          'application/json': {
            schema: mediaWithTrackingSchema
          }
        }
      },
      400: {
        description: 'Invalid input'
      }
    }
  });

  registry.registerPath({
    method: 'put',
    path: '/api/v1/media/{id}/tracking',
    summary: 'Update media tracking',
    tags: ['Tracking'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: updateTrackingSchema
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Tracking updated'
      },
      400: {
        description: 'Invalid input'
      }
    }
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/stats',
    summary: 'Get statistics',
    tags: ['Stats'],
    responses: {
      200: {
        description: 'User statistics',
        content: {
          'application/json': {
            schema: statsSchema
          }
        }
      }
    }
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/health',
    summary: 'Health check',
    tags: ['Health'],
    responses: {
      200: {
        description: 'Service health status',
        content: {
          'application/json': {
            schema: healthSchema
          }
        }
      }
    }
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Media Tracker API',
      version: '1.0.0',
      description: 'API for tracking movies, TV shows, and books'
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Development server' }
    ]
  });
};
