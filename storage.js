<!-- storage.js -->
<script>
(function () {
  // Wrapper de stockage pour navigateur + Capacitor
  const isCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences);

  async function getItem(key) {
    if (isCapacitor) {
      try {
        const res = await window.Capacitor.Plugins.Preferences.get({ key });
        return res.value || null;
      } catch (e) {
        return null;
      }
    } else {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
  }

  async function setItem(key, value) {
    if (isCapacitor) {
      try {
        await window.Capacitor.Plugins.Preferences.set({ key, value });
      } catch (e) {
        // noop
      }
    } else {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // noop
      }
    }
  }

  async function removeItem(key) {
    if (isCapacitor) {
      try {
        await window.Capacitor.Plugins.Preferences.remove({ key });
      } catch (e) {
        // noop
      }
    } else {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // noop
      }
    }
  }

  window.FHStorage = { getItem, setItem, removeItem };
})();
</script>
