// Service for managing podcast categories

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface PodcastCategory {
  podcastId: string;
  podcastName: string;
  categoryId: string;
}

const STORAGE_KEY_CATEGORIES = 'podtrack_categories';
const STORAGE_KEY_PODCAST_CATEGORIES = 'podtrack_podcast_categories';

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Education', color: '#3b82f6' },
  { id: '2', name: 'Entertainment', color: '#10b981' },
  { id: '3', name: 'News', color: '#f59e0b' },
  { id: '4', name: 'Science', color: '#8b5cf6' },
  { id: '5', name: 'History', color: '#ef4444' },
  { id: '6', name: 'Business', color: '#06b6d4' },
];

export class CategoryService {
  getCategories(): Category[] {
    const stored = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return DEFAULT_CATEGORIES;
      }
    }
    return DEFAULT_CATEGORIES;
  }

  saveCategories(categories: Category[]): void {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
  }

  addCategory(category: Category): void {
    const categories = this.getCategories();
    categories.push(category);
    this.saveCategories(categories);
  }

  updateCategory(categoryId: string, updates: Partial<Category>): void {
    const categories = this.getCategories();
    const index = categories.findIndex((c) => c.id === categoryId);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updates };
      this.saveCategories(categories);
    }
  }

  deleteCategory(categoryId: string): void {
    const categories = this.getCategories();
    const filtered = categories.filter((c) => c.id !== categoryId);
    this.saveCategories(filtered);

    // Remove category assignments
    const assignments = this.getPodcastCategories();
    const filteredAssignments = assignments.filter((a) => a.categoryId !== categoryId);
    this.savePodcastCategories(filteredAssignments);
  }

  getPodcastCategories(): PodcastCategory[] {
    const stored = localStorage.getItem(STORAGE_KEY_PODCAST_CATEGORIES);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  }

  savePodcastCategories(assignments: PodcastCategory[]): void {
    localStorage.setItem(STORAGE_KEY_PODCAST_CATEGORIES, JSON.stringify(assignments));
  }

  assignCategory(podcastId: string, podcastName: string, categoryId: string): void {
    const assignments = this.getPodcastCategories();
    const existingIndex = assignments.findIndex((a) => a.podcastId === podcastId);

    if (existingIndex !== -1) {
      assignments[existingIndex] = { podcastId, podcastName, categoryId };
    } else {
      assignments.push({ podcastId, podcastName, categoryId });
    }

    this.savePodcastCategories(assignments);
  }

  getCategoryForPodcast(podcastId: string): string | null {
    const assignments = this.getPodcastCategories();
    const assignment = assignments.find((a) => a.podcastId === podcastId);
    return assignment?.categoryId || null;
  }

  removeCategoryAssignment(podcastId: string): void {
    const assignments = this.getPodcastCategories();
    const filtered = assignments.filter((a) => a.podcastId !== podcastId);
    this.savePodcastCategories(filtered);
  }
}

export const categoryService = new CategoryService();
