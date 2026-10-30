const changeMessageButton = document.querySelector("#change-message");
const demoMessage = document.querySelector("#demo-message");

changeMessageButton.addEventListener("click", () => {
  demoMessage.textContent = "DOM оновлено JavaScript!";
  demoMessage.classList.toggle("is-highlighted");
});

const topics = ["DOM", "Події", "Масиви"];
const topicList = document.querySelector("#topic-list");
const topicCount = document.querySelector("#topic-count");
const topicStatus = document.querySelector("#topic-status");

function renderTopics() {
  topicList.replaceChildren();

  for (const topic of topics) {
    const item = document.createElement("li");
    item.textContent = topic;
    topicList.append(item);
  }

  topicCount.textContent = `У списку ${topics.length} тем.`;
}

document.querySelector("#topic-add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const topicName = String(formData.get("topic")).trim();

  if (!topicName) {
    topicStatus.textContent = "Введіть назву теми.";
    return;
  }

  if (
    topics.some(
      (topic) =>
        topic.toLocaleLowerCase("uk") === topicName.toLocaleLowerCase("uk"),
    )
  ) {
    topicStatus.textContent = `Тема «${topicName}» вже є у списку.`;
    return;
  }

  topics.push(topicName);
  renderTopics();
  form.reset();
  topicStatus.textContent = `Тему «${topicName}» додано.`;
});

document.querySelector("#topic-remove-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const topicName = String(formData.get("topic")).trim();
  const topicIndex = topics.findIndex(
    (topic) => topic.toLocaleLowerCase("uk") === topicName.toLocaleLowerCase("uk"),
  );

  if (topicIndex === -1) {
    topicStatus.textContent = `Тему «${topicName}» не знайдено. Перевірте назву.`;
    return;
  }

  const [removedTopic] = topics.splice(topicIndex, 1);
  renderTopics();
  form.reset();
  topicStatus.textContent = `Тему «${removedTopic}» видалено зі списку.`;
});
renderTopics();

function createGreeting(name) {
  return `Привіт, ${name}!`;
}

document.querySelector("#greeting-examples").textContent = [
  createGreeting("Оля"),
  createGreeting("Тарас"),
].join(" ");

const lessonDialog = document.querySelector("#lesson-dialog");
document.querySelector("#open-dialog").addEventListener("click", () => {
  lessonDialog.showModal();
});
document.querySelector("#close-dialog").addEventListener("click", () => {
  lessonDialog.close();
});

const encryptionForm = document.querySelector("#encryption-form");
const encryptionStatus = document.querySelector("#encryption-status");
const encryptionResult = document.querySelector(".js-encryption-result");
const ciphertextOutput = document.querySelector("#ciphertext-output");
const decryptedOutput = document.querySelector("#decrypted-output");

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

encryptionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(encryptionForm);
  const text = String(formData.get("text")).trim();
  const submitButton = encryptionForm.querySelector('button[type="submit"]');

  if (!text) {
    encryptionStatus.textContent = "Введіть тестовий текст для демонстрації.";
    return;
  }

  if (!globalThis.crypto?.subtle) {
    encryptionStatus.textContent =
      "Web Crypto API недоступне. Відкрийте сторінку через HTTPS або localhost.";
    return;
  }

  submitButton.disabled = true;
  encryptionResult.hidden = true;
  encryptionStatus.textContent = "Шифрування тестового тексту...";

  try {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedText,
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    ciphertextOutput.textContent = JSON.stringify(
      {
        algorithm: "AES-GCM",
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      },
      null,
      2,
    );
    decryptedOutput.textContent = new TextDecoder().decode(decrypted);
    encryptionResult.hidden = false;
    encryptionStatus.textContent =
      "Готово. Шифрування та розшифрування виконані локально у вашому браузері.";
  } catch (error) {
    encryptionStatus.textContent = `Не вдалося виконати демонстрацію: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#clear-encryption").addEventListener("click", () => {
  encryptionForm.reset();
  ciphertextOutput.textContent = "";
  decryptedOutput.textContent = "";
  encryptionResult.hidden = true;
  encryptionStatus.textContent = "Результат і тестовий текст очищено.";
});

const noteForm = document.querySelector("#note-form");
const notesList = document.querySelector("#notes-list");
const notesStatus = document.querySelector("#notes-status");

function renderNotes(notes) {
  notesList.replaceChildren();

  for (const note of notes) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const text = document.createElement("p");
    const date = document.createElement("time");
    const removeButton = document.createElement("button");

    title.textContent = note.title;
    text.textContent = note.text;
    date.dateTime = note.createdAt;
    date.textContent = new Date(note.createdAt).toLocaleString("uk-UA");
    removeButton.type = "button";
    removeButton.className = "js-delete-note";
    removeButton.dataset.noteId = note.id;
    removeButton.textContent = "Видалити запис";
    item.append(title, text, date, removeButton);
    notesList.append(item);
  }
}

async function loadNotes() {
  notesStatus.textContent = "Завантаження записів...";

  const response = await fetch("/api/notes");
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити записи (HTTP ${response.status}).`);
  }

  const notes = await response.json();
  renderNotes(notes);
  notesStatus.textContent = notes.length
    ? `Завантажено записів: ${notes.length}.`
    : "Записів поки немає. Додайте першу нотатку.";
}

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(noteForm);
  const submitButton = noteForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  notesStatus.textContent = "Збереження запису...";

  try {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"),
        text: formData.get("text"),
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? `Помилка збереження (HTTP ${response.status}).`);
    }

    renderNotes(result);
    noteForm.reset();
    notesStatus.textContent = "Запис збережено у data/notes.json.";
  } catch (error) {
    notesStatus.textContent = `Не вдалося зберегти запис: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#reload-notes").addEventListener("click", async () => {
  try {
    await loadNotes();
  } catch (error) {
    notesStatus.textContent = `Не вдалося завантажити записи: ${error.message}`;
  }
});

notesList.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button.js-delete-note");
  if (!button) {
    return;
  }

  button.disabled = true;
  notesStatus.textContent = "Видалення запису...";

  try {
    const response = await fetch(
      `/api/notes/${encodeURIComponent(button.dataset.noteId)}`,
      { method: "DELETE" },
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? `Помилка видалення (HTTP ${response.status}).`);
    }

    renderNotes(result);
    notesStatus.textContent = "Запис видалено з data/notes.json.";
  } catch (error) {
    button.disabled = false;
    notesStatus.textContent = `Не вдалося видалити запис: ${error.message}`;
  }
});

loadNotes().catch((error) => {
  notesStatus.textContent = `JSON API недоступне: ${error.message} Запустіть node server.js і відкрийте сайт через локальний сервер.`;
});
