// Mock API responses for import search
export const mockSearchResults = {
  inception: [
    {
      id: 'tmdb-27205',
      title: 'Inception',
      type: 'movie',
      year: 2010,
      poster: 'https://image.tmdb.org/t/p/w200/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg',
      director: 'Christopher Nolan',
      description: 'A thief who steals corporate secrets through dream-sharing technology'
    }
  ],
  breaking: [
    {
      id: 'tmdb-1396',
      title: 'Breaking Bad',
      type: 'tv_show',
      year: 2008,
      poster: 'https://image.tmdb.org/t/p/w200/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
      description: 'A chemistry teacher diagnosed with cancer turns to manufacturing meth',
      totalSeasons: 5
    },
    {
      id: 'tmdb-114461',
      title: 'Breaking Fast',
      type: 'movie',
      year: 2020,
      poster: 'https://image.tmdb.org/t/p/w200/6J9QW8RhWDCVmPvPkdMPHCNvJTl.jpg',
      director: 'Mike Mosallam'
    }
  ],
  hobbit: [
    {
      id: 'book-hobbit-1937',
      title: 'The Hobbit',
      type: 'book',
      year: 1937,
      author: 'J.R.R. Tolkien',
      poster: 'https://covers.openlibrary.org/b/id/8739161-M.jpg',
      description: 'A hobbit reluctantly joins a quest to reclaim treasure from a dragon',
      totalPages: 310
    },
    {
      id: 'tmdb-49051',
      title: 'The Hobbit: An Unexpected Journey',
      type: 'movie',
      year: 2012,
      poster: 'https://image.tmdb.org/t/p/w200/yHA9Fc37VmpUA5UncTxxo3rTGVA.jpg',
      director: 'Peter Jackson'
    }
  ],
  dune: [
    {
      id: 'book-dune-1965',
      title: 'Dune',
      type: 'book',
      year: 1965,
      author: 'Frank Herbert',
      poster: 'https://covers.openlibrary.org/b/id/12498659-M.jpg',
      description: 'A epic science fiction novel set in the distant future',
      totalPages: 688
    },
    {
      id: 'tmdb-438631',
      title: 'Dune',
      type: 'movie',
      year: 2021,
      poster: 'https://image.tmdb.org/t/p/w200/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
      director: 'Denis Villeneuve'
    },
    {
      id: 'tmdb-675',
      title: 'Dune',
      type: 'movie',
      year: 1984,
      poster: 'https://image.tmdb.org/t/p/w200/6DrHO1jr3qVrViUO0s6BtXv4WhQ.jpg',
      director: 'David Lynch'
    }
  ],
  stranger: [
    {
      id: 'tmdb-66732',
      title: 'Stranger Things',
      type: 'tv_show',
      year: 2016,
      poster: 'https://image.tmdb.org/t/p/w200/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
      description: 'When a young boy vanishes, a small town uncovers a mystery involving supernatural forces',
      totalSeasons: 4
    },
    {
      id: 'tmdb-745',
      title: 'The Stranger',
      type: 'movie',
      year: 2010,
      poster: 'https://image.tmdb.org/t/p/w200/placeholder.jpg',
      director: 'Various'
    }
  ]
};

// Simulate API call with debounce
export const searchImportAPI = async (query) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const normalizedQuery = query.toLowerCase().trim();
  
  // Find matching results
  for (const [key, results] of Object.entries(mockSearchResults)) {
    if (key.startsWith(normalizedQuery)) {
      return results.slice(0, 5); // Top 5 candidates
    }
  }
  
  // Partial match
  for (const [key, results] of Object.entries(mockSearchResults)) {
    if (key.includes(normalizedQuery) || normalizedQuery.includes(key)) {
      return results.slice(0, 5);
    }
  }
  
  return [];
};
