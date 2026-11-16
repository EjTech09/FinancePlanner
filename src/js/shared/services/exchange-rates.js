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
      const editingRate = activeInput && activeInput.matches &&
        activeInput.matches('input[data-fx-currency]');
      if (refreshing || (automatic && editingRate)) return;

      const currentState = getState();
      const hasProviderRates = ['PHP', 'USD'].some(currency =>
        Object.prototype.hasOwnProperty.call(currentState.fx.rates, currency)
      );
      if (!hasProviderRates) {
        statusText = 'No provider-supported currency rates are configured. Add PHP or USD to refresh provider rates.';
        updateStatus();
        return;
      }

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
        const nzdPerPhp = usdToNzd / usdToPhp;
        const updatedAt = new Date(Number(data.time_last_update_unix) * 1000);
        const hasValidRates = Number.isFinite(usdToNzd) && usdToNzd > 0 &&
          Number.isFinite(usdToPhp) && usdToPhp > 0 &&
          Number.isFinite(phpPerNzd) && Number.isFinite(nzdPerPhp);
        if (data.result !== 'success' || !hasValidRates || !Number.isFinite(updatedAt.getTime())) {
          throw new Error('Exchange-rate service returned invalid PHP/NZD or USD/NZD data');
        }

        const state = getState();
        if (Object.prototype.hasOwnProperty.call(state.fx.rates, 'PHP')) {
          state.fx.rates.PHP = nzdPerPhp;
          state.fx.updatedAt.PHP = updatedAt.toISOString();
        }
        if (Object.prototype.hasOwnProperty.call(state.fx.rates, 'USD')) {
          state.fx.rates.USD = usdToNzd;
          state.fx.updatedAt.USD = updatedAt.toISOString();
        }
        const refreshed = [];
        if (Object.prototype.hasOwnProperty.call(state.fx.rates, 'PHP')) {
          refreshed.push(`PHP/NZD ${phpPerNzd.toFixed(5)}`);
        }
        if (Object.prototype.hasOwnProperty.call(state.fx.rates, 'USD')) {
          refreshed.push(`USD/NZD ${usdToNzd.toFixed(5)}`);
        }
        statusText = refreshed.length
          ? `Latest rates: ${refreshed.join(' and ')}. Provider data updated ${updatedAt.toLocaleString('en-NZ')}.`
          : 'No provider-supported currency rates are configured. Add PHP or USD to refresh provider rates.';
        commit();

        const refreshedRates = [
          ['PHP', nzdPerPhp],
          ['USD', usdToNzd]
        ];
        refreshedRates.forEach(([currency, value]) => {
          const input = query('input[data-fx-currency="' + currency + '"]');
          if (input && document.activeElement !== input) input.value = String(value);
        });
      } catch (error) {
        console.error('Unable to refresh the PHP/NZD and USD/NZD exchange rates:', error);
        statusText = 'Could not refresh exchange rates. Using the saved rates.';
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
