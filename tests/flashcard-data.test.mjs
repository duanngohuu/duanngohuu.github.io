import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flashcardDir = path.join(root, 'flashcard');
const manifestPath = path.join(flashcardDir, 'data', 'manifest.json');
const requiredHeaders = ['no', 'front', 'reading', 'meaning_vi', 'han_viet', 'years'];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readTsv(filePath) {
  const raw = readFileSync(filePath, 'utf8').trim();
  assert.ok(raw.length > 0, `${filePath} is empty`);
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split('\t');
  const rows = lines.map((line, rowIndex) => {
    const cells = line.split('\t');
    assert.equal(cells.length, headers.length, `${filePath} row ${rowIndex + 2} has wrong column count`);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
  return { headers, rows };
}

test('flashcard manifest exists and has lessons', () => {
  assert.ok(existsSync(manifestPath), 'flashcard/data/manifest.json must exist');
  const manifest = readJson(manifestPath);
  assert.ok(Array.isArray(manifest.courses), 'manifest.courses must be an array');
  assert.ok(manifest.courses.length > 0, 'manifest must contain at least one course');

  const lessons = manifest.courses.flatMap(course => course.lessons || []);
  assert.ok(lessons.length > 0, 'manifest must contain lessons');

  for (const lesson of lessons) {
    assert.ok(lesson.id, 'lesson.id is required');
    assert.ok(lesson.title, `${lesson.id} title is required`);
    assert.ok(lesson.path, `${lesson.id} path is required`);
    assert.ok(Number.isInteger(lesson.count), `${lesson.id} count must be an integer`);
  }
});

test('all lesson TSV files exist and match manifest counts', () => {
  const manifest = readJson(manifestPath);
  const lessons = manifest.courses.flatMap(course => course.lessons || []);

  for (const lesson of lessons) {
    const lessonPath = path.resolve(flashcardDir, lesson.path.replace(/^\.\//, ''));
    assert.ok(lessonPath.startsWith(flashcardDir), `${lesson.id} path must stay inside flashcard/`);
    assert.ok(existsSync(lessonPath), `${lesson.id} TSV missing: ${lesson.path}`);

    const { headers, rows } = readTsv(lessonPath);
    for (const header of requiredHeaders) {
      assert.ok(headers.includes(header), `${lesson.id} missing TSV header: ${header}`);
    }
    assert.equal(rows.length, lesson.count, `${lesson.id} row count must match manifest count`);

    rows.forEach((row, i) => {
      assert.ok(row.no, `${lesson.id} row ${i + 2} no is required`);
      assert.ok(row.front, `${lesson.id} row ${i + 2} front is required`);
      assert.ok(row.reading, `${lesson.id} row ${i + 2} reading is required`);
      assert.ok(row.meaning_vi, `${lesson.id} row ${i + 2} meaning_vi is required`);
    });
  }
});
