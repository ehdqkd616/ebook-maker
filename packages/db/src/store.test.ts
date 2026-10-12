import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { Store } from "./index";

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeStore() {
  dir = mkdtempSync(path.join(tmpdir(), "ebook-db-"));
  return new Store(dir);
}

describe("Store", () => {
  it("credit balance is the ledger sum", () => {
    const store = makeStore();
    const { lastInsertRowid } = store.run(
      "INSERT INTO users (username, name, pw_hash, created_at) VALUES (?, ?, ?, ?)", "alice", "a", "x", Date.now(),
    );
    const id = Number(lastInsertRowid);
    expect(store.creditBalance(id)).toBe(0);
    store.addCredit(id, 500, "signup_grant");
    store.addCredit(id, -200, "generate");
    expect(store.creditBalance(id)).toBe(300);
  });

  it("usernames are unique regardless of case", () => {
    const store = makeStore();
    const insert = (username: string) =>
      store.run("INSERT INTO users (username, name, pw_hash, created_at) VALUES (?, ?, ?, ?)", username, "a", "x", 0);
    insert("Me@Example.com");
    expect(() => insert("me@example.com")).toThrow(/UNIQUE/);
    expect(store.getUserByUsername("ME@EXAMPLE.COM")?.username).toBe("Me@Example.com");
  });

  it("renames the old email column and keeps existing ids", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ebook-db-"));
    const old = new DatabaseSync(path.join(dir, "ebook.sqlite"));
    old.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pw_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'pending', signup_note TEXT, reject_reason TEXT, approved_by INTEGER, approved_at INTEGER, last_login_at INTEGER, created_at INTEGER NOT NULL)");
    old.exec("INSERT INTO users (email, name, pw_hash, created_at) VALUES ('kim@test.local', 'kim', 'x', 0)");
    old.close();
    const store = new Store(dir);
    expect(store.getUserByUsername("kim@test.local")?.name).toBe("kim");
  });

  it("rolls back failed transactions", () => {
    const store = makeStore();
    expect(() =>
      store.tx(() => {
        store.audit("x");
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(store.all("SELECT * FROM audit_log")).toHaveLength(0);
  });
});
