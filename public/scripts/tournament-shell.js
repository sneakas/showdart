(function () {
  function getAccessToken() {
    try {
      return localStorage.getItem('supabase_access_token');
    } catch (_error) {
      return null;
    }
  }

  function createShowdartShell(options) {
    const allowedOrigin = options?.allowedOrigin || window.location.origin;

    function getAuthHeaders() {
      const token = getAccessToken();
      if (!token) {
        return null;
      }
      return {
        Authorization: `Bearer ${token}`
      };
    }

    function postToParent(message) {
      if (!window.parent || window.parent === window) {
        return;
      }
      window.parent.postMessage(message, allowedOrigin);
    }

    function notifyParentHeight() {
      const height = Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement ? document.documentElement.scrollHeight : 0,
        900
      );
      postToParent({ type: 'showdart-height', height });
    }

    return {
      getAuthHeaders,
      postToParent,
      notifyParentHeight
    };
  }

  window.createShowdartShell = createShowdartShell;
})();
