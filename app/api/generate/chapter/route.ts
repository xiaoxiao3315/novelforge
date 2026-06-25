import { NextRequest, NextResponse } from "next/server";
import { requestHasInternalSession } from "@/lib/internal/auth";
import {
  generateInternalChapter,
  validationError,
  type GenerateChapterBody,
} from "@/lib/chapters/generation";

export async function POST(request: NextRequest) {
  if (!requestHasInternalSession(request)) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GenerateChapterBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成章节正文时不能从前端传 user_id。");
  }

  return generateInternalChapter(body);
}
