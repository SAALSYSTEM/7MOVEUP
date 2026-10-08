import { planWeekdays } from "@/domain/measure-plans";
import { defaultBodySettings, normalizeBodySettings } from "@/domain/body";
import { sortMeasurements } from "@/domain/body-stats";
import type {
  BodyMeasurement,
  BodySettings,
  Exercise,
  ExerciseNote,
  Language,
  PerformanceSnapshot,
  Profile,
  Settings,
  WorkoutPlan,
  WorkoutSession,
} from "@/domain/types";
import { notifyDataChanged } from "@/data/events";
import type {
  BodyRepository,
  ExerciseRepository,
  PlanRepository,
  ProfileRepository,
  SettingsRepository,
  WorkoutRepository,
} from "@/data/repositories";
import { BUILT_IN_EXERCISES } from "@/data/seed";
import { createId } from "@/lib/id";

import type { MoveUpDatabase } from "./db";

const CURRENT_PROFILE_KEY = "currentProfileId";

export function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return "de";
  const lang = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
  return lang.startsWith("de") ? "de" : "en";
}

function now() {
  return new Date().toISOString();
}

export function createLocalRepositories(db: MoveUpDatabase) {
  let profileIdPromise: Promise<string> | null = null;

  /** Stellt sicher, dass genau ein lokales Profil existiert, und liefert dessen ID. */
  async function currentProfileId(): Promise<string> {
    if (!profileIdPromise) {
      profileIdPromise = db
        .transaction("rw", db.meta, db.profiles, db.settings, async () => {
          const meta = await db.meta.get(CURRENT_PROFILE_KEY);
          if (meta && (await db.profiles.get(meta.value))) return meta.value;

          const timestamp = now();
          const profile: Profile = {
            id: createId(),
            language: detectBrowserLanguage(),
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await db.profiles.put(profile);
          await db.settings.put({
            profileId: profile.id,
            soundEnabled: true,
            hapticsEnabled: true,
            updatedAt: timestamp,
          });
          await db.meta.put({ key: CURRENT_PROFILE_KEY, value: profile.id });
          return profile.id;
        })
        .catch((error) => {
          profileIdPromise = null;
          throw error;
        });
    }
    return profileIdPromise;
  }

  const profiles: ProfileRepository = {
    async getCurrent() {
      const id = await currentProfileId();
      const profile = await db.profiles.get(id);
      if (!profile) throw new Error("Profil nicht gefunden");
      return profile;
    },
    async update(patch) {
      const current = await profiles.getCurrent();
      const next: Profile = { ...current, ...patch, updatedAt: now() };
      if (!next.displayName?.trim()) delete next.displayName;
      else next.displayName = next.displayName.trim();
      await db.profiles.put(next);
      notifyDataChanged();
      return next;
    },
  };

  const settings: SettingsRepository = {
    async get() {
      const profileId = await currentProfileId();
      const existing = await db.settings.get(profileId);
      return (
        existing ?? { profileId, soundEnabled: true, hapticsEnabled: true, updatedAt: now() }
      );
    },
    async update(patch) {
      const current = await settings.get();
      const next: Settings = { ...current, ...patch, updatedAt: now() };
      await db.settings.put(next);
      notifyDataChanged();
      return next;
    },
  };

  const exercises: ExerciseRepository = {
    async getAll() {
      const profileId = await currentProfileId();
      const custom = await db.customExercises.where("profileId").equals(profileId).toArray();
      return [...BUILT_IN_EXERCISES, ...custom];
    },
    async getById(id) {
      const builtIn = BUILT_IN_EXERCISES.find((e) => e.id === id);
      if (builtIn) return builtIn;
      const profileId = await currentProfileId();
      const custom = await db.customExercises.get(id);
      return custom?.profileId === profileId ? custom : undefined;
    },
    async saveCustom(exercise) {
      const profileId = await currentProfileId();
      const timestamp = now();
      const next: Exercise = {
        ...exercise,
        builtIn: false,
        profileId,
        createdAt: exercise.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      await db.customExercises.put(next);
      notifyDataChanged();
      return next;
    },
    async deleteCustom(id) {
      const profileId = await currentProfileId();
      await db.transaction("rw", db.customExercises, db.exerciseNotes, async () => {
        await db.customExercises.delete(id);
        await db.exerciseNotes.delete([profileId, id]);
      });
      notifyDataChanged();
    },
    async getNote(exerciseId) {
      const profileId = await currentProfileId();
      return db.exerciseNotes.get([profileId, exerciseId]);
    },
    async getNotes() {
      const profileId = await currentProfileId();
      return db.exerciseNotes.where("profileId").equals(profileId).toArray();
    },
    async saveNote(exerciseId, patch) {
      const profileId = await currentProfileId();
      const existing = await db.exerciseNotes.get([profileId, exerciseId]);
      const next: ExerciseNote = {
        profileId,
        exerciseId,
        note: existing?.note ?? "",
        videoUrls: existing?.videoUrls,
        ...patch,
        updatedAt: now(),
      };
      await db.exerciseNotes.put(next);
      notifyDataChanged();
      return next;
    },
  };

  const plans: PlanRepository = {
    async getAll() {
      const profileId = await currentProfileId();
      const all = await db.plans.where("profileId").equals(profileId).toArray();
      return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
    },
    async getById(id) {
      const profileId = await currentProfileId();
      const plan = await db.plans.get(id);
      return plan?.profileId === profileId ? plan : undefined;
    },
    async save(plan) {
      const profileId = await currentProfileId();
      const next: WorkoutPlan = { ...plan, profileId, updatedAt: now() };
      await db.plans.put(next);
      notifyDataChanged();
      return next;
    },
    async saveMany(list) {
      const profileId = await currentProfileId();
      const timestamp = now();
      await db.plans.bulkPut(list.map((p) => ({ ...p, profileId, updatedAt: timestamp })));
      notifyDataChanged();
    },
    async replaceAll(list) {
      const profileId = await currentProfileId();
      const timestamp = now();
      await db.transaction("rw", db.plans, async () => {
        await db.plans.where("profileId").equals(profileId).delete();
        await db.plans.bulkPut(list.map((p) => ({ ...p, profileId, updatedAt: timestamp })));
      });
      notifyDataChanged();
    },
    async delete(id) {
      await db.plans.delete(id);
      notifyDataChanged();
    },
  };

  const sessionsQuery = (profileId: string) =>
    db.sessions.where("[profileId+startedAt]").between([profileId, ""], [profileId, "\uffff"]);

  async function sessionsOfProfile(): Promise<WorkoutSession[]> {
    return sessionsQuery(await currentProfileId()).toArray();
  }

  const workouts: WorkoutRepository = {
    async getSession(id) {
      const profileId = await currentProfileId();
      const session = await db.sessions.get(id);
      return session?.profileId === profileId ? session : undefined;
    },
    async getActiveSession() {
      const all = await sessionsOfProfile();
      return all.filter((s) => !s.completedAt).at(-1);
    },
    async getCompletedSessions() {
      const all = await sessionsOfProfile();
      return all.filter((s) => Boolean(s.completedAt));
    },
    async saveSession(session) {
      const profileId = await currentProfileId();
      const next = { ...session, profileId };
      await db.sessions.put(next);
      notifyDataChanged();
      return next;
    },
    async startSession(session) {
      const profileId = await currentProfileId();
      const result = await db.transaction("rw", db.sessions, async () => {
        const open = (await sessionsQuery(profileId).toArray()).filter((s) => !s.completedAt).at(-1);
        if (open) return { session: open, created: false };
        const next = { ...session, profileId };
        await db.sessions.put(next);
        return { session: next, created: true };
      });
      if (result.created) notifyDataChanged();
      return result;
    },
    async deleteSession(id) {
      await db.sessions.delete(id);
      notifyDataChanged();
    },
    async getLastPerformance(exerciseId, beforeIso) {
      const completed = await workouts.getCompletedSessions();
      for (let i = completed.length - 1; i >= 0; i -= 1) {
        const session = completed[i];
        if (beforeIso && session.startedAt >= beforeIso) continue;
        const entry = session.exercises.find(
          (ex) => ex.exerciseId === exerciseId && ex.sets.some((set) => set.done),
        );
        if (entry) {
          const snapshot: PerformanceSnapshot = {
            sessionId: session.id,
            date: session.date,
            trackingType: entry.trackingType,
            target: entry.target,
            sets: entry.sets.filter((set) => set.done),
            // erste geplante Zeile (nicht die erste erledigte) – bestimmt die Startseite der nächsten Einheit
            startSide: entry.sets[0]?.side,
          };
          return snapshot;
        }
      }
      return undefined;
    },
  };

  const body: BodyRepository = {
    async getSettings() {
      const profileId = await currentProfileId();
      const stored = await db.bodySettings.get(profileId);
      return normalizeBodySettings(stored ?? defaultBodySettings(profileId));
    },
    async saveSettings(patch) {
      const current = await body.getSettings();
      const merged: BodySettings = { ...current, ...patch, updatedAt: now() };
      // ältere App-Versionen kennen nur Messtage: alle Plan-Tage mitschreiben
      if (patch.plans) merged.measureWeekdays = planWeekdays(patch.plans);
      const next: BodySettings = normalizeBodySettings(merged);
      await db.bodySettings.put(next);
      notifyDataChanged();
      return next;
    },
    async getMeasurements() {
      const profileId = await currentProfileId();
      return sortMeasurements(await db.measurements.where("profileId").equals(profileId).toArray());
    },
    async getMeasurementsPage({ from, to, limit }) {
      const profileId = await currentProfileId();
      const range = db.measurements
        .where("[profileId+date]")
        .between([profileId, from ?? ""], [profileId, to ?? "\uffff"], true, true);
      const head = await range.clone().reverse().limit(limit).toArray();
      if (head.length === 0) return { items: [], hasMore: false };
      // ein Tag wird nie zerschnitten: alle Messungen des letzten Tages dazunehmen
      const lastDate = head[head.length - 1].date;
      const sameDay = await db.measurements.where("[profileId+date]").equals([profileId, lastDate]).toArray();
      const known = new Set(head.map((m) => m.id));
      const items = sortMeasurements([...head, ...sameDay.filter((m) => !known.has(m.id))]).reverse();
      const older = await db.measurements
        .where("[profileId+date]")
        .between([profileId, from ?? ""], [profileId, lastDate], true, false)
        .count();
      return { items, hasMore: older > 0 };
    },
    async getMeasurementYearRange() {
      const profileId = await currentProfileId();
      const index = db.measurements.where("[profileId+date]").between([profileId, ""], [profileId, "\uffff"]);
      const [first, last] = await Promise.all([index.clone().first(), index.clone().last()]);
      if (!first || !last) return undefined;
      return { first: Number(first.date.slice(0, 4)), last: Number(last.date.slice(0, 4)) };
    },
    async saveMeasurement(input) {
      const profileId = await currentProfileId();
      const timestamp = now();
      const existing = input.id ? await db.measurements.get(input.id) : undefined;
      const values = Object.fromEntries(
        Object.entries(input.values).filter(([, v]) => typeof v === "number" && Number.isFinite(v)),
      );
      const next: BodyMeasurement = {
        id: existing?.profileId === profileId ? existing.id : createId(),
        profileId,
        date: input.date,
        time: input.time || undefined,
        values,
        planId: input.planId,
        note: input.note?.trim() ? input.note.trim().slice(0, 200) : undefined,
        createdAt: existing?.profileId === profileId ? existing.createdAt : timestamp,
        updatedAt: timestamp,
      };
      await db.measurements.put(next);
      notifyDataChanged();
      return next;
    },
    async deleteMeasurement(id) {
      const profileId = await currentProfileId();
      const existing = await db.measurements.get(id);
      if (existing?.profileId !== profileId) return;
      await db.measurements.delete(id);
      notifyDataChanged();
    },
  };

  return { currentProfileId, profiles, settings, exercises, plans, workouts, body };
}

export type LocalRepositories = ReturnType<typeof createLocalRepositories>;
