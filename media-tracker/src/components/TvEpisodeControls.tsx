import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildEpisodeQueryKey,
  buildSeasonQueryKey,
  episodesApi,
  seasonsApi,
  type Episode,
  type MediaItem,
} from '../services/api';

interface TvEpisodeControlsProps {
  item: MediaItem;
  isUpdating: boolean;
  onEpisodeSelect: (episode: Episode | null) => void;
  onMarkNextEpisode: (episode: Episode) => void;
}

export function TvEpisodeControls({
  item,
  isUpdating,
  onEpisodeSelect,
  onMarkNextEpisode,
}: TvEpisodeControlsProps) {
  const queryClient = useQueryClient();
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);

  const seasonsQuery = useQuery({
    queryKey: buildSeasonQueryKey(item.id),
    queryFn: () => seasonsApi.list(item.id),
    enabled: item.mediaType === 'tv_show',
  });

  const episodesQuery = useQuery({
    queryKey: buildEpisodeQueryKey(selectedSeasonId ?? -1),
    queryFn: () => episodesApi.list(selectedSeasonId ?? -1),
    enabled: Boolean(selectedSeasonId),
  });

  useEffect(() => {
    if (!seasonsQuery.data || seasonsQuery.data.length === 0) {
      setSelectedSeasonId(null);
      return;
    }

    if (selectedSeasonId) {
      return;
    }

    const fallbackSeasonId = seasonsQuery.data[0]?.id ?? null;

    if (!item.tracking?.episodeId) {
      setSelectedSeasonId(fallbackSeasonId);
      return;
    }

    let isActive = true;

    const seasons = seasonsQuery.data;

    (async () => {
      for (const season of seasons) {
        try {
          const episodes = await episodesApi.list(season.id);
          queryClient.setQueryData(buildEpisodeQueryKey(season.id), episodes);

          if (!isActive) {
            return;
          }

          if (episodes.some((episode: Episode) => episode.id === item.tracking?.episodeId)) {
            setSelectedSeasonId(season.id);
            setSelectedEpisodeId(item.tracking?.episodeId ?? null);
            return;
          }
        } catch (error) {
          console.error('Failed to resolve episodes for season', season.id, error);
        }
      }

      if (isActive) {
        setSelectedSeasonId(fallbackSeasonId);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [item.tracking?.episodeId, queryClient, seasonsQuery.data, selectedSeasonId]);

  useEffect(() => {
    if (!episodesQuery.data || episodesQuery.data.length === 0) {
      setSelectedEpisodeId(null);
      return;
    }

    if (selectedEpisodeId && episodesQuery.data.some((episode) => episode.id === selectedEpisodeId)) {
      return;
    }

    if (item.tracking?.episodeId) {
      const matchingEpisode = episodesQuery.data.find((episode) => episode.id === item.tracking?.episodeId);
      if (matchingEpisode) {
        setSelectedEpisodeId(matchingEpisode.id);
        return;
      }
    }

    if (item.tracking?.progress) {
      const progressEpisode = episodesQuery.data.find(
        (episode) => episode.episodeNumber === item.tracking?.progress,
      );
      if (progressEpisode) {
        setSelectedEpisodeId(progressEpisode.id);
        return;
      }
    }

    setSelectedEpisodeId(episodesQuery.data[0]?.id ?? null);
  }, [episodesQuery.data, item.tracking?.episodeId, item.tracking?.progress, selectedEpisodeId]);

  const nextEpisode = useMemo(() => {
    if (!episodesQuery.data || episodesQuery.data.length === 0) {
      return null;
    }

    const sorted = [...episodesQuery.data].sort((a, b) => a.episodeNumber - b.episodeNumber);
    const currentProgress = item.tracking?.progress ?? 0;

    return sorted.find((episode) => episode.episodeNumber > currentProgress) ?? null;
  }, [episodesQuery.data, item.tracking?.progress]);

  if (seasonsQuery.isLoading) {
    return <p className="tv-controls-status">Loading episodes…</p>;
  }

  if (seasonsQuery.error) {
    return <p className="tv-controls-status">Unable to load seasons right now.</p>;
  }

  if (!seasonsQuery.data || seasonsQuery.data.length === 0) {
    return <p className="tv-controls-status">Add seasons to start tracking episodes.</p>;
  }

  const handleSeasonChange = (seasonId: number) => {
    setSelectedSeasonId(seasonId);
    setSelectedEpisodeId(null);
  };

  const handleEpisodeChange = (episodeId: number) => {
    if (!episodesQuery.data) return;
    const episode = episodesQuery.data.find((candidate) => candidate.id === episodeId) ?? null;
    setSelectedEpisodeId(episodeId);
    onEpisodeSelect(episode);
  };

  const handleMarkNextClick = () => {
    if (!nextEpisode) return;
    setSelectedEpisodeId(nextEpisode.id);
    onMarkNextEpisode(nextEpisode);
  };

  return (
    <div className="tv-controls" aria-live="polite">
      <div className="tv-control-field">
        <label htmlFor={`season-${item.id}`}>Season</label>
        <select
          id={`season-${item.id}`}
          value={selectedSeasonId ?? ''}
          onChange={(event) => handleSeasonChange(Number(event.target.value))}
          disabled={isUpdating}
        >
          {seasonsQuery.data.map((season) => (
            <option key={season.id} value={season.id}>
              Season {season.seasonNumber}
              {season.title ? ` — ${season.title}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="tv-control-field">
        <label htmlFor={`episode-${item.id}`}>Episode</label>
        <select
          id={`episode-${item.id}`}
          value={selectedEpisodeId ?? ''}
          onChange={(event) => handleEpisodeChange(Number(event.target.value))}
          disabled={isUpdating || !episodesQuery.data || episodesQuery.data.length === 0}
        >
          {episodesQuery.data?.map((episode) => (
            <option key={episode.id} value={episode.id}>
              {episode.episodeNumber}. {episode.title}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="mark-next-button"
        onClick={handleMarkNextClick}
        disabled={isUpdating || !nextEpisode}
      >
        Mark next episode
      </button>

      {episodesQuery.isLoading && <p className="tv-controls-status">Loading episodes…</p>}
      {episodesQuery.error ? <p className="tv-controls-status">Unable to load episodes.</p> : null}
      {!episodesQuery.isLoading && !episodesQuery.error && (!episodesQuery.data || episodesQuery.data.length === 0) && (
        <p className="tv-controls-status">No episodes found for this season.</p>
      )}
    </div>
  );
}

export default TvEpisodeControls;
