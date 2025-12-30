/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrowseView from '../BrowseView';
import { catalogApi } from '../../services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the API
vi.mock('../../services/api', () => ({
    catalogApi: {
        browse: vi.fn(),
        getGenres: vi.fn(),
        getDecades: vi.fn(),
        addToLibrary: vi.fn(),
    },
    mediaQueryKey: ['media'],
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

describe('BrowseView Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();

        // Mock IntersectionObserver
        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        window.IntersectionObserver = mockIntersectionObserver;

        // Default mocks
        (catalogApi.getGenres as any).mockResolvedValue([
            { name: 'Action', slug: 'action', color: '#ff0000' },
            { name: 'Comedy', slug: 'comedy', color: '#00ff00' }
        ]);

        (catalogApi.getDecades as any).mockResolvedValue([2020, 2010, 2000]);

        (catalogApi.browse as any).mockResolvedValue([
            {
                id: 1,
                title: 'Test Movie',
                mediaType: 'movie',
                tmdbRating: '8.5',
                releaseYear: 2023,
                imageUrl: 'test.jpg'
            },
            {
                id: 2,
                title: 'Test Book',
                mediaType: 'book',
                tmdbRating: '9.0',
                releaseYear: 2021,
                imageUrl: 'book.jpg'
            }
        ]);
    });

    it('renders initial state with search bar and filters', async () => {
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <BrowseView />
            </QueryClientProvider>
        );

        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
        expect(screen.getByText('All Types')).toBeInTheDocument();
    });

    it('fetches and displays catalog items', async () => {
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <BrowseView />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Test Movie')).toBeInTheDocument();
            expect(screen.getByText('Test Book')).toBeInTheDocument();
        });
    });

    it('filters by media type', async () => {
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <BrowseView />
            </QueryClientProvider>
        );

        const typeSelect = screen.getByDisplayValue('All Types');
        fireEvent.change(typeSelect, { target: { value: 'movie' } });

        await waitFor(() => {
            expect(catalogApi.browse).toHaveBeenCalledWith(expect.objectContaining({
                mediaType: 'movie'
            }), expect.anything());
        });
    });

    it('searches for items', async () => {
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <BrowseView />
            </QueryClientProvider>
        );

        const searchInput = screen.getByPlaceholderText(/search/i);
        fireEvent.change(searchInput, { target: { value: 'Matrix' } });

        // Search is debounced, so wait a bit
        await waitFor(() => {
            expect(catalogApi.browse).toHaveBeenCalledWith(expect.objectContaining({
                search: 'Matrix'
            }), expect.anything());
        }, { timeout: 1000 });
    });

    it('adds item to library', async () => {
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <BrowseView />
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Test Movie')).toBeInTheDocument();
        });

        const addButtons = screen.getAllByTitle(/add to library/i);
        fireEvent.click(addButtons[0]);

        await waitFor(() => {
            expect(catalogApi.addToLibrary).toHaveBeenCalledWith(expect.objectContaining({
                catalogItemId: 1,
                status: 'to_watch'
            }));
        });
    });
});
