import { useState } from 'react';
import './QuickAdd.css';

const TYPE_LABELS = {
  movie: 'Movie',
  tv_show: 'TV Show',
  book: 'Book'
};

export default function ConfirmAdd({ candidate, onConfirm, onCancel }) {
  const [status, setStatus] = useState('to_watch');

  if (!candidate) return null;

  const handleConfirm = () => {
    onConfirm({ ...candidate, status });
  };

  return (
    <div className="confirm-overlay" role="dialog" aria-labelledby="confirm-title">
      <div className="confirm-modal">
        <h2 id="confirm-title">Add to Library</h2>
        
        <div className="confirm-content">
          {candidate.poster && (
            <img
              src={candidate.poster}
              alt={`${candidate.title} poster`}
              className="confirm-poster"
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          
          <div className="confirm-details">
            <h3>{candidate.title}</h3>
            <p className="confirm-year">{candidate.year} • {TYPE_LABELS[candidate.type]}</p>
            
            {candidate.director && (
              <p className="confirm-credit">Directed by {candidate.director}</p>
            )}
            {candidate.author && (
              <p className="confirm-credit">Written by {candidate.author}</p>
            )}
            
            {candidate.description && (
              <p className="confirm-description">{candidate.description}</p>
            )}
            
            {candidate.totalSeasons && (
              <p className="confirm-info">{candidate.totalSeasons} seasons</p>
            )}
            {candidate.totalPages && (
              <p className="confirm-info">{candidate.totalPages} pages</p>
            )}
          </div>
        </div>

        <div className="confirm-status">
          <label htmlFor="status-select">Status:</label>
          <select
            id="status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="status-select"
          >
            <option value="to_watch">Want to {candidate.type === 'book' ? 'Read' : 'Watch'}</option>
            <option value="watching">{candidate.type === 'book' ? 'Reading' : 'Watching'}</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>

        <div className="confirm-actions">
          <button onClick={onCancel} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleConfirm} className="btn-confirm">
            Add to Library
          </button>
        </div>
      </div>
    </div>
  );
}
