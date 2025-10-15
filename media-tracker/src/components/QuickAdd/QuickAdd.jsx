import { useState, useCallback } from 'react';
import QuickAddInput from './QuickAddInput';
import CandidateList from './CandidateList';
import ConfirmAdd from './ConfirmAdd';
import { searchImportAPI } from './mockImportData';
import './QuickAdd.css';

export default function QuickAdd({ onAdd }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [confirming, setConfirming] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setCandidates([]);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchImportAPI(query);
      setCandidates(results);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search failed:', error);
      setCandidates([]);
      setSelectedIndex(-1);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectCandidate = useCallback((index) => {
    if (index >= 0 && index < candidates.length) {
      setConfirming(candidates[index]);
    }
  }, [candidates]);

  const handleNavigate = useCallback((direction) => {
    setSelectedIndex(prevIndex => {
      if (candidates.length === 0) {
        return -1;
      }
      
      if (direction === 'down') {
        if (prevIndex === -1) {
          return 0;
        }
        return Math.min(prevIndex + 1, candidates.length - 1);
      } else if (direction === 'up') {
        if (prevIndex <= 0) {
          return -1;
        }
        return prevIndex - 1;
      }
      return prevIndex;
    });
  }, [candidates.length]);

  const handleConfirm = useCallback((item) => {
    onAdd(item);
    setConfirming(null);
    setCandidates([]);
    setSelectedIndex(-1);
  }, [onAdd]);

  const handleCancel = useCallback(() => {
    setConfirming(null);
  }, []);

  return (
    <div className="quick-add-container">
      <QuickAddInput
        onSearch={handleSearch}
        onSelect={() => handleSelectCandidate(selectedIndex)}
        onNavigate={handleNavigate}
        selectedIndex={selectedIndex}
      />
      
      {isSearching && (
        <div className="loading-message">Searching...</div>
      )}
      
      {!isSearching && candidates.length > 0 && (
        <CandidateList
          candidates={candidates}
          selectedIndex={selectedIndex}
          onSelect={handleSelectCandidate}
          onNavigate={handleNavigate}
        />
      )}

      {confirming && (
        <ConfirmAdd
          candidate={confirming}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
