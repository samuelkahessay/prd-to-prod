"use client";

import { useEffect, useReducer, useRef } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type { BuildEvent } from "@/lib/types";
import { factoryReducer, createInitialState } from "./factory-state";
import { mapBuildEvent } from "./event-mapper";
import { FactoryHud } from "./factory-hud";
import { FactoryCanvas } from "./renderer-2d/factory-canvas";
import type { FactoryAction, FactoryState } from "./factory-types";
import {
  getFactoryReplayDelay,
  getFactoryReplayLeadIn,
  isFactoryPlaybackEvent,
  type FactoryPlaybackMode,
  type FactoryReplayProfile,
} from "./factory-replay";

interface FactorySceneProps {
  events: BuildEvent[];
  playbackMode?: FactoryPlaybackMode;
  replayProfile?: FactoryReplayProfile;
  onPlaybackEvent?: (event: BuildEvent) => void;
  height?: number;
}

export function FactoryScene({
  events,
  playbackMode = "instant",
  replayProfile = "demo",
  onPlaybackEvent,
  height = 420,
}: FactorySceneProps) {
  const playbackEventRef = useRef(onPlaybackEvent);
  playbackEventRef.current = onPlaybackEvent;

  const [state, dispatch] = useReducer(factoryReducer, {
    events,
    playbackMode,
  }, createSceneState);
  const processedEventIdsRef = useRef<Set<number>>(
    playbackMode === "instant"
      ? new Set(events.map((event) => event.id))
      : new Set()
  );
  const cinematicQueueRef = useRef<BuildEvent[]>([]);
  const cinematicTimerRef = useRef<number | null>(null);
  const cinematicRunningRef = useRef(false);

  useEffect(() => {
    if (playbackMode === "cinematic") {
      const nextEvents = events
        .filter(isFactoryPlaybackEvent)
        .filter((event) => !processedEventIdsRef.current.has(event.id))
        .sort(comparePlaybackEvents);

      if (nextEvents.length === 0) {
        return;
      }

      for (const event of nextEvents) {
        processedEventIdsRef.current.add(event.id);
        cinematicQueueRef.current.push(event);
      }

      if (!cinematicRunningRef.current) {
        runCinematicQueue(dispatch, {
          queueRef: cinematicQueueRef,
          timerRef: cinematicTimerRef,
          runningRef: cinematicRunningRef,
          replayProfile,
          onPlaybackEventRef: playbackEventRef,
        });
      }

      return;
    }

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
  }, [events, playbackMode, replayProfile]);

  useEffect(() => {
    return () => {
      if (cinematicTimerRef.current !== null) {
        window.clearTimeout(cinematicTimerRef.current);
      }
    };
  }, []);

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
      <FactoryCanvas
        state={state}
        height={height}
        replayProfile={replayProfile}
      />
    </div>
  );
}

function createSceneState({
  events,
  playbackMode,
}: {
  events: BuildEvent[];
  playbackMode: FactoryPlaybackMode;
}): FactoryState {
  if (playbackMode === "cinematic") {
    return createInitialState();
  }

  return replayEvents(events);
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

function comparePlaybackEvents(a: BuildEvent, b: BuildEvent): number {
  const createdAtDiff =
    Date.parse(a.created_at || "") - Date.parse(b.created_at || "");
  if (Number.isFinite(createdAtDiff) && createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return a.id - b.id;
}

function runCinematicQueue(
  dispatch: Dispatch<FactoryAction>,
  {
    queueRef,
    timerRef,
    runningRef,
    replayProfile,
    onPlaybackEventRef,
  }: {
    queueRef: MutableRefObject<BuildEvent[]>;
    timerRef: MutableRefObject<number | null>;
    runningRef: MutableRefObject<boolean>;
    replayProfile: FactoryReplayProfile;
    onPlaybackEventRef: MutableRefObject<FactorySceneProps["onPlaybackEvent"] | undefined>;
  }
) {
  runningRef.current = true;

  const processNext = (delayMs: number) => {
    timerRef.current = window.setTimeout(() => {
      const nextEvent = queueRef.current.shift();
      if (!nextEvent) {
        runningRef.current = false;
        timerRef.current = null;
        return;
      }

      const actions = mapBuildEvent(nextEvent);
      for (const action of actions) {
        dispatch(action);
      }
      onPlaybackEventRef.current?.(nextEvent);

      if (queueRef.current.length === 0) {
        runningRef.current = false;
        timerRef.current = null;
        return;
      }

      processNext(getFactoryReplayDelay(nextEvent, replayProfile));
    }, delayMs);
  };

  processNext(getFactoryReplayLeadIn(replayProfile));
}
