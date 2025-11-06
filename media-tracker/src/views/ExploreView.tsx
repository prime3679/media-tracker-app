/**
 * ExploreView - Browse the discovery catalog
 *
 * The Netflix moment - visual abundance, instant filtering, one-tap import
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import FilterBar from '../components/FilterBar';
import CatalogGrid from '../components/CatalogGrid';
import { type MoodType } from '../components/MoodSelector';
import {
  catalogApi,
  catalogQueryKey,
  mediaQueryKey,
  type CatalogItem,
  type CatalogFilters,
} from '../services/api';
import { fadeIn, slideUp } from '../animations/transitions';
import './ExploreView.css';

interface ExploreViewProps {
  className?: string;
}

export default function ExploreView({ className }: ExploreViewProps) {
  // Filter state
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'movie' | 'tv_show' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingItemId, setAddingItemId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  // Fetch available genres
  const { data: availableGenres = [] } = useQuery<string[]>({
    queryKey: [...catalogQueryKey, 'genres'],
    queryFn: (((context: any) => catalogApi.getGenres(context.signal)) as any),
  });

  // Fetch available decades
  const { data: availableDecades = [] } = useQuery<number[]>({
    queryKey: [...catalogQueryKey, 'decades'],
    queryFn: (((context: any) => catalogApi.getDecades(context.signal)) as any),
  });

  // Build filters object
  const filters: CatalogFilters = {
    mood: selectedMood || undefined,
    decade: selectedDecade || undefined,
    genre: selectedGenre || undefined,
    mediaType: selectedMediaType || undefined,
    search: searchQuery || undefined,
    sortBy: 'popularity',
    sortOrder: 'desc',
    limit: 50,
  };

  // Fetch catalog items
  const { data: catalogItems = [], isLoading } = useQuery<CatalogItem[]>({
    queryKey: [...catalogQueryKey, filters],
    queryFn: (((context: any) => catalogApi.browse(filters, context.signal)) as any),
  });

  // Add to library mutation
  const addToLibraryMutation = useMutation({
    mutationFn: (item: CatalogItem) => catalogApi.addToLibrary(item.id, 'to_watch'),
    onSuccess: () => {
      // Invalidate personal library queries
      queryClient.invalidateQueries({ queryKey: mediaQueryKey });
      setAddingItemId(null);
    },
    onError: (error: any) => {
      console.error('Error adding to library:', error);
      setAddingItemId(null);
      // TODO: Show error toast
      alert('Failed to add item. It may already be in your library.');
    },
  });

  const handleAddItem = async (item: CatalogItem) => {
    setAddingItemId(item.id);
    addToLibraryMutation.mutate(item);
  };

  // Count active filters
  const activeFiltersCount = [
    selectedMood,
    selectedDecade,
    selectedGenre,
    selectedMediaType,
    searchQuery,
  ].filter(Boolean).length;

  return (
    <div className={`explore-view ${className || ''}`}>
      {/* Header */}
      <motion.div
        className="explore-header"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
        <div className="header-content">
          <motion.h1
            className="explore-title"
            variants={slideUp}
          >
            Explore Catalog
          </motion.h1>
          <motion.p
            className="explore-subtitle"
            variants={slideUp}
          >
            {catalogItems.length > 0
              ? `${catalogItems.length} items ${activeFiltersCount > 0 ? 'matching your filters' : 'available'}`
              : 'Browse and discover new content'}
          </motion.p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="explore-filters"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.1 }}
      >
        <FilterBar
          selectedMood={selectedMood}
          onMoodChange={setSelectedMood}
          selectedDecade={selectedDecade}
          onDecadeChange={setSelectedDecade}
          selectedGenre={selectedGenre}
          onGenreChange={setSelectedGenre}
          selectedMediaType={selectedMediaType}
          onMediaTypeChange={setSelectedMediaType}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          availableGenres={availableGenres}
          availableDecades={availableDecades}
        />
      </motion.div>

      {/* Grid */}
      <motion.div
        className="explore-grid-container"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
      >
        <CatalogGrid
          items={catalogItems}
          onAddItem={handleAddItem}
          addingItemId={addingItemId}
          isLoading={isLoading}
        />
      </motion.div>
    </div>
  );
}
