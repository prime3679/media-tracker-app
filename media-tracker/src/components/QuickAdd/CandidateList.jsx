import './QuickAdd.css';

const TYPE_ICONS = {
  movie: '🎬',
  tv_show: '📺',
  book: '📚'
};

const TYPE_LABELS = {
  movie: 'Movie',
  tv_show: 'TV Show',
  book: 'Book'
};

export default function CandidateList({ candidates, selectedIndex, onSelect, onNavigate }) {
  if (candidates.length === 0) return null;

  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(index);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigate(Math.min(index + 1, candidates.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigate(Math.max(index - 1, 0));
    }
  };

  return (
    <div
      id="candidates-list"
      className="candidates-list"
      role="listbox"
      aria-label="Search results"
    >
      {candidates.map((candidate, index) => (
        <div
          key={candidate.id}
          id={`candidate-${index}`}
          className={`candidate-item ${selectedIndex === index ? 'selected' : ''}`}
          onClick={() => onSelect(index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          role="option"
          aria-selected={selectedIndex === index}
          tabIndex={selectedIndex === index ? 0 : -1}
        >
          <div className="candidate-icon">
            {TYPE_ICONS[candidate.type]}
          </div>
          <div className="candidate-info">
            <div className="candidate-title">
              {candidate.title}
              <span className="candidate-year"> ({candidate.year})</span>
            </div>
            <div className="candidate-meta">
              <span className="candidate-type">{TYPE_LABELS[candidate.type]}</span>
              {candidate.director && <span> • {candidate.director}</span>}
              {candidate.author && <span> • {candidate.author}</span>}
              {candidate.totalSeasons && <span> • {candidate.totalSeasons} seasons</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
