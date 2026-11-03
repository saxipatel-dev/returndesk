import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";

/**
 * Run an async loader and track loading / error / data.
 * Re-runs whenever `deps` change; call `reload()` to fetch again manually.
 * Responses that arrive after a newer request started are ignored.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);

  const run = useCallback(
    async ({ quiet = false } = {}) => {
      const id = ++latest.current;
      if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await loader();
        if (id === latest.current) setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        if (id === latest.current) {
          setState((s) => ({ ...s, loading: false, error: errorMessage(error) }));
        }
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    run();
  }, [run]);

  return {
    ...state,
    reload: run,
    setData: (updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })),
  };
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
