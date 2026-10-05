import Dexie, { type EntityTable } from "dexie";

import type {
  BodyMeasurement,
  BodySettings,
  Exercise,
  ExerciseNote,
  Profile,
  Settings,
  WorkoutPlan,
  WorkoutSession,
} from "@/domain/types";

type MetaRow = { key: string; value: string };

export class MoveUpDatabase extends Dexie {
  meta!: EntityTable<MetaRow, "key">;
  profiles!: EntityTable<Profile, "id">;
  settings!: EntityTable<Settings, "profileId">;
  customExercises!: EntityTable<Exercise, "id">;
  exerciseNotes!: Dexie.Table<ExerciseNote, [string, string]>;
  plans!: EntityTable<WorkoutPlan, "id">;
  sessions!: EntityTable<WorkoutSession, "id">;
  bodySettings!: EntityTable<BodySettings, "profileId">;
  measurements!: EntityTable<BodyMeasurement, "id">;

  constructor(name = "7moveup") {
    super(name);
    this.version(1).stores({
      meta: "key",
      profiles: "id",
      settings: "profileId",
      customExercises: "id, profileId",
      exerciseNotes: "[profileId+exerciseId], profileId",
      plans: "id, profileId",
      sessions: "id, profileId, [profileId+startedAt]",
    });
    // Version 2 (Körperwerte): nur neue Tabellen – bestehende Daten bleiben unverändert.
    this.version(2).stores({
      bodySettings: "profileId",
      measurements: "id, profileId, [profileId+date]",
    });
  }
}

export const db = new MoveUpDatabase();
