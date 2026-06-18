import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectMode } from "@/lib/projects/modes";
import type { CharacterCard, StoryBible } from "@/prompts/bible";
import type { ChapterContent } from "@/prompts/chapter";
import type { StoryConcept } from "@/prompts/concept";
import type { ChapterOutline, VolumeOutline } from "@/prompts/outline";

export type InternalProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type InternalStoryConfig = {
  project_id: string;
  theme: string | null;
  genre: string | null;
  background: string | null;
  world_setting: string | null;
  protagonist: string | null;
  core_conflict: string | null;
  tone: string | null;
  serial_structure: string | null;
  extra_ideas: string | null;
  config_json: unknown;
};

export type InternalVolumeRow = {
  id: string;
  project_id: string;
  volume_number: number;
  content: VolumeOutline;
};

export type InternalChapterRow = {
  id: string;
  project_id: string;
  volume_id: string | null;
  chapter_number: number;
  content: ChapterContent;
};

export type InternalStore = {
  projects: InternalProject[];
  storyConfigs: InternalStoryConfig[];
  storyConcepts: Array<{ id: string; project_id: string; content: StoryConcept }>;
  storyBibles: Array<{ id: string; project_id: string; content: StoryBible }>;
  characters: Array<{ id: string; project_id: string; sort_order: number; content: CharacterCard }>;
  volumes: InternalVolumeRow[];
  chapters: InternalChapterRow[];
};

export type CreateInternalProjectInput = {
  title: string;
  description: string | null;
  config: Omit<InternalStoryConfig, "project_id">;
};

function getDataDir() {
  return process.env.INTERNAL_DATA_DIR?.trim() || path.join(process.cwd(), ".internal-data");
}

function getStorePath() {
  return path.join(getDataDir(), "novelforge-store.json");
}

function createEmptyStore(): InternalStore {
  return {
    projects: [],
    storyConfigs: [],
    storyConcepts: [],
    storyBibles: [],
    characters: [],
    volumes: [],
    chapters: [],
  };
}

export async function readInternalStore() {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<InternalStore>;

    return {
      ...createEmptyStore(),
      ...parsed,
    };
  } catch {
    return createEmptyStore();
  }
}

async function writeInternalStore(store: InternalStore) {
  await mkdir(getDataDir(), { recursive: true });
  await writeFile(getStorePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function listInternalProjects() {
  const store = await readInternalStore();
  return [...store.projects].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

export async function getInternalProject(projectId: string) {
  const store = await readInternalStore();
  return store.projects.find((project) => project.id === projectId) ?? null;
}

export async function getInternalProjectBundle(projectId: string) {
  const store = await readInternalStore();
  const project = store.projects.find((item) => item.id === projectId) ?? null;

  if (!project) {
    return null;
  }

  return {
    project,
    config: store.storyConfigs.find((item) => item.project_id === projectId) ?? null,
    concept: store.storyConcepts.find((item) => item.project_id === projectId)?.content ?? null,
    bible: store.storyBibles.find((item) => item.project_id === projectId)?.content ?? null,
    characters: store.characters
      .filter((item) => item.project_id === projectId)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((item) => item.content),
    volumes: store.volumes
      .filter((item) => item.project_id === projectId)
      .sort((left, right) => left.volume_number - right.volume_number),
    chapters: store.chapters
      .filter((item) => item.project_id === projectId)
      .sort((left, right) => left.chapter_number - right.chapter_number),
  };
}

export async function getInternalProjectModeMap(projectIds: string[]) {
  const store = await readInternalStore();
  const ids = new Set(projectIds);
  const result = new Map<string, ProjectMode>();

  for (const config of store.storyConfigs) {
    if (!ids.has(config.project_id)) {
      continue;
    }

    const mode =
      typeof config.config_json === "object" &&
      config.config_json !== null &&
      "mode" in config.config_json &&
      (config.config_json as { mode?: unknown }).mode === "interactive"
        ? "interactive"
        : "classic";

    result.set(config.project_id, mode);
  }

  return result;
}

export async function createInternalProject(input: CreateInternalProjectInput) {
  const store = await readInternalStore();
  const now = new Date().toISOString();
  const project: InternalProject = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    status: "draft",
    created_at: now,
    updated_at: now,
  };

  store.projects.push(project);
  store.storyConfigs.push({
    project_id: project.id,
    ...input.config,
  });
  await writeInternalStore(store);

  return project;
}

export async function saveInternalConcept(projectId: string, concept: StoryConcept) {
  const store = await readInternalStore();
  store.storyConcepts = store.storyConcepts.filter((item) => item.project_id !== projectId);
  store.storyConcepts.push({ id: randomUUID(), project_id: projectId, content: concept });
  await touchProject(store, projectId);
  await writeInternalStore(store);
  return store.storyConcepts.find((item) => item.project_id === projectId)!;
}

export async function saveInternalBible(
  projectId: string,
  bible: StoryBible,
  characters: CharacterCard[],
) {
  const store = await readInternalStore();
  const bibleId = randomUUID();
  store.storyBibles = store.storyBibles.filter((item) => item.project_id !== projectId);
  store.storyBibles.push({ id: bibleId, project_id: projectId, content: bible });
  store.characters = store.characters.filter((item) => item.project_id !== projectId);
  store.characters.push(
    ...characters.map((character, index) => ({
      id: randomUUID(),
      project_id: projectId,
      sort_order: index,
      content: character,
    })),
  );
  await touchProject(store, projectId);
  await writeInternalStore(store);
  return bibleId;
}

export async function saveInternalOutline(
  projectId: string,
  volume: VolumeOutline,
  chapters: ChapterOutline[],
) {
  const store = await readInternalStore();
  const volumeId = randomUUID();
  store.volumes = store.volumes.filter(
    (item) => item.project_id !== projectId || item.volume_number !== volume.volumeNumber,
  );
  store.volumes.push({
    id: volumeId,
    project_id: projectId,
    volume_number: volume.volumeNumber,
    content: volume,
  });
  store.chapters = store.chapters.filter(
    (item) =>
      item.project_id !== projectId ||
      !chapters.some((chapter) => chapter.chapterNumber === item.chapter_number),
  );
  store.chapters.push(
    ...chapters.map((chapter) => ({
      id: randomUUID(),
      project_id: projectId,
      volume_id: volumeId,
      chapter_number: chapter.chapterNumber,
      content: { ...chapter } as ChapterContent,
    })),
  );
  await touchProject(store, projectId);
  await writeInternalStore(store);
  return volumeId;
}

async function touchProject(store: InternalStore, projectId: string) {
  const project = store.projects.find((item) => item.id === projectId);

  if (project) {
    project.updated_at = new Date().toISOString();
  }
}
