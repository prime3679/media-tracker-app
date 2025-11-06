/**
 * CatalogGrid - Netflix-style grid of catalog items
 *
 * Responsive grid with stagger animations and loading states
 */

import { motion } from 'framer-motion';
import CatalogCard from './CatalogCard';
import { type CatalogItem } from '../services/api';
import './CatalogGrid.css';

interface CatalogGridProps {
  items: CatalogItem[];
  onAddItem: (item: CatalogItem) => void;
  addingItemId: number | null;
  isLoading?: boolean;
}

export default function CatalogGrid({
  items,
  onAddItem,
  addingItemId,
  isLoading = false,
}: CatalogGridProps) {
  if (isLoading) {
    return (
      <div className="catalog-grid-loading">
        <motion.div
          className="loading-spinner-large"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          🎬
        </motion.div>
        <p>Loading catalog...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <motion.div
        className="catalog-grid-empty"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="empty-icon">🔍</div>
        <h3>No items found</h3>
        <p>Try adjusting your filters or search query</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="catalog-grid"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.4 }}
        >
          <CatalogCard
            item={item}
            onAdd={onAddItem}
            isAdding={addingItemId === item.id}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
