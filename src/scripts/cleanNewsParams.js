// Global script to clean up news parameters when navigating outside news section
document.addEventListener('astro:page-load', function() {
  // Only clean if we're NOT on a news page and we have news-specific parameters
  if (!window.location.pathname.startsWith('/news')) {
    const url = new URL(window.location);
    const params = url.searchParams;
    
    if (params.has('view')) {
      params.delete('view');
      const newUrl = url.pathname + (params.toString() ? '?' + params.toString() : '');
      
      if (newUrl !== window.location.pathname + window.location.search) {
        // Use NavigationManager if available for coordination
        if (window.navigationManager?.isEnabled()) {
          window.navigationManager.updateURL(newUrl, true);
        } else {
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }
});
