# Overview

Media Tracker is a full-stack web application that allows users to track their consumption of various media types including movies, TV shows, and books. The application provides functionality to add media items, track viewing/reading progress, rate content, and manage personal media collections. Built as a Progressive Web App (PWA), it offers offline capabilities and mobile-first design for tracking media on-the-go.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built using React 19 with Vite as the build tool, following a mobile-first design approach. The application is configured as a Progressive Web App (PWA) using the VitePWA plugin, enabling offline functionality and app-like behavior on mobile devices. The UI is designed with a maximum width constraint (480px) to optimize for mobile viewing, with sticky navigation tabs and a gradient header design.

## Backend Architecture
The backend uses Express.js as the web server framework with TypeScript support via tsx. The API follows RESTful conventions and includes CORS middleware for cross-origin requests. The server is structured with separation of concerns:

- **API Layer**: Express routes handling HTTP requests and responses
- **Storage Layer**: Abstracted data access interface for database operations
- **Database Layer**: Drizzle ORM for type-safe database interactions

## Data Architecture
The system uses PostgreSQL as the primary database with Drizzle ORM for schema management and migrations. The database schema includes three main entities:

- **Users**: User account information and authentication data
- **Media Items**: Core media information (movies, TV shows, books) with external API integration fields
- **Media Tracking**: User-specific tracking data including status, progress, ratings, and notes

The schema supports multiple media types through PostgreSQL enums and includes flexible fields for different content types (e.g., seasons/episodes for TV shows, pages for books, TMDB/IMDB IDs for movies).

## Development Workflow
The application uses concurrent development with separate client and server processes. Database schema changes are managed through Drizzle migrations with commands for generation, migration, and direct schema pushing. ESLint is configured for code quality with React-specific rules and hooks validation.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL database using the `@neondatabase/serverless` driver with WebSocket support for real-time connections

## Development Tools
- **Drizzle Kit**: Database schema management and migration tool
- **TypeScript**: Type safety across the entire application stack
- **Vite**: Fast development server and build tool for the frontend

## Runtime Libraries
- **Express.js**: Web application framework for the API server
- **Zod**: Runtime schema validation for API requests and responses
- **CORS**: Cross-origin resource sharing middleware
- **WebSocket (ws)**: Real-time communication support for database connections

## PWA and Mobile Features
- **Workbox**: Service worker management for offline functionality
- **VitePWA**: Progressive Web App configuration and manifest generation

The application is designed to potentially integrate with external media APIs (TMDB, IMDB) based on the schema fields, though these integrations are not currently implemented in the codebase.

# Verification

This repository has been verified for Devin access, linting capabilities, and PR workflow on 2025-10-14.
