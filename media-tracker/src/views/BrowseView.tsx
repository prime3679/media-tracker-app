import { useState, useRef, useEffect } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi, mediaQueryKey, type CatalogFilters, type DiscoveryCatalogItem } from '../services/api';
import MediaCard from '../components/MediaCard';
import './BrowseView.css';

export default function BrowseView() {
    const [search, setSearch] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('');
    const [selectedDecade, setSelectedDecade] = useState('');
    const [selectedType, setSelectedType] = useState('');

    const queryClient = useQueryClient();
    const searchTimeoutRef = useRef<NodeJS.Timeout>(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search input
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [search]);

    // Fetch metadata for filters
    // Fetch genres
    const { data: genres } = useQuery({
        queryKey: ['catalog', 'genres'],
        queryFn: ({ signal }) => catalogApi.getGenres(signal),
    });

    // Fetch decades
    const { data: decades } = useQuery({
        queryKey: ['catalog', 'decades'],
        queryFn: ({ signal }) => catalogApi.getDecades(signal),
    });

    // Infinite query for catalog items
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
        error,
    } = useInfiniteQuery({
        queryKey: ['catalog', 'browse', debouncedSearch, selectedGenre, selectedDecade, selectedType],
        queryFn: ({ pageParam = 0, signal }) => {
            const filters: CatalogFilters = {
                limit: 20,
                offset: pageParam as number,
                search: debouncedSearch || undefined,
                genre: selectedGenre || undefined,
                decade: selectedDecade ? Number(selectedDecade) : undefined,
                mediaType: selectedType ? (selectedType as any) : undefined,
            };
            return catalogApi.browse(filters, signal);
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage: DiscoveryCatalogItem[], allPages: DiscoveryCatalogItem[][]) => {
            if (lastPage.length < 20) return undefined;
            return allPages.length * 20;
        },
    });

    // Intersection observer for infinite scroll
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.5 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Add to library mutation
    const [addingId, setAddingId] = useState<number | null>(null);

    const addToLibraryMutation = useMutation({
        mutationFn: (item: { id: number }) => catalogApi.addToLibrary({
            catalogItemId: item.id,
            status: 'to_watch'
        }),
        onMutate: (variables) => {
            setAddingId(variables.id);
        },
        onSettled: () => {
            setAddingId(null);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaQueryKey });
            // Optional: Show toast notification
        },
    });

    const handleAddToLibrary = (item: DiscoveryCatalogItem) => {
        addToLibraryMutation.mutate(item);
    };

    return (
        <div className="browse-view">
            <div className="browse-header">
                <h1>Discover</h1>
                <p className="browse-subtitle">Explore the curated collection of cinema and literature.</p>
            </div>

            <div className="browse-filters">
                <div className="search-bar-container">
                    <span className="search-icon-absolute">🔍</span>
                    <input
                        type="text"
                        className="browse-search-input"
                        placeholder="Search titles, directors..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="filter-select"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                >
                    <option value="">All Types</option>
                    <option value="movie">Movies</option>
                    <option value="tv_show">TV Shows</option>
                    <option value="book">Books</option>
                </select>

                <select
                    className="filter-select"
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                >
                    <option value="">All Genres</option>
                    {genres?.map((g) => (
                        <option key={g.slug} value={g.slug}>{g.name}</option>
                    ))}
                </select>

                <select
                    className="filter-select"
                    value={selectedDecade}
                    onChange={(e) => setSelectedDecade(e.target.value)}
                >
                    <option value="">All Decades</option>
                    {decades?.map((d) => (
                        <option key={d} value={d}>{d}s</option>
                    ))}
                </select>
            </div>

            {status === 'pending' ? (
                <div className="browse-loading">
                    <span className="browse-loading-spinner">⏳</span>
                    <p>Loading catalog...</p>
                </div>
            ) : status === 'error' ? (
                <div className="browse-error">
                    <p>Error loading catalog: {(error as Error).message}</p>
                </div>
            ) : (
                <div className="browse-grid">
                    {data.pages.map((page) => (
                        page.map((item) => (
                            <MediaCard
                                key={item.id}
                                item={item}
                                onAdd={handleAddToLibrary}
                                isAdding={addingId === item.id}
                            />
                        ))
                    ))}
                </div>
            )}

            <div ref={loadMoreRef} className="browse-load-more">
                {isFetchingNextPage && (
                    <div className="browse-loading">
                        <span className="browse-loading-spinner">⏳</span>
                        <p>Loading more...</p>
                    </div>
                )}
                {!hasNextPage && data && data.pages.length > 0 && (
                    <div className="browse-end">
                        <p>You've reached the end of the collection.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
