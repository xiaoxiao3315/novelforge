import { NextResponse } from "next/server";
import {
  MARKET_FILTER_VERSION,
  isValidMarketFilterValue,
  isValidMarketGenreForChannel,
  isValidSubGenreForMarketGenre,
} from "@/data/plot-filters";
import { isProjectMode, normalizeProjectMode } from "@/lib/projects/modes";
import { createClient } from "@/lib/supabase/server";

type ProjectRequestBody = {
  title?: unknown;
  description?: unknown;
  channel?: unknown;
  marketGenre?: unknown;
  subGenre?: unknown;
  tropes?: unknown;
  protagonistArchetype?: unknown;
  cheatPower?: unknown;
  romanceLine?: unknown;
  theme?: unknown;
  genre?: unknown;
  background?: unknown;
  worldSetting?: unknown;
  protagonist?: unknown;
  coreConflict?: unknown;
  tone?: unknown;
  serialStructure?: unknown;
  extraIdeas?: unknown;
  mode?: unknown;
  user_id?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanStringArray(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, maxLength) : ""))
    .filter(Boolean);
}

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ProjectRequestBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("创建作品时不能从前端传 user_id。");
  }

  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 200);
  const extraIdeas = cleanText(body.extraIdeas, 1200);
  const mode = normalizeProjectMode(body.mode);
  const tropes = cleanStringArray(body.tropes, 80);

  if (!title) {
    return validationError("请填写作品名。");
  }

  if (body.mode !== undefined && !isProjectMode(body.mode)) {
    return validationError("项目模式不合法。");
  }

  if (
    !isValidMarketFilterValue("channels", body.channel) ||
    !isValidMarketFilterValue("marketGenres", body.marketGenre) ||
    !isValidMarketGenreForChannel(body.channel, body.marketGenre) ||
    !isValidSubGenreForMarketGenre(body.marketGenre, body.subGenre) ||
    !isValidMarketFilterValue("protagonistArchetypes", body.protagonistArchetype) ||
    !isValidMarketFilterValue("cheatPowers", body.cheatPower) ||
    !isValidMarketFilterValue("romanceLines", body.romanceLine) ||
    !isValidMarketFilterValue("tones", body.tone)
  ) {
    return validationError("剧情筛选器选项不合法。");
  }

  if (tropes.length > 3 || tropes.some((trope) => !isValidMarketFilterValue("tropes", trope))) {
    return validationError("热门元素最多选择 3 个，且选项必须合法。");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      title,
      description: description || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message || "作品创建失败。" },
      { status: 500 },
    );
  }

  const { error: configError } = await supabase.from("story_configs").insert({
    project_id: project.id,
    theme: body.channel,
    genre: body.marketGenre,
    background: body.subGenre,
    world_setting: body.cheatPower,
    protagonist: body.protagonistArchetype,
    core_conflict: tropes.join(","),
    tone: body.tone,
    serial_structure: body.romanceLine,
    extra_ideas: extraIdeas || null,
    config_json: {
      filterVersion: MARKET_FILTER_VERSION,
      channel: body.channel,
      marketGenre: body.marketGenre,
      subGenre: body.subGenre,
      tropes,
      protagonistArchetype: body.protagonistArchetype,
      cheatPower: body.cheatPower,
      romanceLine: body.romanceLine,
      tone: body.tone,
      extraIdeas,
      mode,
    },
  });

  if (configError) {
    await supabase.from("projects").delete().eq("id", project.id).eq("user_id", user.id);
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  return NextResponse.json({ projectId: project.id }, { status: 201 });
}
