"use client";

import { useEffect, useReducer, useRef } from "react";
import type { BuildEvent } from "@/lib/types";
import { factoryReducer, createInitialState } from "./factory-state";
import { mapBuildEvent } from "./event-mapper";
import { FactoryHud } from "./factory-hud";
import { FactoryCanvas } from "./renderer-2d/factory-canvas";
import type { FactoryState } from "./factory-types";

interface FactorySceneProps {
  events: BuildEvent[];
}

export function FactoryScene({ events }: FactorySceneProps) {
  const [state, dispatch] = useReducer(factoryReducer, events, replayEvents);
  const processedEventIdsRef = useRef<Set<number>>(new Set(events.map((event) => event.id)));

  useEffect(() => {
    for (const event of events) {
      if (processedEventIdsRef.current.has(event.id)) {
        continue;
      }

      processedEventIdsRef.current.add(event.id);
      const actions = mapBuildEvent(event);
      for (const action of actions) {
        dispatch(action);
      }
    }
  }, [events]);

  // Tick timer for elapsed time
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      dispatch({ type: "TICK", elapsedMs: Date.now() - start });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <FactoryHud state={state} />
      <FactoryCanvas state={state} height={420} />
    </div>
  );
}

function replayEvents(events: BuildEvent[]): FactoryState {
  let state = createInitialState();
  for (const event of events) {
    const actions = mapBuildEvent(event);
    for (const action of actions) {
      state = factoryReducer(state, action);
    }
  }
  return state;
}

