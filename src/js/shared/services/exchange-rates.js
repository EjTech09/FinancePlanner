(() => {
  'use strict';

  /**
   * Exchange-rate refresh service.
   *
   * Fetches the latest currency values from an external provider, stores them in
   * app state, and updates the visible rate inputs/status text.
   */
  function createExchangeRateService({ getState, commit, query }) {
    let statusText = 'Fetching the latest available PHP/NZD and USD/NZD rates...';
    let refreshing = false;

    function updateStatus() {
      const status = query('#fx-status');
      if (status) status.textContent = statusText;
      const button = query('#fx-refresh');
      if (button) button.disabled = refreshing;
    }

    async function refresh(automatic = false) {
      const activeInput = document.activeElement;
      const rateInputs = ['PHP per 1 NZD', 'NZD per 1 USD'];
      const editingRate = rateInputs.some(label =>
        query('input[aria-label="' + label + '"]') === activeInput
      );
      if (refreshing || (automatic && editingRate)) return;

      refreshing = true;
      statusText = 'Fetching the latest available PHP/NZD and USD/NZD rates...';
      updateStatus();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD', {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('Exchange-rate service returned HTTP ' + response.status);
        }

        const data = await response.json();
        const usdToNzd = Number(data.rates && data.rates.NZD);
        const usdToPhp = Number(data.rates && data.rates.PHP);
        const phpPerNzd = usdToPhp / usdToNzd;
        const updatedAt = new Date(Number(data.time_last_update_unix) * 1000);
        const hasValidRates = Number.isFinite(usdToNzd) && usdToNzd > 0 &&
          Number.isFinite(usdToPhp) && usdToPhp > 0 &&
          Number.isFinite(phpPerNzd);
        if (data.result !== 'success' || !hasValidRates || !Number.isFinite(updatedAt.getTime())) {
          throw new Error('Exchange-rate service returned invalid PHP/NZD or USD/NZD data');
        }

        const state = getState();
        state.fx.php = phpPerNzd;
        state.fx.usd = usdToNzd;
        state.fx.phpUpdatedAt = updatedAt.toISOString();
        state.fx.usdUpdatedAt = updatedAt.toISOString();
        statusText = `Latest rates: PHP/NZD ${phpPerNzd.toFixed(5)} and USD/NZD ${usdToNzd.toFixed(5)}. Provider data updated ${updatedAt.toLocaleString('en-NZ')}.`;
        commit();

        const refreshedRates = [
          ['PHP per 1 NZD', phpPerNzd],
          ['NZD per 1 USD', usdToNzd]
        ];
        refreshedRates.forEach(([label, value]) => {
          const input = query('input[aria-label="' + label + '"]');
          if (input && document.activeElement !== input) input.value = String(value);
        });
      } catch (error) {
        const { num } = window.HouseholdPlannerModel;
        console.error('Unable to refresh the PHP/NZD and USD/NZD exchange rates:', error);
        const state = getState();
        statusText = `Could not refresh exchange rates. Using saved rates: PHP/NZD ${num(state.fx.php).toFixed(5)} and USD/NZD ${num(state.fx.usd).toFixed(5)}.`;
      } finally {
        clearTimeout(timeout);
        refreshing = false;
        updateStatus();
      }
    }

    return Object.freeze({
      refresh,
      updateStatus,
      setStatus(text) {
        statusText = text;
        updateStatus();
      },
      get statusText() {
        return statusText;
      }
    });
  }

  window.HouseholdPlannerExchangeRates = Object.freeze({
    create: createExchangeRateService
  });
})();
