import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

import { subscribeDataChanges } from "@/data/events";

type DataState<T> = { data: T | undefined; loading: boolean; error: unknown };

/**
 * Lädt Daten über eine Repository-Funktion und lädt automatisch neu,
 * sobald irgendein Repository eine Änderung meldet.
 */
export function useData<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<DataState<T>>({ data: undefined, loading: true, error: undefined });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const requestRef = useRef(0);

  const run = useCallback(() => {
    const request = ++requestRef.current;
    loaderRef
      .current()
      .then((data) => {
        if (request === requestRef.current) setState({ data, loading: false, error: undefined });
      })
      .catch((error: unknown) => {
        if (request === requestRef.current) setState((prev) => ({ ...prev, loading: false, error }));
      });
  }, []);

  useEffect(() => {
    run();
    return subscribeDataChanges(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}
