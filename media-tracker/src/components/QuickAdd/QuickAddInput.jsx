import { useState, useEffect, useRef } from 'react';
import './QuickAdd.css';

export default function QuickAddInput({ onSearch, onSelect, selectedIndex }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        onSearch(query);
      } else {
        onSearch('');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div className="quick-add-input">
      <label htmlFor="quick-search" className="sr-only">
        Search for movies, TV shows, or books
      </label>
      <input
        ref={inputRef}
        id="quick-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Quick add: Search for movies, TV shows, books..."
        className="search-input"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls="candidates-list"
        aria-activedescendant={selectedIndex >= 0 ? `candidate-${selectedIndex}` : undefined}
      />
      {query && (
        <button
          onClick={() => setQuery('')}
          className="clear-button"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
