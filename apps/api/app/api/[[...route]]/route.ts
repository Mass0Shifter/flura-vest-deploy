import { handle } from "hono/vercel";
import { app } from "@/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const h = handle(app);
export const GET = h;
export const POST = h;
export const PUT = h;
export const PATCH = h;
export const DELETE = h;
