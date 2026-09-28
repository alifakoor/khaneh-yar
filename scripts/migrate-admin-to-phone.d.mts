import type { Db } from "mongodb";
export function migrateAdminToPhone(db: Db, phone: string): Promise<"migrated" | "already-migrated" | "no-legacy-user">;
