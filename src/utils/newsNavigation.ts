// src/utils/newsNavigation.ts - News-specific navigation utilities

/**
 * Determines if a given pathname is within the news section
 */
export function isNewsPath(pathname: string): boolean {
  return pathname === '/news' || pathname.startsWith('/news/');
}

/**
 * Determines if current page is in news section
 */
export function isCurrentlyInNewsSection(): boolean {
  if (typeof window === 'undefined') return false;
  return isNewsPath(window.location.pathname);
}

/**
 * Creates a news-aware URL that only preserves view parameter within news section
 */
export function createNewsAwareURL(
  targetPath: string, 
  currentParams?: URLSearchParams,
  options: { preserveAll?: boolean } = {}
): string {
  const { preserveAll = false } = options;
  const params = new URLSearchParams(currentParams || (typeof window !== 'undefined' ? window.location.search : ''));
  
  // If target is outside news section, remove news-specific parameters
  if (!isNewsPath(targetPath)) {
    params.delete('view');
    // Could add other news-specific params here in future
  }
  
  // If preserveAll is false and we're going to a news path, 
  // only preserve relevant news parameters
  if (!preserveAll && isNewsPath(targetPath)) {
    const newsParams = new URLSearchParams();
    
    // Preserve these parameters for news section
    const preserveParams = ['view', 'search', 'sort', 'page', 'categories', 'tags', 'dateRange'];
    
    preserveParams.forEach(param => {
      if (params.has(param)) {
        const values = params.getAll(param);
        values.forEach(value => newsParams.append(param, value));
      }
    });
    
    const queryString = newsParams.toString();
    return queryString ? `${targetPath}?${queryString}` : targetPath;
  }
  
  const queryString = params.toString();
  return queryString ? `${targetPath}?${queryString}` : targetPath;
}

/**
 * Safely gets view preference from localStorage
 */
export function getSavedViewPreference(): 'grid' | 'list' | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem('newsViewPreference');
    return saved === 'list' ? 'list' : 'grid';
  } catch {
    return null;
  }
}

/**
 * Safely saves view preference to localStorage
 */
export function saveViewPreference(view: 'grid' | 'list'): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('newsViewPreference', view);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Determines if view parameter should be restored from localStorage
 * Only restore if:
 * 1. We're in news section
 * 2. URL doesn't already have view parameter
 * 3. URL has other parameters (indicating filtered state) OR user explicitly set preference
 */
export function shouldRestoreViewFromLocalStorage(currentParams: URLSearchParams, pathname: string): boolean {
  // Only in news section
  if (!isNewsPath(pathname)) return false;
  
  // Don't restore if view already in URL
  if (currentParams.has('view')) return false;
  
  // Get saved preference
  const savedView = getSavedViewPreference();
  if (!savedView || savedView === 'grid') return false;
  
  // Restore if URL has other parameters (user is in filtered state)
  // or if this is a direct navigation with saved preference
  const hasOtherParams = Array.from(currentParams.keys()).length > 0;
  
  return hasOtherParams || savedView === 'list';
}

/**
 * Creates a clean news URL without view parameter (for "clear filters" etc.)
 */
export function createCleanNewsURL(): string {
  return '/news';
}

/**
 * Updates current URL with view parameter (news section only)
 */
export function updateViewInCurrentURL(view: 'grid' | 'list'): void {
  if (typeof window === 'undefined' || !isCurrentlyInNewsSection()) return;
  
  const currentParams = new URLSearchParams(window.location.search);
  
  if (view === 'grid') {
    currentParams.delete('view');
  } else {
    currentParams.set('view', view);
  }
  
  const newURL = createNewsAwareURL(window.location.pathname, currentParams);
  window.history.replaceState({}, '', newURL);
  
  // Save preference
  saveViewPreference(view);
}

/**
 * Navigation handler that preserves appropriate parameters based on target
 */
export function navigateWithContext(targetPath: string, currentParams?: URLSearchParams): void {
  if (typeof window === 'undefined') return;
  
  const url = createNewsAwareURL(targetPath, currentParams);
  window.location.href = url;
}
